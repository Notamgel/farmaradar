/**
 * La presentación de FarmaRadar: farmaradar.lat/presentacion (con voz de ElevenLabs) y farmaradar.lat/presentacion.pdf.
 * Cada diapositiva tiene su narración: el texto está aquí (`voz`) y su audio en public/presentacion/voz-N.mp3
 * (se generan con `node scripts/voz-presentacion.mjs`).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ico, logo } from '../lib/vistas.js';
import { esc } from '../lib/util.js';
import { html } from '../lib/http.js';
import { radar } from './landing.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DIAPOSITIVAS = [
  {
    clase: 'portada',
    voz: 'Esto es FarmaRadar. La red contra el desabasto de medicamentos. Tu medicina, encontrada en minutos. No en días.',
    html: `<div class="d-dos">
      <div>
        <p class="d-insignia"><span class="d-pulso"></span> La red contra el desabasto de medicamentos</p>
        <h1 class="d-gigante">Tu medicina,<br><span class="d-verde">encontrada</span> en minutos.<br>No en días.</h1>
        <p class="d-marca">${logo}</p>
      </div>
      <div class="d-radar">${radar()}</div>
    </div>`,
  },
  {
    clase: 'problema',
    voz: 'Imagina esto. Tu mamá necesita insulina. Vas a una farmacia: no hay. A otra: no hay. A una tercera: tampoco. Y la farmacia de la esquina sí la tenía. Pero nadie lo sabía.',
    html: `<p class="d-sobre">El problema</p>
      <h2 class="d-titulo">«No hay.»<br><span class="d-tenue">«No hay.» «Tampoco.»</span></h2>
      <div class="d-recorrido">
        <div class="d-tienda no">${ico.cadena}<b>Cadena 1</b><span class="sem rojo">No hay</span></div><i class="d-flecha">${ico.flecha}</i>
        <div class="d-tienda no">${ico.cadena}<b>Cadena 2</b><span class="sem rojo">No hay</span></div><i class="d-flecha">${ico.flecha}</i>
        <div class="d-tienda no">${ico.cadena}<b>Cadena 3</b><span class="sem rojo">Agotado</span></div><i class="d-flecha">${ico.flecha}</i>
        <div class="d-tienda si">${ico.tienda}<b>La de la esquina</b><span class="sem verde">¡Sí tenía!</span></div>
      </div>
      <p class="d-remate">Inventarios en silos. Farmacias de barrio invisibles. Horas perdidas cuando el tratamiento no puede esperar.</p>`,
  },
  {
    clase: 'idea',
    voz: 'FarmaRadar es un radar que busca por ti, en dos fases. Primero, las grandes cadenas en segundos. Y si no está, salimos a preguntar a las farmacias de barrio de tu colonia. Con voz.',
    html: `<p class="d-sobre">La solución</p>
      <h2 class="d-titulo">Un radar que busca por ti.</h2>
      <div class="d-fases">
        <article><span class="d-num">1</span>${ico.cadena}<h3>Grandes cadenas</h3><p>Precio y existencia reales, en segundos.</p><em>Firecrawl</em></article>
        <i class="d-flecha grande">${ico.flecha}</i>
        <article class="d-luz"><span class="d-num">2</span>${ico.telefono}<h3>Farmacias de barrio</h3><p>Les preguntamos por ti, con voz. Contestan hablando.</p><em>ElevenLabs</em></article>
        <i class="d-flecha grande">${ico.flecha}</i>
        <article class="d-meta"><span class="d-semaforo"></span><h3>Semáforo en verde</h3><p>Quién la tiene, a qué precio y cómo llegar.</p><em>Google Maps</em></article>
      </div>`,
  },
  {
    clase: 'fase1',
    voz: 'Fase uno. Firecrawl lee en tiempo real las tiendas en línea de las cadenas: el producto exacto, el precio y si hay existencia. Esta es una consulta real: insulina glargina, desde quinientos nueve pesos. En segundos, sin llamar a nadie.',
    html: `<div class="d-dos">
      <div>
        <p class="d-sobre">Fase 1 · Firecrawl</p>
        <h2 class="d-titulo">Las cadenas,<br>en segundos.</h2>
        <p class="d-texto">Leemos sus tiendas en línea al momento: producto exacto, precio y existencia. Nunca inventamos un precio.</p>
      </div>
      <div class="d-tarjeta-app">
        <p class="d-app-cab">${ico.buscar} Insulina glargina <small>consulta real · 28 oct 2026</small></p>
        <ul class="d-filas">
          <li><span class="sem verde">Disponible</span><span><b>Farmacias Guadalajara</b><small>Insulina Glargina 100 UI/ml, 10 ml</small></span><strong>$509.96</strong></li>
          <li><span class="sem verde">Disponible</span><span><b>Farmacias del Ahorro</b><small>Insulina Glargina 100 UI, Marca del Ahorro</small></span><strong>$554</strong></li>
          <li><span class="sem verde">Disponible</span><span><b>Farmacias Benavides</b><small>Lantus 100 UI, 10 ml</small></span><strong>$2,365</strong></li>
        </ul>
        <p class="d-ahorro">Mismo principio activo: <b>hasta $1,855 de diferencia</b>.</p>
      </div>
    </div>`,
  },
  {
    clase: 'fase2',
    voz: 'Fase dos. Si las cadenas no la tienen, entra la voz de ElevenLabs. El boticario de tu colonia escucha la pregunta con una voz natural, y contesta hablando: sí la tengo, a trescientos noventa pesos. Entendemos su respuesta, y tu pantalla se pone en verde.',
    html: `<div class="d-dos">
      <div>
        <p class="d-sobre">Fase 2 · ElevenLabs</p>
        <h2 class="d-titulo">El barrio,<br>con voz.</h2>
        <p class="d-texto">El boticario no necesita apps ni página web: escucha la pregunta y contesta hablando. FarmaRadar entiende si la tiene y a qué precio.</p>
      </div>
      <div class="d-telefono">
        <div class="d-tel-cab">${ico.tienda}<b>Farmacia Lupita</b><small>Polanco</small></div>
        <div class="d-burbuja entra"><span class="d-onda"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>«Un paciente cerca busca <b>insulina glargina</b>. ¿La tiene? ¿A qué precio?»</div>
        <div class="d-burbuja sale">${ico.micro} «Sí, la tengo. Se la dejo en 390.»</div>
        <div class="d-verde-final"><span class="d-semaforo"></span><span><small>Pantalla del paciente</small><b>¡La encontramos! · $390</b></span></div>
      </div>
    </div>`,
  },
  {
    clase: 'habla',
    voz: 'Y el paciente también puede hablarle a FarmaRadar. Le dice qué busca y en dónde, y FarmaRadar le contesta con voz: qué encontró, a qué precio, y quién lo tiene cerca. Sin escribir nada. Ideal para adultos mayores.',
    html: `<div class="d-dos">
      <div>
        <p class="d-sobre">Háblale a FarmaRadar</p>
        <h2 class="d-titulo">Sin escribir<br>nada.</h2>
        <p class="d-texto">Dices qué buscas y dónde. FarmaRadar te contesta con voz y pregunta por ti. Pensado para quien no se lleva con las pantallas.</p>
      </div>
      <div class="d-asis">
        <div class="d-orbe"><i></i><i></i><b></b></div>
        <ol>
          <li class="tu">Busco insulina glargina en Polanco</li>
          <li class="farma">Encontré insulina glargina en 3 cadenas. La más barata, a 509 pesos. ¿Quieres que les pregunte a las farmacias de barrio cerca de ti?</li>
          <li class="tu">Sí, por favor</li>
          <li class="farma">¡Buenas noticias! Una farmacia en Polanco sí la tiene, a 470 pesos. Te la marqué en el mapa.</li>
        </ol>
      </div>
    </div>`,
  },
  {
    clase: 'el-mapa',
    voz: 'Todo termina en un mapa de Google: el semáforo de cada farmacia, su precio y el botón para llegar. Hoy ya funciona en todo México, con una red de prueba en treinta y cinco ciudades.',
    html: `<div class="d-dos">
      <div>
        <p class="d-sobre">El resultado</p>
        <h2 class="d-titulo">Quién la tiene,<br>cuánto cuesta<br>y cómo llegar.</h2>
        <ul class="d-lista">
          <li>${ico.ok} Semáforo en vivo, sin recargar</li>
          <li>${ico.pin} Google Maps con «Cómo llegar»</li>
          <li>${ico.radar} Funciona en todo México: red de prueba en 35 ciudades</li>
        </ul>
      </div>
      <div class="d-captura"><img src="/static/presentacion/resultado.png" alt="Resultado real de FarmaRadar en un teléfono"></div>
    </div>`,
  },
  {
    clase: 'tecnologia',
    voz: 'Lo construimos con Firecrawl para leer las cadenas, ElevenLabs para la voz, Google Maps para el mapa, y algunos detalles de diseño con Lovable. Y es código abierto.',
    html: `<p class="d-sobre">Cómo está hecho</p>
      <h2 class="d-titulo">Funciona hoy. Y es abierto.</h2>
      <div class="d-tec">
        <article>${ico.cadena}<b>Firecrawl</b><span>Lee precios y existencias de las cadenas en tiempo real.</span></article>
        <article>${ico.micro}<b>ElevenLabs</b><span>Voz natural y voz a texto: pregunta, escucha y entiende.</span></article>
        <article>${ico.pin}<b>Google Maps</b><span>Mapa, ubicación y la ruta a la farmacia.</span></article>
        <article>${ico.corazon}<b>Lovable</b><span>Algunos detalles de diseño de la interfaz.</span></article>
      </div>
      <p class="d-abierto">${ico.llave} Código abierto · <b>github.com/Notamgel/farmaradar</b></p>`,
  },
  {
    clase: 'cierre',
    voz: 'Rompemos los silos, digitalizamos al boticario, y acercamos la medicina al paciente. Pruébalo hoy en farmaradar punto lat.',
    html: `<div class="d-dos">
      <div>
        <h2 class="d-gigante chico">Rompemos los silos.<br>Digitalizamos al boticario.<br><span class="d-verde">Acercamos la medicina.</span></h2>
        <p class="d-url">farmaradar.lat</p>
        <p class="d-texto">Gratis para pacientes · sin registro · con voz</p>
      </div>
      <div class="d-qr"><img src="/static/presentacion/qr.svg" alt="Código QR a farmaradar.lat"><span>Escanéalo y pruébalo</span></div>
    </div>`,
  },
];

function presentacion({ imprimir = false } = {}) {
  const total = DIAPOSITIVAS.length;
  const diapos = DIAPOSITIVAS.map((d, i) => `<section class="diapo ${d.clase}${i === 0 ? ' activa' : ''}" data-n="${i + 1}" data-voz="${esc(d.voz)}" aria-roledescription="diapositiva" aria-label="${i + 1} de ${total}">
    <div class="diapo-in">${d.html}</div>
    <footer class="diapo-pie"><span>${logo}</span><span>farmaradar.lat</span><span>${i + 1} / ${total}</span></footer>
  </section>`).join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>FarmaRadar · Presentación</title>
<meta name="description" content="FarmaRadar en 2 minutos: la red contra el desabasto de medicamentos, con voz.">
<meta name="theme-color" content="#04201c">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/estilos.css">
<link rel="stylesheet" href="/static/presentacion.css">
${imprimir ? '' : '<script src="/static/presentacion.js" defer></script>'}
</head>
<body class="presenta${imprimir ? ' imprimir' : ''}">
<main class="escenario" id="escenario">
  <div class="lienzo" id="lienzo">${diapos}</div>
</main>
${imprimir ? '' : `<div class="inicio" id="inicio">
  <div class="inicio-caja">
    <p class="inicio-marca">${logo}</p>
    <h1>FarmaRadar en 2 minutos</h1>
    <p>La red contra el desabasto de medicamentos.</p>
    <button type="button" class="boton primario grande" id="con-voz">${ico.bocina} Ver con voz</button>
    <button type="button" class="boton grande inicio-sin" id="sin-voz">Ver sin voz</button>
    <p class="inicio-ayuda">Usa ← → o desliza para cambiar · Espacio para pausar</p>
  </div>
</div>
<div class="subtitulo" id="subtitulo" aria-live="polite"></div>
<nav class="controles" id="controles" aria-label="Controles de la presentación">
  <button type="button" data-accion="anterior" aria-label="Anterior">${ico.flecha}</button>
  <button type="button" data-accion="voz" class="voz-boton" aria-label="Reproducir o pausar la voz">${ico.bocina}<span>Pausar</span></button>
  <div class="puntos">${DIAPOSITIVAS.map((_, i) => `<button type="button" data-ir="${i}" aria-label="Ir a la diapositiva ${i + 1}"></button>`).join('')}</div>
  <button type="button" data-accion="siguiente" aria-label="Siguiente">${ico.flecha}</button>
  <button type="button" data-accion="subtitulos" aria-label="Subtítulos">CC</button>
  <button type="button" data-accion="pantalla" aria-label="Pantalla completa">${ico.panel}</button>
  <a href="/presentacion.pdf" download="FarmaRadar.pdf" aria-label="Descargar PDF">PDF</a>
  <div class="barra"><i id="progreso"></i></div>
</nav>`}
</body>
</html>`;
}

export default function rutas(r) {
  r.get('/presentacion', (req, res, { q }) => {
    html(res, presentacion({ imprimir: q.get('imprimir') === '1' }));
  });
  r.get('/presentacion.pdf', async (req, res) => {
    try {
      const pdf = await readFile(join(RAIZ, 'public', 'presentacion', 'FarmaRadar.pdf'));
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="FarmaRadar.pdf"', 'Content-Length': pdf.length, 'Cache-Control': 'public, max-age=300' });
      res.end(pdf);
    } catch { return false; }
  });
}
