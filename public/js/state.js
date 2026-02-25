/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Estado Global                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

const API = (() => {
  const fromStorage = (localStorage.getItem('plataforma_api_base') || '').trim();
  const fallback = 'https://mediumpurple-loris-159660.hostingersite.com';
  let base = fromStorage || fallback;

  // Sanitiza entradas comuns quebradas no localStorage:
  // - aspas extras: "https://..."
  // - espaços no início/fim
  // - barra no final
  base = base.replace(/^['"]+|['"]+$/g, '').trim();

  // Se vier sem protocolo (ex.: localhost:3000), normaliza para evitar
  // DOMException: "The string did not match the expected pattern."
  if (!/^https?:\/\//i.test(base)) {
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(base)) {
      base = `${window.location.protocol}//${base}`;
    } else {
      base = `https://${base}`;
    }
  }

  base = base.replace(/\/+$/, '');

  // Validação final robusta da URL.
  try {
    const u = new URL(base);
    if (!/^https?:$/i.test(u.protocol)) throw new Error('invalid protocol');
    return u.origin + (u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, ''));
  } catch (_) {
    return fallback;
  }
})();

const state = {
  allMeetings: [],
  meetings: [],
  users: [],
  notifications: [],
  selectedType: 'Gerencial',
  recurrence: 'never',
  active: true,
  selectedMembers: ['GM'],
  filterOpen: false,
  currentView: 'list',
  currentMeeting: null,
  chronoInterval: null,
  chronoSeconds: 0,
  chronoStartedAt: null,
  chronoRunning: false,
  sidebarOrgOpen: true,
  ataMonth: new Date().getMonth(),
  ataYear: new Date().getFullYear(),
  pendingStartMeeting: null,
  pendingSelectedGuests: [],
  editingMeetingId: null,
  currentUser: null,
  filterResp: null,
  filterStatus: null,
  activeNav: 'reunioes-workspace',
  workspaceData: null,
  workspaceUI: {
    selectedPlanId: '',
    selectedProjectId: '',
    selectedTaskId: '',
  },
  meetingFilters: {
    status: '',
    type: '',
    member: '',
    responsible: '',
    frequency: '',
  },
};
