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
}

function loadWorkspaceData() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY) || localStorage.getItem('plataforma_workspace_v1');
    if (!raw) return emptyWorkspaceData();

    const parsed = JSON.parse(raw);
    const normalized = emptyWorkspaceData();

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

function openAppSection(navKey) {
  ensureWorkspaceState();
  const key = navKey || 'home';
  state.activeNav = key;
  syncSidebarActiveState(key);

  const listView = document.getElementById('listView');
  const detailView = document.getElementById('detailView');
  const workspaceView = document.getElementById('workspaceView');
  if (!listView || !detailView || !workspaceView) return;

  if (key === 'reunioes') {
    workspaceView.classList.add('hidden');
    detailView.classList.add('hidden');
    listView.classList.remove('hidden');
    state.currentView = 'list';
    state.currentMeeting = null;
    if (typeof applyMeetingFilters === 'function') applyMeetingFilters();
    return;
  }

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

  const meta = {
    home: { title: 'Home', subtitle: 'Visão geral da Organização e atalhos da Plataforma.' },
    planejamento: { title: 'Construtor Estratégico', subtitle: 'Árvore raiz do plano anual com projetos arrastáveis.' },
    projetos: { title: 'Projetos', subtitle: 'Crie projetos com ou sem plano estratégico e vincule quando quiser.' },
    tarefas: { title: 'Tarefas', subtitle: 'Crie tarefas com ou sem projeto, mantendo flexibilidade.' },
    processos: { title: 'Processos', subtitle: 'Crie processos com ou sem tarefa e vincule depois.' },
    indicadores: { title: 'Indicadores', subtitle: 'Acompanhe indicadores e organize por setores.' },
    setores: { title: 'Setores', subtitle: 'Cadastro de setores para estrutura dos indicadores.' },
    'reunioes-workspace': { title: 'Reuniões', subtitle: 'Abra uma reunião e crie pautas com tarefas sem necessidade de projeto.' },
    'tarefas-reunioes': { title: 'Tarefas de Reuniões', subtitle: 'Ações geradas durante as reuniões.' },
    'processos-reunioes': { title: 'Processos de Reuniões', subtitle: 'Fluxos relacionados às pautas e decisões.' },
    relatorios: { title: 'Relatórios', subtitle: 'Modelos e registros de relatórios da plataforma.' },
  };

  const current = meta[navKey] || { title: 'Workspace', subtitle: 'Seção em preparação.' };
  titleEl.textContent = current.title;
  subEl.textContent = current.subtitle;

  if (navKey === 'home') return renderHomeWorkspace(contentEl);
  if (navKey === 'planejamento') return renderPlanningBuilder(contentEl);
  if (navKey === 'projetos') return renderProjectsWorkspace(contentEl);
  if (navKey === 'tarefas') return renderTasksWorkspace(contentEl);
  if (navKey === 'processos') return renderProcessesWorkspace(contentEl);
  if (['indicadores', 'setores'].includes(navKey)) return renderSetoresWorkspace(contentEl);
  if (navKey === 'reunioes-workspace') return renderMeetingsWorkspace(contentEl);
  if (navKey === 'tarefas-reunioes') return renderMeetingTasksWorkspace(contentEl);
  if (['processos-reunioes', 'relatorios'].includes(navKey)) return renderMeetingOpsWorkspace(navKey, contentEl);

  contentEl.innerHTML = '<div class="ws-card"><h3>Em construção</h3><p>Esta seção será habilitada em seguida.</p></div>';
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
  const map = new Map();
  (state.users || []).forEach((u) => {
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

function renderPlanningBuilder(root) {
  const plans = state.workspaceData.planejamentos || [];
  const selectedPlan = getSelectedPlan();
  const linkedProjects = getProjectsForPlan(selectedPlan);
  const unlinkedProjects = (state.workspaceData.projetos || []).filter((p) => !p.planId);

  const stats = {
    projetos: linkedProjects.length,
    tarefas: linkedProjects.reduce((acc, p) => acc + getTasksForProject(p.id).length, 0),
    processos: linkedProjects.reduce((acc, p) => acc + getTasksForProject(p.id).reduce((a, t) => a + getProcessesForTask(t.id).length, 0), 0),
  };

  const planOptions = plans.map((p) => `<option value="${esc(p.id)}" ${p.id === state.workspaceUI.selectedPlanId ? 'selected' : ''}>${esc(String(p.ano))} - ${esc(p.nome)}</option>`).join('');
  const attachOptions = unlinkedProjects.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
  const plansList = plans.length
    ? plans.map((p) => `
      <div class="ws-item ws-item-entity">
        <div>
          <strong>${esc(String(p.ano))} - ${esc(p.nome)}</strong><br>
          <small>${esc(p.descricao || 'Sem descrição')}</small>
        </div>
        <button type="button" class="ws-open-planning" data-select-plan="${esc(p.id)}">
          ${p.id === state.workspaceUI.selectedPlanId ? 'Plano Ativo' : 'Abrir Plano'}
        </button>
      </div>
    `).join('')
    : '<div class="ws-empty">Nenhum plano cadastrado.</div>';

  root.innerHTML = `
    <section class="plan-shell">
      <article class="ws-card plan-control-card">
        <h3>Plano Raiz</h3>
        <form class="ws-form" id="wsStrategicPlanForm">
          <input type="text" name="ano" maxlength="20" placeholder="Ano (ex: 2026)" required>
          <input type="text" name="nome" placeholder="Nome do plano" required>
          <textarea name="descricao" placeholder="Diretriz estratégica"></textarea>
          <button type="submit">Criar Plano</button>
        </form>

        <div class="plan-divider"></div>

        <div class="ws-form">
          <label class="ws-label">Plano ativo</label>
          <select id="wsPlanSelect">
            <option value="">Selecione...</option>
            ${planOptions}
          </select>
        </div>

        <div class="ws-list ws-list-wide">
          ${plansList}
        </div>

        <form class="ws-form" id="wsAttachProjectToPlanForm">
          <label class="ws-label">Inserir projeto no plano (opcional)</label>
          <select name="projectId" ${selectedPlan ? '' : 'disabled'}>
            <option value="">Selecione projeto sem plano</option>
            ${attachOptions}
          </select>
          <button type="submit" ${selectedPlan ? '' : 'disabled'}>Inserir no Plano</button>
        </form>
      </article>

      <article class="ws-card plan-tree-card">
        <div class="plan-kpis">
          <div class="plan-kpi"><strong>${stats.projetos}</strong><span>Projetos</span></div>
          <div class="plan-kpi"><strong>${stats.tarefas}</strong><span>Tarefas</span></div>
          <div class="plan-kpi"><strong>${stats.processos}</strong><span>Processos</span></div>
        </div>

        <h3>Árvore Estratégica</h3>
        ${renderAllPlansTrees(plans)}

        <div class="plan-divider"></div>
        <h3>Projetos no Plano (arraste para ordenar)</h3>
        <div class="ws-project-board" id="wsProjectBoard">
          ${renderProjectCards(linkedProjects)}
        </div>
      </article>
    </section>
  `;
}

function renderPlanningTree(plan, projects) {
  if (!plan) return '<div class="ws-empty">Crie um plano raiz para visualizar a árvore.</div>';

  const rootNodeId = `plan:${plan.id}`;
  const rootOpen = isNodeOpen(rootNodeId);

  const projectLines = projects.map((project) => {
    const projectNodeId = `project:${project.id}`;
    const projectOpen = isNodeOpen(projectNodeId);
    const tasks = getTasksForProject(project.id);

    const tasksHtml = tasks.map((task) => {
      const taskNodeId = `task:${task.id}`;
      const taskOpen = isNodeOpen(taskNodeId);
      const processes = getProcessesForTask(task.id);

      return `
        <li class="ws-tree-line">
          <div class="ws-tree-node-row">
            ${processes.length ? renderTreeToggle(taskNodeId, taskOpen) : '<span class="ws-tree-pad"></span>'}
            <span class="ws-tree-node ws-tree-task">✔ ${esc(task.nome)}</span>
          </div>
          ${processes.length && taskOpen ? `<ul>${processes.map((proc) => `<li class="ws-tree-line"><span class="ws-tree-node ws-tree-process">⚙ ${esc(proc.nome)}</span></li>`).join('')}</ul>` : ''}
        </li>
      `;
    }).join('');

    return `
      <li class="ws-tree-line">
        <div class="ws-tree-node-row">
          ${tasks.length ? renderTreeToggle(projectNodeId, projectOpen) : '<span class="ws-tree-pad"></span>'}
          <span class="ws-tree-node ws-tree-project">◆ ${esc(project.nome)}</span>
        </div>
        ${tasks.length && projectOpen ? `<ul>${tasksHtml}</ul>` : ''}
      </li>
    `;
  }).join('');

  return `
    <div class="ws-tree-root-wrap">
      <div class="ws-tree-node-row root-row">
        ${renderTreeToggle(rootNodeId, rootOpen)}
        <span class="ws-tree-node ws-tree-root">RAIZ ${esc(String(plan.ano))} • ${esc(plan.nome)}</span>
      </div>
      ${rootOpen ? `<ul class="ws-tree-root-list">${projectLines || '<li class="ws-empty">Sem projetos vinculados.</li>'}</ul>` : ''}
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
        <div class="modal-create ws-modal-create">
          <div class="ws-modal-body">
            <div class="ws-modal-header">
              <h3>Novo Projeto</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="project" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form" id="wsProjectForm">
              <input type="text" name="nome" placeholder="Nome do projeto" required>
              <textarea name="descricao" placeholder="Descrição"></textarea>
              <label class="ws-label">Inserir no plano estratégico (opcional)</label>
              <select name="planId">
                <option value="">Sem plano</option>
                ${planOptions}
              </select>
              <label class="ws-label">Gestores do projeto (max 2)</label>
              <select name="managerIds" multiple size="4">
                ${managerOptions}
              </select>
              <button type="submit">Salvar Projeto</button>
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
        <button type="submit">Atualizar</button>
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
        <div class="modal-create ws-modal-create">
          <div class="ws-modal-body">
            <div class="ws-modal-header">
              <h3>Nova Tarefa</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="task" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form" id="wsTaskForm">
              <input type="text" name="nome" placeholder="Nome da tarefa" required>
              <textarea name="descricao" placeholder="Descrição"></textarea>
              <label class="ws-label">Inserir no projeto (opcional)</label>
              <select name="projectId">
                <option value="">Sem projeto</option>
                ${projectOptions}
              </select>
              <label class="ws-label">Usuário responsável</label>
              <select name="assigneeId">
                <option value="">Sem usuário</option>
                ${userOptions}
              </select>
              <button type="submit">Salvar Tarefa</button>
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
        <button type="submit">Atualizar</button>
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
    <article class="ws-card ws-focus">
      <h3>Novo Processo</h3>
      <form class="ws-form" id="wsProcessForm">
        <input type="text" name="nome" placeholder="Nome do processo" required>
        <textarea name="descricao" placeholder="Descrição"></textarea>
        <label class="ws-label">Inserir na tarefa (opcional)</label>
        <select name="taskId">
          <option value="">Sem tarefa</option>
          ${taskOptions}
        </select>
        <label class="ws-label">Usuário responsável</label>
        <select name="assigneeId">
          <option value="">Sem usuário</option>
          ${userOptions}
        </select>
        <button type="submit">Salvar Processo</button>
      </form>
    </article>

    <article class="ws-card">
      <h3>Processos cadastrados</h3>
      <div class="ws-list ws-list-wide">
        ${processes.length ? processes.map((process) => renderProcessLinkItem(process, tasks)).join('') : '<div class="ws-empty">Nenhum processo cadastrado.</div>'}
      </div>
    </article>
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
        <button type="submit">Atualizar</button>
      </form>
    </div>
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
          ? setores.map((s) => `<div class="ws-item"><strong>${esc(s.nome)}</strong><br><small>Resp.: ${esc(s.responsavel)}${s.meta ? ` | Meta: ${esc(s.meta)}` : ''}</small></div>`).join('')
          : '<div class="ws-empty">Nenhum setor cadastrado.</div>'}
      </div>
    </article>
  `;
}

function renderMeetingsWorkspace(root) {
  const meetings = Array.isArray(state.allMeetings) ? state.allMeetings : [];
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
              return `
                <div class="ws-item ws-item-entity ${selected}">
                  <div class="ws-item-main" data-select-meeting="${esc(meeting.id)}">
                    <strong>${esc(meeting.name || 'Reunião')}</strong><br>
                    <small>${esc(meeting.description || 'Sem descrição')}</small><br>
                    <span class="ws-badge">${esc(meeting.date || '')} ${meeting.time ? '• ' + esc(meeting.time) : ''}</span>
                    <br><span class="ws-badge">${esc(statusLabel)}</span>
                  </div>
                  <button type="button" class="ws-open-planning" data-open-meeting-detail="${esc(meeting.id)}">Abrir</button>
                </div>
              `;
            }).join('') : '<div class="ws-empty">Nenhuma reunião encontrada.</div>'}
          </div>
        </article>
      </div>

      <article class="ws-card ws-dual-right">
        <h3>ATA da Reunião</h3>
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
        <div class="modal-create ws-modal-create">
          <div class="ws-modal-body">
            <div class="ws-modal-header">
              <h3>Nova Tarefa de Reunião</h3>
              <button type="button" class="ws-modal-close" data-close-workspace-modal="meeting-task" aria-label="Fechar">×</button>
            </div>
            <form class="ws-form" id="wsMeetingTaskForm">
              <input type="text" name="nome" placeholder="Nome da tarefa" required>
              <textarea name="descricao" placeholder="Descrição"></textarea>
              <label class="ws-label">Reunião vinculada (opcional)</label>
              <select name="meetingId">
                <option value="">Sem reunião</option>
                ${meetingOptions}
              </select>
              <label class="ws-label">Usuário responsável</label>
              <select name="assigneeId">
                <option value="">Sem usuário</option>
                ${userOptions}
              </select>
              <button type="submit">Salvar Tarefa</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMeetingOpsWorkspace(navKey, root) {
  const map = {
    'tarefas-reunioes': { key: 'reunioesTarefas', title: 'Nova tarefa de reunião', placeholder: 'Ex: Validar pauta da diretoria' },
    'processos-reunioes': { key: 'reunioesProcessos', title: 'Novo processo de reunião', placeholder: 'Ex: Fluxo de aprovação de ata' },
    relatorios: { key: 'relatorios', title: 'Novo relatório', placeholder: 'Ex: Relatório mensal de desempenho' },
  };

  const cfg = map[navKey];
  const list = state.workspaceData[cfg.key] || [];

  root.innerHTML = `
    <article class="ws-card ws-focus">
      <h3>${cfg.title}</h3>
      <form class="ws-form" id="wsOpsForm" data-ops-key="${cfg.key}">
        <input type="text" name="nome" placeholder="${cfg.placeholder}" required>
        <textarea name="descricao" placeholder="Descrição"></textarea>
        <button type="submit">Salvar</button>
      </form>
    </article>
    <article class="ws-card">
      <h3>Itens cadastrados</h3>
      <div class="ws-list">
        ${list.length
          ? list.map((item) => `<div class="ws-item"><strong>${esc(item.nome)}</strong><br><small>${esc(item.descricao || 'Sem descrição')}</small></div>`).join('')
          : '<div class="ws-empty">Nenhum item cadastrado.</div>'}
      </div>
    </article>
  `;
}

function handleWorkspaceSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  e.preventDefault();
  ensureWorkspaceState();

  if (form.id === 'wsStrategicPlanForm') {
    const anoRaw = String(form.ano.value || '').trim();
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    if (!anoRaw || anoRaw.length > 20 || !nome) {
      showToast('Preencha o campo de ano/ciclo (máximo 20 caracteres).', 'info');
      return;
    }

    const plan = { id: mkId('plan'), ano: anoRaw, nome, descricao, projectIds: [] };
    state.workspaceData.planejamentos.push(plan);
    state.workspaceUI.selectedPlanId = plan.id;
    state.workspaceUI.expandedNodes[`plan:${plan.id}`] = true;
    saveWorkspaceData();
    renderWorkspaceSection('planejamento');
    showToast('Plano estratégico criado.', 'success');
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
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const planId = String(form.planId.value || '') || null;
    const managerIds = Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).map((opt) => String(opt.value || '')).filter(Boolean).slice(0, 2);
    if (!nome) return;
    if (Array.from(form.querySelectorAll('select[name="managerIds"] option:checked')).length > 2) {
      showToast('Projeto permite no máximo 2 gestores.', 'info');
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
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const projectId = String(form.projectId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;

    state.workspaceData.tarefas.push({ id: mkId('task'), nome, descricao, projectId, assigneeId });
    saveWorkspaceData();
    closeWorkspaceModal('task');
    renderWorkspaceSection('tarefas');
    showToast('Tarefa salva.', 'success');
    return;
  }

  if (form.id === 'wsMeetingTaskForm') {
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const meetingId = String(form.meetingId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;
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
    const nome = String(form.nome.value || '').trim();
    const descricao = String(form.descricao.value || '').trim();
    const taskId = String(form.taskId.value || '') || null;
    const assigneeId = String(form.assigneeId.value || '') || null;
    if (!nome) return;

    state.workspaceData.processos.push({ id: mkId('proc'), nome, descricao, taskId, assigneeId });
    saveWorkspaceData();
    renderWorkspaceSection('processos');
    showToast('Processo salvo.', 'success');
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
    renderWorkspaceSection(state.activeNav || 'setores');
    showToast('Setor salvo.', 'success');
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

  if (target.id === 'wsPlanSelect' && target instanceof HTMLSelectElement) {
    state.workspaceUI.selectedPlanId = target.value || '';
    renderWorkspaceSection('planejamento');
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

  const openMeetingDetailBtn = e.target.closest('[data-open-meeting-detail]');
  if (openMeetingDetailBtn) {
    const meetingId = String(openMeetingDetailBtn.dataset.openMeetingDetail || '');
    const meeting = (state.allMeetings || []).find((m) => String(m.id) === meetingId);
    if (meeting) {
      openAppSection('reunioes');
      if (typeof openMeetingDetail === 'function') {
        setTimeout(() => openMeetingDetail(meeting), 0);
      }
    }
    return;
  }

  const openModalBtn = e.target.closest('[data-open-workspace-modal]');
  if (openModalBtn) {
    openWorkspaceModal(String(openModalBtn.dataset.openWorkspaceModal || ''));
    return;
  }

  const closeModalBtn = e.target.closest('[data-close-workspace-modal]');
  if (closeModalBtn) {
    closeWorkspaceModal(String(closeModalBtn.dataset.closeWorkspaceModal || ''));
    return;
  }

  const overlay = e.target.closest('.modal-overlay');
  if (overlay && e.target === overlay) {
    if (overlay.id === 'wsProjectModalOverlay') closeWorkspaceModal('project');
    if (overlay.id === 'wsTaskModalOverlay') closeWorkspaceModal('task');
    if (overlay.id === 'wsMeetingTaskModalOverlay') closeWorkspaceModal('meeting-task');
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
  const id = kind === 'project'
    ? 'wsProjectModalOverlay'
    : kind === 'task'
      ? 'wsTaskModalOverlay'
      : kind === 'meeting-task'
        ? 'wsMeetingTaskModalOverlay'
        : '';
  if (!id) return;
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('open');
}

function closeWorkspaceModal(kind) {
  const id = kind === 'project'
    ? 'wsProjectModalOverlay'
    : kind === 'task'
      ? 'wsTaskModalOverlay'
      : kind === 'meeting-task'
        ? 'wsMeetingTaskModalOverlay'
        : '';
  if (!id) return;
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('open');
}
