(() => {
  const header = document.querySelector('.site-header');
  const inner = header.querySelector('.site-header__inner');
  const nav = header.querySelector('.site-nav');
  const toggle = header.querySelector('.menu-toggle');
  let collapsed = false;
  let open = false;

  function setOpen(value, restoreFocus = false) {
    open = collapsed && value;
    nav.hidden = collapsed && !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    if (restoreFocus) toggle.focus();
  }

  function updateHeight() {
    document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  }

  function updateLayout() {
    const active = document.activeElement;
    const wasCollapsed = collapsed;
    // Measure the real links in their expanded layout, including loaded fonts.
    // Restore the final state synchronously so the measurement never flashes.
    header.classList.remove('is-collapsed');
    nav.hidden = false;
    const rows = new Set([...nav.children].map(link => Math.round(link.offsetTop)));
    collapsed = inner.clientWidth <= 1200 || rows.size > 1;
    header.classList.toggle('is-collapsed', collapsed);
    setOpen(wasCollapsed && open);
    if (collapsed && nav.hidden && nav.contains(active)) toggle.focus();
    if (!collapsed && active === toggle) nav.querySelector('a').focus();
    updateHeight();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  nav.addEventListener('click', event => {
    if (event.target.closest('a') && collapsed) setOpen(false, true);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      setOpen(false, true);
      event.preventDefault();
    }
  });
  document.addEventListener('click', event => {
    if (open && !header.contains(event.target)) setOpen(false, nav.contains(document.activeElement));
  });
  header.addEventListener('focusout', event => {
    if (open && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
  });

  // Observe width only: opening a menu or changing header height must not loop.
  let lastWidth;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width !== lastWidth) {
      lastWidth = entry.contentRect.width;
      updateLayout();
    }
  }).observe(inner);
  new ResizeObserver(updateHeight).observe(header);
  window.addEventListener('resize', updateLayout);
  document.fonts.ready.then(updateLayout);
  updateLayout();
})();
