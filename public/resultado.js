// El resultado de una búsqueda, en vivo: semáforo de las cadenas, genéricos, la fase 2 y el mapa.
const raiz = document.getElementById('resultado');
const ID = raiz.dataset.id;

const SEM = {
  disponible: ['verde', 'Disponible'], agotado: ['rojo', 'Agotado'], sin_resultado: ['gris', 'No aparece en línea'],
  consultando: ['ambar', 'Consultando…'], error: ['gris', 'No se pudo consultar'], sin_configurar: ['gris', 'Consulta en línea pendiente'],
  tiene: ['verde', 'Sí la tiene'], no_tiene: ['rojo', 'No la tiene'], enviada: ['ambar', 'Esperando respuesta'], pendiente: ['ambar', 'Esperando respuesta'],
  llamando: ['ambar', 'Llamando…'], sin_respuesta: ['gris', 'Sin respuesta'],
};
const CANAL = { whatsapp: 'por WhatsApp', llamada: 'por voz', panel: 'en su panel' };
const ESPERA = new Set(['consultando', 'enviada', 'pendiente', 'llamando']);
const COLOR = { verde: '#16a34a', rojo: '#dc2626', ambar: '#d97706', gris: '#64748b' };

function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const pesos = (n) => (n ? `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : '');
const sem = (estado) => { const [c, t] = SEM[estado] || ['gris', estado]; return h('span', { class: `sem ${c}` }, t); };

let datos = null;
let mapa = null, capa = null;
let pidiendo = false;

function general(d) {
  const cad = d.cadenas.map((c) => c.estado), loc = d.locales.map((l) => l.estado);
  if (cad.includes('disponible') || loc.includes('tiene')) return ['verde', '¡La encontramos!', 'Hay al menos un lugar donde está disponible.'];
  if (cad.includes('consultando') || loc.some((e) => ESPERA.has(e))) return ['ambar', 'Buscando…', d.fase2 ? 'Estamos preguntando a las farmacias de tu zona.' : 'Consultando las cadenas en línea.'];
  if (d.fase2 && loc.length && loc.every((e) => e === 'no_tiene')) return ['rojo', 'Nadie la tiene por ahora', 'Ninguna de las farmacias que contestaron la tiene.'];
  if (!d.fase2 && cad.length && cad.every((e) => e === 'agotado')) return ['rojo', 'Agotado en las cadenas', 'Busquemos en las farmacias de barrio de tu zona.'];
  return ['gris', 'Sin confirmar', d.fase2 ? 'Aún no hay respuestas.' : 'Pregunta a las farmacias de barrio de tu zona.'];
}

function pinta(d) {
  const [color, titulo, sub] = general(d);
  const sinApi = !d.apis.firecrawl;
  const frag = [
    h('section', { class: `semaforo-general ${color}` },
      h('span', { class: 'luz' }),
      h('div', {}, h('p', { class: 'etiqueta' }, d.zona ? `${d.medicamento} · ${d.zona}` : d.medicamento), h('h1', {}, titulo), h('p', {}, sub))),

    h('div', { class: 'res-grid' },
      h('div', { class: 'res-col' },
        h('section', { class: 'bloque' },
          h('h2', {}, h('span', { class: 'fase' }, 'Fase 1'), ' Farmacias de cadena'),
          d.cadenas.length
            ? h('ul', { class: 'lista-estado' }, d.cadenas.map((c) => h('li', {},
              sem(c.estado),
              h('div', { class: 'le-txt' }, h('b', {}, c.nombre), c.producto ? h('small', {}, c.producto) : null),
              c.precio ? h('span', { class: 'precio' }, pesos(c.precio)) : null,
              c.url && c.estado !== 'sin_configurar' ? h('a', { href: c.url, target: '_blank', rel: 'noopener' }, 'Ver') : null)))
            : h('p', { class: 'vacio' }, 'No hay cadenas configuradas.'),
          sinApi ? h('p', { class: 'ayuda' }, 'La consulta en línea a las cadenas se enciende al conectar su API.') : null),

        h('section', { class: `bloque fase2 ${d.fase2 ? 'activa' : ''}` },
          h('h2', {}, h('span', { class: 'fase' }, 'Fase 2'), ' Farmacias de barrio'),
          d.fase2
            ? (d.locales.length
              ? h('ul', { class: 'lista-estado' }, d.locales.map((l) => h('li', { class: l.estado === 'tiene' ? 'destaca' : '' },
                sem(l.estado),
                h('div', { class: 'le-txt' }, h('b', {}, l.nombre, l.demo ? h('span', { class: 'demo-tag', title: 'Farmacia de demostración' }, 'Demo') : null), h('small', {}, [l.direccion, l.colonia].filter(Boolean).join(', ')),
                  l.nota && !l.demo ? h('small', { class: 'nota' }, l.nota) : null,
                  h('small', { class: 'canal' }, `Avisada ${CANAL[l.canal] || ''}`)),
                l.precio ? h('span', { class: 'precio' }, pesos(l.precio)) : null)))
              : h('p', { class: 'vacio' }, 'Todavía no hay farmacias de barrio registradas en tu zona. ', h('a', { href: '/farmacias/registro' }, '¿Conoces una? Invítala.')))
            : h('div', { class: 'cta-fase2' },
              h('p', {}, d.cercanas
                ? `Hay ${d.cercanas} farmacia${d.cercanas === 1 ? '' : 's'} de barrio registrada${d.cercanas === 1 ? '' : 's'} cerca. Les preguntamos por ti${d.apis.elevenlabs ? ': llamamos a la más cercana' : ''}${d.apis.n8n ? ' y avisamos por WhatsApp' : ''}.`
                : 'Aún no hay farmacias de barrio registradas en tu zona.'),
              h('button', { class: 'boton primario grande ancho-total', type: 'button', disabled: !d.cercanas || pidiendo, onclick: fase2 },
                pidiendo ? 'Avisando…' : 'Buscar en farmacias locales'),
              !d.cercanas ? h('a', { class: 'ayuda', href: '/farmacias/registro' }, 'Registra una farmacia de tu colonia') : null))),

      h('div', { class: 'res-col' },
        h('section', { class: 'bloque mapa-bloque' }, h('h2', {}, 'Mapa'), h('div', { id: 'mapa', class: 'mapa' }),
          !d.mapa.length ? h('p', { class: 'ayuda' }, 'Las farmacias aparecen aquí cuando registran su ubicación.') : null),
        d.genericos_estado === 'sin_configurar' ? null : h('section', { class: 'bloque' }, h('h2', {}, 'Genéricos y principio activo'),
          d.genericos_estado === 'consultando' ? h('p', { class: 'vacio' }, 'Identificando el principio activo…')
            : h('div', {},
                d.principio_activo ? h('p', {}, 'Principio activo: ', h('b', {}, d.principio_activo)) : null,
                d.genericos?.length ? h('ul', { class: 'genericos' }, d.genericos.map((g) => h('li', {}, h('b', {}, g.nombre), g.nota ? h('small', {}, g.nota) : null))) : h('p', { class: 'vacio' }, 'Sin sugerencias para esta medicina.'),
                h('p', { class: 'ayuda' }, 'Consulta a tu médico o farmacéutico antes de cambiar de medicamento.'))))),
  ];
  // El mapa se conserva entre repintados: se saca y se vuelve a poner.
  const viejo = mapa ? mapa.getContainer() : gmapa ? gmapa.getDiv() : null;
  raiz.replaceChildren(...frag);
  if (viejo) document.getElementById('mapa').replaceWith(viejo);
  pintaMapa(d);
}

// Google Maps (si hay clave): estilo propio, marcadores del color del semáforo y «Cómo llegar».
let gmapa = null, gmarcas = [], gventana = null, gajustado = false;
const limpia = (t) => String(t ?? '').replace(/[<>&"]/g, '');
function pintaGoogle(d) {
  const el = document.getElementById('mapa');
  if (!el || !window.FR_MAPAS?.listo) return;
  if (!gmapa || gmapa.getDiv() !== el) {
    gmapa = new google.maps.Map(el, {
      center: { lat: d.lat ?? 19.4326, lng: d.lng ?? -99.1332 }, zoom: d.lat ? 14 : 12,
      styles: window.FR_MAPAS.estilo, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', clickableIcons: false,
    });
    gventana = new google.maps.InfoWindow();
    gajustado = false;
  }
  gmarcas.forEach((m) => m.setMap(null));
  gmarcas = [];
  const limites = new google.maps.LatLngBounds();
  if (d.lat && d.lng) {
    gmarcas.push(new google.maps.Marker({ map: gmapa, position: { lat: d.lat, lng: d.lng }, icon: window.FR_MAPAS.icono('#0f766e', true), title: 'Tú', zIndex: 5 }));
    limites.extend({ lat: d.lat, lng: d.lng });
  }
  for (const f of d.mapa) {
    const color = f.estado ? (COLOR[(SEM[f.estado] || ['gris'])[0]] || COLOR.gris) : '#0ea5e9';
    const m = new google.maps.Marker({ map: gmapa, position: { lat: f.lat, lng: f.lng }, icon: window.FR_MAPAS.icono(color, f.estado === 'tiene'), title: f.nombre, zIndex: f.estado === 'tiene' ? 10 : 1 });
    m.addListener('click', () => {
      gventana.setContent(`<div class="gm-ficha"><b>${limpia(f.nombre)}</b>${f.demo ? '<em>Farmacia de demostración</em>' : ''}<span>${limpia(f.direccion)}</span>${f.precio ? `<strong>${pesos(f.precio)}</strong>` : ''}
        <a href="https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}" target="_blank" rel="noopener">Cómo llegar</a></div>`);
      gventana.open({ map: gmapa, anchor: m });
    });
    gmarcas.push(m);
    limites.extend({ lat: f.lat, lng: f.lng });
  }
  if (gmarcas.length > 1 && !gajustado) { gmapa.fitBounds(limites, 40); gajustado = true; }
  else if (gmarcas.length === 1 && !gajustado) { gmapa.setCenter(gmarcas[0].getPosition()); gmapa.setZoom(15); gajustado = true; }
}
document.addEventListener('gmaps-listo', () => datos && pintaGoogle(datos));

function pintaMapa(d) {
  if (window.FR_MAPAS) return pintaGoogle(d);
  if (!window.L) return;
  const el = document.getElementById('mapa');
  if (!mapa) {
    mapa = L.map(el, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
    mapa.setView([d.lat ?? 19.4326, d.lng ?? -99.1332], d.lat ? 14 : 11);
  }
  capa.clearLayers();
  const puntos = [];
  if (d.lat && d.lng) {
    L.circleMarker([d.lat, d.lng], { radius: 7, color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 1, weight: 3 }).bindTooltip('Tú').addTo(capa);
    puntos.push([d.lat, d.lng]);
  }
  for (const f of d.mapa) {
    const c = COLOR[(SEM[f.estado] || ['gris'])[0]] || COLOR.gris;
    L.circleMarker([f.lat, f.lng], { radius: 9, color: '#fff', weight: 2, fillColor: f.estado ? c : '#0ea5e9', fillOpacity: 0.95 })
      .bindPopup(`<b>${f.nombre.replace(/[<>&"]/g, '')}</b><br>${(f.direccion || '').replace(/[<>&"]/g, '')}${f.precio ? `<br>${pesos(f.precio)}` : ''}`)
      .addTo(capa);
    puntos.push([f.lat, f.lng]);
  }
  if (puntos.length > 1 && !mapa._ajustado) { mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 15 }); mapa._ajustado = true; }
  setTimeout(() => mapa.invalidateSize(), 50);
}

async function fase2() {
  pidiendo = true;
  pinta(datos);
  try {
    const r = await fetch(`/api/busquedas/${ID}/locales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 409) alert(d.error || 'No se pudo avisar a las farmacias.');
  } finally {
    pidiendo = false;
    await carga();
  }
}

let vueltas = 0;
async function carga() {
  try {
    const r = await fetch(`/api/busquedas/${ID}`, { cache: 'no-store' });
    if (!r.ok) throw new Error();
    datos = await r.json();
    // No repintar si no cambió nada (el mapa y el scroll se quedan quietos).
    const firma = JSON.stringify(datos);
    if (firma !== carga.firma) { carga.firma = firma; pinta(datos); }
  } catch {
    if (!datos) raiz.replaceChildren(h('p', { class: 'error' }, 'No se pudo cargar la búsqueda.'));
  }
}

(async function bucle() {
  await carga();
  vueltas += 1;
  const sigue = datos && (datos.cadenas.some((c) => ESPERA.has(c.estado)) || datos.genericos_estado === 'consultando'
    || datos.locales.some((l) => ESPERA.has(l.estado)) || !datos.fase2);
  if (sigue && vueltas < 600) setTimeout(bucle, document.hidden ? 8000 : 2500);
})();
