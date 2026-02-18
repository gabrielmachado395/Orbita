/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Header & Filtros                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupHeader() {
  const btnNew = document.getElementById('btnNewMeeting');
  const btnFilter = document.getElementById('btnFilter');

  btnNew.addEventListener('click', openModal);
  btnFilter.addEventListener('click', openFilterPanel);
}

function setupFilterPanel() {
  const overlay = document.getElementById('filterPanelOverlay');
  const panel = document.getElementById('filterPanel');
  const closeBtn = document.getElementById('fpClose');
  const applyBtn = document.getElementById('fpApply');

  closeBtn.addEventListener('click', closeFilterPanel);
  overlay.addEventListener('click', closeFilterPanel);

  applyBtn.addEventListener('click', () => {
    state.meetingFilters = {
      status: document.getElementById('fpStatus').value,
      type: document.getElementById('fpType').value,
      member: document.getElementById('fpMember').value,
      responsible: document.getElementById('fpResponsible').value,
      frequency: document.getElementById('fpFrequency').value,
    };

    applyMeetingFilters();
    closeFilterPanel();
    showToast('Filtros aplicados', 'success');
  });
}

function openFilterPanel() {
  document.getElementById('fpStatus').value = state.meetingFilters.status || '';
  document.getElementById('fpType').value = state.meetingFilters.type || '';
  document.getElementById('fpMember').value = state.meetingFilters.member || '';
  document.getElementById('fpResponsible').value = state.meetingFilters.responsible || '';
  document.getElementById('fpFrequency').value = state.meetingFilters.frequency || '';
  document.getElementById('filterPanel').classList.add('open');
  document.getElementById('filterPanelOverlay').classList.add('open');
}

function openFilterPanelForField(fieldId) {
  openFilterPanel();
  if (!fieldId) return;
  requestAnimationFrame(() => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.focus();
      if (typeof field.showPicker === 'function') {
        try { field.showPicker(); } catch (e) {}
      }
    }
  });
}

function closeFilterPanel() {
  document.getElementById('filterPanel').classList.remove('open');
  document.getElementById('filterPanelOverlay').classList.remove('open');
}

function populateFilterUsers() {
  const fpResp = document.getElementById('fpResponsible');
  const fpMember = document.getElementById('fpMember');

  state.users.forEach(u => {
    const opt1 = document.createElement('option');
    opt1.value = u.initials;
    opt1.textContent = u.name;
    fpResp.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = u.initials;
    opt2.textContent = u.name;
    fpMember.appendChild(opt2);
  });
}

function resetMeetingFilters() {
  state.meetingFilters = {
    status: '',
    type: '',
    member: '',
    responsible: '',
    frequency: '',
  };

  const fpStatus = document.getElementById('fpStatus');
  const fpType = document.getElementById('fpType');
  const fpMember = document.getElementById('fpMember');
  const fpResponsible = document.getElementById('fpResponsible');
  const fpFrequency = document.getElementById('fpFrequency');

  if (fpStatus) fpStatus.value = '';
  if (fpType) fpType.value = '';
  if (fpMember) fpMember.value = '';
  if (fpResponsible) fpResponsible.value = '';
  if (fpFrequency) fpFrequency.value = '';

  syncFilterChips();
}

function syncFilterChips() {
  const row = document.getElementById('filterChipsRow');
  if (!row) return;

  const defs = [
    { key: 'status', label: 'Status', fieldId: 'fpStatus' },
    { key: 'type', label: 'Tipo', fieldId: 'fpType' },
    { key: 'responsible', label: 'Responsável', fieldId: 'fpResponsible' },
    { key: 'member', label: 'Membro', fieldId: 'fpMember' },
    { key: 'frequency', label: 'Frequência', fieldId: 'fpFrequency' }
  ];

  const active = defs.filter(d => state.meetingFilters[d.key]);

  row.innerHTML = active.map(d => {
    const value = state.meetingFilters[d.key];
    const option = document.querySelector(`#${d.fieldId} option[value="${value}"]`);
    const text = option ? option.textContent : value;
    return `
      <button class="filter-chip-tag" data-filter-key="${d.key}" data-filter-field="${d.fieldId}" title="Editar filtro ${d.label}">
        <span class="chip-label">${d.label}</span>
        <span class="chip-value">${esc(text || '')}</span>
        <svg class="chip-remove" data-chip-remove="${d.key}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <svg class="chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    `;
  }).join('');
}
