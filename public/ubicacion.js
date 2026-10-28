// «Usar mi ubicación»: llena lat/lng del formulario donde está el botón.
document.addEventListener('click', (e) => {
  const b = e.target.closest('#ubicacion');
  if (!b) return;
  const form = b.closest('form');
  const estado = form.querySelector('#ubicacion-estado');
  if (!navigator.geolocation) { estado.textContent = 'Tu navegador no comparte la ubicación.'; return; }
  estado.textContent = 'Buscando tu ubicación…';
  b.disabled = true;
  navigator.geolocation.getCurrentPosition((p) => {
    form.querySelector('[name=lat]').value = p.coords.latitude.toFixed(6);
    form.querySelector('[name=lng]').value = p.coords.longitude.toFixed(6);
    estado.textContent = 'Ubicación lista.';
    b.classList.add('hecho');
    b.disabled = false;
  }, () => {
    estado.textContent = 'No se pudo obtener. Escribe tu colonia o código postal.';
    b.disabled = false;
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
});
