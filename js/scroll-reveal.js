(() => {
  document.querySelectorAll('img[src*="./assets/"]').forEach(image => {
    const src = image.getAttribute('src');
    if (!src || src.includes('/Logo/')) return;
    if (image.closest('picture')) return;
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.srcset = src.replace(/\.(jpe?g|png)$/i, '.webp');
    source.type = 'image/webp';
    image.parentNode.insertBefore(picture, image);
    picture.append(source, image);
    image.decoding = 'async';
    if (image.closest('.home-hero')) {
      image.fetchPriority = 'high';
    } else if (!image.classList.contains('access-map')) {
      image.loading = 'lazy';
    }
  });
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionPreference.matches || !('IntersectionObserver' in window)) return;

  // Animate individual blocks instead of hiding a long section and its children twice.
  const selector = [
    'main section', 'main article', 'main .section-title', '.staff-lead',
    '.home-medical__button', '.home-access-top', '.home-access .hours', '.home-departments'
  ].join(',');
  const blocks = [...document.querySelectorAll(selector)]
    .filter(block => !block.querySelector(selector));

  function reveal(block) {
    block.classList.add('is-visible');
    observer.unobserve(block);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) reveal(entry.target);
    }
  }, {
    // A zero threshold also works for blocks taller than the viewport.
    threshold: 0,
    rootMargin: '0px 0px -24px 0px'
  });

  for (const block of blocks) {
    block.classList.add('scroll-reveal');
    observer.observe(block);
  }

  // Keyboard focus must never land inside an invisible block.
  document.addEventListener('focusin', event => {
    const block = event.target.closest('.scroll-reveal');
    if (block) reveal(block);
  });

  motionPreference.addEventListener('change', event => {
    if (event.matches) {
      blocks.forEach(reveal);
      observer.disconnect();
    }
  });
})();
