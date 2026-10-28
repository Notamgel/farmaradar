/**
 * La plantilla común de las páginas y los iconos (SVG en línea, sin emojis).
 */
import { esc } from './util.js';

const I = (d, extra = '') => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const ico = {
  radar: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  buscar: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  pin: I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  tienda: I('<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10h18"/><path d="M10 20v-5h4v5"/>'),
  telefono: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  whatsapp: I('<path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.6-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z"/>'),
  pildora: I('<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="m9.2 7.9 5.6 8.2" />'),
  cadena: I('<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/><path d="M12 8v3M10.5 9.5h3"/>'),
  ok: I('<path d="M20 6 9 17l-5-5"/>'),
  x: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  reloj: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  llave: I('<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M16 7l2 2M14 9l2 2"/>'),
  panel: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  usuario: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  rayo: I('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  corazon: I('<path d="M12 20s-7.5-4.6-9.3-9.2A5 5 0 0 1 12 6a5 5 0 0 1 9.3 4.8C19.5 15.4 12 20 12 20z"/>'),
  flecha: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  salir: I('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  actividad: I('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'),
};

export const logo = `<span class="logo">${ico.radar}</span><span class="marca-txt">Farma<b>Radar</b></span>`;

/**
 * Página completa. `clase` para el body; `scripts` rutas de /static; `leaflet` carga el mapa.
 */
export function pagina({ titulo, cuerpo, clase = '', scripts = [], leaflet = false, descripcion = '' }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion || 'FarmaRadar: encuentra tu medicina en farmacias de cadena y de barrio, en tiempo real.')}">
<meta name="theme-color" content="#0f766e">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
${leaflet ? '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">' : ''}
<link rel="stylesheet" href="/static/estilos.css">
${leaflet ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>' : ''}
<script src="/static/comun.js" defer></script>
${scripts.map((s) => `<script src="/static/${s}" defer></script>`).join('\n')}
</head>
<body class="${esc(clase)}">
${cuerpo}
</body>
</html>`;
}

/** Cabecera pública. */
export function cabeceraPublica(activa = '') {
  const a = (k) => (k === activa ? ' class="activa"' : '');
  return `<header class="cab">
  <div class="ancho cab-in">
    <a class="marca" href="/">${logo}</a>
    <button class="menu-boton" type="button" data-alternar="menu" aria-label="Abrir menú">${ico.menu}</button>
    <nav class="menu" id="menu">
      <a href="/#como-funciona"${a('como')}>Cómo funciona</a>
      <a href="/#farmacias"${a('farmacias')}>Para farmacias</a>
      <a href="/farmacias/registro" class="boton"${a('registro')}>Registra tu farmacia</a>
      <a href="/buscar" class="boton primario">${ico.buscar} Buscar medicina</a>
    </nav>
  </div>
</header>`;
}

export const pie = `<footer class="pie">
  <div class="ancho pie-in">
    <div class="marca">${logo}</div>
    <p>La red contra el desabasto de medicamentos. Hecho en México.</p>
    <p class="pie-nota">FarmaRadar informa disponibilidad; no vende medicamentos ni sustituye la indicación de tu médico.</p>
    <p class="pie-enlaces"><a href="/farmacias/registro">Registra tu farmacia</a> · <a href="/f">Soy farmacia</a> · <a href="/panel">Equipo</a></p>
  </div>
</footer>`;

/** Aviso (éxito, error o información). */
export const aviso = (texto, tipo = 'info') => (texto ? `<div class="aviso aviso-${tipo}" role="status">${esc(texto)}</div>` : '');
