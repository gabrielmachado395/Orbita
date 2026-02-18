/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Detail View                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupDetailView() {
  document.getElementById('btnBack').addEventListener('click', closeDetail);

  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('tabResumo').classList.toggle('hidden', tabName !== 'resumo');
      document.getElementById('tabAnexos').classList.toggle('hidden', tabName !== 'anexos');
      document.getElementById('tabAta').classList.toggle('hidden', tabName !== 'ata');
      if (tabName === 'anexos') renderAttachments();
      if (tabName === 'ata') updateAtaDisplay();
    });
  });

  document.getElementById('highlightInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target;
      const text = input.value.trim();
      if (!text || !state.currentMeeting) return;

      try {
        const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
        const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
        const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}/highlights${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error('Erro');
        const hl = await res.json();
        state.currentMeeting.highlights = state.currentMeeting.highlights || [];
        state.currentMeeting.highlights.push(hl);
        input.value = '';
        renderHighlights();
      } catch (err) {
        showToast('Erro ao criar destaque', 'error');
      }
    }
  });

  /* ── Destaques / Pautas tab switching ──────────────────────────────────── */
  const tabDestaques = document.getElementById('tabBtnDestaques');
  const tabPautas    = document.getElementById('tabBtnPautas');
  const destContent  = document.getElementById('destaquesContent');
  const pautContent  = document.getElementById('pautasContent');

  if (tabDestaques && tabPautas && destContent && pautContent) {
    tabDestaques.addEventListener('click', () => {
      tabDestaques.classList.add('active');
      tabPautas.classList.remove('active');
      destContent.classList.remove('hidden');
      pautContent.classList.add('hidden');
    });
    tabPautas.addEventListener('click', () => {
      tabPautas.classList.add('active');
      tabDestaques.classList.remove('active');
      pautContent.classList.remove('hidden');
      destContent.classList.add('hidden');
    });
  }

  /* ── Pauta input ─────────────────────────────────────────────────────── */
  const pautaInput = document.getElementById('pautaInput');
  if (pautaInput) {
    pautaInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = pautaInput.value.trim();
        if (!text || !state.currentMeeting) return;

        try {
          const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
          const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
          const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}/pautas${query}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });
          if (!res.ok) throw new Error('Erro');
          const pauta = await res.json();

          state.currentMeeting.pautas = state.currentMeeting.pautas || [];
          state.currentMeeting.pautas.push(pauta);
          pautaInput.value = '';
          renderPautas();
        } catch (err) {
          showToast('Erro ao criar pauta', 'error');
        }
      }
    });
  }

  /* ── Filter dropdowns (responsável / status) ─────────────────────────── */
  setupColFilters();

  document.querySelectorAll('.detail-col-right .col-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-col-right .col-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRightColumn();
    });
  });

  const rightAdd = document.getElementById('btnRightAdd');
  if (rightAdd) {
    rightAdd.addEventListener('click', () => {
      const input = document.getElementById('rightItemInput');
      if (input) input.focus();
    });
  }

  document.getElementById('btnUpload').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', handleAttachmentUpload);

  const ataSearchBtn = document.getElementById('ataSearchBtn');
  if (ataSearchBtn) {
    ataSearchBtn.addEventListener('click', updateAtaDisplay);
  }

  const ataYearInput = document.getElementById('ataYearInput');
  if (ataYearInput) {
    ataYearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateAtaDisplay();
      }
    });
  }

  document.getElementById('chronoPlay').addEventListener('click', toggleChrono);

  document.getElementById('btnDetailSettings').addEventListener('click', async () => {
    if (!state.currentMeeting) return;

    try {
      const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
      const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
      const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}${query}`);
      if (res.ok) {
        const freshMeeting = await res.json();
        state.currentMeeting = freshMeeting;
        if (Array.isArray(state.allMeetings)) {
          const idx = state.allMeetings.findIndex(m => m.id === freshMeeting.id);
          if (idx !== -1) state.allMeetings[idx] = freshMeeting;
        }
      }
    } catch (e) {
    }

    if (!canCurrentUserEditMeeting(state.currentMeeting)) {
      showToast('Somente o responsável pode editar os dados da reunião', 'info');
      return;
    }
    openModalForEdit(state.currentMeeting);
  });
}

function openMeetingDetail(meeting) {
  state.currentMeeting = meeting;
  state.currentView = 'detail';
  state.filterResp = null;
  state.filterStatus = null;

  fetchMeetingByIdForCurrentUser(meeting.id).then(freshMeeting => {
    if (!freshMeeting || !state.currentMeeting || state.currentMeeting.id !== freshMeeting.id) return;

    state.currentMeeting = freshMeeting;

    if (Array.isArray(state.allMeetings)) {
      const idx = state.allMeetings.findIndex(m => m.id === freshMeeting.id);
      if (idx !== -1) state.allMeetings[idx] = freshMeeting;
    }

    const btnDetailSettings = document.getElementById('btnDetailSettings');
    if (btnDetailSettings) {
      btnDetailSettings.style.display = canCurrentUserEditMeeting(freshMeeting) ? '' : 'none';
    }

    renderHighlights();
    renderPautas();
    renderRightColumn();
  });

  document.getElementById('detailTitle').textContent = meeting.name;

  const dateObj = new Date(meeting.date + 'T00:00:00');
  document.getElementById('detailDate').textContent =
    dateObj.toLocaleDateString('pt-BR');
  document.getElementById('detailTime').textContent =
    meeting.time ? meeting.time.replace(':', 'h') : '';

  const resp = meeting.responsible || (meeting.members && meeting.members[0]) || 'GM';
  const respAvatarEl = document.getElementById('detailRespAvatar');
  if (typeof applyUserAvatarToElement === 'function') {
    applyUserAvatarToElement(respAvatarEl, resp);
  } else {
    respAvatarEl.textContent = resp;
  }

  const respInfo = (typeof getUserDisplay === 'function')
    ? getUserDisplay(resp)
    : { name: resp };
  document.getElementById('detailRespName').textContent = respInfo.name || resp;

  const btnDetailSettings = document.getElementById('btnDetailSettings');
  if (btnDetailSettings) {
    btnDetailSettings.style.display = canCurrentUserEditMeeting(meeting) ? '' : 'none';
  }

  const membersToShow = (meeting.presentMembers && meeting.presentMembers.length)
    ? meeting.presentMembers
    : (meeting.members || []);

  const membersEl = document.getElementById('detailMembers');
  membersEl.innerHTML = membersToShow.map(m => {
    if (typeof renderUserAvatar === 'function') {
      return renderUserAvatar(m);
    }
    const u = state.users.find(x => x.initials === m);
    const label = u ? u.name : m;
    return `<span class="card-avatar" title="${esc(label)}">${esc(m)}</span>`;
  }).join('');

  document.getElementById('detailDesc').textContent = meeting.description || '';

  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.detail-tab[data-tab="resumo"]').classList.add('active');
  document.getElementById('tabResumo').classList.remove('hidden');
  document.getElementById('tabAnexos').classList.add('hidden');
  document.getElementById('tabAta').classList.add('hidden');

  renderHighlights();
  renderPautas();

  state.currentMeeting.tasks = Array.isArray(state.currentMeeting.tasks) ? state.currentMeeting.tasks : [];
  state.currentMeeting.notes = Array.isArray(state.currentMeeting.notes) ? state.currentMeeting.notes : [];
  state.currentMeeting.attachments = Array.isArray(state.currentMeeting.attachments) ? state.currentMeeting.attachments : [];
  const rightTabs = document.querySelectorAll('.detail-col-right .col-tab');
  rightTabs.forEach(t => t.classList.remove('active'));
  const defaultRightTab = document.querySelector('.detail-col-right .col-tab[data-coltab="tarefas"]');
  if (defaultRightTab) defaultRightTab.classList.add('active');
  renderRightColumn();

  // Reset destaques/pautas tabs
  const tabDest = document.getElementById('tabBtnDestaques');
  const tabPaut = document.getElementById('tabBtnPautas');
  const destC = document.getElementById('destaquesContent');
  const pautC = document.getElementById('pautasContent');
  if (tabDest) tabDest.classList.add('active');
  if (tabPaut) tabPaut.classList.remove('active');
  if (destC) destC.classList.remove('hidden');
  if (pautC) pautC.classList.add('hidden');

  renderAttachments();

  state.ataMonth = dateObj.getMonth();
  state.ataYear = dateObj.getFullYear();
  const ataMonthSelect = document.getElementById('ataMonthSelect');
  const ataYearInput = document.getElementById('ataYearInput');
  if (ataMonthSelect) ataMonthSelect.value = String(state.ataMonth);
  if (ataYearInput) ataYearInput.value = String(state.ataYear);
  updateAtaDisplay();

  // Se a reunião já está em andamento, não zere o cronômetro (evita parar após start)
  if (state.currentMeeting && state.currentMeeting.status === 'in_progress') {
    // Carrega duração conhecida (se houver) sem parar o timer local
    state.chronoSeconds = Number(state.currentMeeting.actualDurationSeconds || state.chronoSeconds || 0);
    const total = state.chronoSeconds;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const timeEl = document.getElementById('chronoTime');
    if (timeEl) {
      timeEl.textContent =
        String(hrs).padStart(2, '0') + ':' +
        String(mins).padStart(2, '0') + ':' +
        String(secs).padStart(2, '0');
    }
  } else {
    resetChrono();
  }

  document.getElementById('listView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
}

function closeDetail() {
  state.currentView = 'list';
  state.currentMeeting = null;
  stopChrono();

  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listView').classList.remove('hidden');

  reloadMeetings();
}

function getCurrentUserInitials() {
  return (state.currentUser && state.currentUser.initials) || 'GM';
}

async function fetchMeetingByIdForCurrentUser(meetingId) {
  if (!meetingId) return null;
  try {
    const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
    const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
    const res = await fetch(`${API}/api/meetings/${meetingId}${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function canCurrentUserEditMeeting(meeting) {
  if (!meeting) return false;
  return getCurrentUserInitials() === (meeting.responsible || (meeting.members && meeting.members[0]) || 'GM');
}

function canManageMeetingItems(meeting, user) {
    return (
        meeting &&
        user &&
        meeting.status === 'in_progress' &&
        (meeting.members.includes(user.initials) || meeting.members.includes(user.id))
    );
}
// 

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function persistMeetingAttachments(attachments) {
  if (!state.currentMeeting || !state.currentMeeting.id) return;
  const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
  const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
  const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachments })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao salvar anexos');
  }

  const updated = await res.json();
  state.currentMeeting = updated;
  if (Array.isArray(state.allMeetings)) {
    const idx = state.allMeetings.findIndex(m => m.id === updated.id);
    if (idx !== -1) state.allMeetings[idx] = updated;
  }
}

async function handleAttachmentUpload(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length || !state.currentMeeting) return;

  if (!canCurrentUserEditMeeting(state.currentMeeting)) {
    showToast('Somente o responsável pode enviar anexos', 'info');
    return;
  }

  const current = Array.isArray(state.currentMeeting.attachments) ? [...state.currentMeeting.attachments] : [];

  const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024; // 30MB por arquivo (base64 + JSON cresce bastante)
  const hint = document.getElementById('uploadMaxHint');
  if (hint) hint.textContent = 'máximo 30MB por arquivo';

  try {
    const mapped = [];
    for (const file of files) {
      if (Number(file.size) > MAX_ATTACHMENT_BYTES) {
        showToast(`Arquivo "${file.name}" excede o máximo de 30MB`, 'error');
        continue;
      }
      const dataUrl = await readFileAsDataURL(file);
      mapped.push({
        id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl,
        uploadedBy: getCurrentUserInitials(),
        uploadedAt: new Date().toISOString()
      });
    }

    if (!mapped.length) return;

    const next = [...current, ...mapped];
    // Optimistic update: render immediately
    state.currentMeeting.attachments = next;
    renderAttachments();
    showToast(`${mapped.length} anexo(s) enviado(s)`, 'success');

    // Persist in background
    await persistMeetingAttachments(next);
  } catch (err) {
    // Revert on error
    state.currentMeeting.attachments = current;
    renderAttachments();
    showToast(err.message || 'Erro ao enviar anexo', 'error');
  }
}

function renderAttachments() {
  const list = document.getElementById('attachmentsList');
  const btnUpload = document.getElementById('btnUpload');
  if (!list || !state.currentMeeting) return;

  const canManage = canCurrentUserEditMeeting(state.currentMeeting);
  if (btnUpload) btnUpload.style.display = canManage ? '' : 'none';

  const attachments = Array.isArray(state.currentMeeting.attachments) ? state.currentMeeting.attachments : [];
  if (!attachments.length) {
    list.innerHTML = '<div class="empty-col">Nenhum anexo nesta reunião</div>';
    return;
  }

  list.innerHTML = attachments.map(a => {
    const uploadedAt = a.uploadedAt ? new Date(a.uploadedAt).toLocaleDateString('pt-BR') : '';
    return `
      <div class="attachment-item attachment-row" data-attachment-id="${esc(a.id)}">
        <div class="attachment-main">
          <span class="attachment-name">${esc(a.name || 'Arquivo')}</span>
          <span class="attachment-size">${formatFileSize(Number(a.size) || 0)}${uploadedAt ? ` • ${esc(uploadedAt)}` : ''}</span>
        </div>
        <div class="attachment-actions">
          <button class="attachment-action" data-attachment-view="${esc(a.id)}" aria-label="Visualizar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="attachment-action" data-attachment-download="${esc(a.id)}" aria-label="Baixar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          ${canManage ? `<button class="attachment-action danger" data-attachment-delete="${esc(a.id)}" aria-label="Excluir"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-attachment-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attachmentView;
      const item = attachments.find(a => a.id === id);
      if (!item || !item.dataUrl) return;
      openAttachmentPreview(item);
    });
  });

  list.querySelectorAll('[data-attachment-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attachmentDownload;
      const item = attachments.find(a => a.id === id);
      if (!item || !item.dataUrl) return;
      const link = document.createElement('a');
      link.href = item.dataUrl;
      link.download = item.name || 'anexo';
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  });

  list.querySelectorAll('[data-attachment-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.attachmentDelete;
      const previous = [...attachments];
      const next = attachments.filter(a => a.id !== id);
      // Optimistic update
      state.currentMeeting.attachments = next;
      renderAttachments();
      showToast('Anexo removido', 'success');
      try {
        await persistMeetingAttachments(next);
      } catch (e) {
        state.currentMeeting.attachments = previous;
        renderAttachments();
        showToast(e.message || 'Erro ao excluir anexo', 'error');
      }
    });
  });
}

// Função utilitária para atualizar reuniões e detalhes
async function refreshMeetingsAndDetails(meetingId, user) {
  // Atualiza lista de reuniões
  const meetingsRes = await fetch(`${API}/api/meetings?user=${user}`);
  if (meetingsRes.ok) {
    state.meetings = await meetingsRes.json();
    if (typeof renderMeetings === 'function') renderMeetings();
  }
  // Atualiza detalhes da reunião atual
  const detailRes = await fetch(`${API}/api/meetings/${meetingId}?user=${user}`);
  if (detailRes.ok) {
    state.currentMeeting = await detailRes.json();
    // Adicione estas linhas:
    renderHighlights();
    renderPautas();
    renderRightColumn();
  }
}

// Exemplo de uso após iniciar reunião
async function startMeeting(meetingId, user) {
  const res = await fetch(`${API}/api/meetings/${meetingId}/start?user=${user}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentMembers: [user] })
  });
  if (!res.ok) {
    showToast('Erro ao iniciar reunião', 'error');
    return;
  }
  // Aguarde o backend atualizar e só então faça o fetch atualizado
  await new Promise(resolve => setTimeout(resolve, 300)); // pequeno delay para garantir escrita no disco
  await refreshMeetingsAndDetails(meetingId, user);
  showToast('Reunião iniciada!', 'success');
}

// Exemplo de uso após finalizar reunião
async function completeMeeting(meetingId, user, durationSeconds) {
  const res = await fetch(`${API}/api/meetings/${meetingId}/complete?user=${user}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationSeconds })
  });
  if (!res.ok) {
    showToast('Erro ao finalizar reunião', 'error');
    return;
  }
  await refreshMeetingsAndDetails(meetingId, user);
  showToast('Reunião finalizada!', 'success');
}

// Exemplo de uso após criar reunião (adapte conforme fluxo)
async function createMeeting(payload, user) {
  const res = await fetch(`${API}/api/meetings?user=${user}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    showToast('Erro ao criar reunião', 'error');
    return;
  }
  const newMeeting = await res.json();
  await refreshMeetingsAndDetails(newMeeting.id, user);
  showToast('Reunião criada!', 'success');
}



/* ── Attachment Preview Modal ──────────────────────────────────────────── */
function openAttachmentPreview(attachment) {
  let overlay = document.getElementById('attachmentPreviewOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'attachmentPreviewOverlay';
    overlay.className = 'attachment-preview-overlay';
    overlay.innerHTML = `
      <div class="attachment-preview-card">
        <div class="attachment-preview-header">
          <span class="attachment-preview-name" id="previewFileName"></span>
          <div class="attachment-preview-actions">
            <button class="attachment-action" id="previewDownloadBtn" aria-label="Baixar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="attachment-action" id="previewCloseBtn" aria-label="Fechar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="attachment-preview-body" id="previewBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    document.getElementById('previewCloseBtn').addEventListener('click', () => overlay.classList.remove('open'));
  }

  document.getElementById('previewFileName').textContent = attachment.name || 'Arquivo';

  const downloadBtn = document.getElementById('previewDownloadBtn');
  downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.href = attachment.dataUrl;
    link.download = attachment.name || 'anexo';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const body = document.getElementById('previewBody');
  const type = (attachment.type || '').toLowerCase();

  if (type.startsWith('image/')) {
    body.innerHTML = `<img src="${attachment.dataUrl}" alt="${esc(attachment.name)}" class="preview-image">`;
  } else if (type === 'application/pdf') {
    body.innerHTML = `<iframe src="${attachment.dataUrl}" class="preview-iframe" title="${esc(attachment.name)}"></iframe>`;
  } else if (type.startsWith('video/')) {
    body.innerHTML = `<video src="${attachment.dataUrl}" controls class="preview-video"></video>`;
  } else if (type.startsWith('audio/')) {
    body.innerHTML = `<div class="preview-audio-wrap"><audio src="${attachment.dataUrl}" controls></audio></div>`;
  } else if (type.startsWith('text/') || type === 'application/json') {
    try {
      const decoded = atob(attachment.dataUrl.split(',')[1]);
      body.innerHTML = `<pre class="preview-text">${esc(decoded.substring(0, 50000))}</pre>`;
    } catch {
      body.innerHTML = `<div class="preview-unsupported"><p>Não é possível visualizar este arquivo</p><button class="btn-save" onclick="document.getElementById('previewDownloadBtn').click()">Baixar arquivo</button></div>`;
    }
  } else {
    body.innerHTML = `
      <div class="preview-unsupported">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p class="preview-unsupported-name">${esc(attachment.name || 'Arquivo')}</p>
        <p class="preview-unsupported-size">${formatFileSize(Number(attachment.size) || 0)}</p>
        <button class="btn-save" onclick="document.getElementById('previewDownloadBtn').click()">Baixar arquivo</button>
      </div>
    `;
  }

  overlay.classList.add('open');
}

function getAtaMeetingsForSelectedPeriod() {
  if (!state.currentMeeting) return [];
  const monthSelect = document.getElementById('ataMonthSelect');
  const yearInput = document.getElementById('ataYearInput');
  const selectedMonth = Number(monthSelect ? monthSelect.value : state.ataMonth);
  const selectedYear = Number(yearInput ? yearInput.value : state.ataYear);

  const sameSeries = (state.allMeetings || []).filter(m => {
    if (!m || !m.date) return false;
    if (m.name !== state.currentMeeting.name) return false;
    const d = new Date(m.date + 'T00:00:00');
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  sameSeries.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
  return sameSeries;
}

function formatDuration(seconds, fallback = '-') {
  if (!Number.isFinite(Number(seconds))) return fallback;
  const total = Number(seconds);
  const hrs = Math.floor(total / 3600).toString().padStart(2, '0');
  const mins = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(total % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function renderAtaItemCards(items, renderItem) {
  if (!Array.isArray(items) || !items.length) return '<p class="ata-empty-sm">Sem registros</p>';
  return `<div class="ata-items-grid">${items.map(renderItem).join('')}</div>`;
}


function showMeetingCompletionCard(meeting) {
  return;
}

function getActiveRightTab() {
  const activeTab = document.querySelector('.detail-col-right .col-tab.active');
  return activeTab ? activeTab.dataset.coltab : 'tarefas';
}

function getRightTabMeta() {
  const tab = getActiveRightTab();
  if (tab === 'anotacoes') {
    return {
      key: 'notes',
      singular: 'anotação',
      pluralEmpty: 'Nenhuma anotação',
      inputPlaceholder: 'Nova anotação'
    };
  }
  return {
    key: 'tasks',
    singular: 'tarefa',
    pluralEmpty: 'Nenhuma tarefa',
    inputPlaceholder: 'Nova tarefa'
  };
}

async function persistMeetingWorkItems(payload) {
  if (!state.currentMeeting || !state.currentMeeting.id) return;
  const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
  const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
  const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao salvar');
  }

  const updated = await res.json();
  state.currentMeeting = updated;
  if (Array.isArray(state.allMeetings)) {
    const idx = state.allMeetings.findIndex(m => m.id === updated.id);
    if (idx !== -1) state.allMeetings[idx] = updated;
  }
}

function renderRightColumn() {
  const area = document.getElementById('tasksArea');
  const addBtn = document.getElementById('btnRightAdd');
  if (!area || !state.currentMeeting) return;

  const canManage = canCurrentUserEditMeeting(state.currentMeeting);
  const canCheckItems = canManage && canManageMeetingItems(state.currentMeeting);
  const meta = getRightTabMeta();
  const items = Array.isArray(state.currentMeeting[meta.key]) ? state.currentMeeting[meta.key] : [];

  if (addBtn) {
    addBtn.style.display = canManage ? '' : 'none';
    addBtn.title = canManage ? `Adicionar ${meta.singular}` : '';
  }

  const listMarkup = items.length
    ? items.map(item => {
      const creator = item.createdBy || getCurrentUserInitials();
      const createdInfo = (typeof getUserDisplay === 'function') ? getUserDisplay(creator) : { name: creator };
      const creatorName = createdInfo.name || creator;
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '';

      if (meta.key === 'tasks') {
        return `
          <article class="right-item-card ${item.checked ? 'is-done' : ''}" data-item-id="${item.id}">
            ${canCheckItems ? `<button class="right-task-check ${item.checked ? 'checked' : ''}" data-task-check="${item.id}" aria-label="Marcar tarefa"></button>` : ''}
            <div class="right-item-main">
              <p class="right-item-text">${esc(item.text || '')}</p>
              <div class="right-item-meta">
                ${(typeof renderUserAvatar === 'function') ? renderUserAvatar(creator) : `<span class="hl-avatar">${esc(creator)}</span>`}
                <span>${esc(creatorName)}</span>
                ${createdAt ? `<span class="right-dot">•</span><span>${esc(createdAt)}</span>` : ''}
              </div>
            </div>
            ${canManage ? `<button class="right-item-delete" data-item-delete="${item.id}" aria-label="Excluir tarefa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
          </article>
        `;
      }

      return `
        <article class="right-item-card note-card" data-item-id="${item.id}">
          <div class="right-note-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="right-item-main">
            <p class="right-item-text">${esc(item.text || '')}</p>
            <div class="right-item-meta">
              ${(typeof renderUserAvatar === 'function') ? renderUserAvatar(creator) : `<span class="hl-avatar">${esc(creator)}</span>`}
              <span>${esc(creatorName)}</span>
              ${createdAt ? `<span class="right-dot">•</span><span>${esc(createdAt)}</span>` : ''}
            </div>
          </div>
          ${canManage ? `<button class="right-item-delete" data-item-delete="${item.id}" aria-label="Excluir anotação"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
        </article>
      `;
    }).join('')
    : `<div class="empty-col">${meta.pluralEmpty}</div>`;

  area.innerHTML = `
    ${canManage ? `
    <div class="right-composer">
      <textarea id="rightItemInput" class="right-input" rows="2" placeholder="${meta.inputPlaceholder}"></textarea>
      <button class="right-add-btn" id="btnAddRightItem">Adicionar</button>
    </div>
    ` : ''}
    <div class="right-items-list" id="rightItemsList">${listMarkup}</div>
  `;

  const input = document.getElementById('rightItemInput');
  const add = document.getElementById('btnAddRightItem');
  if (canManage && input && add) {
    const addItem = async () => {
      const text = input.value.replace(/\r\n/g, '\n').trim();
      if (!text) return;

      const newItem = {
        id: `${meta.key === 'tasks' ? 't' : 'n'}_${Date.now()}`,
        text,
        createdBy: getCurrentUserInitials(),
        createdAt: new Date().toISOString()
      };

      if (meta.key === 'tasks') newItem.checked = false;

      const previous = Array.isArray(state.currentMeeting[meta.key]) ? [...state.currentMeeting[meta.key]] : [];
      state.currentMeeting[meta.key] = [...previous, newItem];

      try {
        await persistMeetingWorkItems({ [meta.key]: state.currentMeeting[meta.key] });
        renderRightColumn();
      } catch (e) {
        state.currentMeeting[meta.key] = previous;
        showToast(e.message || `Erro ao criar ${meta.singular}`, 'error');
      }
    };

    add.addEventListener('click', addItem);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        addItem();
      }
    });
  }

  const list = document.getElementById('rightItemsList');
  if (!list) return;

  list.querySelectorAll('[data-task-check]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!canManage) return;
      if (!canCheckItems) {
        showToast('As tarefas só podem ser concluídas durante a reunião em andamento', 'info');
        return;
      }
      const id = btn.dataset.taskCheck;
      const previous = Array.isArray(state.currentMeeting.tasks) ? [...state.currentMeeting.tasks] : [];
      state.currentMeeting.tasks = previous.map(task => task.id === id ? { ...task, checked: !task.checked } : task);
      try {
        await persistMeetingWorkItems({ tasks: state.currentMeeting.tasks });
        renderRightColumn();
      } catch (e) {
        state.currentMeeting.tasks = previous;
        showToast(e.message || 'Erro ao atualizar tarefa', 'error');
      }
    });
  });

  list.querySelectorAll('[data-item-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!canManage) return;
      const id = btn.dataset.itemDelete;
      const previous = Array.isArray(state.currentMeeting[meta.key]) ? [...state.currentMeeting[meta.key]] : [];
      state.currentMeeting[meta.key] = previous.filter(item => item.id !== id);
      try {
        await persistMeetingWorkItems({ [meta.key]: state.currentMeeting[meta.key] });
        renderRightColumn();
      } catch (e) {
        state.currentMeeting[meta.key] = previous;
        showToast(e.message || `Erro ao excluir ${meta.singular}`, 'error');
      }
    });
  });
}

function renderResponsibleFilterAvatar(initials) {
  const info = (typeof getUserDisplay === 'function') ? getUserDisplay(initials) : null;
  const title = (info && info.name) || initials || '';

  if (info && info.photo) {
    return `<span class="col-filter-avatar has-photo" title="${esc(title)}"><img src="${esc(info.photo)}" alt="${esc(title)}" class="col-filter-avatar-photo"></span>`;
  }

  return `<span class="col-filter-avatar" title="${esc(title)}">${esc(initials || '')}</span>`;
}

async function persistCurrentMeetingPautas() {
  if (!state.currentMeeting || !state.currentMeeting.id) return;

  const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
  const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
  const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}${query}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pautas: state.currentMeeting.pautas || [] })
  });

  if (!res.ok) {
    throw new Error('Erro ao persistir pautas');
  }

  const updated = await res.json();
  state.currentMeeting = updated;
  if (Array.isArray(state.allMeetings)) {
    const idx = state.allMeetings.findIndex(m => m.id === updated.id);
    if (idx !== -1) state.allMeetings[idx] = updated;
  }
}

function renderHighlights() {
  const list = document.getElementById('highlightsList');
  let highlights = (state.currentMeeting && state.currentMeeting.highlights) || [];

  // Apply filters
  if (state.filterResp) {
    highlights = highlights.filter(hl => (hl.assignee || 'GM') === state.filterResp);
  }
  if (state.filterStatus) {
    if (state.filterStatus === 'done') highlights = highlights.filter(hl => hl.checked);
    else if (state.filterStatus === 'open') highlights = highlights.filter(hl => !hl.checked);
  }

  if (highlights.length === 0) {
    list.innerHTML = '<div class="empty-col">Nenhum destaque ainda</div>';
    return;
  }

  list.innerHTML = highlights.map(hl => `
    <div class="highlight-card" data-hl-id="${hl.id}">
      <div class="hl-drag">
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
      </div>
      <div class="hl-checkbox ${hl.checked ? 'checked' : ''} ${!canManageMeetingItems(state.currentMeeting, state.currentUser) ? 'disabled' : ''}" data-hl-check="${hl.id}"></div>
      <span class="hl-text ${hl.checked ? 'checked-text' : ''}">${esc(hl.text)}</span>
      <button class="hl-edit" data-hl-edit="${hl.id}" aria-label="Editar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      ${(typeof renderUserAvatar === 'function') ? renderUserAvatar(hl.assignee || 'GM') : `<span class="hl-avatar">${esc(hl.assignee || 'GM')}</span>`}
      <span class="hl-chevron">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>
      <button class="hl-delete" data-hl-del="${hl.id}" aria-label="Excluir">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('[data-hl-check]').forEach(cb => {
    cb.addEventListener('click', async () => {
      if (cb.classList.contains('disabled')) return;

      const id = cb.dataset.hlCheck;
      const hl = (state.currentMeeting.highlights || []).find(h => h.id === id);
      if (!hl) return;

      hl.checked = !hl.checked;
      cb.classList.toggle('checked', hl.checked);
      if (hl.checked) {
        cb.parentElement.querySelector('.hl-text').classList.add('checked-text');
      } else {
        cb.parentElement.querySelector('.hl-text').classList.remove('checked-text');
      }

      try {
        await persistMeetingWorkItems({ highlights: state.currentMeeting.highlights });
        showToast('Destaque atualizado!', 'success');
      } catch (e) {
        hl.checked = !hl.checked; // Reverte em caso de erro
        cb.classList.toggle('checked', hl.checked);
        showToast('Erro ao atualizar destaque', 'error');
      }
    });
  });

  list.querySelectorAll('[data-hl-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const hlId = btn.dataset.hlDel;
      try {
        const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
        const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
        await fetch(`${API}/api/meetings/${state.currentMeeting.id}/highlights/${hlId}${query}`, {
          method: 'DELETE'
        });
        state.currentMeeting.highlights = highlights.filter(h => h.id !== hlId);
        renderHighlights();
        showToast('Destaque removido', 'success');
      } catch (e) {
        showToast('Erro ao remover', 'error');
      }
    });
  });

  list.querySelectorAll('[data-hl-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const hlId = btn.dataset.hlEdit;
      const hl = highlights.find(h => h.id === hlId);
      if (!hl) return;
      const card = btn.closest('.highlight-card');
      const textSpan = card.querySelector('.hl-text');
      if (!textSpan || card.querySelector('.hl-inline-input')) return;

      const oldText = textSpan.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = oldText;
      input.className = 'hl-inline-input';
      textSpan.replaceWith(input);
      input.focus();
      input.select();

      const save = async () => {
        const newText = input.value.trim();
        if (!newText || newText === oldText) {
          const span = document.createElement('span');
          span.className = 'hl-text' + (hl.checked ? ' checked-text' : '');
          span.textContent = oldText;
          input.replaceWith(span);
          return;
        }
        try {
          const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
          const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
          await fetch(`${API}/api/meetings/${state.currentMeeting.id}/highlights/${hlId}${query}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newText })
          });
          hl.text = newText;
          renderHighlights();
        } catch (e) {
          showToast('Erro ao editar', 'error');
          const span = document.createElement('span');
          span.className = 'hl-text' + (hl.checked ? ' checked-text' : '');
          span.textContent = oldText;
          input.replaceWith(span);
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') {
          const span = document.createElement('span');
          span.className = 'hl-text' + (hl.checked ? ' checked-text' : '');
          span.textContent = oldText;
          input.replaceWith(span);
        }
      });
      input.addEventListener('blur', save);
    });
  });
}

function renderAtaAccordionBody(meeting) {
  const dateLabel = meeting.date ? new Date(meeting.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  const timeLabel = meeting.time ? meeting.time.replace(':', 'h') : '-';
  const durationLabel = formatDuration(meeting.actualDurationSeconds, meeting.duration || '-');

  const attachments = Array.isArray(meeting.attachments) ? meeting.attachments : [];
  const highlights = Array.isArray(meeting.highlights) ? meeting.highlights : [];
  const pautas = Array.isArray(meeting.pautas) ? meeting.pautas : [];
  const tasks = Array.isArray(meeting.tasks) ? meeting.tasks : [];
  const notes = Array.isArray(meeting.notes) ? meeting.notes : [];
  const presentMembers = Array.isArray(meeting.presentMembers) && meeting.presentMembers.length
    ? meeting.presentMembers
    : (Array.isArray(meeting.members) ? meeting.members : []);

  return `
    <div class="ata-report-meta">
      <span>${esc(dateLabel)}</span>
      <span>•</span>
      <span>${esc(timeLabel)}</span>
      <span>•</span>
      <span>Duração: ${esc(durationLabel)}</span>
    </div>

    <div class="ata-grid">
      <section>
        <h4>Destaques</h4>
        ${renderAtaItemCards(highlights, h => `
          <article class="ata-item-card">
            <p class="ata-item-title">${esc(h.text || '')}</p>
            <p class="ata-item-meta">${h.checked ? 'Concluído' : 'Em aberto'}</p>
          </article>
        `)}
      </section>

      <section>
        <h4>Pautas</h4>
        ${renderAtaItemCards(pautas, p => `
          <article class="ata-item-card">
            <p class="ata-item-title">${esc(p.text || '')}</p>
            <p class="ata-subline">${p.description ? esc(p.description) : 'Sem descrição'}</p>
          </article>
        `)}
      </section>

      <section>
        <h4>Tarefas</h4>
        ${renderAtaItemCards(tasks, t => `
          <article class="ata-item-card">
            <p class="ata-item-title">${esc(t.text || '')}</p>
            <p class="ata-item-meta ${t.checked ? 'ata-done' : ''}">${t.checked ? 'Concluída' : 'Pendente'}</p>
          </article>
        `)}
      </section>

      <section>
        <h4>Anotações</h4>
        ${renderAtaItemCards(notes, n => `
          <article class="ata-item-card">
            <p class="ata-item-title">${esc(n.text || '')}</p>
          </article>
        `)}
      </section>
    </div>

    <section class="ata-members-block">
      <h4>Participantes</h4>
      ${presentMembers.length
        ? `<div class="ata-members-list">${presentMembers.map(m => {
            const info = (typeof getUserDisplay === 'function') ? getUserDisplay(m) : { name: m };
            return `<span class="ata-member-chip">${esc(info.name || m)}</span>`;
          }).join('')}</div>`
        : '<p class="ata-empty-sm">Sem participantes registrados</p>'}
    </section>

    <section>
      <h4>Anexos</h4>
      ${attachments.length
        ? `<div class="ata-attachments">${attachments.map(a => `<button class="ata-file-link" data-ata-download="${esc(a.id)}" data-meeting-id="${esc(meeting.id)}">${esc(a.name || 'Arquivo')}</button>`).join('')}</div>`
        : '<p class="ata-empty-sm">Sem anexos</p>'}
    </section>
  `;
}

function updateAtaDisplay() {
  const ataContent = document.getElementById('ataContent');
  if (!ataContent || !state.currentMeeting) return;

  const meetings = getAtaMeetingsForSelectedPeriod();
  if (!meetings.length) {
    ataContent.innerHTML = '<p class="ata-empty">Não há registros de atas disponíveis para esse mês</p>';
    return;
  }

  ataContent.innerHTML = `
    <div class="ata-accordion-list">
      ${meetings.map((m, idx) => {
        const dateLabel = m.date ? new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
        const timeLabel = m.time ? m.time.replace(':', 'h') : '-';
        const statusLabel = m.status === 'completed' ? 'Finalizada' : (m.status === 'in_progress' ? 'Em andamento' : 'Não iniciada');
        return `
          <div class="ata-accordion-item" data-ata-idx="${idx}">
            <button class="ata-accordion-header" data-ata-toggle="${idx}">
              <div class="ata-accordion-info">
                <span class="ata-accordion-title">${esc(m.name || 'Reunião')}</span>
                <span class="ata-accordion-meta">${esc(dateLabel)} • ${esc(timeLabel)} • ${esc(statusLabel)}</span>
              </div>
              <svg class="ata-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="ata-accordion-body" id="ataAccBody${idx}">
              ${renderAtaAccordionBody(m)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Accordion toggle
  ataContent.querySelectorAll('[data-ata-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.ata-accordion-item');
      const wasOpen = item.classList.contains('open');
      // Close all
      ataContent.querySelectorAll('.ata-accordion-item').forEach(el => el.classList.remove('open'));
      // Toggle clicked
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Download links in all accordion bodies
  ataContent.querySelectorAll('[data-ata-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const meetingId = btn.dataset.meetingId;
      const id = btn.dataset.ataDownload;
      const m = meetings.find(x => x.id === meetingId);
      if (!m) return;
      const item = (m.attachments || []).find(a => a.id === id);
      if (!item || !item.dataUrl) return;
      const link = document.createElement('a');
      link.href = item.dataUrl;
      link.download = item.name || 'anexo';
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  });
}

/* ── Pautas rendering ──────────────────────────────────────────────────── */
function renderPautas() {
  const list = document.getElementById('pautasList');
  let pautas = (state.currentMeeting && state.currentMeeting.pautas) || [];

  if (state.filterResp) {
    pautas = pautas.filter(p => (p.assignee || 'GM') === state.filterResp);
  }

  if (state.filterStatus) {
    if (state.filterStatus === 'done') pautas = pautas.filter(p => p.checked);
    else if (state.filterStatus === 'open') pautas = pautas.filter(p => !p.checked);
  }

  if (!pautas.length) {
    list.innerHTML = '<div class="empty-col">Nenhuma pauta ainda</div>';
    return;
  }

  const currentUserKey = getCurrentUserInitials();
  const canToggle = canManageMeetingItems(state.currentMeeting, state.currentUser);

  list.innerHTML = pautas.map(p => `
    <div class="highlight-card pauta-card-styled" data-pauta-id="${p.id}">
      <div class="hl-drag">
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
        <div class="hl-drag-row"><span class="hl-drag-dot"></span><span class="hl-drag-dot"></span></div>
      </div>
      <div class="hl-checkbox ${p.checked ? 'checked' : ''} ${!canToggle ? 'disabled' : ''}" data-pauta-check="${p.id}"></div>
      <div class="pauta-main">
        <span class="hl-text ${p.checked ? 'checked-text' : ''}">${esc(p.text)}</span>
        ${p.description ? `<p class="pauta-description-saved">${esc(p.description)}</p>` : ''}
        ${((p.assignee || 'GM') === currentUserKey)
          ? `<div class="pauta-desc-actions">
              ${!p.description
                ? `<button class="pauta-add-desc-btn" data-pauta-add-desc="${p.id}">+ Adicionar descrição</button>`
                : `<button class="pauta-edit-desc-btn" data-pauta-edit-desc="${p.id}">Editar descrição</button>`}
            </div>
            <div class="pauta-desc-editor hidden" data-pauta-editor="${p.id}">
              <textarea class="pauta-description-input" data-pauta-desc="${p.id}" placeholder="Digite a descrição e pressione Enter">${esc(p.description || '')}</textarea>
            </div>`
          : ''}
      </div>
      ${(typeof renderUserAvatar === 'function') ? renderUserAvatar(p.assignee || 'GM') : `<span class="hl-avatar">${esc(p.assignee || 'GM')}</span>`}
      ${((p.assignee || 'GM') === currentUserKey) ? `<button class="hl-delete" data-pauta-del="${p.id}" aria-label="Excluir">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('[data-pauta-check]').forEach(cb => {
    cb.addEventListener('click', async () => {
      const id = cb.dataset.pautaCheck;
      const p = pautas.find(x => x.id === id);
      if (!p) return;
      if ((p.assignee || 'GM') !== currentUserKey) {
        showToast('Você só pode concluir a sua própria pauta', 'info');
        return;
      }
      if (!canToggle) {
        showToast('As pautas só podem ser concluídas durante a reunião em andamento', 'info');
        return;
      }

      try {
        const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
        const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
        const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}/pautas/${id}${query}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checked: !p.checked })
        });
        if (!res.ok) throw new Error('Erro');
        p.checked = !p.checked;
        renderPautas();
      } catch (e) {
        showToast('Erro ao atualizar pauta', 'error');
      }
    });
  });

  // Show/hide description editor
  list.querySelectorAll('[data-pauta-add-desc], [data-pauta-edit-desc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pautaAddDesc || btn.dataset.pautaEditDesc;
      const editor = list.querySelector(`[data-pauta-editor="${id}"]`);
      if (editor) {
        editor.classList.toggle('hidden');
        if (!editor.classList.contains('hidden')) {
          const textarea = editor.querySelector('textarea');
          if (textarea) textarea.focus();
        }
      }
    });
  });

  // Save description on Enter
  list.querySelectorAll('.pauta-description-input').forEach(textarea => {
    const id = textarea.dataset.pautaDesc;
    textarea.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const p = pautas.find(x => x.id === id);
        if (!p) return;
        if ((p.assignee || 'GM') !== currentUserKey) {
          showToast('Você só pode editar a descrição da sua própria pauta', 'info');
          return;
        }

        const nextDescription = textarea.value.replace(/\r\n/g, '\n').trim();

        try {
          const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
          const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
          const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}/pautas/${id}${query}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: nextDescription })
          });
          if (!res.ok) throw new Error('Erro');
          p.description = nextDescription;
          renderPautas();
          showToast('Descrição salva', 'success');
        } catch (e) {
          showToast('Erro ao salvar descrição', 'error');
        }
      }
    });
  });

  list.querySelectorAll('[data-pauta-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.pautaDel;
      const pauta = pautas.find(x => x.id === id);
      if (!pauta) return;
      if ((pauta.assignee || 'GM') !== currentUserKey) {
        showToast('Você só pode excluir a sua própria pauta', 'info');
        return;
      }
      try {
        const userKey = (typeof getCurrentUserQueryKey === 'function') ? getCurrentUserQueryKey() : '';
        const query = userKey ? `?user=${encodeURIComponent(userKey)}` : '';
        const res = await fetch(`${API}/api/meetings/${state.currentMeeting.id}/pautas/${id}${query}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erro');
        state.currentMeeting.pautas = pautas.filter(x => x.id !== id);
        renderPautas();
        showToast('Pauta removida', 'success');
      } catch (e) {
        showToast('Erro ao remover pauta', 'error');
      }
    });
  });
}

/* ── Column filter dropdowns (responsável / status) ────────────────────── */
function setupColFilters() {
  const respBtn = document.getElementById('btnFilterResp');
  const respDrop = document.getElementById('filterRespDropdown');
  const statusBtn = document.getElementById('btnFilterStatus');
  const statusDrop = document.getElementById('filterStatusDropdown');

  if (respBtn && respDrop) {
    respBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      populateFilterResp();
      respDrop.classList.toggle('open');
      if (statusDrop) statusDrop.classList.remove('open');
    });
  }

  if (statusBtn && statusDrop) {
    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      statusDrop.classList.toggle('open');
      if (respDrop) respDrop.classList.remove('open');
    });

    statusDrop.querySelectorAll('.col-filter-item').forEach(item => {
      item.addEventListener('click', () => {
        const wasActive = item.classList.contains('active');
        statusDrop.querySelectorAll('.col-filter-item').forEach(i => i.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
        statusDrop.classList.remove('open');
        
        // Apply filter
        state.filterStatus = wasActive ? null : item.dataset.status;
        renderHighlights();
        renderPautas();
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (respDrop && !respDrop.contains(e.target) && (!respBtn || !respBtn.contains(e.target))) respDrop.classList.remove('open');
    if (statusDrop && !statusDrop.contains(e.target) && (!statusBtn || !statusBtn.contains(e.target))) statusDrop.classList.remove('open');
  });
}

// Atualiza objeto da reunião após ação
if (state.currentMeeting && state.currentMeeting.id) {
fetchMeetingByIdForCurrentUser(state.currentMeeting.id).then(meeting => {
  state.currentMeeting = meeting;
  if (typeof renderMeetingDetails === 'function') renderMeetingDetails(meeting);
  if (typeof reloadMeetings === 'function') reloadMeetings();
});
}

function populateFilterResp() {
  const container = document.getElementById('filterRespItems');
  if (!container) return;

  const participants = Array.from(new Set([
    ...((state.currentMeeting && state.currentMeeting.members) || []),
    ...((state.currentMeeting && state.currentMeeting.presentMembers) || [])
  ])).filter(Boolean);

  // Clear and rebuild each time (apenas participantes da reunião)
  const currentFilter = state.filterResp || null;

  // Add "Todos" option first
  let html = `<button class="col-filter-item ${!currentFilter ? 'active' : ''}" data-initials="">Todos</button>`;
  html += participants.map(initials => {
    const active = currentFilter === initials ? 'active' : '';
    const info = (typeof getUserDisplay === 'function') ? getUserDisplay(initials) : { name: initials };
    return `<button class="col-filter-item ${active}" data-initials="${esc(initials)}">${renderResponsibleFilterAvatar(initials)} ${esc(info.name || initials)}</button>`;
  }).join('');

  container.innerHTML = html;

  container.querySelectorAll('.col-filter-item').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.col-filter-item').forEach(i => i.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('filterRespDropdown').classList.remove('open');

      // Apply filter
      state.filterResp = btn.dataset.initials || null;
      renderHighlights();
      renderPautas();
    });
  });
}
