// Registro de farmacia: marcar la ubicación en Google Maps (tocar, arrastrar o buscar la dirección).
(() => {
  const el = document.getElementById('mapa-elige');
  if (!el) return;
  const form = el.closest('form');
  const lat = form.querySelector('[name=lat]'), lng = form.querySelector('[name=lng]');
  const estado = document.getElementById('elige-estado');
  let mapa = null, punto = null;

  const pon = (pos, centra = true) => {
    lat.value = Number(typeof pos.lat === 'function' ? pos.lat() : pos.lat).toFixed(6);
    lng.value = Number(typeof pos.lng === 'function' ? pos.lng() : pos.lng).toFixed(6);
    if (!punto) {
      punto = new google.maps.Marker({ map: mapa, position: pos, draggable: true, icon: window.FR_MAPAS.icono('#0f766e', true), title: 'Tu farmacia' });
      punto.addListener('dragend', () => { pon(punto.getPosition(), false); });
    } else punto.setPosition(pos);
    if (centra) { mapa.panTo(pos); if (mapa.getZoom() < 16) mapa.setZoom(17); }
    estado.textContent = 'Ubicación marcada. Puedes arrastrar el punto para ajustarla.';
  };

  const inicia = () => {
    if (mapa || !window.FR_MAPAS?.listo) return;
    const hay = lat.value && lng.value;
    mapa = new google.maps.Map(el, {
      center: hay ? { lat: +lat.value, lng: +lng.value } : { lat: 19.4326, lng: -99.1332 }, zoom: hay ? 17 : 11,
      styles: window.FR_MAPAS.estilo, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', clickableIcons: false,
    });
    if (hay) pon({ lat: +lat.value, lng: +lng.value }, false);
    mapa.addListener('click', (e) => pon(e.latLng, false));
  };
  document.addEventListener('gmaps-listo', inicia);
  inicia();

  form.addEventListener('ubicacion', (e) => { inicia(); if (mapa) pon(e.detail); });

  document.getElementById('ubica-direccion')?.addEventListener('click', () => {
    if (!mapa) return;
    const v = (n) => form.querySelector(`[name=${n}]`)?.value.trim() ?? '';
    const texto = [v('direccion'), v('colonia'), v('cp'), v('ciudad') || 'México'].filter(Boolean).join(', ');
    if (!v('direccion') && !v('colonia') && !v('cp')) { estado.textContent = 'Escribe primero tu dirección, colonia o código postal.'; return; }
    estado.textContent = 'Buscando tu dirección…';
    new google.maps.Geocoder().geocode({ address: texto, region: 'mx' }, (res, st) => {
      if (st === 'OK' && res[0]) pon(res[0].geometry.location);
      else estado.textContent = 'No encontramos esa dirección: toca el mapa para marcar tu farmacia.';
    });
  });
})();
