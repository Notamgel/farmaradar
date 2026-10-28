// «Háblale a FarmaRadar»: conversación por voz (ElevenLabs entiende lo que dices y te contesta con su voz).
// Cualquier botón con [data-asistente] la abre; con data-busqueda="<id>" empieza por el resumen de esa búsqueda.
(() => {
  const botones = document.querySelectorAll('[data-asistente]');
  if (!botones.length) return;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const SILENCIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
  let caja, orbe, estado, chat, mic, ver, cerrar;
  let voz = null, flujo = null, ctx = null, analizador = null, abierta = false, turno = 0;
  let grabando = null; // {para()}

  function arma() {
    caja = document.createElement('div');
    caja.className = 'asis';
    caja.hidden = true;
    caja.innerHTML = `<div class="asis-caja" role="dialog" aria-modal="true" aria-label="Asistente de voz de FarmaRadar">
      <button type="button" class="asis-cerrar" aria-label="Cerrar">×</button>
      <div class="asis-orbe" data-estado="quieto" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
      <p class="asis-estado" aria-live="polite"></p>
      <ol class="asis-chat"></ol>
      <div class="asis-acciones">
        <button type="button" class="boton primario grande asis-mic"><span>Hablar</span></button>
        <a class="boton grande asis-ver" hidden>Ver resultados y mapa</a>
      </div></div>`;
    document.body.appendChild(caja);
    orbe = caja.querySelector('.asis-orbe'); estado = caja.querySelector('.asis-estado'); chat = caja.querySelector('.asis-chat');
    mic = caja.querySelector('.asis-mic'); ver = caja.querySelector('.asis-ver'); cerrar = caja.querySelector('.asis-cerrar');
    cerrar.addEventListener('click', cierra);
    caja.addEventListener('click', (e) => { if (e.target === caja) cierra(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierta) cierra(); });
    mic.addEventListener('click', () => { if (grabando) grabando.para(); else if (mic.dataset.reintenta) reintenta(); });
  }

  const pon = (e, t) => { orbe.dataset.estado = e; if (t != null) estado.textContent = t; };
  const linea = (quien, t) => {
    const li = document.createElement('li');
    li.className = quien;
    li.textContent = t;
    chat.appendChild(li);
    chat.scrollTop = chat.scrollHeight;
  };
  const vivo = (n) => abierta && n === turno;

  function cierra() {
    abierta = false; turno++;
    grabando?.para(true);
    voz?.pause();
    flujo?.getTracks().forEach((t) => t.stop()); flujo = null;
    caja.hidden = true;
    document.documentElement.classList.remove('asis-abierta');
  }

  /** Reproduce un audio de la API (la voz de ElevenLabs) y muestra lo que dice. */
  async function di(url, n) {
    pon('piensa', 'Pensando…');
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'La voz no está disponible ahora');
    const texto = decodeURIComponent(r.headers.get('X-Texto') || '');
    const blob = await r.blob();
    if (!vivo(n)) return;
    if (texto) linea('farma', texto);
    pon('habla', 'FarmaRadar está hablando…');
    voz.src = URL.createObjectURL(blob);
    await voz.play().catch(() => {});
    await new Promise((ok) => { voz.onended = ok; voz.onerror = ok; });
  }
  const diFrase = (clave, n) => di(`/api/voz/frase/${clave}`, n);

  /** Escucha hasta que el paciente deja de hablar (o toca «Listo»). → Blob o null */
  async function escucha(n, aviso = 'Te escucho…') {
    if (!vivo(n)) return null;
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : {});
    const partes = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    pon('escucha', aviso);
    mic.hidden = false; mic.querySelector('span').textContent = 'Listo'; delete mic.dataset.reintenta;
    return new Promise((ok) => {
      let hablo = false, callado = 0, fin = false;
      const datos = new Uint8Array(analizador.fftSize);
      const para = (cancela = false) => {
        if (fin) return; fin = true;
        clearInterval(vigila); grabando = null;
        rec.onstop = () => ok(cancela || !hablo && partes.length === 0 ? null : new Blob(partes, { type: rec.mimeType || 'audio/webm' }));
        if (rec.state !== 'inactive') rec.stop(); else ok(null);
        mic.hidden = true;
      };
      grabando = { para };
      const inicio = Date.now();
      const vigila = setInterval(() => {
        analizador.getByteTimeDomainData(datos);
        let s = 0; for (const v of datos) s += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(s / datos.length);
        orbe.style.setProperty('--nivel', Math.min(1, rms * 8).toFixed(2));
        if (rms > 0.035) { hablo = true; callado = 0; } else if (hablo) callado += 100;
        if ((hablo && callado >= 1300) || Date.now() - inicio > 12000 || (!hablo && Date.now() - inicio > 7000)) para();
      }, 100);
      rec.start(250);
    });
  }

  async function envia(url, blob) {
    pon('piensa', 'Entendiendo…');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo enviar el audio');
    return d;
  }

  async function datos(id) { return (await fetch(`/api/busquedas/${id}`)).json(); }
  async function hasta(id, n, listo, maxMs) {
    const t0 = Date.now();
    for (;;) {
      if (!vivo(n)) return null;
      const d = await datos(id).catch(() => null);
      if (d && listo(d)) return d;
      if (Date.now() - t0 > maxMs) return d;
      await espera(2000);
    }
  }

  async function conversa(n, idInicial) {
    let id = idInicial;
    if (!id) {
      await diFrase('saludo', n);
      for (let intento = 0; intento < 3 && vivo(n); intento++) {
        const audio = await escucha(n);
        if (!vivo(n)) return;
        if (!audio) { pon('quieto', 'No te escuché. Toca «Hablar» para intentarlo otra vez.'); return listoParaReintentar(); }
        const lugar = window.__frUbicacion ? `?lat=${window.__frUbicacion.lat}&lng=${window.__frUbicacion.lng}` : '';
        const d = await envia(`/api/voz/buscar${lugar}`, audio);
        linea('tu', d.texto || '…');
        if (d.entendi) { id = d.id; break; }
        await diFrase('no-entendi', n);
      }
      if (!id) return;
      ver.href = `/b/${id}`; ver.hidden = false;
      await di(`/api/busquedas/${id}/voz/inicio`, n);
    }
    ver.href = `/b/${id}`; ver.hidden = false;
    pon('piensa', 'Buscando en las cadenas…');
    const d1 = await hasta(id, n, (d) => d.cadenas.length && d.cadenas.every((c) => c.estado !== 'consultando'), 70000);
    if (!vivo(n) || !d1) return;
    if (!d1.fase2 && !d1.cercanas) await espera(2500); // las farmacias de la zona pueden estar apareciendo
    await di(`/api/busquedas/${id}/voz/resumen`, n);
    const d2 = await datos(id);
    if (!vivo(n)) return;
    if (!d2.fase2 && d2.cercanas) {
      const audio = await escucha(n, 'Dime «sí» o «no»…');
      if (!vivo(n)) return;
      const r = audio ? await envia('/api/voz/sino', audio) : { si: null, texto: '' };
      if (r.texto) linea('tu', r.texto);
      if (r.si) {
        await fetch(`/api/busquedas/${id}/locales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        await di(`/api/busquedas/${id}/voz/preguntando`, n);
        pon('piensa', 'Esperando a que contesten las farmacias…');
        const d3 = await hasta(id, n, (d) => d.locales.some((l) => l.estado === 'tiene'), 60000);
        if (!vivo(n)) return;
        await di(`/api/busquedas/${id}/voz/encontrada`, n);
        if (d3?.locales.some((l) => l.estado === 'tiene')) pon('quieto', '¡Listo! Mira la farmacia en el mapa.');
        return;
      }
      await diFrase('va-resultados', n);
    }
    pon('quieto', 'Listo. Toca «Ver resultados y mapa».');
  }

  let ultimo = null;
  function listoParaReintentar() { mic.hidden = false; mic.querySelector('span').textContent = 'Hablar'; mic.dataset.reintenta = '1'; }
  function reintenta() { const n = ++turno; conversa(n, ultimo).catch((e) => falla(e, n)); }
  function falla(e, n) { if (!vivo(n)) return; pon('quieto', e.message || 'Algo falló. Intenta de nuevo.'); listoParaReintentar(); }

  async function abre(idBusqueda) {
    if (!caja) arma();
    caja.hidden = false; abierta = true; document.documentElement.classList.add('asis-abierta');
    chat.replaceChildren(); ver.hidden = true; mic.hidden = true;
    const n = ++turno;
    ultimo = idBusqueda || null;
    // Todo lo que pide un toque (Safari): el audio, el contexto de sonido y el micrófono.
    if (!voz) voz = new Audio();
    voz.src = SILENCIO; voz.play().catch(() => {});
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      if (!flujo) {
        pon('piensa', 'Activando el micrófono…');
        flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        analizador = ctx.createAnalyser(); analizador.fftSize = 1024;
        ctx.createMediaStreamSource(flujo).connect(analizador);
      }
    } catch {
      pon('quieto', 'Necesito permiso para usar el micrófono. Actívalo en tu navegador y vuelve a intentarlo.');
      return;
    }
    conversa(n, ultimo).catch((e) => falla(e, n));
  }

  botones.forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); abre(b.dataset.busqueda); }));
})();
