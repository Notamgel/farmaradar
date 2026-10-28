// Landing: aparición al hacer scroll, cifras que cuentan y sombra de la cabecera.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cuenta = (el) => {
    const fin = Number(el.dataset.cuenta);
    if (!fin || quieto) return;
    const t0 = performance.now(), dura = 1200;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / dura);
      el.textContent = Math.round(fin * (1 - (1 - p) ** 3)).toLocaleString('es-MX');
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((vistas) => {
      for (const v of vistas) {
        if (!v.isIntersecting) continue;
        v.target.querySelectorAll('[data-cuenta]').forEach(cuenta);
        io.unobserve(v.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.lp-stats').forEach((el) => io.observe(el));
  }

  const cab = document.querySelector('.cab');
  if (cab) {
    const sombra = () => cab.classList.toggle('con-sombra', scrollY > 8);
    addEventListener('scroll', sombra, { passive: true });
    sombra();
  }

  // El menú del teléfono se cierra al elegir una sección.
  document.getElementById('menu')?.addEventListener('click', (e) => {
    if (e.target.closest('a')) e.currentTarget.classList.remove('abierto');
  });
})();
