// La presentación: escala el lienzo, cambia diapositivas, narra con la voz de ElevenLabs y pinta el fondo 3D.
(() => {
  const lienzo = document.getElementById('lienzo');
  const diapos = [...document.querySelectorAll('.diapo')];
  const puntos = [...document.querySelectorAll('.puntos button')];
  const sub = document.getElementById('subtitulo');
  const controles = document.getElementById('controles');
  const progreso = document.getElementById('progreso');
  const vozBoton = controles.querySelector('.voz-boton span');
  const luz = Object.assign(document.createElement('div'), { className: 'barrido-luz' });
  document.body.appendChild(luz);
  let actual = 0, conVoz = false, sonando = false, subtitulos = false, fin = null;
  const audio = new Audio();
  audio.preload = 'auto';

  // Escala 1600×900 a la pantalla.
  const escala = () => { lienzo.style.transform = `scale(${Math.min(innerWidth / 1600, innerHeight / 900)})`; };
  addEventListener('resize', escala); escala();

  // Precios que cuentan hacia arriba.
  const cuenta = (d) => d.querySelectorAll('.d-filas strong, .rv-precio').forEach((el) => {
    const fin = el.dataset.fin ?? el.textContent; el.dataset.fin = fin;
    const n = Number(fin.replace(/[^0-9.]/g, '')); if (!n) return;
    const dec = fin.includes('.') ? 2 : 0; const t0 = performance.now();
    const paso = (t) => { const p = Math.min(1, (t - t0) / 1400); const v = n * (1 - (1 - p) ** 3);
      el.textContent = `$${v.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`; if (p < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  });

  function ve(i, { narrar = conVoz } = {}) {
    i = Math.max(0, Math.min(diapos.length - 1, i));
    if (i !== actual) {
      const vieja = diapos[actual];
      vieja.classList.remove('activa'); vieja.classList.add('sale');
      setTimeout(() => vieja.classList.remove('sale'), 800);
      luz.classList.remove('corre'); void luz.offsetWidth; luz.classList.add('corre');
    }
    actual = i;
    diapos.forEach((d, k) => d.classList.toggle('activa', k === i));
    puntos.forEach((p, k) => p.classList.toggle('activo', k === i));
    cuenta(diapos[i]);
    window.__fondo3d?.(i);
    history.replaceState(null, '', `#${i + 1}`);
    clearTimeout(fin); progreso.style.width = '0%';
    sub.innerHTML = '';
    if (subtitulos) { const s = document.createElement('span'); s.textContent = diapos[i].dataset.voz; sub.appendChild(s); }
    if (narrar) narra(); else { audio.pause(); sonando = false; marca(); }
  }

  function narra() {
    sonando = true; marca();
    audio.src = `/static/presentacion/voz-${actual + 1}.mp3`;
    audio.play().catch(() => { sonando = false; marca(); });
  }
  audio.addEventListener('timeupdate', () => { if (audio.duration) progreso.style.width = `${(audio.currentTime / audio.duration) * 100}%`; });
  audio.addEventListener('ended', () => {
    if (!conVoz) return;
    if (actual < diapos.length - 1) fin = setTimeout(() => ve(actual + 1), 900);
    else { sonando = false; conVoz = false; marca(); }
  });
  const marca = () => { vozBoton.textContent = sonando ? 'Pausar' : 'Escuchar'; };

  function alternaVoz() {
    if (sonando) { audio.pause(); sonando = false; conVoz = false; clearTimeout(fin); }
    else { conVoz = true; if (audio.src && !audio.ended && audio.currentTime > 0 && audio.src.endsWith(`voz-${actual + 1}.mp3`)) { audio.play(); sonando = true; } else narra(); }
    marca();
  }

  // Inicio: con voz o sin voz (el toque desbloquea el audio en Safari).
  const inicio = document.getElementById('inicio');
  document.getElementById('con-voz').addEventListener('click', () => { inicio.hidden = true; conVoz = true; ve(actual, { narrar: true }); });
  document.getElementById('sin-voz').addEventListener('click', () => { inicio.hidden = true; conVoz = false; ve(actual, { narrar: false }); });

  controles.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ir) return ve(Number(b.dataset.ir));
    const a = b.dataset.accion;
    if (a === 'anterior') ve(actual - 1);
    if (a === 'siguiente') ve(actual + 1);
    if (a === 'voz') alternaVoz();
    if (a === 'subtitulos') { subtitulos = !subtitulos; b.classList.toggle('activo', subtitulos); sub.classList.toggle('oculto', !subtitulos); if (subtitulos && !sub.firstChild) ve(actual, { narrar: false }); }
    if (a === 'pantalla') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  });
  addEventListener('keydown', (e) => {
    if (!inicio.hidden) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('con-voz').click(); } return; }
    if (['ArrowRight', 'PageDown'].includes(e.key)) ve(actual + 1);
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) ve(actual - 1);
    else if (e.key === ' ') { e.preventDefault(); alternaVoz(); }
    else if (e.key.toLowerCase() === 'f') controles.querySelector('[data-accion="pantalla"]').click();
    else if (e.key === 'Home') ve(0); else if (e.key === 'End') ve(diapos.length - 1);
  });
  // Tocar la mitad derecha avanza, la izquierda regresa; deslizar también.
  let x0 = null;
  document.getElementById('escenario').addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  document.getElementById('escenario').addEventListener('pointerup', (e) => {
    if (x0 === null || !inicio.hidden) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) ve(actual + (dx < 0 ? 1 : -1));
    else ve(actual + (e.clientX > innerWidth / 2 ? 1 : -1));
  });
  // Los controles se esconden si no mueves nada.
  let quieto;
  const despierta = () => { controles.classList.remove('quieto'); clearTimeout(quieto); quieto = setTimeout(() => controles.classList.add('quieto'), 3000); };
  ['pointermove', 'pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, despierta)); despierta();

  const n0 = Number(location.hash.slice(1)) - 1;
  ve(Number.isInteger(n0) && n0 > 0 ? n0 : 0, { narrar: false });

  /* ── Fondo 3D (three.js): una malla de puntos como mapa, con «pings» de farmacias ── */
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.crossOrigin = 'anonymous';
  s.onload = fondo;
  document.head.appendChild(s);

  function fondo() {
    const T = window.THREE; if (!T) return;
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lienzo3d = Object.assign(document.createElement('canvas'), { id: 'fondo3d' });
    document.body.prepend(lienzo3d);
    const r = new T.WebGLRenderer({ canvas: lienzo3d, antialias: true, alpha: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setClearColor(0x020f0d);
    const escena = new T.Scene(); escena.fog = new T.FogExp2(0x020f0d, 0.032);
    const cam = new T.PerspectiveCamera(55, 1, 0.1, 200);

    // Malla de puntos ondulante.
    const N = 120, paso = 0.5, pos = new Float32Array(N * N * 3);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = (i * N + j) * 3; pos[k] = (i - N / 2) * paso; pos[k + 1] = 0; pos[k + 2] = (j - N / 2) * paso; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const puntos = new T.Points(geo, new T.PointsMaterial({ color: 0x2dd4bf, size: 0.06, transparent: true, opacity: 0.55 }));
    escena.add(puntos);

    // Pings: anillos que se expanden en colores del semáforo.
    const COLORES = [0x4ade80, 0x4ade80, 0xf87171, 0xfbbf24, 0x5eead4];
    const pings = [];
    const anillo = new T.RingGeometry(0.92, 1, 64);
    const nuevoPing = () => {
      const m = new T.Mesh(anillo, new T.MeshBasicMaterial({ color: COLORES[Math.floor(Math.random() * COLORES.length)], transparent: true, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set((Math.random() - 0.5) * 34, 0.02, (Math.random() - 0.5) * 34 - 4);
      const nucleo = new T.Mesh(new T.CircleGeometry(0.12, 20), new T.MeshBasicMaterial({ color: m.material.color, transparent: true }));
      nucleo.rotation.x = -Math.PI / 2; nucleo.position.copy(m.position); nucleo.position.y += 0.01;
      escena.add(m, nucleo); pings.push({ m, nucleo, t: 0, vida: 2.5 + Math.random() * 2 });
    };
    for (let i = 0; i < 14; i++) { nuevoPing(); pings[i].t = Math.random() * pings[i].vida; }

    // Cada diapositiva tiene su toma.
    const TOMAS = [[0, 6, 14, 0, 0, 0], [-8, 4, 10, -4, 0, -2], [6, 9, 12, 2, 0, -4], [10, 5, 8, 6, 0, -6], [-6, 3, 7, -10, 0, -6],
      [0, 12, 4, 0, 0, -6], [4, 16, 10, 0, 0, 0], [-10, 7, 14, 0, 0, -2], [0, 5, 16, 0, 0, 0]];
    let toma = TOMAS[0], hacia = new T.Vector3(...toma.slice(0, 3)), mira = new T.Vector3(...toma.slice(3)), miraAct = mira.clone();
    cam.position.copy(hacia);
    window.__fondo3d = (i) => { toma = TOMAS[i % TOMAS.length]; hacia = new T.Vector3(...toma.slice(0, 3)); mira = new T.Vector3(...toma.slice(3)); };

    const tam = () => { r.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
    addEventListener('resize', tam); tam();
    let antes = performance.now();
    const cuadro = (ahora) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora; const t = ahora / 1000;
      const a = geo.attributes.position.array;
      for (let k = 0; k < a.length; k += 3) a[k + 1] = Math.sin(a[k] * 0.35 + t * 0.8) * 0.25 + Math.cos(a[k + 2] * 0.3 + t * 0.6) * 0.25;
      geo.attributes.position.needsUpdate = true;
      for (const p of pings) {
        p.t += dt; const f = p.t / p.vida;
        if (f >= 1) { p.t = 0; p.m.position.set((Math.random() - 0.5) * 34, 0.02, (Math.random() - 0.5) * 34 - 4); p.nucleo.position.copy(p.m.position); p.nucleo.position.y += 0.01; continue; }
        const e = 0.2 + f * 2.6; p.m.scale.set(e, e, e); p.m.material.opacity = (1 - f) * 0.8; p.nucleo.material.opacity = 1 - f * 0.5;
        const y = Math.sin(p.m.position.x * 0.35 + t * 0.8) * 0.25 + Math.cos(p.m.position.z * 0.3 + t * 0.6) * 0.25;
        p.m.position.y = y + 0.03; p.nucleo.position.y = y + 0.04;
      }
      cam.position.lerp(hacia, 0.025); miraAct.lerp(mira, 0.03);
      cam.position.x += Math.sin(t * 0.2) * 0.01;
      cam.lookAt(miraAct);
      r.render(escena, cam);
      if (!quieto) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }
})();
