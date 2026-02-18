/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Estado Global                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

const API = '';

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
  meetingFilters: {
    status: '',
    type: '',
    member: '',
    responsible: '',
    frequency: '',
  },
};
