/**
 * Lo público: la landing, el buscador del paciente, el resultado en vivo, el registro express de
 * farmacias, la página donde el boticario contesta (/r/:token) y el panel de cada farmacia (/f).
 */
import { db } from '../lib/db.js';
import { html, redirige, cuerpo, mismoOrigen, ipDe, json } from '../lib/http.js';
import { pagina, cabeceraPublica, pie, ico, logo, aviso, hayGoogleMaps } from '../lib/vistas.js';
import { esc, texto, coord, pesos, fecha } from '../lib/util.js';
import { permite, token, sha256 } from '../lib/seguridad.js';
import * as sesion from '../lib/sesion.js';
import * as busqueda from '../lib/busqueda.js';
import { urlPublica } from '../lib/entorno.js';
import { landing } from './landing.js';
import * as integraciones from '../lib/integraciones.js';

/* ── Buscador y resultado ───────────────────────────────────────────────── */

function buscar(q) {
  const m = texto(q.get('m'), 160), z = texto(q.get('z'), 160);
  return pagina({
    titulo: 'Buscar medicina · FarmaRadar',
    clase: 'app',
    scripts: ['ubicacion.js', 'buscar.js', 'asistente.js'],
    cuerpo: `${cabeceraPublica('buscar')}
<main class="ancho app-main">
  <section class="caja-busqueda">
    <h1>${ico.buscar} ¿Qué medicina necesitas?</h1>
    ${integraciones.configurada('elevenlabs') ? `<button type="button" class="lp-voz claro" data-asistente>${ico.micro}<span><b>Háblale a FarmaRadar</b><small>Dile qué buscas y dónde; te contesta con voz</small></span></button>
    <p class="o-escribe">o escríbelo:</p>` : ''}
    <form id="form-buscar" class="form-grid" novalidate>
      <label class="campo ancho-2"><span>Medicina</span>
        <span class="campo-ico">${ico.pildora}<input name="medicamento" value="${esc(m)}" placeholder="Nombre comercial o principio activo" required maxlength="160" autocomplete="off"></span></label>
      <label class="campo"><span>Colonia o código postal</span>
        <span class="campo-ico">${ico.pin}<input name="zona" value="${esc(z)}" placeholder="Ej. Polanco o 11560" maxlength="160" autocomplete="off"></span></label>
      <div class="campo"><span>Tu ubicación</span>
        <button type="button" class="boton" id="ubicacion">${ico.pin} Usar mi ubicación</button>
        <small id="ubicacion-estado" class="ayuda">Opcional: para ordenar por cercanía.</small></div>
      ${integraciones.configurada('n8n') ? `<label class="campo ancho-2"><span>Tu WhatsApp (opcional)</span>
        <span class="campo-ico">${ico.whatsapp}<input name="whatsapp" inputmode="tel" placeholder="10 dígitos: te avisamos cuando alguien la tenga" maxlength="20" autocomplete="tel"></span></label>` : ''}
      <input type="hidden" name="lat"><input type="hidden" name="lng">
      <div class="ancho-2"><button class="boton primario grande ancho-total" type="submit">${ico.radar} Buscar en el radar</button></div>
      <p class="error" id="error" hidden></p>
    </form>
  </section>
</main>
${pie}`,
  });
}

function resultado(id) {
  return pagina({
    titulo: 'Resultado · FarmaRadar',
    clase: 'app',
    leaflet: true,
    scripts: ['resultado.js', 'asistente.js'],
    cuerpo: `${cabeceraPublica('buscar')}
${integraciones.configurada('elevenlabs') ? `<button type="button" class="voz-flotante" data-asistente data-busqueda="${esc(id)}">${ico.micro}<span>Escuchar y hablar</span></button>` : ''}
<main class="ancho app-main" id="resultado" data-id="${esc(id)}">
  <div class="cargando">${ico.radar} Buscando…</div>
</main>
${pie}`,
  });
}

/* ── Registro express de farmacias ──────────────────────────────────────── */

export function formFarmacia(f = {}, { accion = '/farmacias/registro', boton = 'Registrar mi farmacia', error = '' } = {}) {
  const v = (k) => esc(f[k] ?? '');
  const chk = (k) => (f[k] === undefined || Number(f[k]) ? ' checked' : '');
  return `<form method="post" action="${accion}" class="form-grid" id="form-farmacia">
  ${aviso(error, 'error')}
  <label class="campo ancho-2"><span>Nombre de la farmacia *</span><input name="nombre" value="${v('nombre')}" required maxlength="160" placeholder="Ej. Farmacia Lupita"></label>
  <label class="campo"><span>Responsable</span><input name="responsable" value="${v('responsable')}" maxlength="120" autocomplete="name"></label>
  <label class="campo"><span>Teléfono del mostrador *</span><input name="telefono" value="${v('telefono')}" required inputmode="tel" maxlength="20" placeholder="10 dígitos"></label>
  <label class="campo"><span>WhatsApp</span><input name="whatsapp" value="${v('whatsapp')}" inputmode="tel" maxlength="20" placeholder="Si es otro número"></label>
  <label class="campo"><span>Correo</span><input name="correo" type="email" value="${v('correo')}" maxlength="160" autocomplete="email"></label>
  <label class="campo ancho-2"><span>Dirección *</span><input name="direccion" value="${v('direccion')}" required maxlength="255" placeholder="Calle y número"></label>
  <label class="campo"><span>Colonia *</span><input name="colonia" value="${v('colonia')}" required maxlength="120"></label>
  <label class="campo"><span>Código postal *</span><input name="cp" value="${v('cp')}" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5"></label>
  <label class="campo"><span>Ciudad</span><input name="ciudad" value="${v('ciudad')}" maxlength="120" placeholder="Ej. CDMX"></label>
  <div class="campo"><span>Ubicación en el mapa</span>
    <button type="button" class="boton" id="ubicacion">${ico.pin} Usar mi ubicación</button>
    <small id="ubicacion-estado" class="ayuda">${f.lat ? 'Ubicación guardada.' : 'Ayuda a que te encuentren los pacientes cercanos.'}</small></div>
  <input type="hidden" name="lat" value="${v('lat')}"><input type="hidden" name="lng" value="${v('lng')}">
  ${hayGoogleMaps() ? `<div class="campo ancho-2 elige">
    <div class="elige-cab"><span>Marca tu farmacia en el mapa</span><button type="button" class="boton chico" id="ubica-direccion">${ico.buscar} Buscar mi dirección</button></div>
    <div class="mapa-elige" id="mapa-elige"></div>
    <small class="ayuda" id="elige-estado">Toca el mapa o arrastra el punto hasta tu mostrador.</small></div>` : ''}
  <fieldset class="campo ancho-2 opciones"><legend>¿Cómo quieres recibir las solicitudes?</legend>
    <label class="check"><input type="checkbox" name="acepta_whatsapp" value="1"${chk('acepta_whatsapp')}> Por WhatsApp</label>
    <label class="check"><input type="checkbox" name="acepta_llamadas" value="1"${chk('acepta_llamadas')}> Por llamada (un asistente de voz)</label>
  </fieldset>
  <div class="ancho-2"><button class="boton primario grande ancho-total" type="submit">${ico.tienda} ${boton}</button></div>
</form>`;
}

function registro(error = '', f = {}) {
  return pagina({
    titulo: 'Registra tu farmacia · FarmaRadar',
    clase: 'app',
    mapas: true,
    scripts: ['ubicacion.js', 'elige-mapa.js'],
    cuerpo: `${cabeceraPublica('registro')}
<main class="ancho app-main angosto">
  <section class="caja-busqueda">
    <h1>${ico.tienda} Registra tu farmacia</h1>
    <p class="sub">Gratis. Te llegarán las búsquedas de los pacientes de tu zona y contestas con un toque.</p>
    ${formFarmacia(f, { error })}
    <p class="ayuda centro">${ico.llave} Pronto: entrar sin contraseña con tu correo (MojoAuth). Hoy entras con tu enlace privado.</p>
  </section>
</main>
${pie}`,
  });
}

/** Valida los datos de una farmacia de un formulario. → {datos} o {error} */
export function datosFarmacia(b) {
  const d = {
    nombre: texto(b.nombre, 160), responsable: texto(b.responsable, 120),
    telefono: texto(b.telefono, 20).replace(/[^\d+ ]/g, ''), whatsapp: texto(b.whatsapp, 20).replace(/[^\d+ ]/g, ''),
    correo: texto(b.correo, 160), direccion: texto(b.direccion, 255), colonia: texto(b.colonia, 120),
    cp: texto(b.cp, 5), ciudad: texto(b.ciudad, 120),
    lat: coord(b.lat, 90), lng: coord(b.lng, 180),
    acepta_whatsapp: b.acepta_whatsapp ? 1 : 0, acepta_llamadas: b.acepta_llamadas ? 1 : 0,
  };
  if (!d.nombre) return { error: 'Falta el nombre de la farmacia', datos: d };
  if (d.telefono.replace(/\D/g, '').length < 10) return { error: 'El teléfono debe tener 10 dígitos', datos: d };
  if (!d.direccion || !d.colonia) return { error: 'Faltan la dirección y la colonia', datos: d };
  if (!/^\d{5}$/.test(d.cp)) return { error: 'El código postal son 5 dígitos', datos: d };
  if (d.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return { error: 'El correo no parece válido', datos: d };
  if ((d.lat === null) !== (d.lng === null)) { d.lat = null; d.lng = null; }
  return { datos: d };
}

/* ── El boticario contesta ──────────────────────────────────────────────── */

async function solicitud(tokenR) {
  if (!/^[0-9a-f]{32}$/.test(tokenR)) return null;
  return db.uno(
    `SELECT r.*, f.nombre AS farmacia, b.medicamento, b.zona, b.principio_activo FROM respuestas_locales r
     JOIN farmacias f ON f.id = r.farmacia_id JOIN busquedas b ON b.id = r.busqueda_id WHERE r.token = ?`, [tokenR]);
}

function formRespuesta(r, volver = '') {
  if (r.estado === 'tiene' || r.estado === 'no_tiene') {
    return `<div class="respondida ${r.estado === 'tiene' ? 'verde' : 'rojo'}">${r.estado === 'tiene' ? ico.ok : ico.x}
      <b>${r.estado === 'tiene' ? `Contestaste: sí la tienes${r.precio ? ` a ${pesos(r.precio)}` : ''}` : 'Contestaste: no la tienes'}</b></div>`;
  }
  const voz = integraciones.configurada('elevenlabs') ? `<div class="voz" data-voz="/r/${esc(r.token)}">
    <div class="voz-botones">
      <button type="button" class="boton grande" data-escuchar>${ico.bocina} Escuchar la pregunta</button>
      <button type="button" class="boton primario grande" data-hablar>${ico.micro} <span>Contestar hablando</span></button>
    </div>
    <p class="voz-estado" aria-live="polite">Toca «Contestar hablando», di si la tienes y a qué precio, y vuelve a tocar.</p>
  </div>
  <p class="voz-o">o contesta con los botones:</p>` : '';
  return `${voz}<form method="post" action="/r/${esc(r.token)}" class="form-respuesta">
    ${volver ? `<input type="hidden" name="volver" value="${esc(volver)}">` : ''}
    <label class="campo"><span>Precio por caja (opcional)</span><span class="campo-ico">$<input name="precio" inputmode="decimal" placeholder="390" maxlength="10"></span></label>
    <label class="campo"><span>Nota (opcional)</span><input name="nota" maxlength="300" placeholder="Ej. Me quedan 2 cajas"></label>
    <div class="botones-respuesta">
      <button class="boton verde grande" name="tiene" value="1" type="submit">${ico.ok} Sí la tengo</button>
      <button class="boton rojo-suave grande" name="tiene" value="0" type="submit">${ico.x} No la tengo</button>
    </div>
  </form>`;
}

function paginaRespuesta(r, hecho = false) {
  return pagina({
    titulo: 'Solicitud de un paciente · FarmaRadar',
    clase: 'app',
    scripts: ['voz.js'],
    cuerpo: `<header class="cab"><div class="ancho cab-in"><a class="marca" href="/">${logo}</a></div></header>
<main class="ancho app-main angosto">
  <section class="caja-busqueda">
    ${hecho ? aviso('¡Gracias! Ya le avisamos al paciente.', 'ok') : ''}
    <p class="etiqueta">${ico.tienda} ${esc(r.farmacia)}</p>
    <h1>Un paciente cerca busca:</h1>
    <p class="medicina-grande">${ico.pildora} ${esc(r.medicamento)}</p>
    ${r.principio_activo ? `<p class="sub">Principio activo: <b>${esc(r.principio_activo)}</b></p>` : ''}
    ${r.zona ? `<p class="sub">${ico.pin} Zona: ${esc(r.zona)}</p>` : ''}
    ${formRespuesta(r)}
  </section>
</main>`,
  });
}

/* ── Panel de la farmacia (/f) ──────────────────────────────────────────── */

async function panelFarmacia(fid, { nuevo = null, ok = '', error = '' } = {}) {
  const f = await db.uno('SELECT * FROM farmacias WHERE id = ?', [fid]);
  const pendientes = await db.todos(
    `SELECT r.*, b.medicamento, b.zona FROM respuestas_locales r JOIN busquedas b ON b.id = r.busqueda_id
     WHERE r.farmacia_id = ? AND r.estado IN ('enviada','pendiente','llamando') ORDER BY r.id DESC LIMIT 30`, [fid]);
  const hechas = await db.todos(
    `SELECT r.*, b.medicamento FROM respuestas_locales r JOIN busquedas b ON b.id = r.busqueda_id
     WHERE r.farmacia_id = ? AND r.estado IN ('tiene','no_tiene') ORDER BY r.respondido DESC LIMIT 20`, [fid]);
  return pagina({
    titulo: `${f.nombre} · FarmaRadar`,
    clase: 'app',
    mapas: true,
    scripts: ['ubicacion.js', 'voz.js', 'elige-mapa.js'],
    cuerpo: `<header class="cab"><div class="ancho cab-in"><a class="marca" href="/">${logo}</a>
  <form method="post" action="/f/salir"><button class="boton" type="submit">${ico.salir} Salir</button></form></div></header>
<main class="ancho app-main">
  ${nuevo ? `<div class="enlace-privado"><h2>${ico.llave} Guarda tu enlace privado</h2>
    <p>Con este enlace entras a tu panel desde cualquier teléfono. No lo compartas.</p>
    <input class="copiable" readonly value="${esc(nuevo)}" data-copiar>
    <button class="boton" type="button" data-copiar-de=".copiable">Copiar enlace</button></div>` : ''}
  ${aviso(ok, 'ok')}${aviso(error, 'error')}
  <h1>${ico.tienda} ${esc(f.nombre)}</h1>
  <p class="sub">${esc([f.direccion, f.colonia, f.cp].filter(Boolean).join(', '))}</p>

  <section class="bloque">
    <h2>Pacientes buscando <span class="pastilla">${pendientes.length}</span></h2>
    ${pendientes.length ? pendientes.map((r) => `<article class="solicitud">
      <div class="solicitud-cab"><span class="medicina">${ico.pildora} ${esc(r.medicamento)}</span><span class="cuando">${esc(fecha(r.creado))}</span></div>
      ${formRespuesta(r)}</article>`).join('') : '<p class="vacio">No hay solicitudes por ahora. Te avisaremos cuando alguien busque cerca.</p>'}
  </section>

  ${hechas.length ? `<section class="bloque"><h2>Lo que ya contestaste</h2><ul class="historial">${hechas.map((r) => `<li>
    <span class="sem ${r.estado === 'tiene' ? 'verde' : 'rojo'}">${r.estado === 'tiene' ? 'Sí' : 'No'}</span>
    ${esc(r.medicamento)} ${r.precio ? `· ${pesos(r.precio)}` : ''} <span class="cuando">${esc(fecha(r.respondido))}</span></li>`).join('')}</ul></section>` : ''}

  <section class="bloque">
    <details><summary><h2>Datos de mi farmacia</h2></summary>
    ${formFarmacia(f, { accion: '/f/datos', boton: 'Guardar cambios' })}
    <form method="post" action="/f/enlace" class="enlace-nuevo"><button class="boton" type="submit">${ico.llave} Generar un enlace privado nuevo</button>
    <small class="ayuda">El anterior deja de funcionar.</small></form></details>
  </section>
</main>`,
  });
}

function entrarFarmacia(error = '') {
  return pagina({
    titulo: 'Soy farmacia · FarmaRadar',
    clase: 'app',
    cuerpo: `${cabeceraPublica()}
<main class="ancho app-main angosto">
  <section class="caja-busqueda centro">
    <h1>${ico.tienda} Panel de tu farmacia</h1>
    ${aviso(error, 'error')}
    <p class="sub">Entra con el enlace privado que te dimos al registrarte (o el que te llegó por WhatsApp).</p>
    <p class="ayuda">${ico.llave} Pronto: entrar sin contraseña con tu correo (MojoAuth).</p>
    <a class="boton primario grande" href="/farmacias/registro">${ico.tienda} Aún no estoy registrada</a>
  </section>
</main>
${pie}`,
  });
}

/* ── Rutas ──────────────────────────────────────────────────────────────── */

export default function publico(r) {
  r.get('/', async (req, res) => html(res, await landing()));
  r.get('/salud', (req, res) => json(res, { ok: true }));
  r.get('/buscar', (req, res, { q }) => html(res, buscar(q)));
  r.get('/b/:id', async (req, res, { params }) => {
    if (!/^[A-Za-z0-9_-]{16}$/.test(params.id) || !(await db.uno('SELECT id FROM busquedas WHERE id = ?', [params.id]))) return false;
    html(res, resultado(params.id));
  });

  r.get('/farmacias/registro', (req, res) => html(res, registro()));
  r.post('/farmacias/registro', async (req, res) => {
    if (!mismoOrigen(req)) return html(res, registro('La página caducó: vuelve a intentarlo'), 403);
    if (!permite(`registro:${ipDe(req)}`, 10, 3600_000)) return html(res, registro('Demasiados registros desde esta conexión. Intenta en una hora.'), 429);
    const { datos, error } = datosFarmacia(await cuerpo(req));
    if (error) return html(res, registro(error, datos), 400);
    const acceso = token(24);
    const { id } = await db.ejecutar(
      `INSERT INTO farmacias (nombre, responsable, telefono, whatsapp, correo, direccion, colonia, cp, ciudad, lat, lng, acepta_whatsapp, acepta_llamadas, acceso_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.nombre, datos.responsable, datos.telefono, datos.whatsapp, datos.correo, datos.direccion, datos.colonia, datos.cp, datos.ciudad,
        datos.lat, datos.lng, datos.acepta_whatsapp, datos.acepta_llamadas, sha256(acceso)]);
    await busqueda.registra('farmacia', `Nueva farmacia registrada: ${datos.nombre} (${datos.colonia})`);
    const c = await sesion.abre('farmacia', id);
    html(res, await panelFarmacia(id, { nuevo: `${urlPublica()}/f/entrar/${acceso}`, ok: '¡Listo! Tu farmacia ya está en el radar.' }), 200, { 'Set-Cookie': c });
  });

  r.get('/r/:token', async (req, res, { params, q }) => {
    const s = await solicitud(params.token);
    if (!s) return false;
    html(res, paginaRespuesta(s, q.get('hecho') === '1'));
  });
  r.post('/r/:token', async (req, res, { params }) => {
    if (!permite(`responde:${ipDe(req)}`, 60, 3600_000)) return html(res, 'Demasiadas respuestas; intenta más tarde', 429);
    const s = await solicitud(params.token);
    if (!s) return false;
    const b = await cuerpo(req);
    const precio = Number(String(b.precio ?? '').replace(/[^0-9.]/g, ''));
    await busqueda.responde(params.token, {
      tiene: String(b.tiene) === '1',
      precio: Number.isFinite(precio) && precio > 0 && precio < 1_000_000 ? Math.round(precio * 100) / 100 : null,
      nota: texto(b.nota, 300) || null,
    });
    // Desde su panel vuelve al panel; desde el enlace, a la misma página con el gracias.
    const fid = await sesion.de(req, 'farmacia');
    redirige(res, fid === s.farmacia_id ? '/f?ok=1' : `/r/${params.token}?hecho=1`);
  });

  // ElevenLabs: la pregunta en voz (mp3) y la respuesta hablada (audio → texto → sí/no y precio).
  r.get('/r/:token/voz.mp3', async (req, res, { params }) => {
    if (!permite(`voz-oye:${ipDe(req)}`, 40, 3600_000)) return json(res, { error: 'Demasiadas solicitudes' }, 429);
    const s = await solicitud(params.token);
    if (!s) return false;
    const mp3 = await integraciones.vozPregunta(`Hola, ${s.farmacia}. Le hablamos de FarmaRadar. Un paciente que está cerca busca ${s.medicamento}. ¿La tiene? Y si la tiene, ¿a qué precio?`);
    if (!mp3) return json(res, { error: 'La voz no está disponible ahora' }, 503);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': mp3.length, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(mp3);
  });
  r.post('/r/:token/voz', async (req, res, { params }) => {
    if (!mismoOrigen(req)) return json(res, { error: 'no permitido' }, 403);
    if (!permite(`voz-habla:${ipDe(req)}`, 30, 3600_000)) return json(res, { error: 'Demasiados intentos; contesta con los botones' }, 429);
    const s = await solicitud(params.token);
    if (!s) return json(res, { error: 'Solicitud no encontrada' }, 404);
    if (s.estado === 'tiene' || s.estado === 'no_tiene') return json(res, { error: 'Esta solicitud ya tiene respuesta' }, 409);
    const tipo = String(req.headers['content-type'] ?? '').split(';')[0].trim();
    if (!/^audio\/(webm|mp4|ogg|mpeg|wav|x-m4a|aac)$/.test(tipo)) return json(res, { error: 'Formato de audio no válido' }, 415);
    const trozos = []; let n = 0;
    for await (const t of req) { n += t.length; if (n > 3 * 1024 * 1024) return json(res, { error: 'La grabación es muy larga' }, 413); trozos.push(t); }
    if (n < 1000) return json(res, { error: 'No se oyó nada; intenta de nuevo' }, 400);
    const t = await integraciones.transcribe(Buffer.concat(trozos), tipo);
    if (!t.ok) return json(res, { error: 'No se pudo entender el audio; contesta con los botones' }, 502);
    if (!t.texto) return json(res, { error: 'No se oyó nada; intenta de nuevo' }, 400);
    const e = integraciones.entiendeRespuesta(t.texto);
    if (e.tiene === null) return json(res, { texto: t.texto, listo: false });
    await busqueda.responde(params.token, { tiene: e.tiene, precio: e.precio, transcripcion: t.texto, canal: 'llamada' });
    json(res, { texto: t.texto, tiene: e.tiene, precio: e.precio, listo: true });
  });

  r.get('/f', async (req, res, { q }) => {
    const fid = await sesion.de(req, 'farmacia');
    if (!fid) return html(res, entrarFarmacia());
    html(res, await panelFarmacia(fid, { ok: q.get('ok') === '1' ? '¡Gracias! Ya le avisamos al paciente.' : q.get('ok') === '2' ? 'Datos guardados.' : '' }));
  });
  r.get('/f/entrar/:token', async (req, res, { params }) => {
    if (!permite(`entrar-f:${ipDe(req)}`, 20, 900_000)) return html(res, entrarFarmacia('Demasiados intentos. Espera 15 minutos.'), 429);
    const f = await db.uno('SELECT id FROM farmacias WHERE acceso_hash = ? AND activa = 1', [sha256(params.token)]);
    if (!f) return html(res, entrarFarmacia('Ese enlace ya no funciona. Pide uno nuevo al equipo de FarmaRadar.'), 404);
    redirige(res, '/f', { 'Set-Cookie': await sesion.abre('farmacia', f.id) });
  });
  r.post('/f/salir', async (req, res) => redirige(res, '/f', { 'Set-Cookie': await sesion.cierra(req, 'farmacia') }));
  r.post('/f/datos', async (req, res) => {
    const fid = await sesion.de(req, 'farmacia');
    if (!fid || !mismoOrigen(req)) return redirige(res, '/f');
    const { datos, error } = datosFarmacia(await cuerpo(req));
    if (error) return html(res, await panelFarmacia(fid, { error }), 400);
    await db.ejecutar(
      `UPDATE farmacias SET nombre=?, responsable=?, telefono=?, whatsapp=?, correo=?, direccion=?, colonia=?, cp=?, ciudad=?,
       lat=COALESCE(?, lat), lng=COALESCE(?, lng), acepta_whatsapp=?, acepta_llamadas=? WHERE id=?`,
      [datos.nombre, datos.responsable, datos.telefono, datos.whatsapp, datos.correo, datos.direccion, datos.colonia, datos.cp, datos.ciudad,
        datos.lat, datos.lng, datos.acepta_whatsapp, datos.acepta_llamadas, fid]);
    redirige(res, '/f?ok=2');
  });
  r.post('/f/enlace', async (req, res) => {
    const fid = await sesion.de(req, 'farmacia');
    if (!fid || !mismoOrigen(req)) return redirige(res, '/f');
    const acceso = token(24);
    await db.ejecutar('UPDATE farmacias SET acceso_hash = ? WHERE id = ?', [sha256(acceso), fid]);
    await sesion.cierraTodas('farmacia', fid);
    html(res, await panelFarmacia(fid, { nuevo: `${urlPublica()}/f/entrar/${acceso}`, ok: 'Enlace nuevo creado. El anterior ya no funciona.' }), 200,
      { 'Set-Cookie': await sesion.abre('farmacia', fid) });
  });
}
