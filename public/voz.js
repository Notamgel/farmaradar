// La farmacia escucha la pregunta (voz de ElevenLabs) y contesta hablando: se graba, se transcribe y se entiende.
(() => {
  for (const caja of document.querySelectorAll('[data-voz]')) {
    const base = caja.dataset.voz;
    const estado = caja.querySelector('.voz-estado');
    const hablar = caja.querySelector('[data-hablar]');
    const etiqueta = hablar.querySelector('span');
    const di = (t, clase = '') => { estado.textContent = t; estado.className = `voz-estado ${clase}`; };
    let audio = null, grabadora = null, partes = [], corte = null;

    caja.querySelector('[data-escuchar]').addEventListener('click', () => {
      if (!audio) audio = new Audio(`${base}/voz.mp3`);
      audio.currentTime = 0;
      di('Escuchando la pregunta…');
      audio.play().catch(() => di('No se pudo reproducir la voz.', 'error'));
      audio.onended = () => di('Ahora toca «Contestar hablando» y di si la tienes y a qué precio.');
    });

    const envia = async (blob) => {
      di('Entendiendo tu respuesta…');
      hablar.disabled = true;
      try {
        const r = await fetch(`${base}/voz`, { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] }, body: blob });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { di(d.error || 'No se pudo enviar.', 'error'); return; }
        if (!d.listo) { di(`Entendimos: «${d.texto}». No quedó claro si la tienes: inténtalo otra vez o usa los botones.`, 'error'); return; }
        di(d.tiene ? `¡Listo! Entendimos que sí la tienes${d.precio ? ` a $${d.precio}` : ''}. Ya le avisamos al paciente.` : 'Listo: entendimos que no la tienes. ¡Gracias!', 'ok');
        setTimeout(() => location.reload(), 1800);
      } catch { di('Sin conexión. Intenta de nuevo o usa los botones.', 'error'); }
      finally { hablar.disabled = false; }
    };

    const para = () => {
      clearTimeout(corte);
      if (grabadora?.state === 'recording') grabadora.stop();
    };

    hablar.addEventListener('click', async () => {
      if (grabadora?.state === 'recording') return para();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { di('Tu navegador no puede grabar; contesta con los botones.', 'error'); return; }
      let flujo;
      try { flujo = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { di('Necesitamos permiso para el micrófono; o contesta con los botones.', 'error'); return; }
      const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      grabadora = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : {});
      partes = [];
      grabadora.ondataavailable = (e) => e.data.size && partes.push(e.data);
      grabadora.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        hablar.classList.remove('grabando');
        etiqueta.textContent = 'Contestar hablando';
        envia(new Blob(partes, { type: grabadora.mimeType || 'audio/webm' }));
      };
      grabadora.start();
      hablar.classList.add('grabando');
      etiqueta.textContent = 'Terminar';
      di('Te escuchamos… di «sí la tengo, a 390» o «no la tengo». Toca «Terminar» al acabar.', 'grabando');
      corte = setTimeout(para, 15000);
    });
  }
})();
