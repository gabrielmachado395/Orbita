/* ═══════════════════════════════════════════════════════════════════════════ */
/* Órbita - Email Module                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupEmail() {
  // Email config panel open/close
  const configOverlay = document.getElementById('emailConfigOverlay');
  const configPanel = document.getElementById('emailConfigPanel');
  const configClose = document.getElementById('emailConfigClose');

  if (configOverlay) configOverlay.addEventListener('click', closeEmailConfig);
  if (configClose) configClose.addEventListener('click', closeEmailConfig);

  // Save email config
  const saveBtn = document.getElementById('emailSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveEmailConfig);

  // Test email
  const testBtn = document.getElementById('emailTestBtn');
  if (testBtn) testBtn.addEventListener('click', testEmailConfig);

  // Send panel
  const sendOverlay = document.getElementById('emailSendOverlay');
  const sendClose = document.getElementById('emailSendClose');
  const sendCancel = document.getElementById('emailSendCancelBtn');
  const sendConfirm = document.getElementById('emailSendConfirmBtn');

  if (sendOverlay) sendOverlay.addEventListener('click', closeEmailSend);
  if (sendClose) sendClose.addEventListener('click', closeEmailSend);
  if (sendCancel) sendCancel.addEventListener('click', closeEmailSend);
  if (sendConfirm) sendConfirm.addEventListener('click', confirmEmailSend);

  // Ata email button
  const ataEmailBtn = document.getElementById('btnAtaEmail');
  if (ataEmailBtn) ataEmailBtn.addEventListener('click', openAtaEmailSend);

  const ataEmailPreviewBtn = document.getElementById('btnAtaEmailPreview');
  if (ataEmailPreviewBtn) ataEmailPreviewBtn.addEventListener('click', openAtaEmailPreview);

  // Email config from profile
  const emailConfigBtn = document.getElementById('btnEmailConfig');
  if (emailConfigBtn) {
    emailConfigBtn.addEventListener('click', () => {
      document.getElementById('profilePanel').classList.remove('open');
      document.getElementById('profileOverlay').classList.remove('open');
      openEmailConfig();
    });
  }
}

/* ── Email Config ──────────────────────────────────────────────────────── */

function openEmailConfig() {
  const overlay = document.getElementById('emailConfigOverlay');
  const panel = document.getElementById('emailConfigPanel');
  if (overlay) overlay.classList.add('open');
  if (panel) panel.classList.add('open');
  loadEmailConfig();
}

function closeEmailConfig() {
  const overlay = document.getElementById('emailConfigOverlay');
  const panel = document.getElementById('emailConfigPanel');
  if (overlay) overlay.classList.remove('open');
  if (panel) panel.classList.remove('open');
}

async function loadEmailConfig() {
  try {
    const res = await fetch(`${API}/api/email/config`);
    if (!res.ok) return;
    const cfg = await res.json();
    document.getElementById('emailEnabled').checked = !!cfg.enabled;
    document.getElementById('emailHost').value = cfg.host || '';
    document.getElementById('emailPort').value = cfg.port || 587;
    document.getElementById('emailSecure').checked = !!cfg.secure;
    document.getElementById('emailUser').value = cfg.user || '';
    document.getElementById('emailPass').value = cfg.pass || '';
    document.getElementById('emailFrom').value = cfg.from || '';
  } catch (e) {
    console.error('Erro ao carregar config email:', e);
  }
}

async function saveEmailConfig() {
  try {
    const payload = {
      enabled: document.getElementById('emailEnabled').checked,
      host: document.getElementById('emailHost').value.trim(),
      port: Number(document.getElementById('emailPort').value) || 587,
      secure: document.getElementById('emailSecure').checked,
      user: document.getElementById('emailUser').value.trim(),
      pass: document.getElementById('emailPass').value,
      from: document.getElementById('emailFrom').value.trim()
    };

    const res = await fetch(`${API}/api/email/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Erro ao salvar');
    showToast('Configuração de email salva', 'success');
    closeEmailConfig();
  } catch (e) {
    showToast(e.message || 'Erro ao salvar configuração', 'error');
  }
}

async function testEmailConfig() {
  const userEmail = document.getElementById('emailUser').value.trim();
  if (!userEmail) {
    showToast('Salve a configuração antes de testar', 'info');
    return;
  }

  // Save first
  await saveEmailConfig();

  try {
    const res = await fetch(`${API}/api/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: userEmail })
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Email de teste enviado com sucesso!', 'success');
    } else {
      showToast(data.error || 'Falha no teste', 'error');
    }
  } catch (e) {
    showToast('Erro ao testar email', 'error');
  }
}

/* ── Email Send ────────────────────────────────────────────────────────── */

let pendingEmailAction = null;

function openEmailSend(title, action) {
  const overlay = document.getElementById('emailSendOverlay');
  const panel = document.getElementById('emailSendPanel');
  const titleEl = document.getElementById('emailSendTitle');
  const toInput = document.getElementById('emailSendTo');

  if (titleEl) titleEl.textContent = title || 'Enviar email';
  if (toInput) toInput.value = '';

  // Pre-populate with member emails if we know them
  if (state.currentMeeting && state.currentMeeting.memberEmails) {
    toInput.value = state.currentMeeting.memberEmails.join(', ');
  }

  pendingEmailAction = action;

  if (overlay) overlay.classList.add('open');
  if (panel) panel.classList.add('open');
  if (toInput) toInput.focus();
}

function closeEmailSend() {
  const overlay = document.getElementById('emailSendOverlay');
  const panel = document.getElementById('emailSendPanel');
  if (overlay) overlay.classList.remove('open');
  if (panel) panel.classList.remove('open');
  pendingEmailAction = null;
}

async function confirmEmailSend() {
  const toInput = document.getElementById('emailSendTo');
  const to = toInput ? toInput.value.trim() : '';
  if (!to) {
    showToast('Informe pelo menos um email', 'info');
    return;
  }

  const emails = to.split(',').map(e => e.trim()).filter(Boolean);
  if (!emails.length) {
    showToast('Informe pelo menos um email válido', 'info');
    return;
  }

  if (typeof pendingEmailAction === 'function') {
    await pendingEmailAction(emails);
  }

  closeEmailSend();
}

/* ── Send Ata ──────────────────────────────────────────────────────────── */

function openAtaEmailSend() {
  if (!state.currentMeeting) {
    showToast('Nenhuma reunião selecionada', 'info');
    return;
  }

  openEmailSend('Enviar ata por email', async (emails) => {
    try {
      const res = await fetch(`${API}/api/email/send-ata/${state.currentMeeting.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emails })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Email enviado! Verifiquem também a caixa de spam.', 'success');
      } else {
        showToast(data.error || 'Erro ao enviar ata', 'error');
      }
    } catch (e) {
      showToast('Erro ao enviar ata por email', 'error');
    }
  });
}

async function openAtaEmailPreview() {
  if (!state.currentMeeting) {
    showToast('Nenhuma reunião selecionada', 'info');
    return;
  }

  try {
    const res = await fetch(`${API}/api/email/preview-ata/${state.currentMeeting.id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao carregar pré-visualização');
    }

    const win = window.open('', '_blank');
    if (!win) {
      showToast('Permita pop-ups para ver a pré-visualização', 'info');
      return;
    }

    const pdfUrl = `${API}/api/email/preview-ata-pdf/${state.currentMeeting.id}`;

    const html = `<!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Pré-visualização da ata</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>body{margin:0;padding:24px 0;background:#e5e7eb;}</style>
        </head>
        <body>
          ${data.html || ''}
          <div style="max-width:720px;margin:18px auto 0;padding:0 12px;text-align:center;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <a href="${pdfUrl}" target="_blank" style="display:inline-block;background:#2187ab;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:700;font-size:13px;">Abrir PDF anexado</a>
          </div>
        </body>
      </html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (e) {
    console.error('Erro na pré-visualização da ata:', e);
    showToast('Erro ao abrir pré-visualização da ata', 'error');
  }
}

/* ── Notify members about new meeting ──────────────────────────────────── */

function openMeetingNotifyEmail(meetingId) {
  if (!meetingId) return;

  const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
  const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';

  fetch(`${API}/api/email/notify-meeting/${meetingId}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Email enviado! Verifiquem também a caixa de spam.', 'success');
        return;
      }
      showToast(data.error || 'Erro ao notificar membros por email', 'error');
    })
    .catch(() => {
      showToast('Erro ao enviar notificação automática', 'error');
    });
}
