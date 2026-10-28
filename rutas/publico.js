/**
 * Lo público: la landing, el buscador del paciente, el resultado en vivo, el registro express de
 * farmacias, la página donde el boticario contesta (/r/:token) y el panel de cada farmacia (/f).
 */
import { db } from '../lib/db.js';
import { html, redirige, cuerpo, mismoOrigen, ipDe, json } from '../lib/http.js';
import { pagina, cabeceraPublica, pie, ico, logo, aviso } from '../lib/vistas.js';
import { esc, texto, coord, pesos, fecha } from '../lib/util.js';
import { permite, token, sha256 } from '../lib/seguridad.js';
import * as sesion from '../lib/sesion.js';
import * as busqueda from '../lib/busqueda.js';
import { urlPublica } from '../lib/entorno.js';

/* ── Landing ────────────────────────────────────────────────────────────── */

function landing() {
  const paso = (n, icono, titulo, txt, clase = '') => `<li class="paso ${clase}"><span class="paso-ico">${icono}</span><div><span class="paso-n">${n}</span><h3>${titulo}</h3><p>${txt}</p></div></li>`;
  return pagina({
    titulo: 'FarmaRadar · Encuentra tu medicina',
    clase: 'landing',
    cuerpo: `${cabeceraPublica()}
<main>
<section class="hero">
  <div class="ancho hero-in">
    <div class="hero-txt">
      <p class="etiqueta">${ico.radar} Contra el desabasto de medicamentos</p>
      <h1>La medicina que buscas puede estar en la farmacia de la esquina.</h1>
      <p class="lead">FarmaRadar busca en tiempo real en las farmacias de cadena y, si están agotadas, pregunta por ti a las farmacias de barrio: por llamada y por WhatsApp.</p>
      <form class="buscador" action="/buscar" method="get" role="search">
        <label class="campo-ico">${ico.pildora}<input name="m" placeholder="¿Qué medicina buscas? Ej. Insulina glargina" autocomplete="off" required maxlength="160"></label>
        <label class="campo-ico">${ico.pin}<input name="z" placeholder="Colonia o código postal" autocomplete="off" maxlength="160"></label>
        <button class="boton primario grande" type="submit">${ico.buscar} Buscar</button>
      </form>
      <p class="hero-nota">Sin registrarte. Gratis.</p>
    </div>
    <div class="radar-vis" aria-hidden="true">
      <div class="radar-anillos"><i></i><i></i><i></i><span class="radar-barrido"></span></div>
      <span class="punto p1 rojo"></span><span class="punto p2 rojo"></span><span class="punto p3 verde"></span><span class="punto p4 ambar"></span><span class="punto p5 gris"></span>
      <div class="radar-tarjeta t1"><b>Cadena A</b><span class="sem rojo">Agotado</span></div>
      <div class="radar-tarjeta t2"><b>Cadena B</b><span class="sem rojo">Agotado</span></div>
      <div class="radar-tarjeta t3"><b>Farmacia de la esquina</b><span class="sem verde">Sí tiene</span></div>
    </div>
  </div>
</section>

<section class="seccion" id="problema">
  <div class="ancho">
    <h2>El problema</h2>
    <p class="sub">En México y Latinoamérica el desabasto de medicamentos para diabetes, hipertensión, cáncer y salud mental obliga a miles de familias a ir de farmacia en farmacia, o a caer en el mercado negro.</p>
    <div class="tarjetas tres">
      <article class="tarjeta"><span class="tarjeta-ico rojo">${ico.cadena}</span><h3>Inventarios en silos</h3><p>Cada gran cadena ve solo lo suyo. Nadie cruza la información.</p></article>
      <article class="tarjeta"><span class="tarjeta-ico ambar">${ico.tienda}</span><h3>El barrio no aparece</h3><p>Muchas farmacias son independientes: sin página web ni tienda en línea, pero a veces con la medicina que las cadenas ya agotaron.</p></article>
      <article class="tarjeta"><span class="tarjeta-ico gris">${ico.reloj}</span><h3>Horas perdidas</h3><p>Llamar una por una, recorrer la ciudad bajo el sol… justo cuando el tratamiento no puede esperar.</p></article>
    </div>
  </div>
</section>

<section class="seccion gris" id="como-funciona">
  <div class="ancho">
    <h2>Cómo funciona</h2>
    <p class="sub">Un buscador con respaldo en dos fases.</p>
    <ol class="pasos">
      ${paso('Fase 1', ico.cadena, 'Grandes cadenas en segundos', 'Consultamos en vivo las existencias y precios en línea de las cadenas, y te lo mostramos con un semáforo.')}
      ${paso('Fase 2', ico.telefono, 'Llamamos por ti', 'Si las cadenas están agotadas, un agente de voz llama a la farmacia de barrio más cercana y le pregunta al boticario si la tiene y a qué precio.', 'destacado')}
      ${paso('Fase 2', ico.whatsapp, 'Red de WhatsApp de la colonia', 'Al mismo tiempo, las farmacias registradas de tu zona reciben una alerta y confirman con un mensaje.')}
      ${paso('Siempre', ico.pildora, 'Genéricos más baratos', 'Identificamos el principio activo de tu medicina y te sugerimos genéricos bioequivalentes.')}
    </ol>
  </div>
</section>

<section class="seccion" id="farmacias">
  <div class="ancho dos">
    <div>
      <h2>¿Tienes una farmacia de barrio?</h2>
      <p class="sub">Regístrate en 10 segundos y recibe a los pacientes de tu colonia que buscan lo que tú tienes en el mostrador. Sin página web, sin comisiones.</p>
      <ul class="lista">
        <li>${ico.ok} Te avisamos por WhatsApp o por llamada cuando alguien busca una medicina cerca.</li>
        <li>${ico.ok} Contestas «sí, tengo» con un toque y tu precio.</li>
        <li>${ico.ok} El paciente llega directo a tu mostrador.</li>
      </ul>
      <a class="boton primario grande" href="/farmacias/registro">${ico.tienda} Registrar mi farmacia</a>
    </div>
    <div class="telefono-vis" aria-hidden="true">
      <div class="burbuja entra"><b>FarmaRadar</b>Hola, Farmacia Lupita. Un paciente cerca busca <b>Insulina glargina</b>. ¿La tienes?</div>
      <div class="burbuja sale">Sí, tengo una caja. $390</div>
      <div class="burbuja entra">¡Gracias! Le avisamos al paciente.</div>
    </div>
  </div>
</section>

<section class="seccion cierre">
  <div class="ancho">
    <h2>Rompemos los silos, digitalizamos al boticario y acercamos la medicina al paciente.</h2>
    <a class="boton blanco grande" href="/buscar">${ico.buscar} Buscar una medicina</a>
  </div>
</section>
</main>
${pie}`,
  });
}

/* ── Buscador y resultado ───────────────────────────────────────────────── */

function buscar(q) {
  const m = texto(q.get('m'), 160), z = texto(q.get('z'), 160);
  return pagina({
    titulo: 'Buscar medicina · FarmaRadar',
    clase: 'app',
    scripts: ['ubicacion.js', 'buscar.js'],
    cuerpo: `${cabeceraPublica('buscar')}
<main class="ancho app-main">
  <section class="caja-busqueda">
    <h1>${ico.buscar} ¿Qué medicina necesitas?</h1>
    <form id="form-buscar" class="form-grid" novalidate>
      <label class="campo ancho-2"><span>Medicina</span>
        <span class="campo-ico">${ico.pildora}<input name="medicamento" value="${esc(m)}" placeholder="Nombre comercial o principio activo" required maxlength="160" autocomplete="off"></span></label>
      <label class="campo"><span>Colonia o código postal</span>
        <span class="campo-ico">${ico.pin}<input name="zona" value="${esc(z)}" placeholder="Ej. Polanco o 11560" maxlength="160" autocomplete="off"></span></label>
      <div class="campo"><span>Tu ubicación</span>
        <button type="button" class="boton" id="ubicacion">${ico.pin} Usar mi ubicación</button>
        <small id="ubicacion-estado" class="ayuda">Opcional: para ordenar por cercanía.</small></div>
      <label class="campo ancho-2"><span>Tu WhatsApp (opcional)</span>
        <span class="campo-ico">${ico.whatsapp}<input name="whatsapp" inputmode="tel" placeholder="10 dígitos: te avisamos cuando alguien la tenga" maxlength="20" autocomplete="tel"></span></label>
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
    scripts: ['resultado.js'],
    cuerpo: `${cabeceraPublica('buscar')}
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
    scripts: ['ubicacion.js'],
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
  return `<form method="post" action="/r/${esc(r.token)}" class="form-respuesta">
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
    scripts: ['ubicacion.js'],
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
  r.get('/', (req, res) => html(res, landing()));
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
