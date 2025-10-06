document.addEventListener('DOMContentLoaded', function() {
  // Elementos del DOM
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const fabBtn = document.getElementById('fab-btn');

  // Variables de control de estado
  let suppressUI = false;
  let lastOpenedAt = 0;

  // Función para suprimir UI temporalmente
  function suppressFor(ms) {
    suppressUI = true;
    closeSidebar();

    const events = ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    const swallow = function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    };
    
    events.forEach(evt => window.addEventListener(evt, swallow, true));

    setTimeout(() => {
      suppressUI = false;
      events.forEach(evt => window.removeEventListener(evt, swallow, true));
    }, ms);
  }

  // Sidebar functions
  function closeSidebar() {
    if (!sidebar) return;
    const wasOpen = sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('visible');

    if (!wasOpen) {
      sidebar.hidden = true;
      if (sidebarBackdrop) sidebarBackdrop.hidden = true;
      return;
    }

    function endSidebar() { sidebar.hidden = true; sidebar.removeEventListener('transitionend', endSidebar); }
    function endBackdrop() { if (sidebarBackdrop) sidebarBackdrop.hidden = true; sidebarBackdrop.removeEventListener('transitionend', endBackdrop); }

    sidebar.addEventListener('transitionend', endSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('transitionend', endBackdrop);
  }

  function openSidebar() {
    if (suppressUI || !sidebar) return;
    sidebar.hidden = false;
    if (sidebarBackdrop) sidebarBackdrop.hidden = false;

    void sidebar.getBoundingClientRect(); // force reflow
    sidebar.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    lastOpenedAt = Date.now();

    if (sidebarBackdrop) requestAnimationFrame(() => sidebarBackdrop.classList.add('visible'));
  }

  // Initialize sidebar
  closeSidebar();

  if (sidebarToggle) {
    sidebarToggle.addEventListener('pointerdown', e => { if (suppressUI) e.stopPropagation(); }, true);
    sidebarToggle.addEventListener('click', e => { e.stopPropagation(); openSidebar(); });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => { if (Date.now() - lastOpenedAt >= 300) closeSidebar(); });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });

});
