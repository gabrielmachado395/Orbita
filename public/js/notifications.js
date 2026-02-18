/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Notificações                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupNotifications() {
  const btn = document.getElementById('sidebarNotifBtn');
  const panel = document.getElementById('notifPanel');
  const btnReadAll = document.getElementById('btnReadAll');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  btnReadAll.addEventListener('click', async () => {
    try {
      const userKey = getCurrentUserQueryKey();
      const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
      await fetch(`${API}/api/notifications/read-all${query}`, { method: 'PUT' });
      state.notifications.forEach(n => n.read = true);
      renderNotifications();
      updateNotifBadge();
    } catch (e) {
      console.error(e);
    }
  });
}

async function reloadNotifications() {
  try {
    const userKey = getCurrentUserQueryKey();
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const res = await fetch(`${API}/api/notifications${query}`);
    state.notifications = await res.json();
    updateNotifBadge();
  } catch (e) {
    console.error(e);
  }
}

function updateNotifBadge() {
  const dot = document.getElementById('sidebarNotifDot');
  const unread = state.notifications.filter(n => !n.read).length;
  dot.classList.toggle('visible', unread > 0);
}

function renderNotifications() {
  const list = document.getElementById('notifList');

  if (state.notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty">Sem notificações</div>';
    return;
  }

  list.innerHTML = state.notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}">
      <div class="notif-item-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="notif-item-content">
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.message)}</p>
      </div>
      <span class="notif-item-time">${timeAgo(n.createdAt)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = parseInt(item.dataset.notifId);
      try {
        const userKey = getCurrentUserQueryKey();
        const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
        await fetch(`${API}/api/notifications/${id}/read${query}`, { method: 'PUT' });
        const n = state.notifications.find(n => n.id === id);
        if (n) n.read = true;
        item.classList.remove('unread');
        updateNotifBadge();
      } catch (e) {
        console.error(e);
      }
    });
  });
}
