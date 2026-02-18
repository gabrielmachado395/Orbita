/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Confirmação de Início                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupStartConfirm() {
  const overlay = document.getElementById('startOverlay');
  const btnStart = document.getElementById('btnStartMeeting');
  if (!overlay || !btnStart) return;

  const dropdown = document.getElementById('startGuestDropdown');
  const trigger = document.getElementById('startGuestTrigger');
  const guestInput = document.getElementById('startGuestInput');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeStartConfirm();
  });

  btnStart.addEventListener('click', confirmStartMeeting);

  if (dropdown && trigger && guestInput) {
    guestInput.addEventListener('focus', () => {
      dropdown.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    guestInput.addEventListener('input', () => {
      const term = guestInput.value.toLowerCase();
      const members = (state.pendingStartMeeting && state.pendingStartMeeting.members) || [];
      const filtered = state.users
        .filter(u => !members.includes(u.initials))
        .filter(u => u.name.toLowerCase().includes(term) || (u.initials || '').toLowerCase().includes(term));
      renderGuestList(filtered, document.getElementById('startGuestList'));
    });

    trigger.addEventListener('click', (e) => {
      if (e.target === guestInput) return;
      dropdown.classList.toggle('open');
      const isOpen = dropdown.classList.contains('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) guestInput.focus();
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.classList.contains('open')) return;
      if (e.target.closest('#startGuestDropdown')) return;
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    });
  }
}

function openStartConfirm(meeting) {
  state.pendingStartMeeting = meeting;
  state.pendingSelectedGuests = [...(meeting.presentMembers || [])].filter(i => !(meeting.members || []).includes(i));

  const overlay = document.getElementById('startOverlay');
  const membersEl = document.getElementById('startMembers');
  const dropdown = document.getElementById('startGuestDropdown');
  const trigger = document.getElementById('startGuestTrigger');
  const guestInput = document.getElementById('startGuestInput');
  const guestList = document.getElementById('startGuestList');
  const selectedCards = document.getElementById('startSelectedCards');

  if (membersEl) {
    const members = meeting.members || [];
    membersEl.innerHTML = members.map(initials => {
      const user = state.users.find(u => u.initials === initials);
      const name = user ? user.name : initials;
      const avatar = (typeof renderUserAvatar === 'function')
        ? renderUserAvatar(initials, { title: name })
        : `<span class="card-avatar">${esc(initials)}</span>`;
      return `
        <div class="start-member">
          <div class="start-member-left">
            ${avatar}
            <span class="start-member-name">${esc(name)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render ALL users into guest list
  if (guestList) {
    const members = meeting.members || [];
    const allUsers = state.users.filter(u => !members.includes(u.initials));
    renderGuestList(allUsers, guestList);
  }

  if (guestInput) guestInput.value = '';

  if (dropdown && trigger) {
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  if (selectedCards) renderSelectedGuestCards();

  overlay.classList.add('open');
}

function renderGuestList(users, container) {
  if (!container) return;
  if (!users.length) {
    container.innerHTML = '<div class="empty-col">Nenhum usuário encontrado</div>';
    return;
  }
  const colors = ['#3A7D44', '#e74c3c', '#3498db', '#f39c12', '#9b59b6'];
  container.innerHTML = users.map(u => {
    const idx = (u.initials || 'A').charCodeAt(0) % colors.length;
    const selected = (state.pendingSelectedGuests || []).includes(u.initials) ? 'selected' : '';
    const avatar = (typeof renderUserAvatar === 'function')
      ? renderUserAvatar(u.initials, { title: u.name })
      : `<span class="card-avatar" style="background:${colors[idx]}">${esc(u.initials)}</span>`;
    return `
      <div class="start-member ${selected}" data-guest="${esc(u.initials)}" title="Clique para selecionar">
        <div class="start-member-left">
          ${avatar}
          <span class="start-member-name">${esc(u.name)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-guest]').forEach(item => {
    item.addEventListener('click', () => {
      const initials = item.dataset.guest;
      const selected = state.pendingSelectedGuests || [];
      const idx = selected.indexOf(initials);
      if (idx >= 0) selected.splice(idx, 1);
      else selected.push(initials);
      state.pendingSelectedGuests = selected;
      renderGuestList(users, container);
      renderSelectedGuestCards();
    });
  });
}

function renderSelectedGuestCards() {
  const wrap = document.getElementById('startSelectedCards');
  if (!wrap) return;
  const selected = state.pendingSelectedGuests || [];
  if (!selected.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = selected.map(initials => {
    const user = state.users.find(u => u.initials === initials);
    const name = user ? user.name : initials;
    const avatar = (typeof renderUserAvatar === 'function')
      ? renderUserAvatar(initials, { title: name })
      : `<span class="card-avatar">${esc(initials)}</span>`;
    return `
      <div class="start-member start-selected-member-card" data-selected="${esc(initials)}">
        <div class="start-member-left">
          ${avatar}
          <span class="start-member-name">${esc(name)}</span>
        </div>
        <button type="button" class="start-remove-btn" data-remove-selected="${esc(initials)}" aria-label="Remover participante">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-remove-selected]').forEach(btn => {
    btn.addEventListener('click', () => {
      const initials = btn.dataset.removeSelected;
      state.pendingSelectedGuests = (state.pendingSelectedGuests || []).filter(i => i !== initials);

      const meeting = state.pendingStartMeeting || { members: [] };
      const members = meeting.members || [];
      const term = (document.getElementById('startGuestInput')?.value || '').toLowerCase();
      const filtered = state.users
        .filter(u => !members.includes(u.initials))
        .filter(u => u.name.toLowerCase().includes(term) || (u.initials || '').toLowerCase().includes(term));
      renderGuestList(filtered, document.getElementById('startGuestList'));
      renderSelectedGuestCards();
    });
  });
}

function closeStartConfirm() {
  const overlay = document.getElementById('startOverlay');
  if (overlay) overlay.classList.remove('open');
  state.pendingStartMeeting = null;

  const dropdown = document.getElementById('startGuestDropdown');
  const trigger = document.getElementById('startGuestTrigger');
  if (dropdown) dropdown.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  const guestInput = document.getElementById('startGuestInput');
  if (guestInput) guestInput.value = '';
}


async function confirmStartMeeting() {
  const meeting = state.pendingStartMeeting;
  if (!meeting) return;

  const presentMembers = Array.from(new Set([
    ...(meeting.members || []),
    ...(state.pendingSelectedGuests || [])
  ]));
  meeting.presentMembers = presentMembers;

  const userDirectory = {};
  presentMembers.forEach((initials) => {
    const user = Array.isArray(state.users) ? state.users.find(u => u && u.initials === initials) : null;
    if (user && user.name) userDirectory[initials] = user.name;
  });

  const prevStatus = meeting.status;
  const prevStartedAt = meeting.startedAt;

  // Otimista: marcar localmente enquanto chama o servidor
  if (!meeting.startedAt) meeting.startedAt = new Date().toISOString();
  meeting.status = 'in_progress';

  closeStartConfirm();
  openMeetingDetail(meeting);
  startChrono();

  try {
    const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const res = await fetch(`${API}/api/meetings/${meeting.id}/start${query}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentMembers, userDirectory })
    });

    if (!res.ok) {
      // Reverter estado local se a chamada falhar
      meeting.status = prevStatus;
      meeting.startedAt = prevStartedAt;
      openMeetingDetail(meeting);
      showToast('Erro ao iniciar reunião (servidor retornou erro)', 'error');
      const text = await res.text().catch(() => '');
      console.error('Start meeting failed', res.status, text);
      return;
    }

    // Use o objeto retornado pelo servidor para garantir consistência
    const updated = await res.json().catch(() => null);
    if (updated && updated.id) {
      state.currentMeeting = updated;
      if (Array.isArray(state.allMeetings)) {
        const idx = state.allMeetings.findIndex(m => m.id === updated.id);
        if (idx !== -1) state.allMeetings[idx] = updated;
      }
    }

    // Atualiza listas e renderizações
    if (typeof reloadMeetings === 'function') await reloadMeetings();
    // Reabrir detalhe com dados do servidor (garante status correto)
    if (state.currentMeeting) openMeetingDetail(state.currentMeeting);

    showToast('Reunião iniciada!', 'success');
  } catch (err) {
    // Reverte em caso de falha de rede
    meeting.status = prevStatus;
    meeting.startedAt = prevStartedAt;
    openMeetingDetail(meeting);
    showToast('Erro ao iniciar reunião (falha de rede)', 'error');
    console.error(err);
  }
}