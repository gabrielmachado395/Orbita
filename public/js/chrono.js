/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Cronômetro                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */


async function toggleChrono() {
  if (state.chronoRunning) {
    await stopChrono();
  } else {
    // Se há uma reunião pendente para iniciar, pede confirmação
    if (state.pendingStartMeeting) {
      // A confirmação já foi feita, pode iniciar
      startChrono();
      state.pendingStartMeeting = null;
    } else if (state.currentMeeting) {
      // Somente o responsável pode iniciar
      const currentInitials = (state.currentUser && state.currentUser.initials) || '';
      const responsible = (state.currentMeeting && (state.currentMeeting.responsible || (state.currentMeeting.members && state.currentMeeting.members[0]))) || '';
      if (currentInitials && responsible && currentInitials !== responsible) {
        showToast('Somente o responsável pode iniciar a reunião', 'info');
        return;
      }
      // Se não há confirmação pendente, abre overlay
      openStartConfirm(state.currentMeeting);
    }
  }
}

function startChrono() {
  // Protege contra múltiplos intervals
  if (state.chronoInterval) {
    clearInterval(state.chronoInterval);
    state.chronoInterval = null;
  }

  // Marca início relativo (permite retomar a partir de state.chronoSeconds)
  state.chronoStartedAt = Date.now() - (Number(state.chronoSeconds || 0) * 1000);
  state.chronoRunning = true;

  const playBtn = document.getElementById('chronoPlay');
  if (playBtn) {
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  }

  // Atualiza a UI imediatamente (evita espera de 1s)
  (function tickOnce() {
    const elapsed = Date.now() - state.chronoStartedAt;
    state.chronoSeconds = Math.floor(elapsed / 1000);
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
  })();

  // Interval com 500ms para melhorar responsividade
  state.chronoInterval = setInterval(() => {
    try {
      const elapsed = Date.now() - state.chronoStartedAt;
      state.chronoSeconds = Math.floor(elapsed / 1000);
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
    } catch (err) {
      console.error('Erro no cronômetro:', err);
    }
  }, 500);
}

async function stopChrono() {
  const wasRunning = state.chronoRunning;
  state.chronoRunning = false;
  if (state.chronoInterval) {
    clearInterval(state.chronoInterval);
    state.chronoInterval = null;
  }
  const playBtn = document.getElementById('chronoPlay');
  if (playBtn) {
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  if (
    wasRunning &&
    state.currentMeeting &&
    state.currentMeeting.id &&
    state.currentMeeting.status !== 'completed' &&
    state.chronoSeconds > 0
  ) {
    try {
      state.currentMeeting.status = 'completed';
      state.currentMeeting.actualDurationSeconds = state.chronoSeconds;
      state.currentMeeting.completedAt = new Date().toISOString();

      if (typeof persistCurrentMeetingLocal === 'function') {
        persistCurrentMeetingLocal();
      } else if (typeof getLocalMeetings === 'function' && typeof saveLocalMeetings === 'function') {
        const allMeetings = getLocalMeetings();
        const idx = allMeetings.findIndex((m) => String(m.id) === String(state.currentMeeting.id));
        if (idx >= 0) allMeetings[idx] = state.currentMeeting;
        else allMeetings.unshift(state.currentMeeting);
        saveLocalMeetings(allMeetings);
        state.allMeetings = allMeetings;
      }

      // Email automático: enviar ata/participantes ao finalizar.
      if (typeof sendMeetingCompletedEmailPayload === 'function') {
        if (typeof getEmailsForInitials === 'function') {
          const participants = (state.currentMeeting.presentMembers && state.currentMeeting.presentMembers.length)
            ? state.currentMeeting.presentMembers
            : (state.currentMeeting.members || []);
          state.currentMeeting.memberEmails = getEmailsForInitials(participants);
        }
        // Não travar o fluxo de finalização caso o email falhe.
        sendMeetingCompletedEmailPayload(state.currentMeeting);
      }

      // Recarrega lista para refletir cartão atualizado
      await reloadMeetings();

      // Fecha detalhe e volta à lista
      if (typeof closeDetail === 'function') {
        closeDetail();
      } else {
        state.currentView = 'list';
        state.currentMeeting = null;
        await reloadMeetings();
      }

      showToast('Reunião finalizada!', 'success');
    } catch (e) {
      showToast('Erro ao finalizar reunião', 'error');
      console.error(e);
    }
  }
}

function resetChrono() {
  stopChrono();
  state.chronoSeconds = 0;
  const timeEl = document.getElementById('chronoTime');
  if (timeEl) timeEl.textContent = '00:00:00';
}

