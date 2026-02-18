/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Login / Registro                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_USERS = 'reunix_users';
const STORAGE_SESSION = 'reunix_session';
const LOGIN_REFRESH_FLAG = 'reunix_after_login_refresh';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS)) || []; }
  catch { return []; }
}

function saveLocalUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SESSION)); }
  catch { return null; }
}

function setSession(user) {
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(STORAGE_SESSION);
}

function makeInitials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function normalizeUserForSync(input) {
  const name = String((input && input.name) || '').trim();
  const email = String((input && input.email) || '').trim().toLowerCase();
  const initials = String((input && input.initials) || makeInitials(name) || '').trim().toUpperCase().slice(0, 2);
  const id = String((input && input.id) || '').trim() || ('local_' + Date.now());
  const role = String((input && input.role) || 'usuario').trim() || 'usuario';

  return {
    id,
    name: name || initials || 'Usuário',
    initials,
    email,
    role
  };
}

/* ── login screen logic ──────────────────────────────────────────────────── */
let loginMode = 'login'; // 'login' | 'register'
let loginRefs = null;
let loginHandlersBound = false;

function getGoogleButtonText(mode) {
  return mode === 'register' ? 'Criar conta com Google' : 'Entrar com Google';
}

function setLoginMode(mode) {
  if (!loginRefs) return;
  const { form, nameIn, btnEl, tabs, errorEl, googleBtnText, dividerText } = loginRefs;

  loginMode = mode;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.ltab === mode));

  if (mode === 'login') {
    form.classList.add('login-mode');
    form.classList.remove('register-mode');
    nameIn.style.display = 'none';
    nameIn.required = false;
    btnEl.textContent = 'Entrar';
  } else {
    form.classList.remove('login-mode');
    form.classList.add('register-mode');
    nameIn.style.display = '';
    nameIn.required = true;
    btnEl.textContent = 'Criar conta';
  }

  if (googleBtnText) googleBtnText.textContent = getGoogleButtonText(mode);
  if (dividerText) dividerText.textContent = 'ou';

  errorEl.textContent = '';
}

function resetLoginUI() {
  if (!loginRefs) return;
  const { form, errorEl } = loginRefs;
  form.reset();
  setLoginMode('login');
  errorEl.textContent = '';
}

function setupLogin() {
  const screen   = document.getElementById('loginScreen');
  const form     = document.getElementById('loginForm');
  const nameIn   = document.getElementById('loginName');
  const emailIn  = document.getElementById('loginEmail');
  const passIn   = document.getElementById('loginPassword');
  const errorEl  = document.getElementById('loginError');
  const btnEl    = document.getElementById('loginBtn');
  const googleBtn = document.getElementById('loginGoogle');
  const googleBtnText = document.getElementById('loginGoogleText');
  const dividerText = document.getElementById('loginDividerText');
  const tabs     = document.querySelectorAll('.login-tab');

  loginRefs = { screen, form, nameIn, emailIn, passIn, errorEl, btnEl, googleBtn, googleBtnText, dividerText, tabs };

  if (!loginHandlersBound) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setLoginMode(tab.dataset.ltab);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      const email = emailIn.value.trim().toLowerCase();
      const pass  = passIn.value;

      if (loginMode === 'register') {
        const name = nameIn.value.trim();
        if (!name) { errorEl.textContent = 'Informe seu nome.'; return; }
        if (!email) { errorEl.textContent = 'Informe seu e-mail.'; return; }
        if (pass.length < 4) { errorEl.textContent = 'Senha deve ter ao menos 4 caracteres.'; return; }

        const users = getLocalUsers();
        if (users.find(u => u.email === email)) {
          errorEl.textContent = 'E-mail já cadastrado.';
          return;
        }

        const newUser = {
          id: 'local_' + Date.now(),
          name,
          email,
          password: pass,
          initials: makeInitials(name),
          role: 'usuario',
        };
        users.push(newUser);
        saveLocalUsers(users);

        const session = { id: newUser.id, name: newUser.name, email: newUser.email, initials: newUser.initials };
        setSession(session);
        if (typeof state === 'object' && state) state.currentUser = session;

        syncUserToServer(newUser);
        sessionStorage.setItem(LOGIN_REFRESH_FLAG, '1');
        location.reload();
      } else {
        if (!email) { errorEl.textContent = 'Informe seu e-mail.'; return; }
        if (!pass) { errorEl.textContent = 'Informe sua senha.'; return; }


        // Busca usuário no backend pelo e-mail
        let backendUser = null;
        try {
          const res = await fetch(`${API}/api/users?email=${encodeURIComponent(email)}`);
          if (res.ok) {
            const users = await res.json();
            console.log('Debug retorno backend: ', users);
            backendUser = Array.isArray(users) ? users.find(u => u.email === email) : users;
          }
        } catch (e) {}

        if (!backendUser) {
          errorEl.textContent = 'Usuário não encontrado no servidor.';
          return;
        }

        // Aqui você pode validar a senha se desejar, ou confiar no backend
        const session = {
          id: backendUser.id,
          name: backendUser.name,
          email: backendUser.email,
          initials: backendUser.initials
        };
        setSession(session);
        if (typeof state === 'object' && state) state.currentUser = session;

        syncUserToServer(backendUser);
        sessionStorage.setItem(LOGIN_REFRESH_FLAG, '1');
        location.reload();
              }
            });

    if (googleBtn) {
      googleBtn.addEventListener('click', () => {
        errorEl.textContent = '';
        const popup = window.open(
          `/api/auth/google/start?mode=${encodeURIComponent(loginMode)}`,
          'orbita_google_auth',
          'width=520,height=640,left=200,top=80'
        );

        if (!popup) {
          errorEl.textContent = 'Não foi possível abrir o login do Google. Verifique o bloqueador de pop-up.';
        }
      });
    }

    window.addEventListener('message', async (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === 'google-auth-success' && data.payload) {
        const normalized = normalizeUserForSync(data.payload);
        const session = { id: normalized.id, name: normalized.name, email: normalized.email, initials: normalized.initials };
        setSession(session);
        if (typeof state === 'object' && state) state.currentUser = session;

        syncUserToServer(normalized);
        sessionStorage.setItem(LOGIN_REFRESH_FLAG, '1');
        location.reload();
        return;
      }

      if (data.type === 'google-auth-error') {
        errorEl.textContent = data.message || 'Falha na autenticação com Google.';
      }
    });

    fetch('/api/auth/google/status')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Falha ao verificar autenticação Google')))
      .then(({ enabled }) => {
        if (!enabled && googleBtn) {
          googleBtn.disabled = true;
          googleBtn.title = 'Login com Google não configurado no servidor';
          if (googleBtnText) googleBtnText.textContent = 'Google não configurado';
        }
      })
      .catch(() => {
        if (googleBtn) {
          googleBtn.disabled = true;
          googleBtn.title = 'Falha ao verificar configuração do Google';
          if (googleBtnText) googleBtnText.textContent = 'Google indisponível';
        }
      });

    loginHandlersBound = true;
  }

  // Check existing session
  const session = getSession();
  if (session) {
    enterApp(session);
  } else {
    resetLoginUI();
    screen.classList.remove('hidden');
  }
}

/* ── enter / leave app ───────────────────────────────────────────────────── */
function enterApp(session) {
  const screen = document.getElementById('loginScreen');
  const app    = document.getElementById('appLayout');

  const safeName = String((session && session.name) || '').trim() || 'Usuário';
  const safeEmail = String((session && session.email) || '').trim().toLowerCase();
  const safeInitials = String((session && session.initials) || makeInitials(safeName) || '').trim().toUpperCase().slice(0, 2) || 'U';
  const safeId = String((session && session.id) || '').trim() || ('local_' + Date.now());
  const normalizedSession = { id: safeId, name: safeName, email: safeEmail, initials: safeInitials };

  state.currentUser = normalizedSession;
  state.currentView = 'list';
  state.currentMeeting = null;
  state.filterResp = null;
  state.filterStatus = null;
  state.allMeetings = [];
  state.meetings = [];
  state.notifications = [];

  screen.classList.add('hidden');
  app.style.display = '';

  const detailView = document.getElementById('detailView');
  const listView = document.getElementById('listView');
  if (detailView) detailView.classList.add('hidden');
  if (listView) listView.classList.remove('hidden');

  const openPanels = [
    'profilePanel',
    'profileOverlay',
    'notifPanel',
    'modalOverlay',
    'filterPanel',
    'filterPanelOverlay',
    'passwordOverlay',
    'startOverlay',
    'startGuestDropdown',
    'membersDropdown',
    'typeDropdown',
    'profileTzDropdown',
    'filterRespDropdown',
    'filterStatusDropdown'
  ];
  openPanels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });

  // Update profile name / email from session
  const profileName  = document.getElementById('profileName');
  const profileEmail = document.querySelector('.profile-email');
  if (profileName) profileName.textContent = normalizedSession.name;
  if (profileEmail) profileEmail.textContent = normalizedSession.email || '';

  // Update sidebar avatar initials
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarAvatar) {
    if (typeof refreshSidebarAvatar === 'function') {
      refreshSidebarAvatar();
    } else {
      sidebarAvatar.textContent = normalizedSession.initials;
    }
  }

  // Evita que o navegador preencha a busca da sidebar com dados do login
  const sidebarSearch = document.getElementById('sidebarSearch');
  if (sidebarSearch) {
    try {
      // atributos adicionais anti-autofill
      sidebarSearch.setAttribute('autocomplete', 'off');
      sidebarSearch.setAttribute('autocorrect', 'off');
      sidebarSearch.setAttribute('autocapitalize', 'off');

      // limpa imediatamente e protege contra autofill que surja logo após
      sidebarSearch.value = '';

      // evita que o browser escreva por autofill (truque: readOnly temporário)
      sidebarSearch.readOnly = true;
      setTimeout(() => {
        sidebarSearch.readOnly = false;
        sidebarSearch.value = ''; // limpeza final caso o browser tenha preenchido depois
      }, 300);
    } catch (e) {
      // fallback: apenas tente limpar
      sidebarSearch.value = '';
    }
  }
  
  if (typeof renderMeetings === 'function') renderMeetings();
  if (typeof updateNotifBadge === 'function') updateNotifBadge();
  if (typeof loadData === 'function') loadData();

  if (sessionStorage.getItem(LOGIN_REFRESH_FLAG) === '1') {
    sessionStorage.removeItem(LOGIN_REFRESH_FLAG);
  }
}

function logoutApp() {
  clearSession();
  const screen = document.getElementById('loginScreen');
  const app    = document.getElementById('appLayout');

  state.currentUser = null;

  const openPanels = [
    'profilePanel',
    'profileOverlay',
    'notifPanel',
    'modalOverlay',
    'filterPanel',
    'filterPanelOverlay',
    'passwordOverlay',
    'startOverlay',
    'startGuestDropdown',
    'membersDropdown',
    'typeDropdown',
    'profileTzDropdown'
  ];

  openPanels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });

  screen.classList.remove('hidden');
  app.style.display = 'none';

  state.allMeetings = [];
  state.meetings = [];
  state.notifications = [];
  if (typeof renderMeetings === 'function') renderMeetings();
  if (typeof updateNotifBadge === 'function') updateNotifBadge();

  resetLoginUI();
}

async function syncUsersRegistry() {
  return syncUserToServer(state.currentUser);
}

async function syncUserToServer(user) {
  try {
    const normalized = normalizeUserForSync(user);
    if (!normalized.id || !normalized.initials) return;

    await fetch(`${API}/api/users/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: [normalized] })
    });
  } catch (e) {
    console.warn('Falha ao sincronizar usuário com servidor:', e);
  }
}

/* ── merge local users into state.users ──────────────────────────────────── */
function mergeLocalUsers() {
  const local = getLocalUsers();
  local.forEach(lu => {
    if (!state.users.find(u => u.id === lu.id)) {
      state.users.push({
        id: lu.id,
        name: lu.name,
        initials: lu.initials,
        email: lu.email,
        role: lu.role,
      });
    }
  });
}
