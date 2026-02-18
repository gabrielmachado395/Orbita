/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Utilitários                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ── Chave de identificação do usuário para API ──────────────────────────── */
function getCurrentUserQueryKey() {
  if (!state || !state.currentUser) return '';
  // Prefere email (resolução mais confiável no servidor), fallback para initials
  return state.currentUser.email || state.currentUser.initials || '';
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (min < 1) return 'Agora';
  if (min < 60) return `${min}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Loading helpers
function showLoading(message = 'Carregando…') {
  const overlay = document.getElementById('globalLoadingOverlay');
  const txt = document.getElementById('globalLoadingText');
  if (!overlay) return;
  if (txt) txt.textContent = message;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  // opcional: marcar app como inativo
  const app = document.getElementById('appLayout');
  if (app) app.setAttribute('aria-busy', 'true');
}

function hideLoading() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  const app = document.getElementById('appLayout');
  if (app) app.removeAttribute('aria-busy');
}

// Conveniência: executa uma async function mostrando o loading automaticamente
async function withLoading(promiseOrFn, message = 'Processando…') {
  try {
    showLoading(message);
    if (typeof promiseOrFn === 'function') {
      return await promiseOrFn();
    } else {
      return await promiseOrFn;
    }
  } finally {
    hideLoading();
  }
}