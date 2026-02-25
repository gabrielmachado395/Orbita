/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Inicialização                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  setupLogin();            // login / session check (shows app if already logged)
  setupWorkspace();
  setupSidebar();
  setupHeader();
  setupModal();
  setupNotifications();
  setupFilterPanel();
  setupDetailView();
  setupProfile();
  setupStartConfirm();
  setupPasswordModal();
  setupGoogleLogin();
  setupFilterChips();
  setupEmail();
  setupMicroMotion();

  // Logout button
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutApp);
});

async function loadData() {
  try {
    state.allMeetings = (typeof getLocalMeetings === 'function') ? getLocalMeetings() : [];

    const userKey = getCurrentUserQueryKey();
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';

    const [usersRes, notifsRes] = await Promise.all([
      fetch(`${API}/api/users`),
      fetch(`${API}/api/notifications${query}`)
    ]);
    state.users = await usersRes.json();
    state.notifications = await notifsRes.json();
    mergeLocalUsers();   // merge localStorage users into state.users
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
  }
  resetMeetingFilters();
  applyMeetingFilters();
  updateNotifBadge();
  populateFilterUsers();
}

// Inicializa edição inline quando DOM estiver pronto
enableHighlightInlineEdit();

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Password Change Modal                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
function setupPasswordModal() {
  const btnOpen = document.getElementById('btnChangePassword');
  const overlay = document.getElementById('passwordOverlay');
  const btnSave = document.getElementById('btnSavePassword');
  const errorEl = document.getElementById('pwdError');
  if (!btnOpen || !overlay) return;

  btnOpen.addEventListener('click', () => {
    overlay.classList.add('open');
    // close profile panel
    document.getElementById('profilePanel').classList.remove('open');
    document.getElementById('profileOverlay').classList.remove('open');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      clearPasswordForm();
    }
  });

  // Eye toggle buttons
  overlay.querySelectorAll('[data-toggle-pwd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.togglePwd;
      const input = document.getElementById(inputId);
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.classList.toggle('active', isPass);
    });
  });

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const oldPwd = document.getElementById('pwdOld').value;
      const newPwd = document.getElementById('pwdNew').value;
      const repeat = document.getElementById('pwdRepeat').value;

      if (!oldPwd || !newPwd || !repeat) {
        errorEl.textContent = 'Preencha todos os campos.';
        return;
      }

      // Verify old password
      const session = getSession();
      if (session) {
        const users = getLocalUsers();
        const user = users.find(u => u.id === session.id);
        if (user && user.password !== oldPwd) {
          errorEl.textContent = 'Senha antiga incorreta.';
          return;
        }
      }

      if (newPwd.length < 4) {
        errorEl.textContent = 'Nova senha deve ter ao menos 4 caracteres.';
        return;
      }
      if (newPwd !== repeat) {
        errorEl.textContent = 'As senhas não coincidem.';
        return;
      }

      // Save new password
      const session2 = getSession();
      if (session2) {
        const users = getLocalUsers();
        const user = users.find(u => u.id === session2.id);
        if (user) {
          user.password = newPwd;
          saveLocalUsers(users);
        }
      }

      overlay.classList.remove('open');
      clearPasswordForm();
      showToast('Senha alterada com sucesso!', 'success');
    });
  }
}

function clearPasswordForm() {
  ['pwdOld', 'pwdNew', 'pwdRepeat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.type = 'password'; }
  });
  const err = document.getElementById('pwdError');
  if (err) err.textContent = '';
  document.querySelectorAll('.password-eye.active').forEach(b => b.classList.remove('active'));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Google Login (placeholder)                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */
function setupGoogleLogin() {
  const btn = document.getElementById('loginGoogle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showToast('Login com Google será implementado com OAuth 2.0', 'info');
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Filter Chips (header)                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
function setupFilterChips() {
  const row = document.getElementById('filterChipsRow');
  if (!row) return;

  row.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-chip-remove]');
    if (removeBtn) {
      e.stopPropagation();
      const key = removeBtn.dataset.chipRemove;
      if (key && Object.prototype.hasOwnProperty.call(state.meetingFilters, key)) {
        state.meetingFilters[key] = '';
        applyMeetingFilters();
      }
      return;
    }

    const chip = e.target.closest('.filter-chip-tag');
    if (!chip) return;

    const fieldId = chip.dataset.filterField;
    if (typeof openFilterPanelForField === 'function') {
      openFilterPanelForField(fieldId);
    } else if (typeof openFilterPanel === 'function') {
      openFilterPanel();
    }
  });
}

function setupMicroMotion() {
  const selector = [
    '.btn-new-meeting',
    '.btn-layout',
    '.btn-start',
    '.sidebar-toggle',
    '.sidebar-notif-btn',
    '.btn-save',
    '.btn-upload'
  ].join(',');

  const buttons = document.querySelectorAll(selector);
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    if (btn.dataset.magneticBound === '1') return;
    btn.dataset.magneticBound = '1';
    btn.classList.add('magnetic-btn');

    btn.addEventListener('pointermove', (event) => {
      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const relX = (event.clientX - rect.left) / rect.width - 0.5;
      const relY = (event.clientY - rect.top) / rect.height - 0.5;
      const offsetX = Math.max(-6, Math.min(6, relX * 12));
      const offsetY = Math.max(-4, Math.min(4, relY * 8));
      btn.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}
