/**
 * Panel del equipo FarmaRadar (/panel): tablero, búsquedas, farmacias, cadenas, integraciones (dónde van
 * las claves de las APIs) y la cuenta. Usuario inicial del .env (ADMIN_USUARIO / ADMIN_CLAVE_INICIAL).
 */
import { db } from '../lib/db.js';
import { html, redirige, cuerpo, mismoOrigen, ipDe } from '../lib/http.js';
import { pagina, ico, logo, aviso } from '../lib/vistas.js';
import { esc, texto, pesos, fecha } from '../lib/util.js';
import { permite, claveCorrecta, hashClave, token, sha256 } from '../lib/seguridad.js';
import * as sesion from '../lib/sesion.js';
import * as integraciones from '../lib/integraciones.js';
import { urlPublica } from '../lib/entorno.js';
import { formFarmacia, datosFarmacia } from './publico.js';

const SECCIONES = [
  ['', 'Tablero', ico.panel],
  ['busquedas', 'Búsquedas', ico.buscar],
  ['farmacias', 'Farmacias', ico.tienda],
  ['cadenas', 'Cadenas', ico.cadena],
  ['integraciones', 'Integraciones', ico.llave],
  ['actividad', 'Actividad', ico.actividad],
  ['cuenta', 'Mi cuenta', ico.usuario],
];

const SEM = {
  disponible: ['verde', 'Disponible'], agotado: ['rojo', 'Agotado'], sin_resultado: ['gris', 'No aparece'],
  consultando: ['ambar', 'Consultando'], error: ['gris', 'Error'], sin_configurar: ['gris', 'API pendiente'],
  tiene: ['verde', 'Sí tiene'], no_tiene: ['rojo', 'No tiene'], enviada: ['ambar', 'Esperando'], pendiente: ['ambar', 'Esperando'],
  llamando: ['ambar', 'Llamando'], sin_respuesta: ['gris', 'Sin respuesta'],
};
const sem = (e) => { const [c, t] = SEM[e] ?? ['gris', e]; return `<span class="sem ${c}">${esc(t)}</span>`; };
const CANAL = { panel: 'Panel', whatsapp: 'WhatsApp', llamada: 'Voz' };

function marco(activa, titulo, contenido) {
  return pagina({
    titulo: `${titulo} · Panel FarmaRadar`,
    clase: 'panel',
    scripts: ['ubicacion.js'],
    cuerpo: `<div class="panel-marco">
  <aside class="panel-lado">
    <a class="marca" href="/panel">${logo}</a>
    <nav class="panel-nav">${SECCIONES.map(([k, t, i]) => `<a href="/panel${k ? `/${k}` : ''}"${k === activa ? ' class="activa" aria-current="page"' : ''}>${i}<span>${t}</span></a>`).join('')}</nav>
    <form method="post" action="/panel/salir" class="panel-salir"><button class="boton" type="submit">${ico.salir} Salir</button></form>
  </aside>
  <main class="panel-main"><h1>${esc(titulo)}</h1>${contenido}</main>
</div>`,
  });
}

function entrar(error = '') {
  return pagina({
    titulo: 'Entrar · Panel FarmaRadar',
    clase: 'app',
    cuerpo: `<main class="ancho app-main angosto">
  <section class="caja-busqueda entrar">
    <a class="marca" href="/">${logo}</a>
    <h1>Panel del equipo</h1>
    ${aviso(error, 'error')}
    <form method="post" action="/panel/entrar" class="form-grid una">
      <label class="campo"><span>Usuario</span><input name="usuario" required autocomplete="username" maxlength="60"></label>
      <label class="campo"><span>Contraseña</span><input name="clave" type="password" required autocomplete="current-password" maxlength="200"></label>
      <button class="boton primario grande ancho-total" type="submit">Entrar</button>
    </form>
  </section>
</main>`,
  });
}

/* ── Secciones ──────────────────────────────────────────────────────────── */

async function tablero() {
  const n = async (sql, p = []) => Number((await db.uno(sql, p))?.n) || 0;
  const hoy = await n('SELECT COUNT(*) AS n FROM busquedas WHERE creado >= UTC_TIMESTAMP() - INTERVAL 24 HOUR');
  const semana = await n('SELECT COUNT(*) AS n FROM busquedas WHERE creado >= UTC_TIMESTAMP() - INTERVAL 7 DAY');
  const farmacias = await n('SELECT COUNT(*) AS n FROM farmacias WHERE activa = 1');
  const confirmadas = await n("SELECT COUNT(*) AS n FROM respuestas_locales WHERE estado = 'tiene' AND respondido >= UTC_TIMESTAMP() - INTERVAL 7 DAY");
  const agotadas = await n("SELECT COUNT(*) AS n FROM resultados_cadena WHERE estado = 'agotado' AND actualizado >= UTC_TIMESTAMP() - INTERVAL 7 DAY");
  const top = await db.todos(
    "SELECT medicamento, COUNT(*) AS n FROM busquedas WHERE creado >= UTC_TIMESTAMP() - INTERVAL 30 DAY GROUP BY medicamento ORDER BY n DESC LIMIT 8");
  const act = await db.todos('SELECT * FROM actividad ORDER BY id DESC LIMIT 12');
  const apis = integraciones.estado();
  const kpi = (v, t, c = '') => `<div class="kpi ${c}"><b>${v}</b><span>${t}</span></div>`;
  return `<div class="kpis">
    ${kpi(hoy, 'Búsquedas en 24 h')}${kpi(semana, 'Búsquedas en 7 días')}${kpi(farmacias, 'Farmacias de barrio activas')}
    ${kpi(confirmadas, 'Confirmaciones de barrio (7 días)', 'verde')}${kpi(agotadas, 'Agotados en cadenas (7 días)', 'rojo')}
  </div>
  <div class="dos-col">
    <section class="bloque"><h2>Lo más buscado (30 días)</h2>
      ${top.length ? `<ol class="ranking">${top.map((t) => `<li><span>${esc(t.medicamento)}</span><b>${t.n}</b></li>`).join('')}</ol>` : '<p class="vacio">Aún no hay búsquedas.</p>'}</section>
    <section class="bloque"><h2>APIs</h2><ul class="apis-mini">${apis.map((a) => `<li>${a.configurada ? '<span class="sem verde">Conectada</span>' : '<span class="sem gris">Pendiente</span>'} ${esc(a.nombre)}</li>`).join('')}</ul>
      <a class="boton" href="/panel/integraciones">${ico.llave} Ver integraciones</a></section>
  </div>
  <section class="bloque"><h2>Actividad reciente</h2>${listaActividad(act)}</section>`;
}

const listaActividad = (act) => (act.length
  ? `<ul class="actividad">${act.map((a) => `<li><span class="cuando">${esc(fecha(a.creado))}</span> ${esc(a.texto)}${a.busqueda_id ? ` <a href="/panel/busquedas/${esc(a.busqueda_id)}">Ver</a>` : ''}</li>`).join('')}</ul>`
  : '<p class="vacio">Sin actividad todavía.</p>');

async function busquedas(q) {
  const filtro = texto(q.get('q'), 80);
  const filas = await db.todos(
    `SELECT b.*,
      (SELECT GROUP_CONCAT(r.estado) FROM resultados_cadena r WHERE r.busqueda_id = b.id) AS cadenas,
      (SELECT COUNT(*) FROM respuestas_locales r WHERE r.busqueda_id = b.id AND r.estado = 'tiene') AS si_tienen,
      (SELECT COUNT(*) FROM respuestas_locales r WHERE r.busqueda_id = b.id) AS avisadas
     FROM busquedas b ${filtro ? 'WHERE b.medicamento LIKE ? OR b.zona LIKE ?' : ''} ORDER BY b.creado DESC LIMIT 150`,
    filtro ? [`%${filtro}%`, `%${filtro}%`] : []);
  return `<form class="filtro" method="get"><span class="campo-ico">${ico.buscar}<input name="q" value="${esc(filtro)}" placeholder="Buscar por medicina o zona"></span></form>
  ${filas.length ? `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Medicina</th><th>Zona</th><th>Cadenas</th><th>Barrio</th><th>Cuándo</th></tr></thead><tbody>
  ${filas.map((b) => `<tr><td><a href="/panel/busquedas/${esc(b.id)}">${esc(b.medicamento)}</a></td><td>${esc(b.zona || '—')}</td>
    <td>${String(b.cadenas ?? '').split(',').filter(Boolean).map(sem).join(' ') || '—'}</td>
    <td>${b.fase2 ? `${b.si_tienen} de ${b.avisadas} la tienen` : '—'}</td><td class="cuando">${esc(fecha(b.creado))}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="vacio">No hay búsquedas.</p>'}`;
}

async function detalleBusqueda(id) {
  const b = await db.uno('SELECT * FROM busquedas WHERE id = ?', [id]);
  if (!b) return null;
  const cad = await db.todos('SELECT r.*, c.nombre FROM resultados_cadena r JOIN cadenas c ON c.id = r.cadena_id WHERE r.busqueda_id = ?', [id]);
  const loc = await db.todos('SELECT r.*, f.nombre, f.telefono, f.colonia FROM respuestas_locales r JOIN farmacias f ON f.id = r.farmacia_id WHERE r.busqueda_id = ?', [id]);
  const act = await db.todos('SELECT * FROM actividad WHERE busqueda_id = ? ORDER BY id', [id]);
  const gen = typeof b.genericos === 'string' ? JSON.parse(b.genericos) : b.genericos;
  return `<p class="sub">${ico.pildora} <b>${esc(b.medicamento)}</b> · ${esc(b.zona || 'sin zona')} · ${esc(fecha(b.creado))}
    ${b.paciente_whatsapp ? ' · el paciente dejó su WhatsApp' : ''} · <a href="/b/${esc(b.id)}" target="_blank" rel="noopener">Ver como paciente</a></p>
  <section class="bloque"><h2>Fase 1 · Cadenas</h2>
    ${cad.length ? `<ul class="lista-estado">${cad.map((c) => `<li>${sem(c.estado)} <b>${esc(c.nombre)}</b> ${esc(c.producto ?? '')} ${c.precio ? pesos(c.precio) : ''} ${c.detalle ? `<small>${esc(c.detalle)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="vacio">Sin cadenas activas.</p>'}</section>
  <section class="bloque"><h2>Genéricos</h2>${b.principio_activo ? `<p>Principio activo: <b>${esc(b.principio_activo)}</b></p>` : ''}
    ${gen?.length ? `<ul>${gen.map((g) => `<li><b>${esc(g.nombre)}</b> — ${esc(g.nota)}</li>`).join('')}</ul>` : `<p class="vacio">${b.genericos_estado === 'sin_configurar' ? 'Gemma 4 pendiente de conectar.' : 'Sin sugerencias.'}</p>`}</section>
  <section class="bloque"><h2>Fase 2 · Farmacias de barrio</h2>
    ${loc.length ? `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Farmacia</th><th>Canal</th><th>Respuesta</th><th>Precio</th><th>Nota</th></tr></thead><tbody>
    ${loc.map((r) => `<tr><td>${esc(r.nombre)}<br><small>${esc(r.colonia)} · ${esc(r.telefono)}</small></td><td>${esc(CANAL[r.canal] ?? r.canal)}</td><td>${sem(r.estado)}</td>
      <td>${r.precio ? pesos(r.precio) : '—'}</td><td>${esc(r.nota ?? '')}${r.transcripcion ? `<details><summary>Transcripción</summary><pre>${esc(r.transcripcion)}</pre></details>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : `<p class="vacio">${b.fase2 ? 'No había farmacias registradas cerca.' : 'El paciente aún no pidió buscar en farmacias locales.'}</p>`}</section>
  <section class="bloque"><h2>Bitácora</h2>${listaActividad(act)}</section>`;
}

async function farmacias(q, extra = '') {
  const filtro = texto(q.get('q'), 80);
  const filas = await db.todos(
    `SELECT f.*, (SELECT COUNT(*) FROM respuestas_locales r WHERE r.farmacia_id = f.id AND r.estado = 'tiene') AS confirmo
     FROM farmacias f ${filtro ? 'WHERE f.nombre LIKE ? OR f.colonia LIKE ? OR f.cp LIKE ? OR f.ciudad LIKE ?' : ''} ORDER BY f.demo, f.creado DESC LIMIT 300`,
    filtro ? [`%${filtro}%`, `%${filtro}%`, `%${filtro}%`, `%${filtro}%`] : []);
  const { n: demos } = await db.uno('SELECT COUNT(*) AS n FROM farmacias WHERE demo = 1');
  return `${extra}
  ${Number(demos) ? `<div class="aviso aviso-info demo-aviso"><span>Hay <b>${Number(demos)}</b> farmacias de demostración (marcadas «Demo»): contestan solas y no tienen teléfono. Si un paciente busca donde no hay ninguna farmacia, se crean cinco alrededor.</span>
    <form method="post" action="/panel/farmacias/demo/borrar" data-confirma="¿Borrar todas las farmacias de demostración y sus respuestas?"><button class="boton chico" type="submit">Borrar las de demostración</button></form></div>` : ''}
  <form class="filtro" method="get"><span class="campo-ico">${ico.buscar}<input name="q" value="${esc(filtro)}" placeholder="Buscar por nombre, colonia o CP"></span></form>
  ${filas.length ? `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Farmacia</th><th>Zona</th><th>Contacto</th><th>Recibe</th><th>Confirmó</th><th></th></tr></thead><tbody>
  ${filas.map((f) => `<tr class="${f.activa ? '' : 'apagada'}"><td><b>${esc(f.nombre)}</b>${f.demo ? ' <span class="demo-tag">Demo</span>' : ''}<br><small>${esc(f.responsable)}</small></td>
    <td>${esc(f.colonia)}<br><small>CP ${esc(f.cp)} ${f.lat ? '· en mapa' : ''}</small></td><td>${esc(f.telefono)}${f.whatsapp ? `<br><small>WA ${esc(f.whatsapp)}</small>` : ''}</td>
    <td>${f.acepta_whatsapp ? 'WhatsApp' : ''}${f.acepta_whatsapp && f.acepta_llamadas ? ' · ' : ''}${f.acepta_llamadas ? 'Llamada' : ''}</td><td>${f.confirmo}</td>
    <td class="acciones"><form method="post" action="/panel/farmacias/${f.id}/activa"><button class="boton chico" type="submit">${f.activa ? 'Pausar' : 'Activar'}</button></form>
      <form method="post" action="/panel/farmacias/${f.id}/enlace"><button class="boton chico" type="submit">Enlace de acceso</button></form></td></tr>`).join('')}
  </tbody></table></div>` : '<p class="vacio">Aún no hay farmacias. Comparte el registro: <a href="/farmacias/registro">farmaradar.lat/farmacias/registro</a></p>'}
  <section class="bloque"><details><summary><h2>Agregar una farmacia a mano</h2></summary>${formFarmacia({}, { accion: '/panel/farmacias', boton: 'Agregar farmacia' })}</details></section>`;
}

async function cadenas(ok = '', error = '') {
  const filas = await db.todos(`SELECT c.*, u.estado AS u_estado, u.detalle AS u_detalle, u.actualizado AS u_fecha
    FROM cadenas c LEFT JOIN resultados_cadena u ON u.id = (SELECT MAX(id) FROM resultados_cadena WHERE cadena_id = c.id AND estado <> 'consultando')
    ORDER BY c.orden, c.id`);
  const ultima = (c) => (c.u_estado ? `<p class="cadena-ultima">Última consulta (${esc(fecha(c.u_fecha))}): ${sem(c.u_estado)} ${esc(c.u_detalle ?? '')}</p>` : '');
  const fila = (c) => `${ultima(c)}<form method="post" action="/panel/cadenas" class="cadena-fila">
    <input type="hidden" name="id" value="${c.id ?? ''}">
    <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(c.nombre ?? '')}" required maxlength="120"></label>
    <label class="campo ancho-2"><span>Página de búsqueda (usa {q} donde va la medicina)</span><input name="url_busqueda" value="${esc(c.url_busqueda ?? '')}" required maxlength="500" placeholder="https://…/buscar?q={q}"></label>
    <label class="check"><input type="checkbox" name="activa" value="1"${c.activa === undefined || c.activa ? ' checked' : ''}> Activa</label>
    <button class="boton" type="submit">${c.id ? 'Guardar' : 'Agregar'}</button></form>`;
  return `${aviso(ok, 'ok')}${aviso(error, 'error')}
  <p class="sub">Firecrawl busca la medicina en el sitio de cada cadena activa y lee su ficha: producto, precio y existencia. La página de búsqueda indica el sitio y es el enlace «Ver» cuando no hay ficha.</p>
  <section class="bloque">${filas.map(fila).join('')}</section>
  <section class="bloque"><h2>Agregar cadena</h2>${fila({})}</section>`;
}

async function integracionesVista({ ok = '', error = '', fresca = false } = {}) {
  const lista = integraciones.estado();
  const vivo = await integraciones.revisa({ fresca });
  const base = urlPublica();
  return `${aviso(ok, 'ok')}${aviso(error, 'error')}
  <p class="sub">Cada clave va en el archivo <code>.env</code> del proyecto y se enciende al reiniciar el servicio. Esta página prueba cada API en vivo (sin gastar saldo) y dice qué falta. Sin ellas FarmaRadar funciona igual: las farmacias contestan desde su panel o su enlace.</p>
  <p><a class="boton" href="/panel/integraciones?fresca=1">${ico.actividad} Volver a comprobar</a></p>
  <div class="integraciones">${lista.map((a) => `<article class="integracion ${vivo[a.id]?.ok ? 'lista' : ''}">
    <div class="integracion-cab"><h2>${esc(a.nombre)}</h2>${vivo[a.id]?.ok ? '<span class="sem verde">Conectada</span>' : a.configurada ? '<span class="sem ambar">Revisar</span>' : '<span class="sem gris">Pendiente</span>'}</div>
    <p>${esc(a.rol)}</p>
    ${vivo[a.id] ? `<p class="estado-vivo ${vivo[a.id].ok ? 'ok' : ''}">${vivo[a.id].ok ? ico.ok : ico.reloj} ${esc(vivo[a.id].texto)}</p>` : ''}
    <p class="ayuda">Variables: ${a.vars.map((v) => `<code class="${a.faltan.includes(v) ? 'falta' : ''}">${v}</code>`).join(' ')}</p>
    <p class="premio">${ico.rayo} ${esc(a.premio)}</p></article>`).join('')}</div>
  <section class="bloque"><h2>Para conectar n8n y el agente de voz</h2>
    <p>Ambos avisan a FarmaRadar con la cabecera <code>X-FarmaRadar-Secreto</code> (el valor de <code>WEBHOOK_SECRETO</code> del .env).</p>
    <ul class="lista-tecnica">
      <li><b>n8n recibe</b> en <code>N8N_WEBHOOK_URL</code>: <code>{evento:"alerta", medicamento, zona, farmacias:[{nombre, whatsapp, token, enlace}]}</code> y <code>{evento:"confirmado", paciente_whatsapp, farmacia, direccion, precio, enlace}</code>.</li>
      <li><b>n8n contesta</b> a <code>${esc(base)}/api/webhooks/n8n</code> con <code>{token, tiene, precio, nota}</code>.</li>
      <li><b>ElevenLabs</b>: en la página de cada solicitud la farmacia escucha la pregunta (voz de <code>ELEVENLABS_VOICE_ID</code>) y contesta hablando; su respuesta se transcribe y se entiende sola. Para llamadas por teléfono además hacen falta <code>ELEVENLABS_AGENT_ID</code> y <code>ELEVENLABS_PHONE_NUMBER_ID</code> (su herramienta contesta a <code>${esc(base)}/api/webhooks/voz</code>).</li>
      <li><b>Gemma 4</b>: cualquier API compatible con OpenAI (<code>GEMMA_URL</code> termina en <code>/v1</code>).</li>
    </ul></section>`;
}

async function actividad() {
  return listaActividad(await db.todos('SELECT * FROM actividad ORDER BY id DESC LIMIT 200'));
}

function cuenta(ok = '', error = '') {
  return `${aviso(ok, 'ok')}${aviso(error, 'error')}
  <form method="post" action="/panel/cuenta" class="form-grid una angosto-form">
    <label class="campo"><span>Contraseña actual</span><input name="actual" type="password" required autocomplete="current-password"></label>
    <label class="campo"><span>Contraseña nueva (mínimo 8)</span><input name="nueva" type="password" required minlength="8" autocomplete="new-password"></label>
    <button class="boton primario" type="submit">Cambiar contraseña</button>
  </form>`;
}

/* ── Rutas ──────────────────────────────────────────────────────────────── */

export default function panel(r) {
  r.get('/panel/entrar', (req, res) => html(res, entrar()));
  r.post('/panel/entrar', async (req, res) => {
    const b = await cuerpo(req);
    const usuario = texto(b.usuario, 60);
    const llave = `login:${ipDe(req)}:${usuario}`;
    if (!permite(llave, 5, 15 * 60_000)) return html(res, entrar('Demasiados intentos. Espera 15 minutos.'), 429);
    const u = await db.uno('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    if (!u || !(await claveCorrecta(String(b.clave ?? ''), u.clave_hash))) return html(res, entrar('Usuario o contraseña incorrectos'), 401);
    redirige(res, '/panel', { 'Set-Cookie': await sesion.abre('equipo', u.id) });
  });

  // Todo lo demás del panel pide sesión del equipo; los POST, además, venir de esta página.
  const con = (fn) => async (req, res, ctx) => {
    const uid = await sesion.de(req, 'equipo');
    if (!uid) return redirige(res, '/panel/entrar');
    if (req.method === 'POST' && !mismoOrigen(req)) return redirige(res, '/panel');
    return fn(req, res, { ...ctx, uid });
  };

  r.post('/panel/salir', async (req, res) => redirige(res, '/panel/entrar', { 'Set-Cookie': await sesion.cierra(req, 'equipo') }));
  r.get('/panel', con(async (req, res) => html(res, marco('', 'Tablero', await tablero()))));
  r.get('/panel/busquedas', con(async (req, res, { q }) => html(res, marco('busquedas', 'Búsquedas', await busquedas(q)))));
  r.get('/panel/busquedas/:id', con(async (req, res, { params }) => {
    const d = await detalleBusqueda(params.id);
    if (!d) return false;
    html(res, marco('busquedas', 'Detalle de la búsqueda', d));
  }));

  r.get('/panel/farmacias', con(async (req, res, { q }) => html(res, marco('farmacias', 'Farmacias de barrio', await farmacias(q)))));
  r.post('/panel/farmacias', con(async (req, res, { q }) => {
    const { datos, error } = datosFarmacia(await cuerpo(req));
    if (error) return html(res, marco('farmacias', 'Farmacias de barrio', await farmacias(q, aviso(error, 'error'))), 400);
    await db.ejecutar(
      `INSERT INTO farmacias (nombre, responsable, telefono, whatsapp, correo, direccion, colonia, cp, ciudad, lat, lng, acepta_whatsapp, acepta_llamadas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.nombre, datos.responsable, datos.telefono, datos.whatsapp, datos.correo, datos.direccion, datos.colonia, datos.cp, datos.ciudad,
        datos.lat, datos.lng, datos.acepta_whatsapp, datos.acepta_llamadas]);
    redirige(res, '/panel/farmacias');
  }));
  r.post('/panel/farmacias/demo/borrar', con(async (req, res) => {
    await db.ejecutar('DELETE r FROM respuestas_locales r JOIN farmacias f ON f.id = r.farmacia_id WHERE f.demo = 1');
    const { cambios } = await db.ejecutar('DELETE FROM farmacias WHERE demo = 1');
    await db.ejecutar('INSERT INTO actividad (tipo, texto) VALUES (?, ?)', ['farmacia', `Se borraron ${cambios} farmacias de demostración`]);
    redirige(res, '/panel/farmacias');
  }));
  r.post('/panel/farmacias/:id/activa', con(async (req, res, { params }) => {
    await db.ejecutar('UPDATE farmacias SET activa = 1 - activa WHERE id = ?', [Number(params.id) || 0]);
    redirige(res, '/panel/farmacias');
  }));
  r.post('/panel/farmacias/:id/enlace', con(async (req, res, { params, q }) => {
    const f = await db.uno('SELECT id, nombre FROM farmacias WHERE id = ?', [Number(params.id) || 0]);
    if (!f) return false;
    const acceso = token(24);
    await db.ejecutar('UPDATE farmacias SET acceso_hash = ? WHERE id = ?', [sha256(acceso), f.id]);
    await sesion.cierraTodas('farmacia', f.id);
    const enlace = `${urlPublica()}/f/entrar/${acceso}`;
    html(res, marco('farmacias', 'Farmacias de barrio', await farmacias(q, `<div class="enlace-privado"><h2>${ico.llave} Enlace de acceso de ${esc(f.nombre)}</h2>
      <p>Mándaselo a la farmacia. El anterior ya no funciona.</p><input class="copiable" readonly value="${esc(enlace)}">
      <button class="boton" type="button" data-copiar-de=".copiable">Copiar enlace</button></div>`)));
  }));

  r.get('/panel/cadenas', con(async (req, res, { q }) => html(res, marco('cadenas', 'Cadenas', await cadenas(q.get('ok') ? 'Guardado.' : '')))));
  r.post('/panel/cadenas', con(async (req, res) => {
    const b = await cuerpo(req);
    const nombre = texto(b.nombre, 120), url = texto(b.url_busqueda, 500);
    if (!nombre || !/^https:\/\/[^\s]+$/.test(url) || !url.includes('{q}'))
      return html(res, marco('cadenas', 'Cadenas', await cadenas('', 'Pon el nombre y una dirección https que tenga {q} donde va la medicina')), 400);
    const id = Number(b.id) || 0;
    if (id) await db.ejecutar('UPDATE cadenas SET nombre = ?, url_busqueda = ?, activa = ? WHERE id = ?', [nombre, url, b.activa ? 1 : 0, id]);
    else await db.ejecutar('INSERT INTO cadenas (nombre, url_busqueda, activa, orden) VALUES (?, ?, ?, (SELECT COALESCE(MAX(c.orden), 0) + 1 FROM cadenas c))', [nombre, url, b.activa ? 1 : 0]);
    redirige(res, '/panel/cadenas?ok=1');
  }));

  r.get('/panel/integraciones', con(async (req, res, { q }) => html(res, marco('integraciones', 'Integraciones', await integracionesVista({ fresca: q.get('fresca') === '1', ok: q.get('ok') ?? '', error: q.get('error') ?? '' })))));
  r.get('/panel/actividad', con(async (req, res) => html(res, marco('actividad', 'Actividad', await actividad()))));
  r.get('/panel/cuenta', con(async (req, res) => html(res, marco('cuenta', 'Mi cuenta', cuenta()))));
  r.post('/panel/cuenta', con(async (req, res, { uid }) => {
    const b = await cuerpo(req);
    const u = await db.uno('SELECT * FROM usuarios WHERE id = ?', [uid]);
    if (!(await claveCorrecta(String(b.actual ?? ''), u.clave_hash))) return html(res, marco('cuenta', 'Mi cuenta', cuenta('', 'La contraseña actual no es correcta')), 400);
    if (String(b.nueva ?? '').length < 8) return html(res, marco('cuenta', 'Mi cuenta', cuenta('', 'La nueva debe tener al menos 8 caracteres')), 400);
    await db.ejecutar('UPDATE usuarios SET clave_hash = ? WHERE id = ?', [await hashClave(b.nueva), uid]);
    html(res, marco('cuenta', 'Mi cuenta', cuenta('Contraseña cambiada.')));
  }));
}
