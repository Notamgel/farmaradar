// Carga Google Maps una sola vez y avisa con el evento «gmaps-listo». La clave va en <meta name="gmaps">.
(() => {
  const clave = document.querySelector('meta[name="gmaps"]')?.content;
  if (!clave) return;
  window.FR_MAPAS = { listo: false, estilo: null };
  window.__frGmaps = () => {
    window.FR_MAPAS.listo = true;
    document.dispatchEvent(new Event('gmaps-listo'));
  };
  const s = document.createElement('script');
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}&v=weekly&language=es&region=MX&loading=async&callback=__frGmaps`;
  s.async = true;
  s.onerror = () => document.dispatchEvent(new Event('gmaps-error'));
  document.head.appendChild(s);

  // Estilo de FarmaRadar: limpio, verde azulado, sin ruido de comercios. Claro y oscuro.
  const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
  window.FR_MAPAS.estilo = oscuro ? [
    { elementType: 'geometry', stylers: [{ color: '#0f1f1c' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8fb3aa' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#08110f' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#12302a' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c3631' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#24514a' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b3a44' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  ] : [
    { elementType: 'geometry', stylers: [{ color: '#f3f7f6' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#4b5f5a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#d9efe6' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d7ebe6' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfe3ea' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  ];

  // Marcador redondo con el color del semáforo (SVG, sin imágenes de fuera).
  window.FR_MAPAS.icono = (color, grande = false) => {
    const r = grande ? 13 : 10, t = r * 2 + 8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}"><circle cx="${t / 2}" cy="${t / 2}" r="${r + 3}" fill="${color}" fill-opacity=".25"/><circle cx="${t / 2}" cy="${t / 2}" r="${r}" fill="${color}" stroke="#fff" stroke-width="3"/></svg>`;
    return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(t, t), anchor: new google.maps.Point(t / 2, t / 2) };
  };
})();
