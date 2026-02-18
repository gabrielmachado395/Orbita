/* ═══════════════════════════════════════════════════════════════════════════ */
/* ReuniX - Sidebar                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const org = document.getElementById('sidebarOrg');
  const nav = document.getElementById('sidebarNav');
  const search = document.getElementById('sidebarSearch');
  if (search) search.value = '';

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  org.classList.add('open');
  org.addEventListener('click', () => {
    state.sidebarOrgOpen = !state.sidebarOrgOpen;
    org.classList.toggle('open', state.sidebarOrgOpen);
    nav.classList.toggle('collapsed-nav', !state.sidebarOrgOpen);
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  search.addEventListener('input', () => {
    const term = search.value.toLowerCase().trim();
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const text = btn.querySelector('span') ? btn.querySelector('span').textContent.toLowerCase() : '';
      if (!term || text.includes(term)) {
        btn.classList.remove('filtered-out');
      } else {
        btn.classList.add('filtered-out');
      }
    });
  });
}
