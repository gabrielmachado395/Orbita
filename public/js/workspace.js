/* ═══════════════════════════════════════════════════════════════════════════ */
/* Workspace / Secoes da Sidebar                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

const WORKSPACE_STORAGE_KEY = 'plataforma_workspace_v2';

function setupWorkspace() {
  ensureWorkspaceState();
  const view = document.getElementById('workspaceView');
  if (!view) return;

  view.addEventListener('submit', handleWorkspaceSubmit);
  view.addEventListener('change', handleWorkspaceChange);
  view.addEventListener('click', handleWorkspaceClick);
  view.addEventListener('dragstart', handleWorkspaceDragStart);
  view.addEventListener('dragover', handleWorkspaceDragOver);
  view.addEventListener('drop', handleWorkspaceDrop);
  view.addEventListener('dragend', handleWorkspaceDragEnd);

  
}

function ensureWorkspaceState() {
  if (!state.workspaceData) state.workspaceData = loadWorkspaceData();
  if (!state.workspaceUI) state.workspaceUI = {};
  if (!state.workspaceUI.expandedNodes) state.workspaceUI.expandedNodes = {};
  if (!state.workspaceUI.dragProjectId) state.workspaceUI.dragProjectId = '';
  if (!state.workspaceUI.modalEdit) state.workspaceUI.modalEdit = { kind: '', id: '' };
}

function loadWorkspaceData() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY) || localStorage.getItem('plataforma_workspace_v1');
    if (!raw) return emptyWorkspaceData();

    const parsed = JSON.parse(raw);
    const normalized = emptyWorkspaceData();

    normalized.indicadores = normalizeIndicadores(parsed.indicadores || []);
    normalized.setores = Array.isArray(parsed.setores) ? parsed.setores : [];
    normalized.reunioesTarefas = Array.isArray(parsed.reunioesTarefas) ? parsed.reunioesTarefas : [];
    normalized.reunioesProcessos = Array.isArray(parsed.reunioesProcessos) ? parsed.reunioesProcessos : [];
    normalized.relatorios = Array.isArray(parsed.relatorios) ? parsed.relatorios : [];

    const hasNewShape = Array.isArray(parsed.projetos) || Array.isArray(parsed.tarefas) || Array.isArray(parsed.processos);
    if (hasNewShape) {
      normalized.planejamentos = normalizePlanos(parsed.planejamentos || []);
      normalized.projetos = normalizeProjetos(parsed.projetos || []);
      normalized.tarefas = normalizeTarefas(parsed.tarefas || []);
      normalized.processos = normalizeProcessos(parsed.processos || []);
      return normalized;
    }

    // Migração da estrutura antiga (aninhada dentro de planejamentos)
    const plans = Array.isArray(parsed.planejamentos) ? parsed.planejamentos : [];

    plans.forEach((oldPlan) => {
      const planId = String(oldPlan.id || mkId('plan'));
      const plan = {
        id: planId,
        ano: Number(oldPlan.ano) || new Date().getFullYear(),
        nome: String(oldPlan.nome || 'Plano estratégico'),
        descricao: String(oldPlan.descricao || ''),
        projectIds: [],
      };
      normalized.planejamentos.push(plan);

      const oldProjects = Array.isArray(oldPlan.projetos) ? oldPlan.projetos : [];
      oldProjects.forEach((oldProject) => {
        const projectId = String(oldProject.id || mkId('proj'));
        normalized.projetos.push({
          id: projectId,
          nome: String(oldProject.nome || 'Projeto'),
          descricao: String(oldProject.descricao || ''),
          planId,
          managerIds: [],
        });
        plan.projectIds.push(projectId);

        const oldTasks = Array.isArray(oldProject.tarefas) ? oldProject.tarefas : [];
        oldTasks.forEach((oldTask) => {
          const taskId = String(oldTask.id || mkId('task'));
          normalized.tarefas.push({
            id: taskId,
            nome: String(oldTask.nome || 'Tarefa'),
            descricao: String(oldTask.descricao || ''),
            projectId,
            assigneeId: null,
          });

          const oldProcesses = Array.isArray(oldTask.processos) ? oldTask.processos : [];
          oldProcesses.forEach((oldProcess) => {
            normalized.processos.push({
              id: String(oldProcess.id || mkId('proc')),
              nome: String(oldProcess.nome || 'Processo'),
              descricao: String(oldProcess.descricao || ''),
              taskId,
              assigneeId: null,
            });
          });
        });
      });
    });

    return normalized;
  } catch (_) {
    return emptyWorkspaceData();
  }
}

function emptyWorkspaceData() {
  return {
    planejamentos: [],
    projetos: [],
    tarefas: [],
    processos: [],
    indicadores: [],
    setores: [],
    reunioesTarefas: [],
    reunioesProcessos: [],
    relatorios: [],
  };
}

function normalizePlanos(items) {
  return items.map((p) => ({
    id: String(p.id || mkId('plan')),
    ano: Number(p.ano) || new Date().getFullYear(),
    nome: String(p.nome || 'Plano estratégico'),
    descricao: String(p.descricao || ''),
    projectIds: Array.isArray(p.projectIds) ? p.projectIds.map(String) : [],
  }));
}

function normalizeProjetos(items) {
  return items.map((p) => ({
    id: String(p.id || mkId('proj')),
    nome: String(p.nome || 'Projeto'),
    descricao: String(p.descricao || ''),
    planId: p.planId ? String(p.planId) : null,
    managerIds: Array.isArray(p.managerIds)
      ? p.managerIds.map(String)
      : (Array.isArray(p.managers) ? p.managers.map(String) : []),
  }));
}

function normalizeTarefas(items) {
  return items.map((t) => ({
    id: String(t.id || mkId('task')),
    nome: String(t.nome || 'Tarefa'),
    descricao: String(t.descricao || ''),
    projectId: t.projectId ? String(t.projectId) : null,
    assigneeId: t.assigneeId ? String(t.assigneeId) : (t.userId ? String(t.userId) : null),
  }));
}

function normalizeProcessos(items) {
  return items.map((p) => ({
    id: String(p.id || mkId('proc')),
    nome: String(p.nome || 'Processo'),
    descricao: String(p.descricao || ''),
    taskId: p.taskId ? String(p.taskId) : null,
    assigneeId: p.assigneeId ? String(p.assigneeId) : (p.userId ? String(p.userId) : null),
  }));
}

function normalizeIndicadores(items) {
  if (!Array.isArray(items)) return [];
  return items.map((i) => ({
    id: String((i && i.id) || mkId('ind')),
    nome: String((i && i.nome) || 'Indicador'),
    setorId: i && i.setorId ? String(i.setorId) : null,
    meta: String((i && i.meta) || ''),
  }));
}

function saveWorkspaceData() {
  if (!state.workspaceData) return;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state.workspaceData));
}

function mkId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function syncSidebarActiveState(navKey) {
  const nav = document.getElementById('sidebarNav');
  if (!nav || !navKey) return;

  nav.querySelectorAll('.tree-toggle, .tree-leaf').forEach((item) => item.classList.remove('active'));
  nav.querySelectorAll('.tree-toggle').forEach((item) => item.classList.remove('active-parent'));

  const target = Array.from(nav.querySelectorAll('.nav-btn')).find((btn) => btn.dataset.nav === navKey);
  if (!target) return;

  target.classList.add('active');
  let parentNode = target.closest('.tree-children')?.closest('.tree-node');
  while (parentNode) {
    parentNode.classList.add('open');
    const parentToggle = parentNode.querySelector(':scope > .tree-toggle');
    if (parentToggle) {
      parentToggle.classList.add('active-parent');
      parentToggle.setAttribute('aria-expanded', 'true');
    }
    parentNode = parentNode.closest('.tree-children')?.closest('.tree-node');
  }
}

function resolveWorkspaceNavKey(navKey) {
  const raw = String(navKey || '').trim().toLowerCase();
  if (!raw) return 'home';
  if (raw === 'reunioes') return 'reunioes-workspace';
  if (raw === 'configurações' || raw === 'configuracao' || raw === 'configuração') return 'configuracoes';
  if (raw === 'indicadores' || raw === 'setores') return 'configuracoes';
  return raw;
}

function openAppSection(navKey) {
  ensureWorkspaceState();
  const key = resolveWorkspaceNavKey(navKey);
  console.log('[openAppSection] called with', navKey, '-> resolved key:', key, 'state.activeNav(before):', state && state.activeNav, 'state.currentView(before):', state && state.currentView);
  state.activeNav = key;
  syncSidebarActiveState(key);

  const listView = document.getElementById('listView');
  const detailView = document.getElementById('detailView');
  const workspaceView = document.getElementById('workspaceView');
  if (!listView || !detailView || !workspaceView) 
    return;

  if (state.currentView === 'detail') {
    if (typeof stopChrono === 'function') stopChrono();
    state.currentMeeting = null;
  }

  listView.classList.add('hidden');
  detailView.classList.add('hidden');
  workspaceView.classList.remove('hidden');
  state.currentView = 'workspace';
  renderWorkspaceSection(key);
}

function renderWorkspaceSection(navKey) {
  const titleEl = document.getElementById('workspaceTitle');
  const subEl = document.getElementById('workspaceSubtitle');
  const contentEl = document.getElementById('workspaceContent');
  if (!titleEl || !subEl || !contentEl) return;

  const key = resolveWorkspaceNavKey(navKey);
  const meta = {
    home: { title: 'Home', subtitle: 'Visão geral da Organização e atalhos da Plataforma.' },
    planejamento: { title: 'Construtor Estratégico', subtitle: 'Árvore raiz do plano anual com projetos arrastáveis.' },
    projetos: { title: 'Projetos', subtitle: 'Crie projetos com ou sem plano estratégico e vincule quando quiser.' },
    tarefas: { title: 'Tarefas', subtitle: 'Crie tarefas com ou sem projeto, mantendo flexibilidade.' },
    processos: { title: 'Processos', subtitle: 'Crie processos com ou sem tarefa e vincule depois.' },
    configuracoes: { title: 'Configurações', subtitle: 'Gerencie setores e cadastros estruturais da plataforma.' },
    'reunioes-workspace': { title: 'Reuniões', subtitle: 'Abra uma reunião e crie pautas com tarefas sem necessidade de projeto.' },
    'tarefas-reunioes': { title: 'Tarefas de Reuniões', subtitle: 'Ações geradas durante as reuniões.' },
    'processos-reunioes': { title: 'Processos de Reuniões', subtitle: 'Fluxos relacionados às pautas e decisões.' },
    relatorios: { title: 'Relatórios', subtitle: 'Modelos e registros de relatórios da plataforma.' },
  };

  const current = meta[key] || { title: 'Workspace', subtitle: 'Seção em preparação.' };
  titleEl.textContent = current.title;
  subEl.textContent = current.subtitle;

  if (key === 'home') return renderHomeWorkspace(contentEl);
  if (key === 'planejamento') return renderPlanningBuilder(contentEl);
  if (key === 'projetos') return renderProjectsWorkspace(contentEl);
  if (key === 'tarefas') return renderTasksWorkspace(contentEl);
  if (key === 'processos') return renderProcessesWorkspace(contentEl);
  if (key === 'configuracoes') return renderConfiguracoesWorkspace(contentEl);
  if (key === 'reunioes-workspace') return renderMeetingsWorkspace(contentEl);
  if (key === 'tarefas-reunioes') return renderMeetingTasksWorkspace(contentEl);
  if (['processos-reunioes', 'relatorios'].includes(key)) return renderMeetingOpsWorkspace(key, contentEl);

  contentEl.innerHTML = '<div class="ws-card"><h3>Em construção</h3><p>Esta seção será habilitada em seguida.</p></div>';
}

function renderConfiguracoesWorkspace(root) {
  const setores = state.workspaceData.setores || [];
  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Setores</h3>
          <form class="ws-form" id="wsSectorForm">
            <input type="text" name="nome" placeholder="Nome do setor" required>
            <input type="text" name="responsavel" placeholder="Responsável" required>
            <input type="text" name="meta" placeholder="Meta principal do setor">
            <button type="submit">Salvar Setor</button>
          </form>
        </article>
        <article class="ws-card">
          <h3>Setores cadastrados</h3>
          <div class="ws-list">
            ${setores.length
              ? setores.map((s) => `
                <div class="ws-item ws-item-entity">
                  <div>
                    <strong>${esc(s.nome)}</strong><br><small>Resp.: ${esc(s.responsavel)}${s.meta ? ` | Meta: ${esc(s.meta)}` : ''}</small>
                  </div>
                  <div class="ws-item-mini-actions">
                    <button type="button" class="ws-open-planning ws-open-edit" data-edit-sector="${esc(s.id)}">Alterar</button>
                    <button type="button" class="ws-open-planning ws-open-danger" data-delete-sector="${esc(s.id)}">Excluir</button>
                  </div>
                </div>
              `).join('')
              : '<div class="ws-empty">Nenhum setor cadastrado.</div>'}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderHomeWorkspace(root) {
  const plans = (state.workspaceData && state.workspaceData.planejamentos) || [];
  const projects = (state.workspaceData && state.workspaceData.projetos) || [];
  const tasks = (state.workspaceData && state.workspaceData.tarefas) || [];
  const processes = (state.workspaceData && state.workspaceData.processos) || [];
  const meetings = Array.isArray(state.allMeetings) ? state.allMeetings : [];

  const startedMeetings = meetings.filter((m) => m && m.status === 'in_progress').length;
  const pendingMeetings = meetings.filter((m) => m && m.status === 'not_started').length;
  const completedMeetings = meetings.filter((m) => m && m.status === 'completed').length;
  const userName = (state.currentUser && state.currentUser.name) ? state.currentUser.name : 'Equipe';

  root.innerHTML = `
    <section class="home-shell">
      <article class="home-hero">
        <div class="home-hero-glow"></div>
        <p class="home-eyebrow">Painel Central</p>
        <h2>Bem-vindo, ${esc(userName)}</h2>
        <p>Visão rápida da Organização para decidir prioridades com clareza.</p>
        <div class="home-metrics">
          <div class="home-metric">
            <span>Planos</span>
            <strong>${plans.length}</strong>
          </div>
          <div class="home-metric">
            <span>Projetos</span>
            <strong>${projects.length}</strong>
          </div>
          <div class="home-metric">
            <span>Tarefas</span>
            <strong>${tasks.length}</strong>
          </div>
          <div class="home-metric">
            <span>Processos</span>
            <strong>${processes.length}</strong>
          </div>
        </div>
      </article>

      <article class="ws-card home-card">
        <h3>Reuniões</h3>
        <p>Gestão rápida de reuniões e andamento atual.</p>
        <div class="home-status-grid">
          <div class="home-status status-total"><strong>${meetings.length}</strong><span>Total cadastrado</span></div>
          <div class="home-status status-pending"><strong>${pendingMeetings}</strong><span>Não iniciadas</span></div>
          <div class="home-status status-started"><strong>${startedMeetings}</strong><span>Em andamento</span></div>
          <div class="home-status status-done"><strong>${completedMeetings}</strong><span>Finalizadas</span></div>
        </div>
      </article>

      <article class="ws-card home-card">
        <h3>Atalhos</h3>
        <p>Acesse rapidamente os módulos principais.</p>
        <div class="home-shortcuts">
          <button type="button" class="home-shortcut-btn" data-nav-shortcut="planejamento">
            <span>Planejamento</span><small>Construtor estratégico</small>
          </button>
          <button type="button" class="home-shortcut-btn" data-nav-shortcut="projetos">
            <span>Projetos</span><small>Carteira e gestão</small>
          </button>
          <button type="button" class="home-shortcut-btn" data-nav-shortcut="reunioes-workspace">
            <span>Reuniões</span><small>Pautas e atas</small>
          </button>
        </div>
      </article>
    </section>
  `;

  root.querySelectorAll('[data-nav-shortcut]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openAppSection(String(btn.dataset.navShortcut || 'home'));
    });
  });
}

function getSelectedPlan() {
  const plans = state.workspaceData.planejamentos || [];
  const selected = plans.find((p) => p.id === state.workspaceUI.selectedPlanId) || plans[0] || null;
  if (selected) state.workspaceUI.selectedPlanId = selected.id;
  return selected;
}

function getProjectsForPlan(plan) {
  if (!plan) return [];
  const ids = Array.isArray(plan.projectIds) ? plan.projectIds : [];
  const projectMap = new Map((state.workspaceData.projetos || []).map((p) => [p.id, p]));
  return ids.map((id) => projectMap.get(id)).filter(Boolean);
}

function getTasksForProject(projectId) {
  return (state.workspaceData.tarefas || []).filter((t) => t.projectId === projectId);
}

function getProcessesForTask(taskId) {
  return (state.workspaceData.processos || []).filter((p) => p.taskId === taskId);
}

function getAssignableUsers() {
  const raw = state.users;
  let list = [];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    // aceita objeto mapeado por id/iniciais
    list = Object.values(raw);
  } else {
    list = [];
  }

  const map = new Map();
  (list || []).forEach((u) => {
    if (!u || !u.initials) return;
    map.set(String(u.initials), {
      id: String(u.initials),
      name: String(u.name || u.initials),
      email: String(u.email || ''),
    });
  });

  if (state.currentUser && state.currentUser.initials && !map.has(String(state.currentUser.initials))) {
    map.set(String(state.currentUser.initials), {
      id: String(state.currentUser.initials),
      name: String(state.currentUser.name || state.currentUser.initials),
      email: String(state.currentUser.email || ''),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function userNameById(userId) {
  if (!userId) return 'Sem usuário';
  const u = getAssignableUsers().find((item) => item.id === userId);
  return u ? u.name : userId;
}

function setTreeAddState(kind, parentId) {
  if (!state.workspaceUI) state.workspaceUI = {};
  state.workspaceUI.treeAddKind = String(kind || '');
  state.workspaceUI.treeAddParentId = String(parentId || '');
}

function clearTreeAddState() {
  if (!state.workspaceUI) return;
  state.workspaceUI.treeAddKind = '';
  state.workspaceUI.treeAddParentId = '';
}

function renderPlanningTreeAddModal(plan) {
  const kind = String((state.workspaceUI && state.workspaceUI.treeAddKind) || '');
  const parentId = String((state.workspaceUI && state.workspaceUI.treeAddParentId) || '');
  const users = getAssignableUsers();
  const userOptions = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`).join('');

  if (!kind || !parentId) {
    return `
      <div class="modal-overlay" id="wsTreeAddModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo item</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="tree-add" aria-label="Fechar">×</button>
            </div>
            <div class="ws-empty">Selecione um botão + na árvore estratégica.</div>
          </div>
        </div>
      </div>
    `;
  }

  if (kind === 'project') {
    const parentLabel = plan ? `${plan.ano} • ${plan.nome}` : 'Plano raiz';
    return `
      <div class="modal-overlay" id="wsTreeAddModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVO PROJETO</span>
            <div class="recurrence-options"><button type="button" class="rec-btn active">RAIZ</button></div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo Projeto no Plano</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="tree-add" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsTreeAddForm" data-tree-kind="project" data-tree-parent="${esc(parentId)}">
              <label class="ws-label">Raiz estratégica</label>
              <input type="text" value="${esc(parentLabel)}" disabled>
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome do projeto" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <label class="ws-label">Responsável(is) (máx. 2)</label>
              <select name="managerIds" multiple size="4">${userOptions}</select>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="tree-add">Cancelar</button>
                <button type="submit" class="btn-save">Criar Projeto</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  if (kind === 'task') {
    const project = (state.workspaceData.projetos || []).find((p) => String(p.id) === parentId);
    return `
      <div class="modal-overlay" id="wsTreeAddModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVA TAREFA</span>
            <div class="recurrence-options"><button type="button" class="rec-btn active">PROJETO</button></div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Nova Tarefa no Projeto</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="tree-add" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsTreeAddForm" data-tree-kind="task" data-tree-parent="${esc(parentId)}">
              <label class="ws-label">Projeto</label>
              <input type="text" value="${esc((project && project.nome) || parentId)}" disabled>
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome da tarefa" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <label class="ws-label">Responsável</label>
              <select name="assigneeId">
                <option value="">Sem usuário</option>
                ${userOptions}
              </select>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="tree-add">Cancelar</button>
                <button type="submit" class="btn-save">Criar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  const task = (state.workspaceData.tarefas || []).find((t) => String(t.id) === parentId);
  return `
    <div class="modal-overlay" id="wsTreeAddModalOverlay">
      <div class="modal-create ws-modal-create ws-modal-like-meeting">
        <div class="modal-recurrence ws-modal-recurrence">
          <span class="recurrence-label">NOVO PROCESSO</span>
          <div class="recurrence-options"><button type="button" class="rec-btn active">TAREFA</button></div>
        </div>
        <div class="modal-body ws-modal-body">
          <div class="ws-modal-header">
            <h3>Novo Processo na Tarefa</h3>
            <button type="button" class="ws-modal-close" data-close-workspace-modal="tree-add" aria-label="Fechar">×</button>
          </div>
          <form class="ws-form ws-modal-form" id="wsTreeAddForm" data-tree-kind="process" data-tree-parent="${esc(parentId)}">
            <label class="ws-label">Tarefa</label>
            <input type="text" value="${esc((task && task.nome) || parentId)}" disabled>
            <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome do processo" required>
            <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
            <label class="ws-label">Responsável</label>
            <select name="assigneeId">
              <option value="">Sem usuário</option>
              ${userOptions}
            </select>
            <div class="modal-actions ws-modal-actions">
              <button type="button" class="btn-cancel" data-close-workspace-modal="tree-add">Cancelar</button>
              <button type="submit" class="btn-save">Criar Processo</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function getWorkspaceListByKey(key) {
  if (!state.workspaceData || !key) return null;
  const list = state.workspaceData[key];
  return Array.isArray(list) ? list : null;
}

function promptRequiredValue(label, currentValue, opts = {}) {
  const maxLen = Number(opts.maxLen || 0);
  const next = window.prompt(label, String(currentValue || ''));
  if (next === null) return null;
  const value = String(next).trim();
  if (!value) {
    showToast('Campo obrigatório.', 'info');
    return '__INVALID__';
  }
  if (maxLen > 0 && value.length > maxLen) {
    showToast(`Máximo de ${maxLen} caracteres.`, 'info');
    return '__INVALID__';
  }
  return value;
}

function promptOptionalValue(label, currentValue) {
  const next = window.prompt(label, String(currentValue || ''));
  if (next === null) return null;
  return String(next).trim();
}

function confirmDelete(label) {
  return window.confirm(`Deseja excluir ${label}?`);
}

function editSimpleWorkspaceItem(listKey, itemId, navKey, itemLabel) {
  const list = getWorkspaceListByKey(listKey);
  if (!list) return;
  const item = list.find((x) => String(x.id) === String(itemId));
  if (!item) return;

  const nome = promptRequiredValue(`Alterar ${itemLabel} - nome:`, item.nome || '', { maxLen: 120 });
  if (nome === null) return;
  if (nome === '__INVALID__') return;
  const descricao = promptOptionalValue(`Alterar ${itemLabel} - descrição:`, item.descricao || '');
  if (descricao === null) return;

  item.nome = nome;
  item.descricao = descricao;
  saveWorkspaceData();
  renderWorkspaceSection(navKey);
  showToast(`${itemLabel} alterado(a).`, 'success');
}

function deleteSimpleWorkspaceItem(listKey, itemId, navKey, itemLabel) {
  const list = getWorkspaceListByKey(listKey);
  if (!list) return;
  const idx = list.findIndex((x) => String(x.id) === String(itemId));
  if (idx < 0) return;
  if (!confirmDelete(`o(a) ${itemLabel.toLowerCase()}`)) return;

  list.splice(idx, 1);
  saveWorkspaceData();
  renderWorkspaceSection(navKey);
  showToast(`${itemLabel} excluído(a).`, 'success');
}

function renderPlanningBuilder(root) {
  const plans = state.workspaceData.planejamentos || [];
  const selectedPlan = plans[0] || null;
  if (selectedPlan) state.workspaceUI.selectedPlanId = selectedPlan.id;
  const linkedProjects = getProjectsForPlan(selectedPlan);

  const stats = {
    projetos: linkedProjects.length,
    tarefas: linkedProjects.reduce((acc, p) => acc + getTasksForProject(p.id).length, 0),
    processos: linkedProjects.reduce((acc, p) => acc + getTasksForProject(p.id).reduce((a, t) => a + getProcessesForTask(t.id).length, 0), 0),
  };

  root.innerHTML = `
    <section class="plan-shell">
      <article class="ws-card plan-control-card">
        <h3>Plano Raiz</h3>
        <p>Use o popup para criar o plano estratégico, no mesmo padrão.</p>
        <div class="plan-root-row">
          <div class="plan-root-action">
            <button type="button" class="ws-open-planning" data-open-workspace-modal="plan">Novo Planejamento</button>
          </div>
          ${selectedPlan
            ? `
              <div class="ws-item ws-item-entity plan-root-item">
                <div>
                  <strong>${esc(String(selectedPlan.ano))} - ${esc(selectedPlan.nome)}</strong><br>
                  <small>${esc(selectedPlan.descricao || 'Sem descrição')}</small>
                </div>
                <div class="ws-item-mini-actions">
                  <button type="button" class="ws-open-planning ws-open-edit" data-edit-plan="${esc(selectedPlan.id)}">Alterar</button>
                  <button type="button" class="ws-open-planning ws-open-danger" data-delete-plan="${esc(selectedPlan.id)}">Excluir</button>
                </div>
              </div>
            `
            : '<div class="ws-empty">Nenhum plano raiz cadastrado.</div>'}
        </div>
        <p>
          <small>Use o ícone <strong>+</strong> na árvore: raiz adiciona projeto, projeto adiciona tarefa e tarefa adiciona processo.</small>
        </p>
      </article>

      <article class="ws-card plan-tree-card">
        <h3>Árvore Estratégica</h3>
        ${renderPlanningTree(selectedPlan, linkedProjects)}
      </article>

      <div class="modal-overlay" id="wsPlanModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVO PLANEJAMENTO</span>
            <div class="recurrence-options">
              <button type="button" class="rec-btn active">WORKSPACE</button>
            </div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo Planejamento</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="plan" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsStrategicPlanForm">
              <div class="ws-modal-form-grid">
                <div>
                  <label class="ws-label">Ano/Ciclo</label>
                  <input type="text" name="ano" maxlength="20" placeholder="Ano (ex: 2026)" required>
                </div>
                <div>
                  <label class="ws-label">Nome do plano</label>
                  <input type="text" name="nome" placeholder="Nome do plano" required>
                </div>
              </div>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Diretriz estratégica"></textarea>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="plan">Cancelar</button>
                <button type="submit" class="btn-save">Criar Plano</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      ${renderPlanningTreeAddModal(selectedPlan)}
    </section>
  `;
}

function renderPlanningTree(plan, projects) {
  if (!plan) return '<div class="ws-empty">Crie um plano raiz para visualizar a árvore.</div>';
  const projectLines = projects.map((project) => {
    const managers = (project.managerIds || []).map((id) => userNameById(id)).filter(Boolean);
    const managerLabel = managers.length ? `<small>Resp.: ${esc(managers.join(', '))}</small>` : '';
    const tasks = getTasksForProject(project.id);

    const tasksHtml = tasks.map((task) => {
      const taskAssignee = task.assigneeId ? userNameById(task.assigneeId) : '';
      const taskAssigneeLabel = taskAssignee ? `<small>Resp.: ${esc(taskAssignee)}</small>` : '';
      const processes = getProcessesForTask(task.id);

      const processHtml = processes.map((proc) => {
        const procAssignee = proc.assigneeId ? userNameById(proc.assigneeId) : '';
        const procAssigneeLabel = procAssignee ? `<small>Resp.: ${esc(procAssignee)}</small>` : '';
        return `
          <li class="ws-org-item">
            <div class="ws-org-node ws-tree-process">
              <span>⚙ ${esc(proc.nome)}</span>
              ${procAssigneeLabel}
              ${renderTreeRemoveButton('process', proc.id, 'Excluir processo')}
            </div>
          </li>
        `;
      }).join('');

      return `
        <li class="ws-org-item">
          <div class="ws-org-node ws-tree-task">
            <span>✔ ${esc(task.nome)}</span>
            ${taskAssigneeLabel}
            ${renderTreeAddButton('process', task.id, 'Adicionar processo')}
            ${renderTreeRemoveButton('task', task.id, 'Excluir tarefa')}
          </div>
          ${processes.length ? `<ul class="ws-org-level">${processHtml}</ul>` : ''}
        </li>
      `;
    }).join('');

    return `
      <li class="ws-org-item">
        <div class="ws-org-node ws-tree-project">
          <span>◆ ${esc(project.nome)}</span>
          ${managerLabel}
          ${renderTreeAddButton('task', project.id, 'Adicionar tarefa')}
          ${renderTreeRemoveButton('project', project.id, 'Excluir projeto')}
        </div>
        ${tasks.length ? `<ul class="ws-org-level">${tasksHtml}</ul>` : ''}
      </li>
    `;
  }).join('');

  return `
    <div class="ws-org-chart">
      <ul class="ws-org-level ws-org-root-level">
        <li class="ws-org-item ws-org-single-root">
          <div class="ws-org-node ws-tree-root">
            <span>${esc(String(plan.ano))} • ${esc(plan.nome)}</span>
            ${renderTreeAddButton('project', plan.id, 'Adicionar projeto')}
          </div>
          ${projects.length
            ? `<ul class="ws-org-level">${projectLines}</ul>`
            : '<div class="ws-empty">Sem projetos vinculados.</div>'}
        </li>
      </ul>
    </div>
  `;
}

function renderAllPlansTrees(plans) {
  if (!plans || !plans.length) {
    return '<div class="ws-empty">Crie um plano raiz para visualizar as árvores.</div>';
  }

  return plans.map((plan) => {
    const projects = getProjectsForPlan(plan);
    return `
      <section class="ws-plan-tree-block">
        ${renderPlanningTree(plan, projects)}
      </section>
    `;
  }).join('');
}

function renderTreeToggle(nodeId, open) {
  return `<button type="button" class="ws-tree-toggle" data-tree-node="${esc(nodeId)}">${open ? '-' : '+'}</button>`;
}

function renderTreeAddButton(kind, parentId, label) {
  return `<button type="button" class="ws-tree-add-btn" data-tree-add="${esc(kind)}" data-tree-parent="${esc(parentId)}" aria-label="${esc(label)}" title="${esc(label)}">+</button>`;
}

function renderTreeRemoveButton(kind, itemId, label) {
  return `<button type="button" class="ws-tree-remove-btn" data-tree-remove="${esc(kind)}" data-tree-id="${esc(itemId)}" aria-label="${esc(label)}" title="${esc(label)}">-</button>`;
}

function renderProjectCards(projects) {
  if (!projects.length) return '<div class="ws-empty">Nenhum projeto no plano.</div>';
  return projects.map((project, index) => {
    const tasksCount = getTasksForProject(project.id).length;
    return `
      <article class="ws-project-card" draggable="true" data-project-id="${esc(project.id)}">
        <span class="ws-project-order">#${index + 1}</span>
        <strong>${esc(project.nome)}</strong>
        <small>${tasksCount} ${tasksCount === 1 ? 'tarefa' : 'tarefas'}</small>
        <button type="button" class="ws-unlink-btn" data-unlink-project="${esc(project.id)}">Remover do plano</button>
      </article>
    `;
  }).join('');
}

function renderProjectsWorkspace(root) {
  const plans = state.workspaceData.planejamentos || [];
  const projects = state.workspaceData.projetos || [];
  const selectedProject =
    projects.find((p) => p.id === state.workspaceUI.selectedProjectId) ||
    projects[0] ||
    null;
  if (selectedProject) state.workspaceUI.selectedProjectId = selectedProject.id;
  const planOptions = plans.map((p) => `<option value="${esc(p.id)}">${esc(String(p.ano))} - ${esc(p.nome)}</option>`).join('');
  const users = getAssignableUsers();
  const managerOptions = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`).join('');

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Criar Projeto</h3>
          <p>Use o popup para cadastrar um novo projeto, como no fluxo de reunião.</p>
          <button type="button" class="ws-open-planning" data-open-workspace-modal="project">Novo Projeto</button>
        </article>

        <article class="ws-card">
          <h3>Projetos cadastrados</h3>
          <div class="ws-list ws-list-wide">
            ${projects.length ? projects.map((project) => renderProjectLinkItem(project, plans, selectedProject?.id)).join('') : '<div class="ws-empty">Nenhum projeto cadastrado.</div>'}
          </div>
        </article>
      </div>

      <article class="ws-card ws-dual-right">
        <h3>Árvore de Projetos</h3>
        ${renderProjectsTree(selectedProject)}
      </article>

      <div class="modal-overlay" id="wsProjectModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVO PROJETO</span>
            <div class="recurrence-options">
              <button type="button" class="rec-btn active">WORKSPACE</button>
            </div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo Projeto</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="project" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsProjectForm">
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome do projeto" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <div class="ws-modal-form-grid">
                <div>
                  <label class="ws-label">Inserir no plano estratégico (opcional)</label>
                  <select name="planId">
                    <option value="">Sem plano</option>
                    ${planOptions}
                  </select>
                </div>
                <div>
                  <label class="ws-label">Gestores do projeto (max 2)</label>
                  <select name="managerIds" multiple size="4">
                    ${managerOptions}
                  </select>
                </div>
              </div>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="project">Cancelar</button>
                <button type="submit" class="btn-save">Salvar Projeto</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderProjectsTree(project) {
  if (!project) return '<div class="ws-empty">Nenhum projeto cadastrado.</div>';

  return `
    <div class="ws-tree-root-wrap">
      <ul class="ws-tree-root-list">
        ${(() => {
          const projectNodeId = `projects-view:project:${project.id}`;
          const projectOpen = isNodeOpen(projectNodeId);
          const tasks = getTasksForProject(project.id);
          const managers = (project.managerIds || []).map((id) => userNameById(id)).join(', ');

          return `
            <li class="ws-tree-line">
              <div class="ws-tree-node-row">
                ${tasks.length ? renderTreeToggle(projectNodeId, projectOpen) : '<span class="ws-tree-pad"></span>'}
                <span class="ws-tree-node ws-tree-project">◆ ${esc(project.nome)}${managers ? ` • Gestor(es): ${esc(managers)}` : ''}</span>
              </div>
              ${tasks.length && projectOpen ? `
                <ul>
                  ${tasks.map((task) => {
                    const taskNodeId = `projects-view:task:${task.id}`;
                    const taskOpen = isNodeOpen(taskNodeId);
                    const processes = getProcessesForTask(task.id);
                    const taskUser = task.assigneeId ? userNameById(task.assigneeId) : 'Sem usuário';

                    return `
                      <li class="ws-tree-line">
                        <div class="ws-tree-node-row">
                          ${processes.length ? renderTreeToggle(taskNodeId, taskOpen) : '<span class="ws-tree-pad"></span>'}
                          <span class="ws-tree-node ws-tree-task">✔ ${esc(task.nome)} • Responsável: ${esc(taskUser)}</span>
                        </div>
                        ${processes.length && taskOpen ? `
                          <ul>
                            ${processes.map((process) => {
                              const procUser = process.assigneeId ? userNameById(process.assigneeId) : 'Sem usuário';
                              return `<li class="ws-tree-line"><span class="ws-tree-node ws-tree-process">⚙ ${esc(process.nome)} • Responsável: ${esc(procUser)}</span></li>`;
                            }).join('')}
                          </ul>
                        ` : ''}
                      </li>
                    `;
                  }).join('')}
                </ul>
              ` : ''}
            </li>
          `;
        })()}
      </ul>
    </div>
  `;
}

function renderProjectLinkItem(project, plans, selectedProjectId) {
  const currentPlan = project.planId ? plans.find((p) => p.id === project.planId) : null;
  const users = getAssignableUsers();
  const options = ['<option value="">Sem plano</option>'].concat(plans.map((p) => `<option value="${esc(p.id)}" ${p.id === project.planId ? 'selected' : ''}>${esc(String(p.ano))} - ${esc(p.nome)}</option>`)).join('');
  const managerOptions = users.map((u) => {
    const selected = (project.managerIds || []).includes(u.id) ? 'selected' : '';
    return `<option value="${esc(u.id)}" ${selected}>${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`;
  }).join('');
  const managersText = (project.managerIds || []).length
    ? (project.managerIds || []).map((id) => userNameById(id)).join(', ')
    : 'Sem gestores';
  return `
    <div class="ws-item ws-item-entity ${project.id === selectedProjectId ? 'ws-item-selected' : ''}">
      <div class="ws-item-main" data-select-project="${esc(project.id)}">
        <strong>${esc(project.nome)}</strong><br>
        <small>${esc(project.descricao || 'Sem descrição')}</small><br>
        <span class="ws-badge">${currentPlan ? `No plano: ${esc(currentPlan.nome)}` : 'Sem plano estratégico'}</span>
        <br><span class="ws-badge">Gestores: ${esc(managersText)}</span>
      </div>
      <form class="ws-inline-form" data-link-type="project" data-project-id="${esc(project.id)}">
        <select name="planId">${options}</select>
        <select name="managerIds" multiple size="4">${managerOptions}</select>
        <div class="ws-item-mini-actions">
          <button type="button" class="ws-open-planning ws-open-edit" data-edit-project="${esc(project.id)}">Alterar</button>
          <button type="button" class="ws-open-planning ws-open-danger" data-delete-project="${esc(project.id)}">Excluir</button>
        </div>
      </form>
    </div>
  `;
}

function renderTasksWorkspace(root) {
  const projects = state.workspaceData.projetos || [];
  const tasks = state.workspaceData.tarefas || [];
  const selectedTask =
    tasks.find((t) => t.id === state.workspaceUI.selectedTaskId) ||
    tasks[0] ||
    null;
  if (selectedTask) state.workspaceUI.selectedTaskId = selectedTask.id;
  const projectOptions = projects.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
  const users = getAssignableUsers();
  const userOptions = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`).join('');

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Criar Tarefa</h3>
          <p>Use o popup para cadastrar uma nova tarefa, no mesmo padrão.</p>
          <button type="button" class="ws-open-planning" data-open-workspace-modal="task">Nova Tarefa</button>
        </article>

        <article class="ws-card">
          <h3>Tarefas cadastradas</h3>
          <div class="ws-list ws-list-wide">
            ${tasks.length ? tasks.map((task) => renderTaskLinkItem(task, projects, selectedTask?.id)).join('') : '<div class="ws-empty">Nenhuma tarefa cadastrada.</div>'}
          </div>
        </article>
      </div>

      <article class="ws-card ws-dual-right">
        <h3>Árvore de Tarefas</h3>
        ${renderTasksTree(selectedTask, projects)}
      </article>

      <div class="modal-overlay" id="wsTaskModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVA TAREFA</span>
            <div class="recurrence-options">
              <button type="button" class="rec-btn active">WORKSPACE</button>
            </div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Nova Tarefa</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="task" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsTaskForm">
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome da tarefa" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <div class="ws-modal-form-grid">
                <div>
                  <label class="ws-label">Inserir no projeto (opcional)</label>
                  <select name="projectId">
                    <option value="">Sem projeto</option>
                    ${projectOptions}
                  </select>
                </div>
                <div>
                  <label class="ws-label">Usuário responsável</label>
                  <select name="assigneeId">
                    <option value="">Sem usuário</option>
                    ${userOptions}
                  </select>
                </div>
              </div>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="task">Cancelar</button>
                <button type="submit" class="btn-save">Salvar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTasksTree(task, projects) {
  if (!task) return '<div class="ws-empty">Nenhuma tarefa cadastrada.</div>';

  const taskNodeId = `tasks-view:task:${task.id}`;
  const taskOpen = isNodeOpen(taskNodeId);
  const processes = getProcessesForTask(task.id);
  const taskUser = task.assigneeId ? userNameById(task.assigneeId) : 'Sem usuário';
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const projectLabel = project ? project.nome : 'Sem projeto';

  return `
    <div class="ws-tree-root-wrap">
      <ul class="ws-tree-root-list">
        <li class="ws-tree-line">
          <div class="ws-tree-node-row">
            ${processes.length ? renderTreeToggle(taskNodeId, taskOpen) : '<span class="ws-tree-pad"></span>'}
            <span class="ws-tree-node ws-tree-task">✔ ${esc(task.nome)} • Responsável: ${esc(taskUser)} • Projeto: ${esc(projectLabel)}</span>
          </div>
          ${processes.length && taskOpen ? `
            <ul>
              ${processes.map((process) => {
                const procUser = process.assigneeId ? userNameById(process.assigneeId) : 'Sem usuário';
                return `<li class="ws-tree-line"><span class="ws-tree-node ws-tree-process">⚙ ${esc(process.nome)} • Responsável: ${esc(procUser)}</span></li>`;
              }).join('')}
            </ul>
          ` : ''}
        </li>
      </ul>
    </div>
  `;
}

function renderTaskLinkItem(task, projects, selectedTaskId) {
  const currentProject = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const users = getAssignableUsers();
  const options = ['<option value="">Sem projeto</option>'].concat(projects.map((p) => `<option value="${esc(p.id)}" ${p.id === task.projectId ? 'selected' : ''}>${esc(p.nome)}</option>`)).join('');
  const userOptions = ['<option value="">Sem usuário</option>'].concat(users.map((u) => `<option value="${esc(u.id)}" ${u.id === task.assigneeId ? 'selected' : ''}>${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`)).join('');
  const userLabel = task.assigneeId ? userNameById(task.assigneeId) : 'Sem usuário';
  return `
    <div class="ws-item ws-item-entity ${task.id === selectedTaskId ? 'ws-item-selected' : ''}">
      <div class="ws-item-main" data-select-task="${esc(task.id)}">
        <strong>${esc(task.nome)}</strong><br>
        <small>${esc(task.descricao || 'Sem descrição')}</small><br>
        <span class="ws-badge">${currentProject ? `No projeto: ${esc(currentProject.nome)}` : 'Sem projeto'}</span>
        <br><span class="ws-badge">Responsável: ${esc(userLabel)}</span>
      </div>
      <form class="ws-inline-form" data-link-type="task" data-task-id="${esc(task.id)}">
        <select name="projectId">${options}</select>
        <select name="assigneeId">${userOptions}</select>
        <div class="ws-item-mini-actions">
          <button type="button" class="ws-open-planning ws-open-edit" data-edit-task="${esc(task.id)}">Alterar</button>
          <button type="button" class="ws-open-planning ws-open-danger" data-delete-task="${esc(task.id)}">Excluir</button>
        </div>
      </form>
    </div>
  `;
}

function renderProcessesWorkspace(root) {
  const tasks = state.workspaceData.tarefas || [];
  const processes = state.workspaceData.processos || [];
  const taskOptions = tasks.map((t) => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join('');
  const users = getAssignableUsers();
  const userOptions = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`).join('');

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Criar Processo</h3>
          <p>Use o popup para cadastrar um novo processo, no mesmo padrão.</p>
          <button type="button" class="ws-open-planning" data-open-workspace-modal="process">Novo Processo</button>
        </article>

        <article class="ws-card">
          <h3>Processos cadastrados</h3>
          <div class="ws-list ws-list-wide">
            ${processes.length ? processes.map((process) => renderProcessLinkItem(process, tasks)).join('') : '<div class="ws-empty">Nenhum processo cadastrado.</div>'}
          </div>
        </article>
      </div>

      <div class="modal-overlay" id="wsProcessModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">NOVO PROCESSO</span>
            <div class="recurrence-options">
              <button type="button" class="rec-btn active">WORKSPACE</button>
            </div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo Processo</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="process" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsProcessForm">
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome do processo" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <div class="ws-modal-form-grid">
                <div>
                  <label class="ws-label">Inserir na tarefa (opcional)</label>
                  <select name="taskId">
                    <option value="">Sem tarefa</option>
                    ${taskOptions}
                  </select>
                </div>
                <div>
                  <label class="ws-label">Usuário responsável</label>
                  <select name="assigneeId">
                    <option value="">Sem usuário</option>
                    ${userOptions}
                  </select>
                </div>
              </div>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="process">Cancelar</button>
                <button type="submit" class="btn-save">Salvar Processo</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderProcessLinkItem(process, tasks) {
  const currentTask = process.taskId ? tasks.find((t) => t.id === process.taskId) : null;
  const users = getAssignableUsers();
  const options = ['<option value="">Sem tarefa</option>'].concat(tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === process.taskId ? 'selected' : ''}>${esc(t.nome)}</option>`)).join('');
  const userOptions = ['<option value="">Sem usuário</option>'].concat(users.map((u) => `<option value="${esc(u.id)}" ${u.id === process.assigneeId ? 'selected' : ''}>${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`)).join('');
  const userLabel = process.assigneeId ? userNameById(process.assigneeId) : 'Sem usuário';
  return `
    <div class="ws-item ws-item-entity">
      <div>
        <strong>${esc(process.nome)}</strong><br>
        <small>${esc(process.descricao || 'Sem descrição')}</small><br>
        <span class="ws-badge">${currentTask ? `Na tarefa: ${esc(currentTask.nome)}` : 'Sem tarefa'}</span>
        <br><span class="ws-badge">Responsável: ${esc(userLabel)}</span>
      </div>
      <form class="ws-inline-form" data-link-type="process" data-process-id="${esc(process.id)}">
        <select name="taskId">${options}</select>
        <select name="assigneeId">${userOptions}</select>
        <div class="ws-item-mini-actions">
          <button type="button" class="ws-open-planning ws-open-edit" data-edit-process="${esc(process.id)}">Alterar</button>
          <button type="button" class="ws-open-planning ws-open-danger" data-delete-process="${esc(process.id)}">Excluir</button>
        </div>
      </form>
    </div>
  `;
}

function renderIndicadoresWorkspace(root) {
  const indicadores = state.workspaceData.indicadores || [];
  const setores = state.workspaceData.setores || [];
  const setorById = new Map(setores.map((s) => [String(s.id), s]));

  const options = ['<option value="">Sem setor</option>']
    .concat(setores.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`))
    .join('');

  root.innerHTML = `
    <article class="ws-card ws-focus">
      <h3>Novo Indicador</h3>
      <form class="ws-form" id="wsIndicatorForm">
        <input type="text" name="nome" placeholder="Nome do indicador" required>
        <select name="setorId">${options}</select>
        <input type="text" name="meta" placeholder="Meta (opcional)">
        <button type="submit">Salvar Indicador</button>
      </form>
    </article>
    <article class="ws-card">
      <h3>Indicadores cadastrados</h3>
      <div class="ws-list">
        ${indicadores.length
          ? indicadores.map((ind) => {
              const setor = ind.setorId ? setorById.get(String(ind.setorId)) : null;
              const setorLabel = setor ? `Setor: ${esc(setor.nome)}` : 'Sem setor';
              const metaLabel = ind.meta ? ` | Meta: ${esc(ind.meta)}` : '';
              return `
                <div class="ws-item ws-item-entity">
                  <div>
                    <strong>${esc(ind.nome)}</strong><br><small>${setorLabel}${metaLabel}</small>
                  </div>
                  <div class="ws-item-mini-actions">
                    <button type="button" class="ws-open-planning ws-open-edit" data-edit-indicator="${esc(ind.id)}">Alterar</button>
                    <button type="button" class="ws-open-planning ws-open-danger" data-delete-indicator="${esc(ind.id)}">Excluir</button>
                  </div>
                </div>
              `;
            }).join('')
          : '<div class="ws-empty">Nenhum indicador cadastrado.</div>'}
      </div>
      ${!setores.length ? '<p><small>Dica: cadastre setores em Indicadores → Setores para organizar melhor.</small></p>' : ''}
    </article>
  `;
}

function renderSetoresWorkspace(root) {
  const setores = state.workspaceData.setores || [];
  root.innerHTML = `
    <article class="ws-card ws-focus">
      <h3>Novo Setor</h3>
      <form class="ws-form" id="wsSectorForm">
        <input type="text" name="nome" placeholder="Nome do setor" required>
        <input type="text" name="responsavel" placeholder="Responsavel" required>
        <input type="text" name="meta" placeholder="Meta principal do setor">
        <button type="submit">Salvar Setor</button>
      </form>
    </article>
    <article class="ws-card">
      <h3>Setores cadastrados</h3>
      <div class="ws-list">
        ${setores.length
          ? setores.map((s) => `
            <div class="ws-item ws-item-entity">
              <div>
                <strong>${esc(s.nome)}</strong><br><small>Resp.: ${esc(s.responsavel)}${s.meta ? ` | Meta: ${esc(s.meta)}` : ''}</small>
              </div>
              <div class="ws-item-mini-actions">
                <button type="button" class="ws-open-planning ws-open-edit" data-edit-sector="${esc(s.id)}">Alterar</button>
                <button type="button" class="ws-open-planning ws-open-danger" data-delete-sector="${esc(s.id)}">Excluir</button>
              </div>
            </div>
          `).join('')
          : '<div class="ws-empty">Nenhum setor cadastrado.</div>'}
      </div>
    </article>
  `;
}

function renderMeetingsWorkspace(root) {
  const meetings = (Array.isArray(state.allMeetings) ? state.allMeetings : []).filter((m) => !(m && m.archived));
  const selectedMeeting =
    meetings.find((m) => m.id === state.workspaceUI.selectedMeetingId) ||
    meetings[0] ||
    null;
  if (selectedMeeting) state.workspaceUI.selectedMeetingId = selectedMeeting.id;

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Criar Reunião</h3>
          <p>Use o painel completo de reuniões para cadastrar e organizar pautas.</p>
          <button type="button" class="ws-open-planning" data-open-classic-reunioes>Nova Reunião</button>
        </article>

        <article class="ws-card">
          <h3>Reuniões cadastradas</h3>
          <div class="ws-list ws-list-wide">
            ${meetings.length ? meetings.map((meeting) => {
              const selected = meeting.id === (selectedMeeting && selectedMeeting.id) ? 'ws-item-selected' : '';
              const statusLabel = meeting.status === 'completed' ? 'Finalizada' : meeting.status === 'in_progress' ? 'Em andamento' : 'Não iniciada';
              const canStart = meeting.status !== 'completed';
              const startLabel = meeting.status === 'in_progress' ? 'Continuar' : 'Iniciar';
              return `
                <div class="ws-item ws-item-entity ${selected}">
                  <div class="ws-item-main" data-select-meeting="${esc(meeting.id)}">
                    <strong>${esc(meeting.name || 'Reunião')}</strong><br>
                    <small>${esc(meeting.description || 'Sem descrição')}</small><br>
                    <span class="ws-badge">${esc(meeting.date || '')} ${meeting.time ? '• ' + esc(meeting.time) : ''}</span>
                    <br><span class="ws-badge">${esc(statusLabel)}</span>
                  </div>
                  <div class="ws-item-actions">
                    ${canStart ? `<button type="button" class="ws-open-planning" data-start-meeting="${esc(meeting.id)}">${esc(startLabel)}</button>` : ''}
                    <button type="button" class="ws-open-planning" data-open-meeting-detail="${esc(meeting.id)}">Abrir</button>
                    <button type="button" class="ws-open-planning ws-open-edit" data-edit-meeting="${esc(meeting.id)}">Alterar</button>
                    <button type="button" class="ws-open-planning ws-open-danger" data-delete-meeting="${esc(meeting.id)}">Excluir</button>
                  </div>
                </div>
              `;
            }).join('') : '<div class="ws-empty">Nenhuma reunião encontrada.</div>'}
          </div>
        </article>
      </div>

      <article class="ws-card ws-dual-right">
        ${selectedMeeting ? `
          <div class="ws-ata-doc">
            <div class="ws-ata-head">
              <h4>ATA DE REUNIÃO</h4>
              <span class="ws-ata-code">REF: ${esc(selectedMeeting.id || 'N/A')}</span>
            </div>
            <div class="ws-ata-meta">
              <div><strong>Título:</strong> ${esc(selectedMeeting.name || 'Reunião')}</div>
              <div><strong>Data:</strong> ${esc(selectedMeeting.date || '-')}</div>
              <div><strong>Hora:</strong> ${esc(selectedMeeting.time || '-')}</div>
              <div><strong>Status:</strong> ${esc(selectedMeeting.status === 'completed' ? 'Finalizada' : selectedMeeting.status === 'in_progress' ? 'Em andamento' : 'Não iniciada')}</div>
            </div>
            <div class="ws-ata-section">
              <h5>Descrição</h5>
              <p>${esc(selectedMeeting.description || 'Sem descrição informada.')}</p>
            </div>
            <div class="ws-ata-section">
              <h5>Encaminhamentos</h5>
              <p>Para registrar pauta e atribuir tarefas sem projeto, abra o detalhe da reunião.</p>
            </div>
            <div class="ws-ata-footer">
              Documento gerado no workspace da Plataforma.
            </div>
          </div>
        ` : '<div class="ws-empty">Selecione uma reunião para visualizar a ATA.</div>'}
      </article>
    </section>
  `;
}

function renderMeetingTasksWorkspace(root) {
  const meetings = Array.isArray(state.allMeetings) ? state.allMeetings : [];
  const users = getAssignableUsers();
  const tasks = state.workspaceData.reunioesTarefas || [];
  const selectedTask =
    tasks.find((t) => t.id === state.workspaceUI.selectedMeetingTaskId) ||
    tasks[0] ||
    null;
  if (selectedTask) state.workspaceUI.selectedMeetingTaskId = selectedTask.id;

  const meetingOptions = meetings.map((m) => `<option value="${esc(m.id)}">${esc(m.name || m.id)}</option>`).join('');
  const userOptions = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}${u.email ? ` • ${esc(u.email)}` : ''}</option>`).join('');

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>Criar Tarefa de Reunião</h3>
          <p>Use popup no mesmo padrão de Projeto/Tarefa.</p>
          <button type="button" class="ws-open-planning" data-open-workspace-modal="meeting-task">Nova Tarefa de Reunião</button>
        </article>
        <article class="ws-card">
          <h3>Tarefas de Reuniões</h3>
          <div class="ws-list ws-list-wide">
            ${tasks.length ? tasks.map((task) => {
              const selected = task.id === (selectedTask && selectedTask.id) ? 'ws-item-selected' : '';
              const meeting = task.meetingId ? meetings.find((m) => m.id === task.meetingId) : null;
              return `
                <div class="ws-item ws-item-entity ${selected}">
                  <div class="ws-item-main" data-select-meeting-task="${esc(task.id)}">
                    <strong>${esc(task.nome || 'Tarefa')}</strong><br>
                    <small>${esc(task.descricao || 'Sem descrição')}</small><br>
                    <span class="ws-badge">${meeting ? `Reunião: ${esc(meeting.name || '')}` : 'Sem reunião'}</span>
                    <br><span class="ws-badge">Responsável: ${esc(task.assigneeId ? userNameById(task.assigneeId) : 'Sem responsável')}</span>
                  </div>
                  <div class="ws-item-actions-col">
                    <div class="ws-item-mini-actions">
                      <button type="button" class="ws-open-planning ws-open-edit" data-edit-meeting-task="${esc(task.id)}">Alterar</button>
                      <button type="button" class="ws-open-planning ws-open-danger" data-delete-meeting-task="${esc(task.id)}">Excluir</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('') : '<div class="ws-empty">Nenhuma tarefa de reunião cadastrada.</div>'}
          </div>
        </article>
      </div>
      <article class="ws-card ws-dual-right">
        <h3>Árvore da Tarefa de Reunião</h3>
        ${selectedTask ? `
          <div class="ws-tree-root-wrap">
            <ul class="ws-tree-root-list">
              <li class="ws-tree-line">
                <span class="ws-tree-node ws-tree-task">✔ ${esc(selectedTask.nome)}</span>
                <ul>
                  <li class="ws-tree-line"><span class="ws-tree-node ws-tree-process">Responsável: ${esc(selectedTask.assigneeId ? userNameById(selectedTask.assigneeId) : 'Sem responsável')}</span></li>
                  <li class="ws-tree-line"><span class="ws-tree-node ws-tree-process">Reunião: ${esc(selectedTask.meetingId ? ((meetings.find((m) => m.id === selectedTask.meetingId) || {}).name || selectedTask.meetingId) : 'Sem reunião')}</span></li>
                </ul>
              </li>
            </ul>
          </div>
        ` : '<div class="ws-empty">Selecione uma tarefa para visualizar a árvore.</div>'}
      </article>

      <div class="modal-overlay" id="wsMeetingTaskModalOverlay">
        <div class="modal-create ws-modal-create ws-modal-like-meeting">
          <div class="modal-recurrence ws-modal-recurrence">
            <span class="recurrence-label">TAREFA DE REUNIÃO</span>
            <div class="recurrence-options">
              <button type="button" class="rec-btn active">WORKSPACE</button>
            </div>
          </div>
          <div class="modal-body ws-modal-body">
            <div class="ws-modal-header">
              <h3>Nova Tarefa de Reunião</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="meeting-task" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form ws-modal-form" id="wsMeetingTaskForm">
              <input class="ws-modal-title-input" type="text" name="nome" placeholder="Nome da tarefa" required>
              <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
              <div class="ws-modal-form-grid">
                <div>
                  <label class="ws-label">Reunião vinculada (opcional)</label>
                  <select name="meetingId">
                    <option value="">Sem reunião</option>
                    ${meetingOptions}
                  </select>
                </div>
                <div>
                  <label class="ws-label">Usuário responsável</label>
                  <select name="assigneeId">
                    <option value="">Sem usuário</option>
                    ${userOptions}
                  </select>
                </div>
              </div>
              <div class="modal-actions ws-modal-actions">
                <button type="button" class="btn-cancel" data-close-workspace-modal="meeting-task">Cancelar</button>
                <button type="submit" class="btn-save">Salvar Tarefa</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMeetingOpsWorkspace(navKey, root) {
  if (navKey === 'relatorios') {
    root.innerHTML = `
      <article class="ws-card">
        <h3>Em construção</h3>
        <p>Esta funcionalidade estará disponível em breve.</p>
      </article>
    `;
    return;
  }

  const map = {
    'tarefas-reunioes': { key: 'reunioesTarefas', title: 'Nova tarefa de reunião', placeholder: 'Ex: Validar pauta da diretoria' },
    'processos-reunioes': { key: 'reunioesProcessos', title: 'Novo processo de reunião', placeholder: 'Ex: Fluxo de aprovação de ata' },
    relatorios: { key: 'relatorios', title: 'Novo relatório', placeholder: 'Ex: Relatório mensal de desempenho' },
  };

  const cfg = map[navKey];
  const list = state.workspaceData[cfg.key] || [];

  root.innerHTML = `
    <section class="ws-dual-layout">
      <div class="ws-dual-left">
        <article class="ws-card ws-focus">
          <h3>${cfg.title}</h3>
          ${navKey === 'processos-reunioes'
            ? `
              <p>Use popup no mesmo padrão de Reuniões.</p>
              <button type="button" class="ws-open-planning" data-open-workspace-modal="meeting-process">Novo Processo de Reunião</button>
            `
            : `
              <form class="ws-form" id="wsOpsForm" data-ops-key="${cfg.key}">
                <input type="text" name="nome" placeholder="${cfg.placeholder}" required>
                <textarea name="descricao" placeholder="Descrição"></textarea>
                <button type="submit">Salvar</button>
              </form>
            `}
        </article>
        <article class="ws-card">
          <h3>Itens cadastrados</h3>
          <div class="ws-list">
            ${list.length
              ? list.map((item) => `
                <div class="ws-item ws-item-entity">
                  <div>
                    <strong>${esc(item.nome)}</strong><br><small>${esc(item.descricao || 'Sem descrição')}</small>
                  </div>
                  <div class="ws-item-mini-actions">
                    <button type="button" class="ws-open-planning ws-open-edit" data-edit-ops-item="${esc(item.id)}" data-ops-key="${esc(cfg.key)}">Alterar</button>
                    <button type="button" class="ws-open-planning ws-open-danger" data-delete-ops-item="${esc(item.id)}" data-ops-key="${esc(cfg.key)}">Excluir</button>
                  </div>
                </div>
              `).join('')
              : '<div class="ws-empty">Nenhum item cadastrado.</div>'}
          </div>
        </article>
      </div>
      ${navKey === 'processos-reunioes'
        ? `
          <div class="modal-overlay" id="wsMeetingProcessModalOverlay">
            <div class="modal-create ws-modal-create ws-modal-like-meeting">
              <div class="modal-recurrence ws-modal-recurrence">
                <span class="recurrence-label">PROCESSO DE REUNIÃO</span>
                <div class="recurrence-options">
                  <button type="button" class="rec-btn active">WORKSPACE</button>
                </div>
              </div>
              <div class="modal-body ws-modal-body">
                <div class="ws-modal-header">
                  <h3>Novo Processo de Reunião</h3>
                  <button type="button" class="ws-modal-close" data-close-workspace-modal="meeting-process" aria-label="Fechar">×</button>
                </div>
                <form class="ws-form ws-modal-form" id="wsMeetingProcessForm">
                  <input class="ws-modal-title-input" type="text" name="nome" placeholder="${cfg.placeholder}" required>
                  <textarea class="ws-modal-desc-input" name="descricao" placeholder="Descrição"></textarea>
                  <div class="modal-actions ws-modal-actions">
                    <button type="button" class="btn-cancel" data-close-workspace-modal="meeting-process">Cancelar</button>
                    <button type="submit" class="btn-save">Salvar Processo</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        `
        : ''}
    </section>
  `;
}

function handleWorkspaceSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  e.preventDefault();
  ensureWorkspaceState();

  if (form.id === 'wsStrategicPlanForm') {
    const editId = String(form.dataset.editId || '');
    const anoRaw = String(form.ano.value || '').trim();
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    if (!anoRaw || anoRaw.length > 20 || !nome) {
      showToast('Preencha o campo de ano/ciclo (máximo 20 caracteres).', 'info');
      return;
    }

    if (editId) {
      const plan = (state.workspaceData.planejamentos || []).find((p) => String(p.id) === editId) || (state.workspaceData.planejamentos || [])[0];
      if (!plan) return;
      plan.ano = anoRaw;
      plan.nome = nome;
      plan.descricao = descricao;
      saveWorkspaceData();
      closeWorkspaceModal('plan');
      renderWorkspaceSection('planejamento');
      showToast('Plano alterado.', 'success');
      return;
    }

    if ((state.workspaceData.planejamentos || []).length) {
      showToast('Já existe um plano raiz. Use Alterar para editar o plano atual.', 'info');
      return;
    }

    const plan = { id: mkId('plan'), ano: anoRaw, nome, descricao, projectIds: [] };
    state.workspaceData.planejamentos.push(plan);
    state.workspaceUI.selectedPlanId = plan.id;
    state.workspaceUI.expandedNodes[`plan:${plan.id}`] = true;
    saveWorkspaceData();
    closeWorkspaceModal('plan');
    renderWorkspaceSection('planejamento');
    showToast('Plano estratégico criado.', 'success');
    return;
  }

  if (form.id === 'wsTreeAddForm') {
    const kind = String(form.dataset.treeKind || '');
    const parentId = String(form.dataset.treeParent || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    if (!kind || !parentId || !nome) return;

    if (kind === 'project') {
      const selectedManagers = Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).map((opt) => String(opt.value || '')).filter(Boolean);
      if (selectedManagers.length > 2) {
        showToast('Projeto permite no máximo 2 responsáveis.', 'info');
        return;
      }
      const plan = (state.workspaceData.planejamentos || []).find((p) => String(p.id) === parentId);
      if (!plan) return;
      const project = { id: mkId('proj'), nome, descricao, planId: plan.id, managerIds: selectedManagers.slice(0, 2) };
      state.workspaceData.projetos.push(project);
      plan.projectIds = plan.projectIds || [];
      if (!plan.projectIds.includes(project.id)) plan.projectIds.push(project.id);
      saveWorkspaceData();
      clearTreeAddState();
      closeWorkspaceModal('tree-add');
      renderWorkspaceSection('planejamento');
      showToast('Projeto criado na raiz.', 'success');
      return;
    }

    if (kind === 'task') {
      const assigneeId = String(form.assigneeId.value || '') || null;
      state.workspaceData.tarefas.push({ id: mkId('task'), nome, descricao, projectId: parentId, assigneeId });
      saveWorkspaceData();
      clearTreeAddState();
      closeWorkspaceModal('tree-add');
      renderWorkspaceSection('planejamento');
      showToast('Tarefa criada no projeto.', 'success');
      return;
    }

    if (kind === 'process') {
      const assigneeId = String(form.assigneeId.value || '') || null;
      state.workspaceData.processos.push({ id: mkId('proc'), nome, descricao, taskId: parentId, assigneeId });
      saveWorkspaceData();
      clearTreeAddState();
      closeWorkspaceModal('tree-add');
      renderWorkspaceSection('planejamento');
      showToast('Processo criado na tarefa.', 'success');
      return;
    }
  }

  if (form.id === 'wsQuickProjectInPlanForm') {
    const plan = getSelectedPlan();
    if (!plan) {
      showToast('Crie o plano raiz antes de inserir projetos.', 'info');
      return;
    }
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const selectedManagers = Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).map((opt) => String(opt.value || '')).filter(Boolean);
    if (!nome) return;
    if (selectedManagers.length > 2) {
      showToast('Projeto permite no máximo 2 responsáveis.', 'info');
      return;
    }
    const project = { id: mkId('proj'), nome, descricao, planId: plan.id, managerIds: selectedManagers.slice(0, 2) };
    state.workspaceData.projetos.push(project);
    plan.projectIds = plan.projectIds || [];
    if (!plan.projectIds.includes(project.id)) plan.projectIds.push(project.id);
    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
    showToast('Projeto criado no plano raiz.', 'success');
    return;
  }

  if (form.id === 'wsQuickTaskInProjectForm') {
    const projectId = String(form.projectId.value || '') || null;
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!projectId || !nome) {
      showToast('Selecione o projeto e informe o nome da tarefa.', 'info');
      return;
    }
    state.workspaceData.tarefas.push({ id: mkId('task'), nome, descricao, projectId, assigneeId });
    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
    showToast('Tarefa criada no projeto.', 'success');
    return;
  }

  if (form.id === 'wsAttachProjectToPlanForm') {
    const plan = getSelectedPlan();
    const projectId = String(form.projectId.value || '');
    if (!plan || !projectId) return;

    const project = (state.workspaceData.projetos || []).find((p) => p.id === projectId);
    if (!project) return;

    project.planId = plan.id;
    plan.projectIds = plan.projectIds || [];
    if (!plan.projectIds.includes(projectId)) plan.projectIds.push(projectId);

    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
    showToast('Projeto inserido no plano.', 'success');
    return;
  }

  if (form.id === 'wsProjectForm') {
    const editId = String(form.dataset.editId || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const planId = String(form.planId.value || '') || null;
    const managerIds = Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).map((opt) => String(opt.value || '')).filter(Boolean).slice(0, 2);
    if (!nome) return;
    if (Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).length > 2) {
      showToast('Projeto permite no máximo 2 gestores.', 'info');
      return;
    }

    if (editId) {
      const project = (state.workspaceData.projetos || []).find((p) => String(p.id) === editId);
      if (!project) return;
      project.nome = nome;
      project.descricao = descricao;
      project.managerIds = managerIds;
      updateProjectPlanLink(project.id, planId);
      saveWorkspaceData();
      closeWorkspaceModal('project');
      renderWorkspaceSection('projetos');
      showToast('Projeto alterado.', 'success');
      return;
    }

    const project = { id: mkId('proj'), nome, descricao, planId, managerIds };
    state.workspaceData.projetos.push(project);

    if (planId) {
      const plan = (state.workspaceData.planejamentos || []).find((p) => p.id === planId);
      if (plan) {
        plan.projectIds = plan.projectIds || [];
        if (!plan.projectIds.includes(project.id)) plan.projectIds.push(project.id);
      }
    }

    saveWorkspaceData();
    closeWorkspaceModal('project');
    renderWorkspaceSection('projetos');
    showToast('Projeto salvo.', 'success');
    return;
  }

  if (form.id === 'wsTaskForm') {
    const editId = String(form.dataset.editId || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const projectId = String(form.projectId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;

    if (editId) {
      const task = (state.workspaceData.tarefas || []).find((t) => String(t.id) === editId);
      if (!task) return;
      task.nome = nome;
      task.descricao = descricao;
      task.projectId = projectId;
      task.assigneeId = assigneeId;
      saveWorkspaceData();
      closeWorkspaceModal('task');
      renderWorkspaceSection('tarefas');
      showToast('Tarefa alterada.', 'success');
      return;
    }

    state.workspaceData.tarefas.push({ id: mkId('task'), nome, descricao, projectId, assigneeId });
    saveWorkspaceData();
    closeWorkspaceModal('task');
    renderWorkspaceSection('tarefas');
    showToast('Tarefa salva.', 'success');
    return;
  }

  if (form.id === 'wsMeetingTaskForm') {
    const editId = String(form.dataset.editId || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const meetingId = String(form.meetingId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;

    if (editId) {
      const item = (state.workspaceData.reunioesTarefas || []).find((t) => String(t.id) === editId);
      if (!item) return;
      item.nome = nome;
      item.descricao = descricao;
      item.meetingId = meetingId;
      item.assigneeId = assigneeId;
      saveWorkspaceData();
      closeWorkspaceModal('meeting-task');
      renderWorkspaceSection('tarefas-reunioes');
      showToast('Tarefa de reunião alterada.', 'success');
      return;
    }

    state.workspaceData.reunioesTarefas.push({
      id: mkId('mtt'),
      nome,
      descricao,
      meetingId,
      assigneeId,
    });
    saveWorkspaceData();
    closeWorkspaceModal('meeting-task');
    renderWorkspaceSection('tarefas-reunioes');
    showToast('Tarefa de reunião salva.', 'success');
    return;
  }

  if (form.id === 'wsProcessForm') {
    const editId = String(form.dataset.editId || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const taskId = String(form.taskId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;

    if (editId) {
      const process = (state.workspaceData.processos || []).find((p) => String(p.id) === editId);
      if (!process) return;
      process.nome = nome;
      process.descricao = descricao;
      process.taskId = taskId;
      process.assigneeId = assigneeId;
      saveWorkspaceData();
      closeWorkspaceModal('process');
      renderWorkspaceSection('processos');
      showToast('Processo alterado.', 'success');
      return;
    }

    state.workspaceData.processos.push({ id: mkId('proc'), nome, descricao, taskId, assigneeId });
    saveWorkspaceData();
    closeWorkspaceModal('process');
    renderWorkspaceSection('processos');
    showToast('Processo salvo.', 'success');
    return;
  }

  if (form.id === 'wsMeetingProcessForm') {
    const editId = String(form.dataset.editId || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    if (!nome) return;

    if (editId) {
      state.workspaceData.reunioesProcessos = Array.isArray(state.workspaceData.reunioesProcessos) ? state.workspaceData.reunioesProcessos : [];
      const item = (state.workspaceData.reunioesProcessos || []).find((x) => String(x.id) === editId);
      if (!item) return;
      item.nome = nome;
      item.descricao = descricao;
      saveWorkspaceData();
      closeWorkspaceModal('meeting-process');
      renderWorkspaceSection('processos-reunioes');
      showToast('Processo de reunião alterado.', 'success');
      return;
    }

    state.workspaceData.reunioesProcessos = Array.isArray(state.workspaceData.reunioesProcessos) ? state.workspaceData.reunioesProcessos : [];
    state.workspaceData.reunioesProcessos.push({ id: mkId('ops'), nome, descricao });
    saveWorkspaceData();
    closeWorkspaceModal('meeting-process');
    renderWorkspaceSection('processos-reunioes');
    showToast('Processo de reunião salvo.', 'success');
    return;
  }

  if (form.dataset.linkType === 'project') {
    const projectId = String(form.dataset.projectId || '');
    const planId = String(form.planId.value || '') || null;
    const selectedManagers = Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).map((opt) => String(opt.value || '')).filter(Boolean);
    if (selectedManagers.length > 2) {
      showToast('Projeto permite no máximo 2 gestores.', 'info');
      return;
    }
    updateProjectPlanLink(projectId, planId);
    const project = (state.workspaceData.projetos || []).find((p) => p.id === projectId);
    if (project) project.managerIds = selectedManagers.slice(0, 2);
    saveWorkspaceData();
    renderWorkspaceSection('projetos');
    showToast('Vínculo do projeto atualizado.', 'success');
    return;
  }

  if (form.dataset.linkType === 'task') {
    const taskId = String(form.dataset.taskId || '');
    const projectId = String(form.projectId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    const task = (state.workspaceData.tarefas || []).find((t) => t.id === taskId);
    if (!task) return;
    task.projectId = projectId;
    task.assigneeId = assigneeId;
    saveWorkspaceData();
    renderWorkspaceSection('tarefas');
    showToast('Vínculo da tarefa atualizado.', 'success');
    return;
  }

  if (form.dataset.linkType === 'process') {
    const processId = String(form.dataset.processId || '');
    const taskId = String(form.taskId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    const process = (state.workspaceData.processos || []).find((p) => p.id === processId);
    if (!process) return;
    process.taskId = taskId;
    process.assigneeId = assigneeId;
    saveWorkspaceData();
    renderWorkspaceSection('processos');
    showToast('Vínculo do processo atualizado.', 'success');
    return;
  }

  if (form.id === 'wsSectorForm') {
    const nome = String(form.nome.value || '').trim();
    const responsavel = String(form.responsavel.value || '').trim();
    const meta = String(form.meta.value || '').trim();
    if (!nome || !responsavel) return;
    state.workspaceData.setores.push({ id: mkId('setor'), nome, responsavel, meta });
    saveWorkspaceData();
    renderWorkspaceSection('configuracoes');
    showToast('Setor salvo.', 'success');
    return;
  }

  if (form.id === 'wsIndicatorForm') {
    const nome = String(form.nome.value || '').trim();
    const setorId = String(form.setorId.value || '') || null;
    const meta = String(form.meta.value || '').trim();
    if (!nome) return;
    state.workspaceData.indicadores = Array.isArray(state.workspaceData.indicadores) ? state.workspaceData.indicadores : [];
    state.workspaceData.indicadores.push({ id: mkId('ind'), nome, setorId, meta });
    saveWorkspaceData();
    renderWorkspaceSection('configuracoes');
    showToast('Indicador salvo.', 'success');
    return;
  }

  if (form.id === 'wsOpsForm') {
    const key = String(form.dataset.opsKey || '');
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    if (!key || !nome || !Array.isArray(state.workspaceData[key])) return;
    state.workspaceData[key].push({ id: mkId('ops'), nome, descricao });
    saveWorkspaceData();
    renderWorkspaceSection(state.activeNav || 'relatorios');
    showToast('Item salvo.', 'success');
  }
}

function updateProjectPlanLink(projectId, newPlanId) {
  const project = (state.workspaceData.projetos || []).find((p) => p.id === projectId);
  if (!project) return;

  const oldPlanId = project.planId || null;
  if (oldPlanId && oldPlanId !== newPlanId) {
    const oldPlan = (state.workspaceData.planejamentos || []).find((p) => p.id === oldPlanId);
    if (oldPlan && Array.isArray(oldPlan.projectIds)) {
      oldPlan.projectIds = oldPlan.projectIds.filter((id) => id !== projectId);
    }
  }

  project.planId = newPlanId;

  if (newPlanId) {
    const newPlan = (state.workspaceData.planejamentos || []).find((p) => p.id === newPlanId);
    if (newPlan) {
      newPlan.projectIds = newPlan.projectIds || [];
      if (!newPlan.projectIds.includes(projectId)) newPlan.projectIds.push(projectId);
    }
  }
}

function handleWorkspaceChange(e) {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target instanceof HTMLSelectElement) {
    const inlineForm = target.closest('.ws-inline-form[data-link-type]');
    if (inlineForm && inlineForm instanceof HTMLFormElement) {
      inlineForm.requestSubmit();
      return;
    }
  }
}

function handleWorkspaceClick(e) {
  const openClassicReunioes = e.target.closest('[data-open-classic-reunioes]');
  if (openClassicReunioes) {
    if (typeof openModal === 'function') {
      // No workspace de reuniões, abrir somente o popup moderno.
      openModal();
    }
    return;
  }

  const startMeetingBtn = e.target.closest('[data-start-meeting]');
  if (startMeetingBtn) {
    const meetingId = String(startMeetingBtn.dataset.startMeeting || '');
    const meeting = (state.allMeetings || []).find((m) => String(m.id) === meetingId);
    if (!meeting) return;

    // Somente o responsável pode iniciar.
    const currentInitials = (state.currentUser && state.currentUser.initials) || '';
    const responsible = (meeting && (meeting.responsible || (meeting.members && meeting.members[0]))) || '';
    if (currentInitials && responsible && currentInitials !== responsible) {
      showToast('Somente o responsável pode iniciar a reunião', 'info');
      return;
    }

    if (typeof openStartConfirm === 'function') {
      openStartConfirm(meeting);
    }
    return;
  }

  const openMeetingDetailBtn = e.target.closest('[data-open-meeting-detail]');
  if (openMeetingDetailBtn) {
    const meetingId = String(openMeetingDetailBtn.dataset.openMeetingDetail || '');
    const meeting = (state.allMeetings || []).find((m) => String(m.id) === meetingId);
    if (meeting) {
      if (typeof openMeetingDetail === 'function') {
        setTimeout(() => openMeetingDetail(meeting), 0);
      }
    }
    return;
  }

  const editMeetingBtn = e.target.closest('[data-edit-meeting]');
  if (editMeetingBtn) {
    const meetingId = String(editMeetingBtn.dataset.editMeeting || '');
    const meeting = (state.allMeetings || []).find((m) => String(m.id) === meetingId);
    if (!meeting) return;
    if (typeof openModalForEdit === 'function') {
      openModalForEdit(meeting);
    }
    return;
  }

  const deleteMeetingBtn = e.target.closest('[data-delete-meeting]');
  if (deleteMeetingBtn) {
    const meetingId = String(deleteMeetingBtn.dataset.deleteMeeting || '');
    if (!confirmDelete('a reunião')) return;
    const meetings = (typeof getLocalMeetings === 'function') ? getLocalMeetings() : (state.allMeetings || []);
    const next = (meetings || []).filter((m) => String(m.id) !== meetingId);
    if (typeof saveLocalMeetings === 'function') saveLocalMeetings(next);
    state.allMeetings = next;
    if (typeof reloadMeetings === 'function') {
      reloadMeetings();
    } else {
      renderWorkspaceSection('reunioes-workspace');
    }
    showToast('Reunião excluída.', 'success');
    return;
  }

  const openModalBtn = e.target.closest('[data-open-workspace-modal]');
  if (openModalBtn) {
    openWorkspaceModalForCreate(String(openModalBtn.dataset.openWorkspaceModal || ''));
    return;
  }

  const treeAddBtn = e.target.closest('[data-tree-add]');
  if (treeAddBtn) {
    const kind = String(treeAddBtn.dataset.treeAdd || '');
    const parentId = String(treeAddBtn.dataset.treeParent || '');
    if (!kind || !parentId) return;
    setTreeAddState(kind, parentId);
    renderWorkspaceSection('planejamento');
    openWorkspaceModal('tree-add');
    return;
  }

  const treeRemoveBtn = e.target.closest('[data-tree-remove]');
  if (treeRemoveBtn) {
    const kind = String(treeRemoveBtn.dataset.treeRemove || '');
    const itemId = String(treeRemoveBtn.dataset.treeId || '');
    if (!kind || !itemId) return;

    if (kind === 'project') {
      if (!confirmDelete('o projeto')) return;
      const taskIds = (state.workspaceData.tarefas || []).filter((t) => String(t.projectId || '') === itemId).map((t) => String(t.id));
      state.workspaceData.processos = (state.workspaceData.processos || []).filter((p) => !taskIds.includes(String(p.taskId || '')));
      state.workspaceData.tarefas = (state.workspaceData.tarefas || []).filter((t) => String(t.projectId || '') !== itemId);
      state.workspaceData.projetos = (state.workspaceData.projetos || []).filter((p) => String(p.id) !== itemId);
      (state.workspaceData.planejamentos || []).forEach((plan) => {
        plan.projectIds = Array.isArray(plan.projectIds) ? plan.projectIds.filter((id) => String(id) !== itemId) : [];
      });
      saveWorkspaceData();
      renderWorkspaceSection('planejamento');
      showToast('Projeto excluído.', 'success');
      return;
    }

    if (kind === 'task') {
      if (!confirmDelete('a tarefa')) return;
      state.workspaceData.processos = (state.workspaceData.processos || []).filter((p) => String(p.taskId || '') !== itemId);
      state.workspaceData.tarefas = (state.workspaceData.tarefas || []).filter((t) => String(t.id) !== itemId);
      saveWorkspaceData();
      renderWorkspaceSection('planejamento');
      showToast('Tarefa excluída.', 'success');
      return;
    }

    if (kind === 'process') {
      if (!confirmDelete('o processo')) return;
      state.workspaceData.processos = (state.workspaceData.processos || []).filter((p) => String(p.id) !== itemId);
      saveWorkspaceData();
      renderWorkspaceSection('planejamento');
      showToast('Processo excluído.', 'success');
      return;
    }
  }

  const closeModalBtn = e.target.closest('[data-close-workspace-modal]');
  if (closeModalBtn) {
    closeWorkspaceModal(String(closeModalBtn.dataset.closeWorkspaceModal || ''));
    return;
  }

  const overlay = e.target.closest('.modal-overlay');
  if (overlay && e.target === overlay) {
    if (overlay.id === 'wsPlanModalOverlay') closeWorkspaceModal('plan');
    if (overlay.id === 'wsTreeAddModalOverlay') closeWorkspaceModal('tree-add');
    if (overlay.id === 'wsProjectModalOverlay') closeWorkspaceModal('project');
    if (overlay.id === 'wsTaskModalOverlay') closeWorkspaceModal('task');
    if (overlay.id === 'wsMeetingTaskModalOverlay') closeWorkspaceModal('meeting-task');
    if (overlay.id === 'wsProcessModalOverlay') closeWorkspaceModal('process');
    if (overlay.id === 'wsMeetingProcessModalOverlay') closeWorkspaceModal('meeting-process');
    return;
  }

  const selectPlanBtn = e.target.closest('[data-select-plan]');
  if (selectPlanBtn) {
    state.workspaceUI.selectedPlanId = String(selectPlanBtn.dataset.selectPlan || '');
    renderWorkspaceSection('planejamento');
    return;
  }

  const selectProject = e.target.closest('[data-select-project]');
  if (selectProject) {
    state.workspaceUI.selectedProjectId = String(selectProject.dataset.selectProject || '');
    renderWorkspaceSection('projetos');
    return;
  }

  const selectTask = e.target.closest('[data-select-task]');
  if (selectTask) {
    state.workspaceUI.selectedTaskId = String(selectTask.dataset.selectTask || '');
    renderWorkspaceSection('tarefas');
    return;
  }

  const selectMeeting = e.target.closest('[data-select-meeting]');
  if (selectMeeting) {
    state.workspaceUI.selectedMeetingId = String(selectMeeting.dataset.selectMeeting || '');
    renderWorkspaceSection('reunioes-workspace');
    return;
  }

  const selectMeetingTask = e.target.closest('[data-select-meeting-task]');
  if (selectMeetingTask) {
    state.workspaceUI.selectedMeetingTaskId = String(selectMeetingTask.dataset.selectMeetingTask || '');
    renderWorkspaceSection('tarefas-reunioes');
    return;
  }

  const editPlanBtn = e.target.closest('[data-edit-plan]');
  if (editPlanBtn) {
    const planId = String(editPlanBtn.dataset.editPlan || '');
    const plan = (state.workspaceData.planejamentos || []).find((p) => String(p.id) === planId);
    if (!plan) return;
    openWorkspaceModalForEdit('plan', plan);
    return;
  }

  const deletePlanBtn = e.target.closest('[data-delete-plan]');
  if (deletePlanBtn) {
    const planId = String(deletePlanBtn.dataset.deletePlan || '');
    const plans = state.workspaceData.planejamentos || [];
    const plan = plans.find((p) => String(p.id) === planId);
    if (!plan) return;
    if (!confirmDelete('o planejamento')) return;

    (state.workspaceData.projetos || []).forEach((project) => {
      if (String(project.planId || '') === planId) project.planId = null;
    });
    state.workspaceData.planejamentos = plans.filter((p) => String(p.id) !== planId);
    if (String(state.workspaceUI.selectedPlanId || '') === planId) {
      state.workspaceUI.selectedPlanId = (state.workspaceData.planejamentos[0] && state.workspaceData.planejamentos[0].id) || '';
    }
    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
    showToast('Planejamento excluído.', 'success');
    return;
  }

  const editProjectBtn = e.target.closest('[data-edit-project]');
  if (editProjectBtn) {
    const projectId = String(editProjectBtn.dataset.editProject || '');
    const project = (state.workspaceData.projetos || []).find((p) => String(p.id) === projectId);
    if (!project) return;
    openWorkspaceModalForEdit('project', project);
    return;
  }

  const deleteProjectBtn = e.target.closest('[data-delete-project]');
  if (deleteProjectBtn) {
    const projectId = String(deleteProjectBtn.dataset.deleteProject || '');
    if (!confirmDelete('o projeto')) return;
    const projects = state.workspaceData.projetos || [];
    state.workspaceData.projetos = projects.filter((p) => String(p.id) !== projectId);
    (state.workspaceData.planejamentos || []).forEach((plan) => {
      plan.projectIds = Array.isArray(plan.projectIds) ? plan.projectIds.filter((id) => String(id) !== projectId) : [];
    });
    (state.workspaceData.tarefas || []).forEach((task) => {
      if (String(task.projectId || '') === projectId) task.projectId = null;
    });
    if (String(state.workspaceUI.selectedProjectId || '') === projectId) state.workspaceUI.selectedProjectId = '';
    saveWorkspaceData();
    renderWorkspaceSection('projetos');
    showToast('Projeto excluído.', 'success');
    return;
  }

  const editTaskBtn = e.target.closest('[data-edit-task]');
  if (editTaskBtn) {
    const taskId = String(editTaskBtn.dataset.editTask || '');
    const task = (state.workspaceData.tarefas || []).find((t) => String(t.id) === taskId);
    if (!task) return;
    openWorkspaceModalForEdit('task', task);
    return;
  }

  const deleteTaskBtn = e.target.closest('[data-delete-task]');
  if (deleteTaskBtn) {
    const taskId = String(deleteTaskBtn.dataset.deleteTask || '');
    if (!confirmDelete('a tarefa')) return;
    state.workspaceData.tarefas = (state.workspaceData.tarefas || []).filter((t) => String(t.id) !== taskId);
    (state.workspaceData.processos || []).forEach((process) => {
      if (String(process.taskId || '') === taskId) process.taskId = null;
    });
    if (String(state.workspaceUI.selectedTaskId || '') === taskId) state.workspaceUI.selectedTaskId = '';
    saveWorkspaceData();
    renderWorkspaceSection('tarefas');
    showToast('Tarefa excluída.', 'success');
    return;
  }

  const editProcessBtn = e.target.closest('[data-edit-process]');
  if (editProcessBtn) {
    const processId = String(editProcessBtn.dataset.editProcess || '');
    const process = (state.workspaceData.processos || []).find((p) => String(p.id) === processId);
    if (!process) return;
    openWorkspaceModalForEdit('process', process);
    return;
  }

  const deleteProcessBtn = e.target.closest('[data-delete-process]');
  if (deleteProcessBtn) {
    deleteSimpleWorkspaceItem('processos', String(deleteProcessBtn.dataset.deleteProcess || ''), 'processos', 'Processo');
    return;
  }

  const editMeetingTaskBtn = e.target.closest('[data-edit-meeting-task]');
  if (editMeetingTaskBtn) {
    const meetingTaskId = String(editMeetingTaskBtn.dataset.editMeetingTask || '');
    const item = (state.workspaceData.reunioesTarefas || []).find((t) => String(t.id) === meetingTaskId);
    if (!item) return;
    openWorkspaceModalForEdit('meeting-task', item);
    return;
  }

  const deleteMeetingTaskBtn = e.target.closest('[data-delete-meeting-task]');
  if (deleteMeetingTaskBtn) {
    const meetingTaskId = String(deleteMeetingTaskBtn.dataset.deleteMeetingTask || '');
    deleteSimpleWorkspaceItem('reunioesTarefas', meetingTaskId, 'tarefas-reunioes', 'Tarefa de reunião');
    if (String(state.workspaceUI.selectedMeetingTaskId || '') === meetingTaskId) state.workspaceUI.selectedMeetingTaskId = '';
    return;
  }

  const editOpsItemBtn = e.target.closest('[data-edit-ops-item]');
  if (editOpsItemBtn) {
    const itemId = String(editOpsItemBtn.dataset.editOpsItem || '');
    const opsKey = String(editOpsItemBtn.dataset.opsKey || '');
    if (!opsKey) return;
    const navKey = state.activeNav || (opsKey === 'reunioesProcessos' ? 'processos-reunioes' : opsKey);
    if (opsKey === 'reunioesProcessos') {
      const item = (state.workspaceData.reunioesProcessos || []).find((x) => String(x.id) === itemId);
      if (!item) return;
      openWorkspaceModalForEdit('meeting-process', item);
      return;
    }
    editSimpleWorkspaceItem(opsKey, itemId, navKey, 'Item');
    return;
  }

  const deleteOpsItemBtn = e.target.closest('[data-delete-ops-item]');
  if (deleteOpsItemBtn) {
    const itemId = String(deleteOpsItemBtn.dataset.deleteOpsItem || '');
    const opsKey = String(deleteOpsItemBtn.dataset.opsKey || '');
    if (!opsKey) return;
    const navKey = state.activeNav || (opsKey === 'reunioesProcessos' ? 'processos-reunioes' : opsKey);
    deleteSimpleWorkspaceItem(opsKey, itemId, navKey, 'Item');
    return;
  }

  const editIndicatorBtn = e.target.closest('[data-edit-indicator]');
  if (editIndicatorBtn) {
    const indicatorId = String(editIndicatorBtn.dataset.editIndicator || '');
    const list = state.workspaceData.indicadores || [];
    const ind = list.find((x) => String(x.id) === indicatorId);
    if (!ind) return;
    const nome = promptRequiredValue('Alterar indicador - nome:', ind.nome || '', { maxLen: 120 });
    if (nome === null || nome === '__INVALID__') return;
    const meta = promptOptionalValue('Alterar indicador - meta:', ind.meta || '');
    if (meta === null) return;
    ind.nome = nome;
    ind.meta = meta;
    saveWorkspaceData();
    renderWorkspaceSection('configuracoes');
    showToast('Indicador alterado.', 'success');
    return;
  }

  const deleteIndicatorBtn = e.target.closest('[data-delete-indicator]');
  if (deleteIndicatorBtn) {
    deleteSimpleWorkspaceItem('indicadores', String(deleteIndicatorBtn.dataset.deleteIndicator || ''), 'configuracoes', 'Indicador');
    return;
  }

  const editSectorBtn = e.target.closest('[data-edit-sector]');
  if (editSectorBtn) {
    const sectorId = String(editSectorBtn.dataset.editSector || '');
    const setor = (state.workspaceData.setores || []).find((x) => String(x.id) === sectorId);
    if (!setor) return;
    const nome = promptRequiredValue('Alterar setor - nome:', setor.nome || '', { maxLen: 120 });
    if (nome === null || nome === '__INVALID__') return;
    const responsavel = promptRequiredValue('Alterar setor - responsável:', setor.responsavel || '', { maxLen: 120 });
    if (responsavel === null || responsavel === '__INVALID__') return;
    const meta = promptOptionalValue('Alterar setor - meta:', setor.meta || '');
    if (meta === null) return;
    setor.nome = nome;
    setor.responsavel = responsavel;
    setor.meta = meta;
    saveWorkspaceData();
    renderWorkspaceSection('configuracoes');
    showToast('Setor alterado.', 'success');
    return;
  }

  const deleteSectorBtn = e.target.closest('[data-delete-sector]');
  if (deleteSectorBtn) {
    const sectorId = String(deleteSectorBtn.dataset.deleteSector || '');
    if (!confirmDelete('o setor')) return;
    state.workspaceData.setores = (state.workspaceData.setores || []).filter((x) => String(x.id) !== sectorId);
    (state.workspaceData.indicadores || []).forEach((ind) => {
      if (String(ind.setorId || '') === sectorId) ind.setorId = null;
    });
    saveWorkspaceData();
    renderWorkspaceSection('configuracoes');
    showToast('Setor excluído.', 'success');
    return;
  }

  const toggle = e.target.closest('[data-tree-node]');
  if (toggle) {
    const nodeId = String(toggle.dataset.treeNode || '');
    if (!nodeId) return;
    state.workspaceUI.expandedNodes[nodeId] = !isNodeOpen(nodeId);
    renderWorkspaceSection(state.activeNav || 'planejamento');
    return;
  }

  const unlinkBtn = e.target.closest('[data-unlink-project]');
  if (unlinkBtn) {
    const projectId = String(unlinkBtn.dataset.unlinkProject || '');
    updateProjectPlanLink(projectId, null);
    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
  }
}

function handleWorkspaceDragStart(e) {
  const card = e.target.closest('.ws-project-card');
  if (!card) return;
  state.workspaceUI.dragProjectId = card.dataset.projectId || '';
  card.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.workspaceUI.dragProjectId);
  }
}

function handleWorkspaceDragOver(e) {
  const board = e.target.closest('#wsProjectBoard');
  if (!board) return;
  e.preventDefault();
}

function handleWorkspaceDrop(e) {
  const board = e.target.closest('#wsProjectBoard');
  if (!board) return;
  e.preventDefault();

  const plan = getSelectedPlan();
  if (!plan || !Array.isArray(plan.projectIds) || !plan.projectIds.length) return;

  const draggedId = state.workspaceUI.dragProjectId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  if (!draggedId) return;

  const fromIndex = plan.projectIds.findIndex((id) => id === draggedId);
  if (fromIndex < 0) return;

  const dropCard = e.target.closest('.ws-project-card');
  let toIndex = dropCard ? plan.projectIds.findIndex((id) => id === dropCard.dataset.projectId) : plan.projectIds.length;

  const [moved] = plan.projectIds.splice(fromIndex, 1);
  if (toIndex > fromIndex) toIndex -= 1;
  if (toIndex < 0 || toIndex > plan.projectIds.length) toIndex = plan.projectIds.length;
  plan.projectIds.splice(toIndex, 0, moved);

  saveWorkspaceData();
  renderWorkspaceSection('planejamento');
}

function handleWorkspaceDragEnd() {
  state.workspaceUI.dragProjectId = '';
}

function isNodeOpen(nodeId) {
  return state.workspaceUI.expandedNodes[nodeId] !== false;
}

function openWorkspaceModal(kind) {
  const id = getWorkspaceModalOverlayId(kind);
  if (!id) return;
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('open');
}

function getWorkspaceModalFormId(kind) {
  return kind === 'plan'
    ? 'wsStrategicPlanForm'
    : kind === 'project'
      ? 'wsProjectForm'
      : kind === 'task'
        ? 'wsTaskForm'
        : kind === 'process'
          ? 'wsProcessForm'
          : kind === 'meeting-task'
            ? 'wsMeetingTaskForm'
            : kind === 'meeting-process'
              ? 'wsMeetingProcessForm'
              : '';
}

function getWorkspaceModalCopy(kind, mode) {
  const isEdit = mode === 'edit';
  if (kind === 'plan') {
    return {
      label: isEdit ? 'ALTERAR PLANEJAMENTO' : 'NOVO PLANEJAMENTO',
      title: isEdit ? 'Alterar Planejamento' : 'Novo Planejamento',
      submit: isEdit ? 'Salvar alterações' : 'Criar Plano',
    };
  }
  if (kind === 'project') {
    return {
      label: isEdit ? 'ALTERAR PROJETO' : 'NOVO PROJETO',
      title: isEdit ? 'Alterar Projeto' : 'Novo Projeto',
      submit: isEdit ? 'Salvar alterações' : 'Salvar Projeto',
    };
  }
  if (kind === 'task') {
    return {
      label: isEdit ? 'ALTERAR TAREFA' : 'NOVA TAREFA',
      title: isEdit ? 'Alterar Tarefa' : 'Nova Tarefa',
      submit: isEdit ? 'Salvar alterações' : 'Salvar Tarefa',
    };
  }
  if (kind === 'process') {
    return {
      label: isEdit ? 'ALTERAR PROCESSO' : 'NOVO PROCESSO',
      title: isEdit ? 'Alterar Processo' : 'Novo Processo',
      submit: isEdit ? 'Salvar alterações' : 'Salvar Processo',
    };
  }
  if (kind === 'meeting-task') {
    return {
      label: isEdit ? 'ALTERAR TAREFA DE REUNIÃO' : 'TAREFA DE REUNIÃO',
      title: isEdit ? 'Alterar Tarefa de Reunião' : 'Nova Tarefa de Reunião',
      submit: isEdit ? 'Salvar alterações' : 'Salvar Tarefa',
    };
  }
  if (kind === 'meeting-process') {
    return {
      label: isEdit ? 'ALTERAR PROCESSO DE REUNIÃO' : 'PROCESSO DE REUNIÃO',
      title: isEdit ? 'Alterar Processo de Reunião' : 'Novo Processo de Reunião',
      submit: isEdit ? 'Salvar alterações' : 'Salvar Processo',
    };
  }
  return { label: '', title: '', submit: '' };
}

function resetWorkspaceModal(kind) {
  const formId = getWorkspaceModalFormId(kind);
  const form = formId ? document.getElementById(formId) : null;
  if (form) {
    delete form.dataset.editId;
    form.reset();
    const multi = form.querySelector('select[name="managerIds"][multiple]');
    if (multi) Array.from(multi.options || []).forEach((opt) => { opt.selected = false; });
  }

  const overlayId = getWorkspaceModalOverlayId(kind);
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  if (!overlay) return;

  const copy = getWorkspaceModalCopy(kind, 'create');
  const labelEl = overlay.querySelector('.ws-modal-recurrence .recurrence-label');
  const titleEl = overlay.querySelector('.ws-modal-header h3');
  const submitEl = overlay.querySelector('button[type="submit"].btn-save');
  if (labelEl && copy.label) labelEl.textContent = copy.label;
  if (titleEl && copy.title) titleEl.textContent = copy.title;
  if (submitEl && copy.submit) submitEl.textContent = copy.submit;

  if (state.workspaceUI && state.workspaceUI.modalEdit && String(state.workspaceUI.modalEdit.kind || '') === String(kind)) {
    state.workspaceUI.modalEdit = { kind: '', id: '' };
  }
}

function applyWorkspaceModalCopy(kind, mode) {
  const overlayId = getWorkspaceModalOverlayId(kind);
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  if (!overlay) return;
  const copy = getWorkspaceModalCopy(kind, mode);
  const labelEl = overlay.querySelector('.ws-modal-recurrence .recurrence-label');
  const titleEl = overlay.querySelector('.ws-modal-header h3');
  const submitEl = overlay.querySelector('button[type="submit"].btn-save');
  if (labelEl && copy.label) labelEl.textContent = copy.label;
  if (titleEl && copy.title) titleEl.textContent = copy.title;
  if (submitEl && copy.submit) submitEl.textContent = copy.submit;
}

function openWorkspaceModalForCreate(kind) {
  ensureWorkspaceState();
  if (getWorkspaceModalFormId(kind)) {
    resetWorkspaceModal(kind);
  }
  openWorkspaceModal(kind);
}

function openWorkspaceModalForEdit(kind, item) {
  ensureWorkspaceState();
  if (!item || !getWorkspaceModalFormId(kind)) return;
  resetWorkspaceModal(kind);

  const formId = getWorkspaceModalFormId(kind);
  const form = formId ? document.getElementById(formId) : null;
  if (!form) return;

  form.dataset.editId = String(item.id || '');
  state.workspaceUI.modalEdit = { kind: String(kind || ''), id: String(item.id || '') };
  applyWorkspaceModalCopy(kind, 'edit');

  if (kind === 'plan') {
    form.ano.value = String(item.ano || '');
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
  }

  if (kind === 'project') {
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
    form.planId.value = String(item.planId || '');
    const multi = form.querySelector('select[name="managerIds"][multiple]');
    if (multi) {
      const ids = Array.isArray(item.managerIds) ? item.managerIds.map(String) : [];
      Array.from(multi.options || []).forEach((opt) => { opt.selected = ids.includes(String(opt.value || '')); });
    }
  }

  if (kind === 'task') {
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
    form.projectId.value = String(item.projectId || '');
    form.assigneeId.value = String(item.assigneeId || '');
  }

  if (kind === 'process') {
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
    form.taskId.value = String(item.taskId || '');
    form.assigneeId.value = String(item.assigneeId || '');
  }

  if (kind === 'meeting-task') {
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
    form.meetingId.value = String(item.meetingId || '');
    form.assigneeId.value = String(item.assigneeId || '');
  }

  if (kind === 'meeting-process') {
    form.nome.value = String(item.nome || '');
    form.descricao.value = String(item.descricao || '');
  }

  openWorkspaceModal(kind);
  const firstInput = form.querySelector('input, textarea, select');
  if (firstInput && typeof firstInput.focus === 'function') {
    setTimeout(() => firstInput.focus(), 0);
  }
}

function getWorkspaceModalOverlayId(kind) {
  return kind === 'plan'
    ? 'wsPlanModalOverlay'
    : kind === 'tree-add'
      ? 'wsTreeAddModalOverlay'
    : kind === 'project'
    ? 'wsProjectModalOverlay'
    : kind === 'task'
      ? 'wsTaskModalOverlay'
      : kind === 'meeting-task'
        ? 'wsMeetingTaskModalOverlay'
        : kind === 'process'
          ? 'wsProcessModalOverlay'
          : kind === 'meeting-process'
            ? 'wsMeetingProcessModalOverlay'
        : '';
}

function closeWorkspaceModal(kind) {
  const id = getWorkspaceModalOverlayId(kind);
  if (!id) return;
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('open');
  if (kind === 'tree-add') clearTreeAddState();
  if (getWorkspaceModalFormId(kind)) resetWorkspaceModal(kind);
}
