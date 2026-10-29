/**
 * La landing de farmaradar.lat: simple y directa. Portada con buscador, voz y el radar; tres pasos; farmacias; cierre.
 */
import { pagina, cabeceraPublica, pie, ico } from '../lib/vistas.js';
import * as integraciones from '../lib/integraciones.js';

// El radar del hero. Las posiciones (ángulo, distancia y el momento en que el barrido pasa por cada punto)
// están en estilos.css como clases .rv-1 … .rv-8: la CSP no deja estilos en línea.
export function radar() {
  const p = (clase, n) => `<b class="rv-punto ${clase} rv-${n}"></b>`;
  const t = (clase, n, html) => `<div class="rv-tarjeta ${clase} rv-${n}">${html}</div>`;
  return `<div class="rv">
    <div class="rv-disco">
      <i class="rv-anillo a1"></i><i class="rv-anillo a2"></i><i class="rv-anillo a3"></i><i class="rv-anillo a4"></i>
      <i class="rv-eje h"></i><i class="rv-eje v"></i>
      <span class="rv-barrido"></span>
      ${p('gris', 1)}${p('gris', 2)}${p('gris', 3)}${p('gris', 4)}
      ${p('rojo', 5)}${p('rojo', 6)}${p('ambar', 7)}${p('verde', 8)}
      <span class="rv-yo">${ico.pin}<small>Tú</small></span>
    </div>
    ${t('arriba rojo', 5, `${ico.cadena}<span><b>Gran cadena</b><small>Fase 1 · web</small></span><em class="sem rojo">Agotado</em>`)}
    ${t('arriba verde', 8, `${ico.tienda}<span><b>Farmacia Lupita</b><small><span class="lp-onda"><i></i><i></i><i></i><i></i><i></i></span>Por voz · a 350 m</small></span><em class="rv-precio">$390</em>`)}
    <div class="rv-resultado"><span class="rv-luz"></span><span><small>Insulina glargina · Col. Roma Norte</small><b>¡La encontramos!</b></span></div>
  </div>`;
}

export async function landing() {
  const voz = integraciones.configurada('elevenlabs');
  const paso = (n, titulo, txt, marca) => `<li class="m-paso"><span class="m-n">${n}</span><h3>${titulo}</h3><p>${txt}</p><small>${marca}</small></li>`;

  return pagina({
    titulo: 'FarmaRadar · Encuentra tu medicina',
    descripcion: 'FarmaRadar busca tu medicina en las cadenas al momento y, si no la tienen, le pregunta por ti a las farmacias de tu colonia. Gratis y sin registro.',
    clase: 'landing m',
    scripts: ['landing.js', 'asistente.js'],
    cuerpo: `${cabeceraPublica()}
<main>
<section class="m-hero">
  <div class="ancho m-hero-in">
    <div class="m-hero-txt">
      <p class="m-chip"><span class="m-punto"></span>Gratis · sin registro</p>
      <h1>Tu medicina,<br><span>encontrada.</span></h1>
      <p class="m-lead">Buscamos en las cadenas al momento. Si no la tienen, le preguntamos por ti a las farmacias de tu colonia.</p>
      <form class="m-buscar" action="/buscar" method="get" role="search" aria-label="Buscar medicina">
        <label class="m-campo m-med">${ico.pildora}<span class="sr">Medicina</span><input name="m" placeholder="¿Qué medicina?" autocomplete="off" required maxlength="160"></label>
        <label class="m-campo m-zona">${ico.pin}<span class="sr">Colonia o código postal</span><input name="z" placeholder="Colonia o C.P." autocomplete="off" maxlength="160"></label>
        <button class="boton primario m-ir" type="submit" aria-label="Buscar">${ico.buscar}<span>Buscar</span></button>
      </form>
      ${voz ? `<button type="button" class="m-voz" data-asistente>${ico.micro}<span>O dilo con tu voz</span></button>` : ''}
    </div>
    <div class="m-hero-vis" aria-hidden="true">${radar()}</div>
  </div>
</section>

<section class="m-seccion" id="como-funciona">
  <div class="ancho">
    <h2 class="m-h2">Así funciona</h2>
    <ol class="m-pasos">
      ${paso('01', 'Cadenas en segundos', 'Leemos sus tiendas en línea: producto, precio y existencia reales.', 'Firecrawl')}
      ${paso('02', 'El barrio, con voz', 'Si está agotada, el boticario de tu colonia escucha la pregunta y contesta hablando.', 'ElevenLabs')}
      ${paso('03', 'Verde y en el mapa', 'Ves quién la tiene, a qué precio y cómo llegar.', 'Google Maps')}
    </ol>
  </div>
</section>

<section class="m-seccion m-cita">
  <div class="ancho">
    <p>«La farmacia de la esquina sí la tenía.<br><span>Ahora lo sabes.»</span></p>
  </div>
</section>

<section class="m-seccion" id="farmacias">
  <div class="ancho m-farmacias">
    <div>
      <h2 class="m-h2">¿Tienes una farmacia de barrio?</h2>
      <p class="m-lead">Recibe a los pacientes de tu colonia. Contestas hablando o con un toque. Sin apps y sin comisiones.</p>
    </div>
    <div class="m-acciones">
      <a class="boton primario grande" href="/farmacias/registro">Registrar mi farmacia</a>
      <a class="boton grande m-sutil" href="/f">Ya estoy registrada</a>
    </div>
  </div>
</section>

<section class="m-seccion m-final">
  <div class="ancho">
    <h2>Rompemos los silos.<br>Acercamos la medicina.</h2>
    <div class="m-acciones centro">
      <a class="boton primario grande" href="/buscar">${ico.buscar} Buscar mi medicina</a>
      <a class="boton grande m-sutil" href="/presentacion">Ver la presentación</a>
    </div>
  </div>
</section>
</main>
${pie}`,
  });
}
