const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');
const dns = require('dns');
const PDFDocument = require('pdfkit');

try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  console.error('Erro ao configurar ordem padrão de resultados DNS:', e);
}

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_AUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
};

const GOOGLE_AUTH_SCOPE = [
  'openid',
  'email',
  'profile'
].join(' ');

const googleAuthStates = new Map();

function isGoogleAuthEnabled() {
  return Boolean(
    GOOGLE_AUTH_CONFIG.clientId &&
    GOOGLE_AUTH_CONFIG.clientSecret
  );
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function getGoogleRedirectUri(req) {
  if (GOOGLE_AUTH_CONFIG.redirectUri) return GOOGLE_AUTH_CONFIG.redirectUri;
  return `${getBaseUrl(req)}/api/auth/google/callback`;
}

function makeGoogleInitials(name, email) {
  const source = String(name || email || '').trim();
  if (!source) return 'GU';
  const parts = source.split(' ').filter(Boolean);
  if (!parts.length) return source.slice(0, 2).toUpperCase();
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function setGoogleAuthState(state, payload) {
  googleAuthStates.set(state, { ...payload, createdAt: Date.now() });
}

function getGoogleAuthState(state) {
  const value = googleAuthStates.get(state);
  if (!value) return null;
  if (Date.now() - value.createdAt > (10 * 60 * 1000)) {
    googleAuthStates.delete(state);
    return null;
  }
  return value;
}

function deleteGoogleAuthState(state) {
  googleAuthStates.delete(state);
}

// ─── Email setup ──────────────────────────────────────────────────────────────

const EMAIL_CONFIG_FILE = path.join(__dirname, 'data', 'email-config.json');

function loadEmailConfig() {
  try {
    if (fs.existsSync(EMAIL_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf8'));
    }
  } catch (e) { console.error('Erro ao carregar config de email:', e); }
  return { enabled: false, host: '', port: 587, secure: false, user: '', pass: '', from: '' };
}

function saveEmailConfig(config) {
  try {
    const dir = path.dirname(EMAIL_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) { console.error('Erro ao salvar config de email:', e); }
}

let emailConfig = loadEmailConfig();

function createTransporter(resolvedHost) {
  if (!emailConfig.enabled || !emailConfig.host || !emailConfig.user) return null;

  const hostToUse = resolvedHost || emailConfig.host;

  return nodemailer.createTransport({
    host: hostToUse,
    port: Number(emailConfig.port) || 587,
    secure: emailConfig.secure || false,
    auth: { user: emailConfig.user, pass: emailConfig.pass },
    requireTLS: !emailConfig.secure,
    tls: {
      servername: emailConfig.host
    },
    family: 4
  });
}

async function sendEmail({ to, subject, html, attachments }) {
  if (!emailConfig.enabled || !emailConfig.host || !emailConfig.user) {
    return { success: false, reason: 'Email não configurado' };
  }

  let resolvedHost = null;
  try {
    const lookup = await dns.promises.lookup(emailConfig.host, { family: 4 });
    resolvedHost = lookup?.address || null;
  } catch (e) {
    console.warn('DNS IPv4 lookup falhou, usando host original:', e.message);
  }

  const transporter = createTransporter(resolvedHost);
  if (!transporter) return { success: false, reason: 'Email não configurado' };

  try {
    await transporter.sendMail({
      from: emailConfig.from || emailConfig.user,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments: Array.isArray(attachments) ? attachments : undefined
    });
    return { success: true };
  } catch (e) {
    console.error('Erro ao enviar email:', e);
    return { success: false, reason: e.message };
  }
}

/* ── Email template helpers ─────────────────────────────────────────────── */

function getUsersRegistry() {
  try {
    return Array.isArray(users) ? users : [];
  } catch { return []; }
}

function getMemberEmails(meeting) {
  if (!meeting || !Array.isArray(meeting.members) || !meeting.members.length) return [];

  const registry = getUsersRegistry();
  const recipients = new Set();

  meeting.members.forEach((memberKey) => {
    const normalized = normalizeUserKey(memberKey);
    if (!normalized) return;

    const user = registry.find((u) => normalizeUserKey(u && u.initials) === normalized);
    const email = String((user && user.email) || '').trim().toLowerCase();
    if (email) recipients.add(email);
  });

  return Array.from(recipients);
}

function getParticipantEmails(meeting) {
  if (!meeting) return [];

  const keys = new Set([
    ...((Array.isArray(meeting.members) && meeting.members) ? meeting.members : []),
    ...((Array.isArray(meeting.presentMembers) && meeting.presentMembers) ? meeting.presentMembers : [])
  ]);

  if (!keys.size) return [];

  const registry = getUsersRegistry();
  const recipients = new Set();

  keys.forEach((memberKey) => {
    const resolved = resolveMemberKey(memberKey);
    const normalized = normalizeUserKey(resolved || memberKey);
    if (!normalized) return;

    const user = registry.find((u) => normalizeUserKey(u && u.initials) === normalized);
    const email = String((user && user.email) || '').trim().toLowerCase();
    if (email) recipients.add(email);
  });

  return Array.from(recipients);
}

function buildMeetingCreatedHtml(meeting) {
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  const timeLabel = meeting.time || '-';

  const registry = getUsersRegistry();

  // Resolve responsável para nome completo quando possível
  const responsibleKey = meeting.responsible || '';
  const responsibleName = (() => {
    if (!responsibleKey) return '-';
    const normKey = normalizeUserKey(responsibleKey);
    const found = registry.find(u =>
      normalizeUserKey(u && u.initials) === normKey ||
      normalizeUserKey(u && u.id) === normKey ||
      normalizeUserKey(u && u.email) === normKey
    );
    return (found && found.name) || responsibleKey;
  })();

  // Resolve membros para nomes quando possível
  const membersNames = (Array.isArray(meeting.members) ? meeting.members : []).map(mk => {
    const normKey = normalizeUserKey(mk);
    const found = registry.find(u =>
      normalizeUserKey(u && u.initials) === normKey ||
      normalizeUserKey(u && u.id) === normKey ||
      normalizeUserKey(u && u.email) === normKey
    );
    return (found && found.name) || mk;
  }).join(', ') || '-';

  const primary = '#2187ab';
  const textMain = '#111827';
  const textMuted = '#6b7280';

  return `
    <div style="margin:0;padding:26px 0;background:#f3f4f6;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 18px 45px rgba(15,23,42,0.08);overflow:hidden;">
        <div style="padding:28px 20px 18px;text-align:center;">
          <div style="font-size:28px;font-weight:800;letter-spacing:0.02em;color:${primary};text-align:center;"></div>
        </div>

        <div style="padding:18px 34px 30px;">
          <div style="text-align:center;">
            <div style="font-size:18px;color:${textMain};line-height:1.4;margin:0 auto 10px;max-width:620px;">
              Nova reunião agendada: <span style="color:${primary};font-weight:700;">${meeting.name || 'Reunião'}</span>
            </div>
            <div style="font-size:13px;color:${textMuted};margin:0 auto 18px;max-width:620px;">Confira os detalhes abaixo.</div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:${textMuted};width:170px;">Data</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${dateLabel}</td></tr>
            <tr><td style="padding:8px 0;color:${textMuted};">Horário</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${timeLabel}</td></tr>
            <tr><td style="padding:8px 0;color:${textMuted};">Duração</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${meeting.duration || '-'}</td></tr>
            <tr><td style="padding:8px 0;color:${textMuted};">Tipo</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${meeting.type || '-'}</td></tr>
            <tr><td style="padding:8px 0;color:${textMuted};">Responsável</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${responsibleName}</td></tr>
            <tr><td style="padding:8px 0;color:${textMuted};">Membros</td><td style="padding:8px 0;color:${textMain};font-weight:600;">${membersNames}</td></tr>
          </table>

          ${meeting.description ? `<div style="margin-top:16px;color:${textMuted};font-size:13px;line-height:1.5;">${meeting.description}</div>` : ''}
        </div>

        <div style="padding:14px 24px 18px;border-top:1px solid #edf2f7;font-size:12px;color:${textMuted};text-align:center;">
          Este email foi enviado automaticamente.
        </div>
      </div>
    </div>
  `;
}

function getOrbitaLogoPngBuffer() {
  try {
    const logoPath = path.join(ROOT_DIR);
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.warn('Não foi possível carregar:', e.message);
  }
  return null;
}

function buildMeetingCompletedHtml(meeting, options = {}) {
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  const timeLabel = meeting.time || '-';

  const durationSecs = meeting.actualDurationSeconds;
  let durationLabel = meeting.duration || '-';
  if (Number.isFinite(Number(durationSecs))) {
    const hrs = Math.floor(durationSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((durationSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(durationSecs % 60).toString().padStart(2, '0');
    durationLabel = `${hrs}:${mins}:${secs}`;
  }

  const primary = '#2187ab';
  const textMain = '#111827';
  const textMuted = '#6b7280';
  const baseUrl = options.baseUrl || '';
  const meetingLink = options.meetingLink || baseUrl || '#';

  // NÃO ENVIA IMAGEM, só o nome estilizado
  return `
    <div style="margin:0;padding:26px 0;background:#f3f4f6;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 18px 45px rgba(15,23,42,0.08);overflow:hidden;">
        <div style="padding:28px 20px 18px;text-align:center;">
          <div style="font-size:28px;font-weight:800;letter-spacing:0.02em;color:${primary};text-align:center;"></div>
        </div>

        <div style="padding:18px 34px 30px;">
          <div style="text-align:center;">
            <div style="font-size:18px;color:${textMain};line-height:1.4;margin:0 auto 10px;max-width:620px;">
              A Reunião <span style="color:${primary};font-weight:700;">${meeting.name || 'Reunião'}</span>
              do dia <span style="color:${primary};font-weight:700;">${dateLabel}</span>
              às <span style="color:${primary};font-weight:700;">${timeLabel}</span> foi finalizada!
            </div>
            <div style="font-size:13px;color:${textMuted};margin:0 auto 18px;max-width:620px;">
              Duração: <span style="color:${textMain};font-weight:600;">${durationLabel}</span>.
              A ata desta reunião está em anexo em PDF.
            </div>
            <div style="margin-top:18px;">
              <a href="${meetingLink}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:700;font-size:14px;">
                Ver Reunião
              </a>
            </div>
            <div style="margin-top:16px;font-size:12px;color:${textMuted};">
              Ou acesse o link para ver a reunião: <a href="${meetingLink}" style="color:${primary};">${meetingLink}</a>
            </div>
          </div>
        </div>

        <div style="padding:14px 24px 18px;border-top:1px solid #edf2f7;font-size:12px;color:${textMuted};text-align:center;">
          Este email foi enviado automaticamente.
        </div>
      </div>
    </div>
  `;
}

function buildAtaPdfBuffer(meeting) {
  const primary = '#2187ab';
  const textMain = '#111827';
  const textMuted = '#6b7280';

  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  const timeLabel = meeting.time || '-';

  const durationSecs = meeting.actualDurationSeconds;
  let actualDurationLabel = '';
  if (Number.isFinite(Number(durationSecs))) {
    const hrs = Math.floor(durationSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((durationSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(durationSecs % 60).toString().padStart(2, '0');
    actualDurationLabel = `${hrs}:${mins}:${secs}`;
  }

  const highlights = Array.isArray(meeting.highlights) ? meeting.highlights : [];
  const pautas = Array.isArray(meeting.pautas) ? meeting.pautas : [];
  const tasks = Array.isArray(meeting.tasks) ? meeting.tasks : [];
  const presentMembers = Array.isArray(meeting.presentMembers) && meeting.presentMembers.length
    ? meeting.presentMembers
    : (Array.isArray(meeting.members) ? meeting.members : []);

  const userDirectory = (meeting && meeting.userDirectory && typeof meeting.userDirectory === 'object')
    ? meeting.userDirectory
    : {};

  const resolveUserName = (key) => {
    const k = normalizeUserKey(key);
    if (!k) return '-';
    if (userDirectory && userDirectory[k]) return String(userDirectory[k]);
    try {
      const u = Array.isArray(users) ? users.find(x => normalizeUserKey(x && x.initials) === k) : null;
      if (u && u.name) return String(u.name);
    } catch {}
    return String(key);
  };

  const unit = meeting.unit || '-';
  const department = meeting.department || '-';
  const responsible = resolveUserName(meeting.responsible || '-');

  const logoBuf = getOrbitaLogoPngBuffer();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const left = doc.page.margins.left;
      const right = pageWidth - doc.page.margins.right;
      const contentWidth = right - left;



      doc
        .fillColor(textMain)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(meeting.name || 'Reunião', left, brandY + 42, { width: contentWidth });

      // Meta row
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textMuted);

      const metaY = brandY + 72;
      doc.text(`UNIDADE`, left, metaY);
      doc.text(`DEPARTAMENTO`, left + 170, metaY);
      doc.text(`RESPONSÁVEL`, left + 340, metaY);

      doc
        .font('Helvetica-Bold')
        .fillColor(textMain)
        .text(String(unit), left, metaY + 14, { width: 160 })
        .text(String(department), left + 170, metaY + 14, { width: 160 })
        .text(String(responsible), left + 340, metaY + 14, { width: 180 });

      // Date/time/duration row
      const infoY = metaY + 42;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textMuted)
        .text(`DATA`, left, infoY)
        .text(`HORA`, left + 170, infoY)
        .text(`DURAÇÃO`, left + 340, infoY);

      doc
        .font('Helvetica-Bold')
        .fillColor(textMain)
        .text(dateLabel, left, infoY + 14, { width: 160 })
        .text(timeLabel, left + 170, infoY + 14, { width: 160 })
        .text(actualDurationLabel || meeting.duration || '-', left + 340, infoY + 14, { width: 180 });

      // Start sections (sem linha antes de "Destaques")
      const startY = infoY + 44;
      let y = startY + 10;

      const sectionTitle = (title, opts = {}) => {
        if (!opts.isFirst) y += 8;
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(textMuted)
          .text(title.toUpperCase(), left, y);
        y += 12;
        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .lineWidth(1)
          .strokeColor('#e5e7eb')
          .stroke();
        y += 14;
      };

      const list = (items, mapFn) => {
        if (!items.length) {
          doc.font('Helvetica').fontSize(10).fillColor(textMuted).text('Sem registros', left, y);
          y += 22;
          return;
        }

        items.forEach((it) => {
          const mapped = mapFn(it);
          if (!mapped) return;
          const text = typeof mapped === 'string' ? mapped : mapped.text;
          if (!text) return;

          const dotColor = (typeof mapped === 'object' && mapped.dotColor) ? mapped.dotColor : primary;
          const bulletX = left;
          const textX = left + 14;
          doc
            .fillColor(dotColor)
            .circle(bulletX + 4, y + 6, 3)
            .fill();
          doc
            .fillColor(textMain)
            .font('Helvetica')
            .fontSize(11)
            .text(text, textX, y, { width: contentWidth - 14 });
          y = doc.y + 10;

          if (y > doc.page.height - 90) {
            doc.addPage();
            y = doc.page.margins.top;
          }
        });

        y += 6;
      };

      // Destaques
      sectionTitle('Destaques', { isFirst: true });
      list(highlights, (h) => {
        if (!h || !h.text) return '';
        return {
          text: String(h.text),
          dotColor: h.checked ? primary : '#9ca3af'
        };
      });

      // Pautas pendentes
      sectionTitle('Pautas pendentes');
      list((pautas || []).filter(p => p && !p.checked), (p) => {
        if (!p) return '';
        const title = p.text ? String(p.text) : '';
        const desc = p.description ? ` — ${String(p.description)}` : '';
        return {
          text: `${title}${desc}`.trim(),
          dotColor: '#f97316'
        };
      });

      // Tarefas
      sectionTitle('Tarefas');
      list(tasks, (t) => {
        if (!t || !t.text) return '';
        return {
          text: String(t.text),
          dotColor: t.checked ? primary : '#f97316'
        };
      });

      // Participantes
      sectionTitle(`${presentMembers.length || 0} membros presentes nesta reunião`);
      if (presentMembers.length) {
        presentMembers.forEach((m) => {
          doc
            .fillColor(textMain)
            .font('Helvetica')
            .fontSize(11)
            .text(resolveUserName(m), left, y, { width: contentWidth });
          y += 18;
          if (y > doc.page.height - 90) {
            doc.addPage();
            y = doc.page.margins.top;
          }
        });
      } else {
        doc.font('Helvetica').fontSize(10).fillColor(textMuted).text('Sem registros', left, y);
        y += 22;
      }

      // Footer
      doc
        .fontSize(9)
        .fillColor(textMuted)
        .text('Gerado automaticamente .', left, doc.page.height - 60, { width: contentWidth, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function buildTaskNotificationHtml(meeting, task) {
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1b2a; color: #e0e6ed; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #3a7d44, #2d6235); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 22px; color: #fff;"></h1>
        <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Nova tarefa atribuída</p>
      </div>
      <div style="padding: 28px 32px;">
        <p style="margin:0 0 8px;color:#8a9ab5;font-size:13px;">Reunião: <strong style="color:#e0e6ed;">${meeting.name || ''}</strong> (${dateLabel})</p>
        <div style="padding:12px 16px;background:rgba(27,38,59,0.5);border-radius:8px;border-left:3px solid #3a7d44;margin:12px 0;font-size:14px;">
          ${task.text || ''}
        </div>
      </div>
      <div style="padding: 16px 32px; border-top: 1px solid #1b2b43; font-size: 12px; color: #485a75;">
        Este email foi enviado automaticamente.
      </div>
    </div>
  `;
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '120mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const ROOT_DIR = path.join(__dirname, '..');
app.get([], (req, res) => {
  res.sendFile(path.join(ROOT_DIR));
});

app.get([], (req, res) => {
  res.sendFile(path.join(ROOT_DIR));
});

// ─── Dados em memória ─────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
const MEETINGS_FILE = path.join(DATA_DIR, 'meetings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadMeetingsFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MEETINGS_FILE)) {
      fs.writeFileSync(MEETINGS_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(MEETINGS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Erro ao carregar reuniões do disco:', e);
    return [];
  }
}

function saveMeetingsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MEETINGS_FILE, JSON.stringify(meetings, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar reuniões no disco:', e);
  }
}

let meetings = loadMeetingsFromDisk();
let nextNotifId = 1;

const DEFAULT_USERS = [
  { id: 'u1', name: 'Gabriel M.', initials: 'GM', email: '', role: 'admin' },
  { id: 'u2', name: 'Ana Costa', initials: 'AC', email: '', role: 'usuario' },
  { id: 'u3', name: 'Lucas P.', initials: 'LP', email: '', role: 'usuario' },
  { id: 'u4', name: 'Mariana L.', initials: 'ML', email: '', role: 'usuario' },
  { id: 'u5', name: 'Rafael O.', initials: 'RO', email: '', role: 'usuario' },
];

function sanitizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const id = String(rawUser.id || '').trim();
  const initials = normalizeUserKey(rawUser.initials);
  if (!id || !initials) return null;

  return {
    id,
    name: String(rawUser.name || initials).trim() || initials,
    initials,
    email: String(rawUser.email || '').trim().toLowerCase(),
    role: String(rawUser.role || 'usuario').trim() || 'usuario'
  };
}

function loadUsersFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf8');
      return [...DEFAULT_USERS];
    }

    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [...DEFAULT_USERS];

    const sanitized = parsed.map(sanitizeUser).filter(Boolean);
    return sanitized.length ? sanitized : [...DEFAULT_USERS];
  } catch (e) {
    console.error('Erro ao carregar usuários do disco:', e);
    return [...DEFAULT_USERS];
  }
}

function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar usuários no disco:', e);
  }
}

let users = loadUsersFromDisk();

let notifications = [];

function normalizeUserKey(raw) {
  if (!raw) return '';
  return String(raw).trim().toUpperCase();
}

function resolveMemberKey(raw) {
  const key = normalizeUserKey(raw);
  if (!key) return '';

  const byInitials = Array.isArray(users)
    ? users.find(u => normalizeUserKey(u && u.initials) === key)
    : null;
  if (byInitials && byInitials.initials) return normalizeUserKey(byInitials.initials);

  const byEmail = Array.isArray(users)
    ? users.find(u => normalizeUserKey(u && u.email) === key)
    : null;
  if (byEmail && byEmail.initials) return normalizeUserKey(byEmail.initials);

  const byId = Array.isArray(users)
    ? users.find(u => normalizeUserKey(u && u.id) === key)
    : null;
  if (byId && byId.initials) return normalizeUserKey(byId.initials);

  return key;
}

function isMeetingVisibleForUser(meeting, userKey) {
  const resolvedUserKey = resolveMemberKey(userKey);
  if (!resolvedUserKey) return true;
  const members = Array.isArray(meeting.members) ? meeting.members : [];
  return members.map(m => normalizeUserKey(m)).includes(resolvedUserKey);
}

function getVisibleNotifications(userKey) {
  const resolvedUserKey = resolveMemberKey(userKey);
  if (!resolvedUserKey) {
    return notifications;
  }
  return notifications.filter(n => {
    if (!Array.isArray(n.recipients) || !n.recipients.length) return true;
    return n.recipients.map(r => normalizeUserKey(r)).includes(resolvedUserKey);
  });
}

function markNotificationReadForUser(notification, userKey) {
  const resolvedUserKey = resolveMemberKey(userKey);
  if (!notification || !resolvedUserKey) return;
  if (!Array.isArray(notification.readBy)) notification.readBy = [];
  if (!notification.readBy.includes(resolvedUserKey)) notification.readBy.push(resolvedUserKey);
}

function toNotificationView(notification, userKey) {
  const resolvedUserKey = resolveMemberKey(userKey);
  const isRead = userKey
    ? (Array.isArray(notification.readBy) && notification.readBy.includes(resolvedUserKey))
    : !!notification.read;

  return {
    ...notification,
    read: isRead
  };
}

function canAccessMeeting(req, meeting) {
  const userKey = resolveMemberKey(req.query.user);
  if (!userKey) return true;
  return isMeetingVisibleForUser(meeting, userKey);
}

function isMeetingResponsibleForUser(req, meeting) {
  const userKey = resolveMemberKey(req.query.user);
  if (!userKey) return true;
  const responsible = normalizeUserKey(meeting && meeting.responsible);
  return responsible === userKey;
}

function getRequestUserKey(req, meeting) {
  return resolveMemberKey(req.query.user) || normalizeUserKey(meeting && meeting.responsible) || 'GM';
}

// ─── Rotas: Reuniões ──────────────────────────────────────────────────────────

// Listar todas
app.get('/api/meetings', (req, res) => {
  const { type, status, search, user } = req.query;
  const userKey = resolveMemberKey(user);
  let result = [...meetings];

  if (userKey) {
    result = result.filter(m => isMeetingVisibleForUser(m, userKey));
  }

  if (type) result = result.filter(m => m.type === type);
  if (status) result = result.filter(m => m.status === status);
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(m =>
      m.name.toLowerCase().includes(term) ||
      (m.description && m.description.toLowerCase().includes(term))
    );
  }

  // Ordenar por data
  result.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

  res.json(result);
});

// Obter uma
app.get('/api/meetings/:id', (req, res) => {
  const userKey = resolveMemberKey(req.query.user);
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (userKey && !isMeetingVisibleForUser(meeting, userKey)) {
    return res.status(403).json({ error: 'Sem permissão para visualizar esta reunião' });
  }
  res.json(meeting);
});

// Criar
app.post('/api/meetings', (req, res) => {
  const { name, description, date, time, duration, type, members, recurrence, active, responsible, unit, department, indic, plan, userDirectory } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome da reunião é obrigatório' });
  }

  const normalizedMembers = Array.isArray(members) && members.length
    ? members
    : [responsible || 'GM'];

  const newMeeting = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description || '',
    date: date || new Date().toISOString().split('T')[0],
    time: time || '09:00',
    duration: duration || '1h',
    type: type || 'Gerencial',
    unit: unit || '',
    department: department || '',
    indic: indic || '',
    plan: plan || '',
    userDirectory: (userDirectory && typeof userDirectory === 'object') ? userDirectory : {},
    members: normalizedMembers,
    responsible: responsible || normalizedMembers[0] || 'GM',
    status: 'not_started',
    recurrence: recurrence || 'never',
    active: active !== undefined ? active : true,
    highlights: [],
    tasks: [],
    notes: [],
    attachments: [],
    createdAt: new Date().toISOString()
  };

  meetings.push(newMeeting);
  saveMeetingsToDisk();

  // Criar notificação
  notifications.push({
    id: nextNotifId++,
    title: 'Nova reunião criada',
    message: `A reunião "${newMeeting.name}" foi agendada.`,
    read: false,
    readBy: [],
    recipients: Array.isArray(newMeeting.members) ? newMeeting.members : [],
    type: 'meeting',
    createdAt: new Date().toISOString()
  });

  res.status(201).json(newMeeting);
});

// Atualizar
app.put('/api/meetings/:id', (req, res) => {
  const idx = meetings.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meetings[idx])) {
    return res.status(403).json({ error: 'Sem permissão para alterar esta reunião' });
  }

  const payload = { ...req.body };

  const restrictedFields = ['name', 'description', 'date', 'time', 'duration', 'type', 'unit', 'department', 'indic', 'plan', 'members', 'responsible', 'recurrence', 'active', 'userDirectory'];
  const isEditingMeetingData = restrictedFields.some(field => payload[field] !== undefined);
  const isEditingWorkItems = payload.tasks !== undefined || payload.notes !== undefined || payload.attachments !== undefined || payload.pautas !== undefined;

  if (isEditingMeetingData && !isMeetingResponsibleForUser(req, meetings[idx])) {
    return res.status(403).json({ error: 'Somente o responsável pode editar os dados da reunião' });
  }

  if (isEditingWorkItems && !isMeetingResponsibleForUser(req, meetings[idx])) {
    return res.status(403).json({ error: 'Somente o responsável pode gerenciar itens sensíveis da reunião' });
  }

  if (
    payload.responsible === undefined &&
    Array.isArray(payload.members) &&
    payload.members.length
  ) {
    payload.responsible = payload.members[0];
  }

  if (payload.userDirectory && typeof payload.userDirectory === 'object') {
    const prevDir = (meetings[idx] && meetings[idx].userDirectory && typeof meetings[idx].userDirectory === 'object') ? meetings[idx].userDirectory : {};
    payload.userDirectory = { ...prevDir, ...payload.userDirectory };
  }

  meetings[idx] = { ...meetings[idx], ...payload, id: meetings[idx].id };
  saveMeetingsToDisk();
  res.json(meetings[idx]);
});

// Excluir
app.delete('/api/meetings/:id', (req, res) => {
  const idx = meetings.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meetings[idx])) {
    return res.status(403).json({ error: 'Sem permissão para excluir esta reunião' });
  }

  const removed = meetings.splice(idx, 1)[0];
  saveMeetingsToDisk();

  notifications.push({
    id: nextNotifId++,
    title: 'Reunião removida',
    message: `A reunião "${removed.name}" foi cancelada.`,
    read: false,
    readBy: [],
    recipients: Array.isArray(removed.members) ? removed.members : [],
    type: 'meeting',
    createdAt: new Date().toISOString()
  });

  res.json({ message: 'Reunião removida com sucesso' });
});

// Iniciar reunião
app.put('/api/meetings/:id/start', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  const userKey = resolveMemberKey(req.query.user);
  if (!userKey) return res.status(400).json({ error: 'Informe o usuário para iniciar a reunião' });
  if (!canAccessMeeting(req, meeting)) return res.status(403).json({ error: 'Sem permissão para iniciar esta reunião' });
  if (!isMeetingResponsibleForUser(req, meeting)) return res.status(403).json({ error: 'Somente o responsável pode iniciar esta reunião' });

  meeting.startedAt = new Date().toISOString();
  meeting.status = 'in_progress'; // Garante que o status está correto
  if (Array.isArray(req.body.presentMembers)) {
    meeting.presentMembers = req.body.presentMembers;
  }
  if (req.body && req.body.userDirectory && typeof req.body.userDirectory === 'object') {
    const prevDir = (meeting.userDirectory && typeof meeting.userDirectory === 'object') ? meeting.userDirectory : {};
    meeting.userDirectory = { ...prevDir, ...req.body.userDirectory };
  }
  saveMeetingsToDisk();
  res.json(meeting);
});

// Concluir reunião

app.put('/api/meetings/:id/complete', async (req, res) => {
  try {
    const meeting = meetings.find(m => m.id === req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
    if (!canAccessMeeting(req, meeting)) {
      return res.status(403).json({ error: 'Sem permissão para concluir esta reunião' });
    }

    meeting.status = 'completed';
    meeting.completedAt = new Date().toISOString();
    if (req.body && Number.isFinite(Number(req.body.durationSeconds))) {
      meeting.actualDurationSeconds = Number(req.body.durationSeconds);
    }

    saveMeetingsToDisk();

    // Adicione logs antes de cada etapa crítica
    notifications.push({
      id: nextNotifId++,
      title: 'Reunião finalizada',
      message: `A reunião "${meeting.name}" foi finalizada.`,
      read: false,
      readBy: [],
      recipients: Array.isArray(meeting.members) ? meeting.members : [],
      type: 'meeting',
      createdAt: new Date().toISOString()
    });
    
    try {
      const recipients = getParticipantEmails(meeting);
      if (!recipients.length) {
        return res.json({ ...meeting, emailSent: false, emailError: 'Nenhum email encontrado para os participantes' });
      }

      const baseUrl = getBaseUrl(req);
      const logoBuf = getOrbitaLogoPngBuffer();
      const logoCid = 'orbita-logo';
      const meetingLink = baseUrl;
      const html = buildMeetingCompletedHtml(meeting, {
        baseUrl,
        meetingLink,
        logoUrl: logoBuf ? `cid:${logoCid}` : ''
      });

      let pdfBuffer;
      try {
        pdfBuffer = await buildAtaPdfBuffer(meeting);
      } catch (e) {
        console.error('Erro ao gerar PDF da ata (auto):', e);
        return res.json({ ...meeting, emailSent: false, emailError: 'Falha ao gerar PDF da ata' });
      }

      const safeName = String(meeting.name || 'Reunião').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
      const pdfFilename = `Ata - ${safeName} - ${meeting.date || ''}.pdf`;
      const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      const subject = `Reunião finalizada: ${meeting.name || 'Reunião'} - ${dateLabel}`;

      const attachments = [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];

      const result = await sendEmail({ to: recipients, subject, html, attachments });
      if (result.success) return res.json({ ...meeting, emailSent: true });
      return res.json({ ...meeting, emailSent: false, emailError: result.reason || 'Falha ao enviar email' });
    
      
    } catch (e) {
      console.error('Erro no auto-envio de email no encerramento:', e);
      return res.json({ ...meeting, emailSent: false, emailError: e.message || 'Falha ao enviar email' });
    }
  } catch (e) {
    console.error('Erro inesperado ao finalizar reunião:', e);
    res.status(500).json({ error: 'Erro interno ao finalizar reunião', details: e.message });
  }
});

// ─── Rotas: Destaques (Highlights) ────────────────────────────────────────
app.get('/api/meetings/:id/highlights', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para visualizar destaques desta reunião' });
  }
  res.json(meeting.highlights || []);
});

app.post('/api/meetings/:id/highlights', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para criar destaque nesta reunião' });
  }
  if (!meeting.highlights) meeting.highlights = [];
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Texto é obrigatório' });
  const creator = getRequestUserKey(req, meeting);
  const highlight = {
    id: crypto.randomUUID(),
    text: text.trim(),
    checked: false,
    assignee: creator,
    createdAt: new Date().toISOString()
  };
  meeting.highlights.push(highlight);
  saveMeetingsToDisk();
  res.status(201).json(highlight);
});

app.put('/api/meetings/:id/highlights/:hid', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para editar destaque nesta reunião' });
  }
  const hl = (meeting.highlights || []).find(h => h.id === req.params.hid);
  if (!hl) return res.status(404).json({ error: 'Destaque não encontrado' });
  if (req.body.text !== undefined) hl.text = req.body.text;
  if (req.body.checked !== undefined) hl.checked = req.body.checked;
  if (req.body.assignee !== undefined) hl.assignee = req.body.assignee;
  saveMeetingsToDisk();
  res.json(hl);
});

app.delete('/api/meetings/:id/highlights/:hid', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para remover destaque nesta reunião' });
  }
  const idx = (meeting.highlights || []).findIndex(h => h.id === req.params.hid);
  if (idx === -1) return res.status(404).json({ error: 'Destaque não encontrado' });
  meeting.highlights.splice(idx, 1);
  saveMeetingsToDisk();
  res.json({ message: 'Destaque removido' });
});

// ─── Rotas: Pautas ───────────────────────────────────────────────────────────

app.get('/api/meetings/:id/pautas', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para visualizar pautas desta reunião' });
  }
  res.json(meeting.pautas || []);
});

app.post('/api/meetings/:id/pautas', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para criar pauta nesta reunião' });
  }

  const text = String(req.body.text || '').trim();
  const description = String(req.body.description || '').trim();
  if (!text) return res.status(400).json({ error: 'Texto da pauta é obrigatório' });

  if (!meeting.pautas) meeting.pautas = [];
  const pauta = {
    id: crypto.randomUUID(),
    text,
    description,
    checked: false,
    assignee: getRequestUserKey(req, meeting),
    createdAt: new Date().toISOString()
  };

  meeting.pautas.push(pauta);
  saveMeetingsToDisk();
  res.status(201).json(pauta);
});

app.put('/api/meetings/:id/pautas/:pid', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para editar pauta nesta reunião' });
  }

  const pauta = (meeting.pautas || []).find(p => p.id === req.params.pid);
  if (!pauta) return res.status(404).json({ error: 'Pauta não encontrada' });

  const userKey = getRequestUserKey(req, meeting);
  const ownerKey = normalizeUserKey(pauta.assignee);
  if (ownerKey !== userKey) {
    return res.status(403).json({ error: 'Somente o autor pode editar ou concluir esta pauta' });
  }

  if (req.body.text !== undefined) {
    pauta.text = String(req.body.text || '').trim();
  }
  if (req.body.description !== undefined) {
    pauta.description = String(req.body.description || '').trim();
  }
  if (req.body.checked !== undefined) {
    pauta.checked = !!req.body.checked;
  }

  saveMeetingsToDisk();
  res.json(pauta);
});

app.delete('/api/meetings/:id/pautas/:pid', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });
  if (!canAccessMeeting(req, meeting)) {
    return res.status(403).json({ error: 'Sem permissão para remover pauta nesta reunião' });
  }

  const idx = (meeting.pautas || []).findIndex(p => p.id === req.params.pid);
  if (idx === -1) return res.status(404).json({ error: 'Pauta não encontrada' });

  const pauta = meeting.pautas[idx];
  const userKey = getRequestUserKey(req, meeting);
  const ownerKey = normalizeUserKey(pauta.assignee);
  if (ownerKey !== userKey) {
    return res.status(403).json({ error: 'Somente o autor pode remover esta pauta' });
  }

  meeting.pautas.splice(idx, 1);
  saveMeetingsToDisk();
  res.json({ message: 'Pauta removida' });
});
// ─── Rotas: Usuários ──────────────────────────────────────────────────────────

app.get('/api/users', (req, res) => {
  const { email } = req.query;
  if (email) {
    const user = users.find(u => u.email === email);
    if (user) return res.json(user);
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  res.json(users);
});

app.put('/api/users/sync', (req, res) => {
  const incoming = Array.isArray(req.body && req.body.users) ? req.body.users : [];
  if (!incoming.length) {
    return res.json({ updated: 0, total: users.length });
  }

  let updated = 0;

  incoming.forEach((item) => {
    const user = sanitizeUser(item);
    if (!user) return;

    const idx = users.findIndex((u) => {
      if (u.id === user.id) return true;
      if (normalizeUserKey(u.initials) === user.initials) return true;
      const existingEmail = String(u.email || '').trim().toLowerCase();
      return !!(user.email && existingEmail && existingEmail === user.email);
    });

    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        name: user.name || users[idx].name,
        initials: user.initials || users[idx].initials,
        email: user.email || users[idx].email || '',
        role: user.role || users[idx].role || 'usuario',
        id: users[idx].id || user.id
      };
    } else {
      users.push(user);
    }

    updated += 1;
  });

  saveUsersToDisk();
  res.json({ updated, total: users.length });
});

// ─── Rotas: Notificações ──────────────────────────────────────────────────────

app.get('/api/notifications', (req, res) => {
  const userKey = resolveMemberKey(req.query.user);
  const visible = getVisibleNotifications(userKey)
    .map(n => toNotificationView(n, userKey))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(visible);
});

app.get('/api/notifications/unread-count', (req, res) => {
  const userKey = resolveMemberKey(req.query.user);
  const visible = getVisibleNotifications(userKey);
  const count = visible.filter(n => {
    if (!userKey) return !n.read;
    return !(Array.isArray(n.readBy) && n.readBy.includes(userKey));
  }).length;
  res.json({ count });
});

app.put('/api/notifications/:id/read', (req, res) => {
  const userKey = resolveMemberKey(req.query.user);
  const notif = notifications.find(n => n.id === parseInt(req.params.id));
  if (!notif) return res.status(404).json({ error: 'Notificação não encontrada' });

  if (userKey && Array.isArray(notif.recipients) && notif.recipients.length) {
    const allowed = notif.recipients.map(r => normalizeUserKey(r)).includes(userKey);
    if (!allowed) return res.status(403).json({ error: 'Sem permissão para esta notificação' });
  }

  if (userKey) {
    markNotificationReadForUser(notif, userKey);
  } else {
    notif.read = true;
  }

  res.json(toNotificationView(notif, userKey));
});

app.put('/api/notifications/read-all', (req, res) => {
  const userKey = resolveMemberKey(req.query.user);
  if (userKey) {
    getVisibleNotifications(userKey).forEach(n => markNotificationReadForUser(n, userKey));
  } else {
    notifications.forEach(n => n.read = true);
  }
  res.json({ message: 'Todas marcadas como lidas' });
});

// ─── Rotas: Auth Google ─────────────────────────────────────────────────────

app.get('/api/auth/google/status', (req, res) => {
  res.json({ enabled: isGoogleAuthEnabled() });
});

app.get('/api/auth/google/start', (req, res) => {
  if (!isGoogleAuthEnabled()) {
    return res.status(500).send('Google OAuth não configurado no servidor');
  }

  const mode = req.query.mode === 'register' ? 'register' : 'login';
  const state = crypto.randomUUID();
  const redirectUri = getGoogleRedirectUri(req);
  const origin = getBaseUrl(req);

  setGoogleAuthState(state, { mode, origin });

  const authParams = new URLSearchParams({
    client_id: GOOGLE_AUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_AUTH_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const stateData = getGoogleAuthState(state);

  const sendPopupResult = (type, payload, targetOrigin) => {
    const safePayload = JSON.stringify(payload || {});
    const safeOrigin = targetOrigin || '*';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body><script>
      (function(){
        var data = Object.assign({ type: ${JSON.stringify(type)} }, ${safePayload});
        if (window.opener) {
          window.opener.postMessage(data, ${JSON.stringify(safeOrigin)});
        }
        window.close();
      })();
    </script></body></html>`);
  };

  if (!stateData) {
    return sendPopupResult('google-auth-error', { message: 'Sessão de autenticação expirada. Tente novamente.' }, '*');
  }

  deleteGoogleAuthState(state);

  if (error) {
    return sendPopupResult('google-auth-error', { message: 'Autenticação com Google cancelada.' }, stateData.origin);
  }

  if (!code) {
    return sendPopupResult('google-auth-error', { message: 'Código de autorização inválido.' }, stateData.origin);
  }

  if (!isGoogleAuthEnabled()) {
    return sendPopupResult('google-auth-error', { message: 'Google OAuth não configurado no servidor.' }, stateData.origin);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_AUTH_CONFIG.clientId,
        client_secret: GOOGLE_AUTH_CONFIG.clientSecret,
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(errText || 'Falha ao obter token Google');
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Google não retornou access_token');
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      throw new Error(errText || 'Falha ao buscar perfil Google');
    }

    const profile = await userRes.json();
    const sessionPayload = {
      id: `google_${profile.sub || Date.now()}`,
      name: profile.name || profile.email || 'Usuário Google',
      email: profile.email || '',
      initials: makeGoogleInitials(profile.name, profile.email),
      provider: 'google'
    };

    return sendPopupResult('google-auth-success', { payload: sessionPayload }, stateData.origin);
  } catch (e) {
    console.error('Erro no callback Google OAuth:', e);
    return sendPopupResult('google-auth-error', { message: 'Falha ao autenticar com Google.' }, stateData.origin);
  }
});

// ─── Rotas: Email ─────────────────────────────────────────────────────────────

// Obter config de email (sem expor senha)
app.get('/api/email/config', (req, res) => {
  const cfg = { ...emailConfig };
  if (cfg.pass) cfg.pass = '••••••••';
  res.json(cfg);
});

// Salvar config de email
app.put('/api/email/config', (req, res) => {
  const { enabled, host, port, secure, user, pass, from } = req.body;
  emailConfig = {
    enabled: !!enabled,
    host: host || '',
    port: Number(port) || 587,
    secure: !!secure,
    user: user || '',
    pass: (pass && pass !== '••••••••') ? pass : emailConfig.pass,
    from: from || ''
  };
  saveEmailConfig(emailConfig);
  const cfg = { ...emailConfig };
  cfg.pass = cfg.pass ? '••••••••' : '';
  res.json(cfg);
});

// Testar config de email
app.post('/api/email/test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Informe o email de destino' });
  const result = await sendEmail({
    to,
    subject: 'Teste de configuração de email',
    html: `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1b2a;color:#e0e6ed;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#3a7d44,#2d6235);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#fff;"></h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-size:15px;">A configuração de email está funcionando corretamente!</p>
        </div>
      </div>
    `
  });
  if (result.success) {
    res.json({ message: 'Email de teste enviado com sucesso' });
  } else {
    res.status(500).json({ error: result.reason || 'Falha ao enviar email' });
  }
});

// Enviar email avulso
app.post('/api/email/send', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'Campos "to" e "subject" são obrigatórios' });
  const result = await sendEmail({ to, subject, html: html || '' });
  if (result.success) res.json({ message: 'Email enviado' });
  else res.status(500).json({ error: result.reason || 'Falha ao enviar' });
});

// Enviar ata por email
app.post('/api/email/send-ata/:id', async (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });

  const { to } = req.body;
  if (!to || (Array.isArray(to) && !to.length)) {
    return res.status(400).json({ error: 'Informe os destinatários' });
  }

  const baseUrl = getBaseUrl(req);
  const logoBuf = getOrbitaLogoPngBuffer();
  const logoCid = 'orbita-logo';
  const meetingLink = baseUrl;
  const html = buildMeetingCompletedHtml(meeting, {
    baseUrl,
    meetingLink,
    logoUrl: logoBuf ? `cid:${logoCid}` : ''
  });

  let pdfBuffer;
  try {
    pdfBuffer = await buildAtaPdfBuffer(meeting);
  } catch (e) {
    console.error('Erro ao gerar PDF da ata:', e);
    return res.status(500).json({ error: 'Falha ao gerar PDF da ata' });
  }

  const safeName = String(meeting.name || 'Reunião').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
  const pdfFilename = `Ata - ${safeName} - ${meeting.date || ''}.pdf`;
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const subject = `Reunião finalizada: ${meeting.name || 'Reunião'} - ${dateLabel}`;

  const attachments = [
    ...(logoBuf ? [{
      filename: 'orbita.png',
      content: logoBuf,
      cid: logoCid,
      contentType: 'image/png'
    }] : []),
    {
      filename: pdfFilename,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ];

  const result = await sendEmail({ to, subject, html, attachments });
  if (result.success) res.json({ message: 'Ata enviada por email' });
  else res.status(500).json({ error: result.reason || 'Falha ao enviar ata' });
});

// Pré-visualizar ata por email (sem envio)
app.get('/api/email/preview-ata/:id', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });

  const baseUrl = getBaseUrl(req);
  const meetingLink = baseUrl;
  const logoUrl = `${baseUrl}/%C3%93rbita.png`;
  const html = buildMeetingCompletedHtml(meeting, { baseUrl, meetingLink, logoUrl });
  res.json({ html });
});

app.get('/api/email/preview-ata-pdf/:id', async (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });

  try {
    const pdfBuffer = await buildAtaPdfBuffer(meeting);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ata.pdf"');
    res.end(pdfBuffer);
  } catch (e) {
    console.error('Erro ao gerar PDF preview:', e);
    res.status(500).json({ error: 'Falha ao gerar PDF' });
  }
});

// Notificar membros sobre nova reunião
app.post('/api/email/notify-meeting/:id', async (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunião não encontrada' });

  const { to } = req.body;
  const recipients = (Array.isArray(to) ? to : []).filter(Boolean);
  const memberRecipients = getParticipantEmails(meeting);
  const finalRecipients = Array.from(new Set([...(recipients || []), ...(memberRecipients || [])]));

  if (!finalRecipients.length) {
    return res.status(400).json({ error: 'Nenhum email encontrado para os membros da reunião' });
  }

  const html = buildMeetingCreatedHtml(meeting);
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const subject = `Nova reunião: ${meeting.name || 'Reunião'} - ${dateLabel}`;

  const result = await sendEmail({ to: finalRecipients, subject, html });
  if (result.success) res.json({ message: 'Notificação enviada' });
  else res.status(500).json({ error: result.reason || 'Falha ao enviar notificação' });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ Projeto rodando em http://localhost:${PORT}`);
});
