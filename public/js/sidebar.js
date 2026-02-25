/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Sidebar                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const COMPANY_LOGO_STORAGE_KEY = 'plataforma_company_logo';

function applyCompanyLogo(dataUrl) {
  const logoBtn = document.getElementById('sidebarCompanyLogo');
  if (!logoBtn) return;

  if (dataUrl) {
    logoBtn.style.setProperty('--company-logo-url', `url("${String(dataUrl).replace(/"/g, '\\"')}")`);
    logoBtn.classList.add('has-custom-logo');
    return;
  }

  logoBtn.style.removeProperty('--company-logo-url');
  logoBtn.classList.remove('has-custom-logo');
}

function setupCompanyLogoUpload() {
  const logoBtn = document.getElementById('sidebarCompanyLogo');
  const input = document.getElementById('sidebarCompanyLogoInput');
  if (!logoBtn || !input) return;

  const savedLogo = localStorage.getItem(COMPANY_LOGO_STORAGE_KEY);
  applyCompanyLogo(savedLogo || '');

  logoBtn.addEventListener('click', () => {
    input.click();
  });

  logoBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!localStorage.getItem(COMPANY_LOGO_STORAGE_KEY)) return;
    const ok = window.confirm('Remover a logo personalizada e voltar para a padrão?');
    if (!ok) return;
    localStorage.removeItem(COMPANY_LOGO_STORAGE_KEY);
    applyCompanyLogo('');
    if (typeof showToast === 'function') showToast('Logo padrão restaurada.', 'success');
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      if (typeof showToast === 'function') showToast('Selecione uma imagem válida.', 'info');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target && ev.target.result ? String(ev.target.result) : '';
      if (!dataUrl) return;
      localStorage.setItem(COMPANY_LOGO_STORAGE_KEY, dataUrl);
      applyCompanyLogo(dataUrl);
      if (typeof showToast === 'function') showToast('Logo da empresa atualizada.', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
  });
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const org = document.getElementById('sidebarOrg');
  const nav = document.getElementById('sidebarNav');
  const search = document.getElementById('sidebarSearch');
  if (search) search.value = '';

  const setActiveButton = (btn) => {
    nav.querySelectorAll('.tree-toggle, .tree-leaf').forEach(item => item.classList.remove('active'));
    if (btn) btn.classList.add('active');
  };

  const markActiveParents = () => {
    nav.querySelectorAll('.tree-toggle').forEach(btn => btn.classList.remove('active-parent'));
    nav.querySelectorAll('.nav-btn.active').forEach(activeBtn => {
      let parentNode = activeBtn.closest('.tree-children')?.closest('.tree-node');
      while (parentNode) {
        const parentToggle = parentNode.querySelector(':scope > .tree-toggle');
        if (parentToggle) parentToggle.classList.add('active-parent');
        parentNode = parentNode.closest('.tree-children')?.closest('.tree-node');
      }
    });
  };

  const revealBranch = (btn) => {
    btn.classList.remove('filtered-out');

    if (btn.classList.contains('tree-toggle')) {
      const ownNode = btn.closest('.tree-node');
      if (ownNode) ownNode.classList.add('open');
      ownNode?.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('filtered-out'));
    }

    let parentNode = btn.closest('.tree-children')?.closest('.tree-node');
    while (parentNode) {
      parentNode.classList.add('open');
      const parentToggle = parentNode.querySelector(':scope > .tree-toggle');
      if (parentToggle) {
        parentToggle.classList.remove('filtered-out');
        parentToggle.setAttribute('aria-expanded', 'true');
      }
      parentNode = parentNode.closest('.tree-children')?.closest('.tree-node');
    }
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (org) {
    org.classList.add('open');
    org.addEventListener('click', () => {
      state.sidebarOrgOpen = !state.sidebarOrgOpen;
      org.classList.toggle('open', state.sidebarOrgOpen);
      nav.classList.toggle('collapsed-nav', !state.sidebarOrgOpen);
    });
  }

  nav.querySelectorAll('.tree-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const node = btn.closest('.tree-node');
      const willOpen = !node.classList.contains('open');
      node.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      setActiveButton(btn);
      markActiveParents();
      const navKey = btn.dataset.nav;
      if (navKey && typeof openAppSection === 'function') openAppSection(navKey);
    });
  });

  nav.querySelectorAll('.tree-leaf').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveButton(btn);
      markActiveParents();
      const navKey = btn.dataset.nav;
      if (navKey && typeof openAppSection === 'function') openAppSection(navKey);
    });
  });

  if (search) {
    search.addEventListener('input', () => {
      const term = search.value.toLowerCase().trim();
      const navButtons = nav.querySelectorAll('.nav-btn');

      if (!term) {
        navButtons.forEach(btn => btn.classList.remove('filtered-out'));
        return;
      }

      navButtons.forEach(btn => btn.classList.add('filtered-out'));
      nav.querySelectorAll('.nav-btn').forEach(btn => {
        const text = btn.querySelector('span')?.textContent.toLowerCase() || '';
        if (text.includes(term)) revealBranch(btn);
      });

      nav.querySelectorAll('.tree-node').forEach(node => {
        const isVisible = node.querySelector(':scope > .tree-toggle:not(.filtered-out)') ||
          node.querySelector(':scope > .tree-children .nav-btn:not(.filtered-out)');
        if (!isVisible) {
          const toggleBtn = node.querySelector(':scope > .tree-toggle');
          if (toggleBtn) toggleBtn.classList.add('filtered-out');
        }
      });
    });
  }

  markActiveParents();
  setupCompanyLogoUpload();
}
