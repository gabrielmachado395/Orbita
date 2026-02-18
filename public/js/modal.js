/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Modal (Criar Reunião)                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupModal() {
  const overlay = document.getElementById('modalOverlay');
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');
  const toggleActive = document.getElementById('toggleActive');

  btnCancel.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeFilterPanel();
      const pp = document.getElementById('profilePanel');
      const po = document.getElementById('profileOverlay');
      pp.classList.remove('open');
      po.classList.remove('open');
    }
  });

  toggleActive.addEventListener('click', () => {
    state.active = !state.active;
    toggleActive.classList.toggle('active', state.active);
  });

  document.querySelectorAll('.rec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.recurrence = btn.dataset.rec;
    });
  });

  setupTypeSelect();
  setupSearchableSelects();
  setupMembersSelect();
  setupDurationPicker();
  btnSave.addEventListener('click', saveMeeting);
}

function getDefaultResponsibleInitials() {
  const currentInitials = (state.currentUser && state.currentUser.initials) || '';
  if (currentInitials) return currentInitials;

  const currentName = (state.currentUser && state.currentUser.name) || '';
  if (currentName) {
    return currentName
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'GM';
  }

  return 'GM';
}

/* ── Duração (inputs numéricos com validação) ─────────────────────────── */

const DURATION_MAX_HOURS = 12;
const DURATION_MAX_MINUTES = 59;

let durationState = { hours: 1, minutes: 0 };

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function parseDurationLabel(label) {
  const result = { hours: 1, minutes: 0 };
  if (!label) return result;
  const str = String(label).trim().toLowerCase();

  // Formatos suportados: "1h30", "1h", "90", "01:30"
  const hMatch = str.match(/^(\d+)h(?:\s*(\d+))?$/);
  if (hMatch) {
    const h = clamp(parseInt(hMatch[1], 10) || 0, 0, DURATION_MAX_HOURS);
    const m = clamp(parseInt(hMatch[2] || '0', 10) || 0, 0, DURATION_MAX_MINUTES);
    return { hours: h, minutes: m };
  }

  const hmMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (hmMatch) {
    const h = clamp(parseInt(hmMatch[1], 10) || 0, 0, DURATION_MAX_HOURS);
    const m = clamp(parseInt(hmMatch[2], 10) || 0, 0, DURATION_MAX_MINUTES);
    return { hours: h, minutes: m };
  }

  const n = parseInt(str, 10);
  if (!Number.isNaN(n)) {
    if (n >= 60) {
      const h = clamp(Math.floor(n / 60), 0, DURATION_MAX_HOURS);
      const m = clamp(n % 60, 0, DURATION_MAX_MINUTES);
      return { hours: h, minutes: m };
    }
    return { hours: 0, minutes: clamp(n, 0, DURATION_MAX_MINUTES) };
  }

  return result;
}

function formatDurationLabel(hours, minutes) {
  const h = clamp(Number(hours) || 0, 0, DURATION_MAX_HOURS);
  const m = clamp(Number(minutes) || 0, 0, DURATION_MAX_MINUTES);
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function updateDurationHiddenInput() {
  const input = document.getElementById('meetingDuration');
  if (!input) return;
  input.value = formatDurationLabel(durationState.hours, durationState.minutes);
}

function renderDurationStepper() {
  const hoursValue = document.getElementById('durationHoursValue');
  const minutesValue = document.getElementById('durationMinutesValue');
  if (!hoursValue || !minutesValue) return;

  hoursValue.value = String(durationState.hours).padStart(2, '0');
  minutesValue.value = String(durationState.minutes).padStart(2, '0');

  updateDurationHiddenInput();
}

function setDurationFromLabel(label) {
  durationState = parseDurationLabel(label);
  renderDurationStepper();
}

function setupDurationPicker() {
  const hoursValue = document.getElementById('durationHoursValue');
  const minutesValue = document.getElementById('durationMinutesValue');
  if (!hoursValue || !minutesValue) return;

  renderDurationStepper();

  const sanitizeDigits = (raw) => String(raw || '').replace(/\D+/g, '');

  const applyTypedValue = (type, raw, opts = {}) => {
    const { formatOnWrite = false } = opts;
    const digits = sanitizeDigits(raw);
    if (!digits) return { clamped: null, changed: false };

    const parsed = parseInt(digits, 10) || 0;
    const max = type === 'hours' ? DURATION_MAX_HOURS : DURATION_MAX_MINUTES;
    const clamped = clamp(parsed, 0, max);

    if (type === 'hours') {
      durationState.hours = clamped;
    } else {
      durationState.minutes = clamped;
    }

    if (formatOnWrite) {
      renderDurationStepper();
    } else {
      updateDurationHiddenInput();
    }

    return { clamped, changed: clamped !== parsed };
  };

  const bindInput = (input, type) => {
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
      if (allowed.includes(e.key)) return;
      if (/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
    });

    input.addEventListener('input', () => {
      const digits = sanitizeDigits(input.value).slice(0, 2);
      if (digits !== input.value) input.value = digits;

      const result = applyTypedValue(type, input.value, { formatOnWrite: false });
      if (result.changed && result.clamped !== null) {
        input.value = String(result.clamped);
      }
    });

    input.addEventListener('blur', () => {
      if (!sanitizeDigits(input.value)) {
        if (type === 'hours') input.value = String(durationState.hours);
        else input.value = String(durationState.minutes);
      }
      applyTypedValue(type, input.value, { formatOnWrite: false });
      renderDurationStepper();
    });

    input.addEventListener('focus', () => {
      const value = type === 'hours' ? durationState.hours : durationState.minutes;
      input.value = String(value);
      input.select();
    });
  };

  bindInput(hoursValue, 'hours');
  bindInput(minutesValue, 'minutes');
}

function canCurrentUserEditMeetingData(meeting) {
  if (!meeting) return false;
  const current = (state.currentUser && state.currentUser.initials) || '';
  const responsible = meeting.responsible || (meeting.members && meeting.members[0]) || '';
  return current && current === responsible;
}

function renderMemberAvatar(initials, size = 'normal') {
  const info = (typeof getUserDisplay === 'function') ? getUserDisplay(initials) : null;
  const title = (info && info.name) || initials || '';
  const avatarClass = size === 'mini' ? 'mini-avatar' : 'member-avatar selected-member';
  const photoClass = size === 'mini' ? 'mini-avatar-photo' : 'member-avatar-photo';

  if (info && info.photo) {
    return `<span class="${avatarClass} has-photo" title="${esc(title)}"><img src="${esc(info.photo)}" alt="${esc(title)}" class="${photoClass}"></span>`;
  }

  return `<span class="${avatarClass}" title="${esc(title)}">${esc(initials)}</span>`;
}

function openModal() {
  state.editingMeetingId = null;
  state.selectedType = 'Gerencial';
  state.recurrence = 'never';
  state.active = true;
  state.selectedMembers = [getDefaultResponsibleInitials()];

  document.getElementById('meetingName').value = '';
  document.getElementById('meetingDesc').value = '';
  document.getElementById('meetingDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('meetingTime').value = '13:30';
  setDurationFromLabel('1h');
  document.getElementById('nameError').classList.remove('visible');
  document.getElementById('meetingName').classList.remove('error');

  document.getElementById('toggleActive').classList.add('active');
  document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.rec-btn[data-rec="never"]').classList.add('active');
  document.getElementById('typeTrigger').querySelector('span').textContent = 'Gerencial';

  document.getElementById('btnSave').textContent = 'Salvar Reunião';
  renderSelectedMembers();
  ensureMembersUsersLoaded();
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('meetingName').focus(), 100);
}

function openModalForEdit(meeting) {
  if (!meeting) return;
  if (!canCurrentUserEditMeetingData(meeting)) {
    showToast('Somente o responsável pode editar os dados da reunião', 'info');
    return;
  }

  state.editingMeetingId = meeting.id;
  state.selectedType = meeting.type || 'Gerencial';
  state.recurrence = meeting.recurrence || 'never';
  state.active = meeting.active !== undefined ? meeting.active : true;
  state.selectedMembers = [...(meeting.members || [getDefaultResponsibleInitials()])];

  document.getElementById('meetingName').value = meeting.name || '';
  document.getElementById('meetingDesc').value = meeting.description || '';
  document.getElementById('meetingDate').value = meeting.date || new Date().toISOString().split('T')[0];
  document.getElementById('meetingTime').value = meeting.time || '13:30';
  setDurationFromLabel(meeting.duration || '1h');
  document.getElementById('nameError').classList.remove('visible');
  document.getElementById('meetingName').classList.remove('error');

  document.getElementById('toggleActive').classList.toggle('active', state.active);
  document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
  const recBtn = document.querySelector(`.rec-btn[data-rec="${state.recurrence}"]`);
  if (recBtn) recBtn.classList.add('active');
  document.getElementById('typeTrigger').querySelector('span').textContent = state.selectedType;

  document.querySelectorAll('#typeDropdown .select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === state.selectedType);
  });

  document.getElementById('btnSave').textContent = 'Atualizar Reunião';
  renderSelectedMembers();
  ensureMembersUsersLoaded();
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('meetingName').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('membersDropdown').classList.remove('open');
  document.getElementById('typeDropdown').classList.remove('open');
}

async function saveMeeting() {
  const name = document.getElementById('meetingName').value.trim();
  const nameError = document.getElementById('nameError');
  const nameInput = document.getElementById('meetingName');

  if (!name) {
    nameError.classList.add('visible');
    nameInput.classList.add('error');
    nameInput.focus();
    return;
  }

  const defaultResponsible = getDefaultResponsibleInitials();
  const members = state.selectedMembers.length
    ? [...state.selectedMembers]
    : [defaultResponsible];

  const data = {
    name,
    description: document.getElementById('meetingDesc').value.trim(),
    date: document.getElementById('meetingDate').value,
    time: document.getElementById('meetingTime').value,
    duration: document.getElementById('meetingDuration').value,
    type: state.selectedType,
    unit: (document.getElementById('unitTrigger')?.querySelector('span')?.textContent || '').trim().replace(/^Selecione\.\.\.$/i, ''),
    department: (document.getElementById('deptTrigger')?.querySelector('span')?.textContent || '').trim().replace(/^Selecione\.\.\.$/i, ''),
    indic: (document.getElementById('indicTrigger')?.querySelector('span')?.textContent || '').trim().replace(/^Selecione\.\.\.$/i, ''),
    plan: (document.getElementById('planTrigger')?.querySelector('span')?.textContent || '').trim().replace(/^Selecione\.\.\.$/i, ''),
    members,
    responsible: members[0] || defaultResponsible,
    recurrence: state.recurrence,
    active: state.active
  };

  // Snapshot de nomes para evitar PDF com apenas iniciais
  const userDirectory = {};
  const uniqueInitials = Array.from(new Set([...(members || []), (members[0] || defaultResponsible)])).filter(Boolean);
  uniqueInitials.forEach((initials) => {
    const user = Array.isArray(state.users) ? state.users.find(u => u && u.initials === initials) : null;
    if (user && user.name) userDirectory[initials] = user.name;
  });
  if (Object.keys(userDirectory).length) {
    data.userDirectory = userDirectory;
  }

  try {
    const isEdit = !!state.editingMeetingId;

    if (isEdit && state.currentMeeting && !canCurrentUserEditMeetingData(state.currentMeeting)) {
      showToast('Somente o responsável pode editar os dados da reunião', 'info');
      return;
    }

    const userKey = getCurrentUserQueryKey();
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const url = isEdit
      ? `${API}/api/meetings/${state.editingMeetingId}${query}`
      : `${API}/api/meetings`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const updated = await res.json();
    closeModal();
    await reloadMeetings();
    if (!isEdit) await reloadNotifications();

    // (fechar modal e recarregar já feito acima)
    if (!isEdit && typeof openMeetingNotifyEmail === 'function') {
      const result = await openMeetingNotifyEmail(updated.id);
      // Atualiza notificações após tentativa de envio
      await reloadNotifications();

      if (result && result.ok) {
        showToast('Reunião criada e email enviado automaticamente.', 'success');
      } else {
        const reason = (result && (result.data && result.data.error)) || result && result.error;
        showToast(`Reunião criada. Falha ao enviar email: ${reason || 'Erro'}`, 'info');
      }
    } else {
      showToast(isEdit ? 'Reunião atualizada!' : 'Reunião criada com sucesso!', 'success');
    }

    // Offer to notify members by email for new meetings
    if (!isEdit && typeof openMeetingNotifyEmail === 'function') {
      openMeetingNotifyEmail(updated.id);
    }

    state.editingMeetingId = null;
  } catch (e) {
    showToast(e.message || 'Erro ao salvar reunião', 'error');
  }
}

function setupTypeSelect() {
  const trigger = document.getElementById('typeTrigger');
  const dropdown = document.getElementById('typeDropdown');
  const searchInput = dropdown.querySelector('.search-input');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // close other searchable dropdowns
    document.querySelectorAll('.select-dropdown.open').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open') && searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase();
      dropdown.querySelectorAll('.select-option').forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());
  }

  dropdown.querySelectorAll('.select-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedType = opt.dataset.value;
      trigger.querySelector('span').textContent = opt.dataset.value;
      dropdown.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      dropdown.classList.remove('open');
      if (searchInput) { searchInput.value = ''; }
      dropdown.querySelectorAll('.select-option').forEach(o => o.style.display = '');
    });
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });
}

function setupMembersSelect() {
  const btnAdd = document.getElementById('btnAddMember');
  const dropdown = document.getElementById('membersDropdown');

  btnAdd.addEventListener('click', async (e) => {
    e.stopPropagation();
    await ensureMembersUsersLoaded();
    renderMembersDropdown();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btnAdd) {
      dropdown.classList.remove('open');
    }
  });
}

/* ── Searchable selects (unit, dept, indic, plan) ────────────────────── */
function setupSearchableSelects() {
  document.querySelectorAll('.searchable-select').forEach(sel => {
    // typeSelect is handled by setupTypeSelect — skip to avoid double-toggle
    if (sel.id === 'typeSelect') return;

    const trigger = sel.querySelector('.select-trigger');
    const dropdown = sel.querySelector('.select-dropdown');
    const searchInput = sel.querySelector('.search-input');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // close others
      document.querySelectorAll('.select-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open') && searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        dropdown.querySelectorAll('.select-option').forEach(opt => {
          const text = opt.textContent.toLowerCase();
          opt.style.display = text.includes(term) ? '' : 'none';
        });
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    dropdown.querySelectorAll('.select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        trigger.querySelector('span').textContent = val;
        dropdown.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        dropdown.classList.remove('open');
        if (searchInput) searchInput.value = '';
        // restore hidden from search
        dropdown.querySelectorAll('.select-option').forEach(o => o.style.display = '');
      });
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.searchable-select .select-dropdown.open').forEach(d => d.classList.remove('open'));
  });
}

async function ensureMembersUsersLoaded() {
  if (!Array.isArray(state.users)) state.users = [];

  if (!state.users.length) {
    try {
      const res = await fetch(`${API}/api/users`);
      if (res.ok) {
        const apiUsers = await res.json();
        if (Array.isArray(apiUsers)) state.users = apiUsers;
      }
    } catch (e) {
      console.error('Erro ao carregar usuários para membros:', e);
    }
  }

  const localUsers = (typeof getLocalUsers === 'function') ? getLocalUsers() : [];
  localUsers.forEach(lu => {
    if (!state.users.find(u => u.id === lu.id)) {
      state.users.push({
        id: lu.id,
        name: lu.name,
        initials: lu.initials,
        email: lu.email,
        role: lu.role || 'usuario'
      });
    }
  });

  if (state.currentUser && !state.users.find(u => u.id === state.currentUser.id)) {
    state.users.push({
      id: state.currentUser.id,
      name: state.currentUser.name,
      initials: state.currentUser.initials,
      email: state.currentUser.email,
      role: 'usuario'
    });
  }
}

function renderMembersDropdown() {
  const dropdown = document.getElementById('membersDropdown');
  const mergedUsers = (state.users || []).filter(u => u && u.initials);

  dropdown.innerHTML = mergedUsers.map(u => {
    const selected = state.selectedMembers.includes(u.initials);
    return `
      <div class="member-option ${selected ? 'selected' : ''}" data-initials="${u.initials}">
        ${renderMemberAvatar(u.initials, 'mini')}
        <span>${esc(u.name)}</span>
      </div>
    `;
  }).join('');

  dropdown.querySelectorAll('.member-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const initials = opt.dataset.initials;
      const idx = state.selectedMembers.indexOf(initials);
      if (idx !== -1) {
        state.selectedMembers.splice(idx, 1);
        opt.classList.remove('selected');
      } else {
        state.selectedMembers.push(initials);
        opt.classList.add('selected');
      }

      if (!state.selectedMembers.length) {
        state.selectedMembers = [getDefaultResponsibleInitials()];
      }

      renderSelectedMembers();
    });
  });
}

function renderSelectedMembers() {
  const row = document.getElementById('membersRow');
  const membersHTML = state.selectedMembers.map(m => renderMemberAvatar(m, 'normal')).join('');

  row.innerHTML = membersHTML + `
    <button class="btn-add-member" id="btnAddMember" aria-label="Adicionar membro">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  `;
  setupMembersSelect();
}
