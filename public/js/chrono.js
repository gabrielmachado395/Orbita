/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Cronômetro                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function parseYmdToDate(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function dateToYmd(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsClamped(dt, months) {
  const day = dt.getDate();
  const target = new Date(dt.getFullYear(), dt.getMonth() + Number(months || 0), 1);
  // último dia do mês alvo
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function computeNextMeetingDateYmd(currentDateYmd, recurrence) {
  const base = parseYmdToDate(currentDateYmd);
  if (!base) return null;
  const rec = String(recurrence || '').toLowerCase();

  if (rec === 'weekly') {
    base.setDate(base.getDate() + 7);
    return dateToYmd(base);
  }

  if (rec === 'biweekly' || rec === '15days' || rec === '15 dias') {
    base.setDate(base.getDate() + 15);
    return dateToYmd(base);
  }

  if (rec === 'monthly') {
    return dateToYmd(addMonthsClamped(base, 1));
  }

  return null;
}

function cloneMeetingDeep(meeting) {
  if (!meeting) return meeting;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(meeting); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(meeting)); } catch (_) { return { ...meeting }; }
}


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
      const nowIso = new Date().toISOString();
      state.currentMeeting.status = 'completed';
      state.currentMeeting.actualDurationSeconds = state.chronoSeconds;
      state.currentMeeting.completedAt = nowIso;

      const recurrence = String(state.currentMeeting.recurrence || 'never');
      const hasRecurrence = recurrence && recurrence !== 'never';

      // Reunião recorrente: arquiva a ocorrência (para histórico/ata) e reagenda a próxima.
      if (hasRecurrence && typeof getLocalMeetings === 'function' && typeof saveLocalMeetings === 'function') {
        const completedOccurrence = cloneMeetingDeep(state.currentMeeting);

        // Próxima data baseada na data da ocorrência concluída
        const nextDate = computeNextMeetingDateYmd(completedOccurrence.date, recurrence);

        if (nextDate) {
          const seriesId = completedOccurrence.seriesId || completedOccurrence.id;

          // Arquivo (histórico) — mantém tudo e marca como "archived"
          completedOccurrence.seriesId = seriesId;
          completedOccurrence.archived = true;
          completedOccurrence.archivedOfId = state.currentMeeting.id;
          completedOccurrence.id = `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          completedOccurrence.nextMeetingDate = nextDate;

          // Próximo encontro — reaproveita o ID atual, mas reseta dados operacionais
          state.currentMeeting.seriesId = seriesId;
          state.currentMeeting.lastOccurrenceId = completedOccurrence.id;
          state.currentMeeting.lastOccurrenceDate = completedOccurrence.date;
          state.currentMeeting.date = nextDate;
          state.currentMeeting.status = 'not_started';
          state.currentMeeting.startedAt = null;
          state.currentMeeting.completedAt = null;
          state.currentMeeting.actualDurationSeconds = null;
          state.currentMeeting.presentMembers = [];
          state.currentMeeting.highlights = [];
          state.currentMeeting.pautas = [];
          state.currentMeeting.tasks = [];
          state.currentMeeting.notes = [];
          state.currentMeeting.attachments = [];
          state.currentMeeting.updatedAt = nowIso;

          const allMeetings = getLocalMeetings();
          const idx = allMeetings.findIndex((m) => String(m.id) === String(state.currentMeeting.id));
          if (idx >= 0) allMeetings[idx] = state.currentMeeting;
          else allMeetings.unshift(state.currentMeeting);

          // guarda histórico (completed) separado
          allMeetings.unshift(completedOccurrence);
          saveLocalMeetings(allMeetings);
          state.allMeetings = allMeetings;

          // Email automático: enviar ata/participantes ao finalizar com data da próxima reunião.
          if (typeof sendMeetingCompletedEmailPayload === 'function') {
            if (typeof getEmailsForInitials === 'function') {
              const participants = (completedOccurrence.presentMembers && completedOccurrence.presentMembers.length)
                ? completedOccurrence.presentMembers
                : (completedOccurrence.members || []);
              completedOccurrence.memberEmails = getEmailsForInitials(participants);
            }
            sendMeetingCompletedEmailPayload(completedOccurrence);
          }
        } else {
          // Se falhar ao calcular próxima data, mantém o comportamento normal (finaliza sem reagendar)
          if (typeof persistCurrentMeetingLocal === 'function') {
            persistCurrentMeetingLocal();
          } else {
            const allMeetings = getLocalMeetings();
            const idx = allMeetings.findIndex((m) => String(m.id) === String(state.currentMeeting.id));
            if (idx >= 0) allMeetings[idx] = state.currentMeeting;
            else allMeetings.unshift(state.currentMeeting);
            saveLocalMeetings(allMeetings);
            state.allMeetings = allMeetings;
          }

          if (typeof sendMeetingCompletedEmailPayload === 'function') {
            if (typeof getEmailsForInitials === 'function') {
              const participants = (state.currentMeeting.presentMembers && state.currentMeeting.presentMembers.length)
                ? state.currentMeeting.presentMembers
                : (state.currentMeeting.members || []);
              state.currentMeeting.memberEmails = getEmailsForInitials(participants);
            }
            sendMeetingCompletedEmailPayload(state.currentMeeting);
          }
        }
      } else {
        // Comportamento normal: apenas finalizar.
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

        if (typeof sendMeetingCompletedEmailPayload === 'function') {
          if (typeof getEmailsForInitials === 'function') {
            const participants = (state.currentMeeting.presentMembers && state.currentMeeting.presentMembers.length)
              ? state.currentMeeting.presentMembers
              : (state.currentMeeting.members || []);
            state.currentMeeting.memberEmails = getEmailsForInitials(participants);
          }
          sendMeetingCompletedEmailPayload(state.currentMeeting);
        }
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

