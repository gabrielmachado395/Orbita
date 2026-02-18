/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Renderização de Reuniões                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function normalizeMeetingStatus(meeting) {
  // Não altere o status!
  return meeting;
}

function applyMeetingFilters() {
  const filters = state.meetingFilters || {};
  let result = (state.allMeetings || []).map(normalizeMeetingStatus);

  if (filters.status) {
    result = result.filter(m => m.status === filters.status);
  } else {
    // Mostrar apenas reuniões não iniciadas na tela inicial
    result = result.filter(m => m.status === 'not_started');
  }

  if (filters.type) {
    result = result.filter(m => m.type === filters.type);
  }
  if (filters.member) {
    result = result.filter(m => (m.members || []).includes(filters.member));
  }
  if (filters.responsible) {
    result = result.filter(m =>
      m.responsible === filters.responsible ||
      ((m.members && m.members[0]) || '') === filters.responsible
    );
  }
  if (filters.frequency && filters.frequency !== 'multi') {
    result = result.filter(m => m.recurrence === filters.frequency);
  }

  state.meetings = result;
  renderMeetings();
  if (typeof syncFilterChips === 'function') {
    syncFilterChips();
  }
}

async function reloadMeetings() {
  try {
    const userKey = getCurrentUserQueryKey();
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const res = await fetch(`${API}/api/meetings${query}`);
    state.allMeetings = await res.json();
    applyMeetingFilters();
  } catch (e) {
    console.error(e);
  }
}

function renderMeetings() {
  const grid = document.getElementById('meetingsGrid');
  const empty = document.getElementById('emptyState');

  if (state.meetings.length === 0) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    grid.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  grid.innerHTML = state.meetings.map(m => {
    const dateObj = new Date(m.date + 'T00:00:00');
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');

    const statusLabels = {
      not_started: 'REUNIÃO NÃO INICIADA',
      in_progress: 'EM ANDAMENTO',
      completed: 'FINALIZADA'
    };

    const members = m.members || [];
    const visibleMembers = members.slice(0, 3);
    const extraCount = members.length - visibleMembers.length;

    const membersHTML = visibleMembers.map(mem => {
      if (typeof renderUserAvatar === 'function') {
        return renderUserAvatar(mem);
      }
      return `<div class="card-avatar">${esc(mem)}</div>`;
    }).join('') + (extraCount > 0
      ? `<button type="button" class="card-avatar card-avatar-more" data-members-popover="${esc(m.id)}">+${extraCount}</button>`
      : '');

    return `
      <div class="meeting-card" data-id="${m.id}">
        <div class="meeting-card-body">
          <div class="meeting-card-top">
            <div>
              <div class="meeting-card-name">${esc(m.name)}</div>
              <div class="meeting-card-members">${membersHTML}</div>
            </div>
            <div class="meeting-card-date">
              <div class="card-date-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span class="day">${day}</span>
              <span class="month">${month}</span>
            </div>
          </div>
          <div class="meeting-card-actions">
            <button class="btn-start" data-action="start" data-id="${m.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Começar
            </button>
            <div class="card-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${esc(m.time)}</span>
            </div>
          </div>
        </div>
        <div class="meeting-card-status ${m.status}">
          ${statusLabels[m.status] || 'FINALIZADA'}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-action="start"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const meeting = state.meetings.find(m => m.id === id);
      if (meeting) openStartConfirm(meeting);
    });
  });

  grid.querySelectorAll('[data-members-popover]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.membersPopover;
      const meeting = state.meetings.find(m => m.id === id);
      if (meeting) openMembersPopover(meeting);
    });
  });

  grid.querySelectorAll('.meeting-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      const id = card.dataset.id;
      const meeting = state.meetings.find(m => m.id === id);
      if (meeting) openMeetingDetail(meeting);
    });
  });
}

function openMembersPopover(meeting) {
  if (!meeting) return;

  let overlay = document.getElementById('membersPopoverOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'membersPopoverOverlay';
    overlay.className = 'members-popover-overlay';
    overlay.innerHTML = `
      <div class="members-popover-card" role="dialog" aria-modal="true" aria-labelledby="membersPopoverTitle">
        <div class="members-popover-header">
          <h3 id="membersPopoverTitle">Participantes</h3>
          <button class="btn-icon-sm members-popover-close" aria-label="Fechar">\n            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\n          </button>
        </div>
        <div class="members-popover-body" id="membersPopoverBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    overlay.querySelector('.members-popover-close').addEventListener('click', () => {
      overlay.classList.remove('open');
    });
  }

  const body = document.getElementById('membersPopoverBody');
  if (!body) return;

  const members = Array.isArray(meeting.members) ? meeting.members : [];
  if (!members.length) {
    body.innerHTML = '<div class="empty-col">Nenhum participante</div>';
  } else {
    body.innerHTML = members.map(initials => {
      const info = (typeof getUserDisplay === 'function') ? getUserDisplay(initials) : { name: initials, email: '' };
      const name = info.name || initials;
      const email = info.email || '';
      const avatar = (typeof renderUserAvatar === 'function')
        ? renderUserAvatar(initials, { title: name })
        : `<span class="card-avatar">${esc(initials)}</span>`;
      return `
        <div class="members-popover-item">
          ${avatar}
          <div class="members-popover-info">
            <div class="members-popover-name">${esc(name)}</div>
            ${email ? `<div class="members-popover-email">${esc(email)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  overlay.classList.add('open');
}

async function reloadMeetings() {
  try {
    const userKey = getCurrentUserQueryKey();
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const res = await fetch(`${API}/api/meetings${query}`);
    state.allMeetings = await res.json();
    applyMeetingFilters();
  } catch (e) {
    console.error(e);
  }
}

async function foo() {
  await reloadMeetings();
}
