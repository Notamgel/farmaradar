/**
 * La landing de farmaradar.lat. Lee de la base las cadenas activas, las cifras de la red y lo más
 * buscado (con caché de un minuto); si la base no responde, la página sale igual con lo básico.
 */
import { db } from '../lib/db.js';
import { pagina, cabeceraPublica, pie, ico } from '../lib/vistas.js';
import { esc } from '../lib/util.js';
import * as integraciones from '../lib/integraciones.js';

const SUGERIDAS = ['Insulina glargina', 'Metformina', 'Losartán', 'Metotrexato', 'Sertralina', 'Salbutamol'];
let cache = { hasta: 0, datos: null };

async function cifras() {
  if (cache.datos && cache.hasta > Date.now()) return cache.datos;
  const datos = { cadenas: [], farmacias: 0, busquedas: 0, confirmadas: 0, populares: [] };
  try {
    const [cad, far, bus, con, pop] = await Promise.all([
      db.todos('SELECT nombre FROM cadenas WHERE activa = 1 ORDER BY orden, id LIMIT 8'),
      db.uno('SELECT COUNT(*) n FROM farmacias WHERE activa = 1'),
      db.uno('SELECT COUNT(*) n FROM busquedas'),
      db.uno("SELECT COUNT(*) n FROM respuestas_locales WHERE estado = 'tiene'"),
      db.todos(`SELECT medicamento, COUNT(*) n FROM busquedas WHERE creado > UTC_TIMESTAMP() - INTERVAL 30 DAY
                GROUP BY medicamento HAVING n >= 3 ORDER BY n DESC LIMIT 6`),
    ]);
    Object.assign(datos, {
      cadenas: cad.map((c) => c.nombre), farmacias: Number(far?.n) || 0, busquedas: Number(bus?.n) || 0,
      confirmadas: Number(con?.n) || 0, populares: pop.map((p) => p.medicamento),
    });
  } catch { /* sin base: la landing sale con lo básico */ }
  cache = { hasta: Date.now() + 60_000, datos };
  return datos;
}

const miles = (n) => n.toLocaleString('es-MX');

export async function landing() {
  const c = await cifras();
  const apis = integraciones.estado();
  const chips = [...new Set([...c.populares, ...SUGERIDAS])].slice(0, 6);
  const cadenas = c.cadenas.length ? c.cadenas : ['Farmacias San Pablo', 'Farmacias del Ahorro'];

  // Cifras del hero: solo las que ya dicen algo (nada de «0 farmacias»).
  // Siempre cuatro: primero las de la base que ya dicen algo, luego datos fijos y ciertos.
  const stats = [
    c.busquedas > 0 && [miles(c.busquedas), 'búsquedas en el radar', c.busquedas],
    c.confirmadas > 0 && [miles(c.confirmadas), 'medicinas encontradas', c.confirmadas],
    c.farmacias > 0 && [miles(c.farmacias), c.farmacias === 1 ? 'farmacia de barrio en la red' : 'farmacias de barrio en la red', c.farmacias],
    [String(cadenas.length), cadenas.length === 1 ? 'cadena en el radar' : 'cadenas en el radar', cadenas.length],
    ['3', 'canales: web, voz y WhatsApp'],
    ['2', 'fases: cadenas y barrio'],
    ['$0', 'para pacientes y farmacias'],
  ].filter(Boolean).slice(0, 4);

  const paso = (n, icono, fase, titulo, txt, clase = '') => `<li class="lp-paso ${clase} revela">
    <span class="lp-paso-n">${n}</span>
    <span class="lp-paso-ico">${icono}</span>
    <span class="lp-fase">${fase}</span>
    <h3>${titulo}</h3><p>${txt}</p></li>`;
  const api = (a, icono) => `<article class="lp-api revela${a.configurada ? ' conectada' : ''}">
    <div class="lp-api-cab"><span class="lp-api-ico">${icono}</span>${a.configurada ? '<span class="sem verde">En vivo</span>' : '<span class="sem gris">En preparación</span>'}</div>
    <h3>${esc(a.nombre)}</h3><p>${esc(a.rol)}</p></article>`;
  const iconoApi = { firecrawl: ico.cadena, elevenlabs: ico.telefono, n8n: ico.whatsapp, gemma: ico.pildora, mojoauth: ico.llave };
  const pregunta = (p, r) => `<details class="lp-faq revela"><summary>${p}<span class="lp-faq-mas" aria-hidden="true"></span></summary><p>${r}</p></details>`;
  const buscador = (id) => `<form class="lp-buscador" action="/buscar" method="get" role="search" aria-label="Buscar medicina">
    <label class="lp-campo">${ico.pildora}<span class="sr">Medicina</span><input id="${id}-m" name="m" placeholder="¿Qué medicina buscas?" autocomplete="off" required maxlength="160"></label>
    <label class="lp-campo">${ico.pin}<span class="sr">Colonia o código postal</span><input name="z" placeholder="Colonia o C.P." autocomplete="off" maxlength="160"></label>
    <button class="boton primario grande" type="submit">${ico.buscar}<span>Buscar</span></button>
  </form>`;

  return pagina({
    titulo: 'FarmaRadar · Encuentra tu medicina en farmacias de cadena y de barrio',
    descripcion: 'FarmaRadar busca tu medicina en tiempo real en las cadenas y, si está agotada, pregunta por ti a las farmacias de barrio por llamada y WhatsApp. Gratis y sin registro.',
    clase: 'landing',
    scripts: ['landing.js'],
    cuerpo: `${cabeceraPublica()}
<main>
<section class="lp-hero">
  <div class="lp-hero-fondo" aria-hidden="true"><i class="lp-orbe o1"></i><i class="lp-orbe o2"></i></div>
  <div class="ancho lp-hero-in">
    <div class="lp-hero-txt">
      <p class="lp-insignia"><span class="lp-pulso" aria-hidden="true"></span> Red en vivo contra el desabasto</p>
      <h1>Tu medicina, <span class="lp-resalta">encontrada</span> en minutos. No en días.</h1>
      <p class="lp-lead">FarmaRadar revisa en tiempo real las farmacias de cadena y, si está agotada, <b>llama y escribe por ti</b> a las farmacias de barrio de tu colonia. Tú solo esperas el semáforo en verde.</p>
      ${buscador('hero')}
      <div class="lp-chips" aria-label="Búsquedas frecuentes"><span>Lo más buscado:</span>
        ${chips.map((m) => `<a class="lp-chip" href="/buscar?m=${encodeURIComponent(m)}">${esc(m)}</a>`).join('')}</div>
      <ul class="lp-confianza">
        <li>${ico.ok} Gratis para pacientes</li><li>${ico.ok} Sin registrarte</li><li>${ico.ok} Precios reales, sin inventar</li>
      </ul>
    </div>

    <div class="lp-demo" aria-hidden="true">
      <div class="lp-radar"><i></i><i></i><i></i><span class="lp-barrido"></span>
        <b class="lp-punto r1"></b><b class="lp-punto r2"></b><b class="lp-punto v1"></b><b class="lp-punto a1"></b></div>
      <div class="lp-ventana">
        <div class="lp-ventana-barra"><i></i><i></i><i></i><span>farmaradar.lat/buscar</span></div>
        <div class="lp-ventana-cuerpo">
          <div class="lp-sem verde"><span class="lp-luz"></span><div><small>Insulina glargina · Col. Roma Norte</small><b>¡La encontramos!</b></div></div>
          <ul class="lp-filas">
            <li><span class="lp-fila-ico">${ico.cadena}</span><span><b>Cadena nacional A</b><small>Fase 1 · web</small></span><span class="sem rojo">Agotado</span></li>
            <li><span class="lp-fila-ico">${ico.cadena}</span><span><b>Cadena nacional B</b><small>Fase 1 · web</small></span><span class="sem rojo">Agotado</span></li>
            <li class="si"><span class="lp-fila-ico">${ico.tienda}</span><span><b>Farmacia Lupita</b><small>Fase 2 · llamada · a 350 m</small></span><span class="lp-precio">$390</span></li>
            <li><span class="lp-fila-ico">${ico.whatsapp}</span><span><b>Botica San Juan</b><small>Fase 2 · WhatsApp</small></span><span class="sem ambar">Preguntando</span></li>
          </ul>
          <div class="lp-generico">${ico.pildora}<span><b>Genérico sugerido</b><small>Mismo principio activo: glargina</small></span></div>
        </div>
      </div>
      <div class="lp-flota f1"><span class="lp-onda"><i></i><i></i><i></i><i></i><i></i></span><span><b>Llamando a la farmacia</b><small>Agente de voz</small></span></div>
      <div class="lp-flota f2">${ico.whatsapp}<span><b>«Sí la tengo, $390»</b><small>Confirmado por WhatsApp</small></span></div>
    </div>
  </div>

  <div class="ancho">
    <dl class="lp-stats">
      ${stats.map(([v, t, n]) => `<div class="revela"><dt${n ? ` data-cuenta="${n}"` : ''}>${v}</dt><dd>${t}</dd></div>`).join('')}
    </dl>
  </div>
</section>

<section class="lp-franja" aria-label="Dónde buscamos">
  <div class="ancho lp-franja-in">
    <span class="lp-franja-tit">Buscamos en</span>
    ${cadenas.map((n) => `<span class="lp-marca">${ico.cadena} ${esc(n)}</span>`).join('')}
    <span class="lp-marca barrio">${ico.tienda} las farmacias de tu colonia</span>
  </div>
</section>

<section class="lp-seccion" id="problema">
  <div class="ancho">
    <header class="lp-cab revela"><p class="lp-sobre">El problema</p>
      <h2>Ir de farmacia en farmacia no debería ser parte del tratamiento.</h2>
      <p class="sub">El desabasto de medicamentos para diabetes, hipertensión, cáncer y salud mental obliga a miles de familias a recorrer la ciudad, o a caer en el mercado negro.</p></header>
    <div class="lp-problemas">
      <article class="lp-problema revela"><span class="lp-ico rojo">${ico.cadena}</span><h3>Inventarios en silos</h3><p>Cada cadena ve solo lo suyo. Nadie cruza la información para el paciente.</p></article>
      <article class="lp-problema revela"><span class="lp-ico ambar">${ico.tienda}</span><h3>El barrio no aparece en internet</h3><p>Las farmacias independientes no tienen tienda en línea, pero muchas veces tienen justo lo que las cadenas ya agotaron.</p></article>
      <article class="lp-problema revela"><span class="lp-ico gris">${ico.reloj}</span><h3>Horas perdidas</h3><p>Llamar una por una, recorrer la ciudad bajo el sol… cuando el tratamiento no puede esperar.</p></article>
    </div>
  </div>
</section>

<section class="lp-seccion suave" id="como-funciona">
  <div class="ancho">
    <header class="lp-cab revela"><p class="lp-sobre">Cómo funciona</p>
      <h2>Un buscador con respaldo en dos fases.</h2>
      <p class="sub">Empezamos por lo más rápido y, si no alcanza, salimos a preguntar a la calle por ti.</p></header>
    <ol class="lp-pasos">
      ${paso('01', ico.cadena, 'Fase 1 · segundos', 'Grandes cadenas en vivo', 'Leemos en tiempo real el precio y la existencia en las webs de las cadenas y te lo mostramos con un semáforo.')}
      ${paso('02', ico.telefono, 'Fase 2 · voz', 'Llamamos por ti', 'Si las cadenas están agotadas, un agente de voz llama a la farmacia de barrio más cercana y le pregunta al boticario si la tiene y a qué precio.', 'destacado')}
      ${paso('03', ico.whatsapp, 'Fase 2 · WhatsApp', 'Red de la colonia', 'Al mismo tiempo, las farmacias registradas de tu zona reciben una alerta y confirman con un toque o un mensaje.')}
      ${paso('04', ico.pildora, 'Siempre', 'Genéricos más baratos', 'Identificamos el principio activo de tu medicina y te sugerimos genéricos bioequivalentes. Consulta siempre a tu médico.')}
    </ol>
    <div class="lp-semaforo revela" aria-label="Qué significa cada color">
      <div><span class="lp-luz-chica verde"></span><b>Verde</b> la encontramos, con farmacia y precio.</div>
      <div><span class="lp-luz-chica ambar"></span><b>Ámbar</b> seguimos buscando y preguntando.</div>
      <div><span class="lp-luz-chica rojo"></span><b>Rojo</b> agotada en todas las que respondieron.</div>
      <p>Se actualiza solo, sin recargar la página. Si dejas tu WhatsApp, te avisamos.</p>
    </div>
  </div>
</section>

<section class="lp-seccion" id="farmacias">
  <div class="ancho lp-dos">
    <div class="revela">
      <p class="lp-sobre">Para farmacias de barrio</p>
      <h2>Los pacientes de tu colonia ya te están buscando.</h2>
      <p class="sub">Regístrate en 10 segundos y recibe a quien busca lo que tú tienes en el mostrador. Sin página web, sin aplicaciones y sin comisiones.</p>
      <ul class="lp-lista">
        <li><span>${ico.whatsapp}</span><div><b>Te avisamos al momento</b>Por WhatsApp o con una llamada cuando alguien busca una medicina cerca.</div></li>
        <li><span>${ico.ok}</span><div><b>Contestas con un toque</b>«Sí la tengo» y tu precio, desde tu teléfono.</div></li>
        <li><span>${ico.pin}</span><div><b>El paciente llega a tu mostrador</b>Le mostramos tu farmacia en el mapa con su ruta.</div></li>
      </ul>
      <div class="lp-botones">
        <a class="boton primario grande" href="/farmacias/registro">${ico.tienda} Registrar mi farmacia</a>
        <a class="boton grande" href="/f">Ya estoy registrada</a>
      </div>
    </div>
    <div class="lp-telefono revela" aria-hidden="true">
      <div class="lp-tel-cab"><span class="logo">${ico.radar}</span><div><b>FarmaRadar</b><small>en línea</small></div></div>
      <div class="lp-tel-chat">
        <div class="burbuja entra"><b>FarmaRadar</b>Hola, Farmacia Lupita. Un paciente a 350 m busca <b>Insulina glargina</b>. ¿La tienes?</div>
        <div class="burbuja sale">Sí, tengo una caja. $390</div>
        <div class="burbuja entra">¡Gracias! Ya le avisamos al paciente. Va para allá.</div>
      </div>
    </div>
  </div>
</section>

<section class="lp-seccion oscura" id="tecnologia">
  <div class="ancho">
    <header class="lp-cab revela"><p class="lp-sobre">La tecnología</p>
      <h2>Cinco piezas conectadas en tiempo real.</h2>
      <p class="sub">Cada una se enciende en cuanto está lista; mientras, las farmacias contestan desde su panel o su enlace y el radar sigue funcionando.</p></header>
    <div class="lp-apis">${apis.map((a) => api(a, iconoApi[a.id] ?? ico.rayo)).join('')}</div>
  </div>
</section>

<section class="lp-seccion" id="preguntas">
  <div class="ancho lp-angosto">
    <header class="lp-cab centro revela"><p class="lp-sobre">Preguntas frecuentes</p><h2>Lo que nos preguntan</h2></header>
    ${pregunta('¿Cuánto cuesta?', 'Para pacientes es gratis y no necesitas registrarte. Para las farmacias de barrio también: sin comisiones por paciente.')}
    ${pregunta('¿FarmaRadar vende medicamentos?', 'No. Te decimos dónde hay y a qué precio; la compra la haces directo en la farmacia, con tu receta cuando la pida.')}
    ${pregunta('¿De dónde salen los precios?', 'De las webs de las cadenas en el momento de tu búsqueda y de lo que contesta cada boticario. Nunca inventamos un precio: si no lo sabemos, no lo mostramos.')}
    ${pregunta('¿Qué hacen con mi WhatsApp?', 'Solo lo usamos para avisarte cuando una farmacia confirma que tiene tu medicina. Es opcional.')}
    ${pregunta('¿Puedo cambiar a un genérico?', 'Te mostramos genéricos bioequivalentes con el mismo principio activo como orientación. Antes de cambiar, consulta a tu médico o farmacéutico.')}
    ${pregunta('Tengo una farmacia, ¿cómo me sumo?', 'Entra a <a href="/farmacias/registro">farmaradar.lat/farmacias/registro</a>, pon tu nombre, teléfono y dirección, y listo: recibes tu enlace privado para contestar.')}
  </div>
</section>

<section class="lp-final">
  <div class="ancho lp-final-in revela">
    <h2>Rompemos los silos, digitalizamos al boticario y acercamos la medicina al paciente.</h2>
    <p>Empieza ahora: escribe tu medicina y tu colonia.</p>
    ${buscador('final')}
  </div>
</section>
</main>
${pie}`,
  });
}
