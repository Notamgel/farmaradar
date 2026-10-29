/**
 * El video de FarmaRadar (la presentación grabada con su voz): farmaradar.lat/video para verlo y
 * farmaradar.lat/video/FarmaRadar.mp4 para descargarlo. Sirve por rangos (Safari y el iPhone lo necesitan).
 */
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { html } from '../lib/http.js';
import { ico, logo } from '../lib/vistas.js';

const ARCHIVO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'presentacion', 'FarmaRadar.mp4');

async function mp4(req, res, descarga) {
  let s;
  try { s = await stat(ARCHIVO); } catch { return false; }
  const base = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600',
    ...(descarga ? { 'Content-Disposition': 'attachment; filename="FarmaRadar.mp4"' } : {}) };
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (rango) {
    let ini = rango[1] === '' ? s.size - Number(rango[2]) : Number(rango[1]);
    let fin = rango[1] !== '' && rango[2] !== '' ? Number(rango[2]) : s.size - 1;
    if (ini < 0 || ini >= s.size || fin < ini) { res.writeHead(416, { 'Content-Range': `bytes */${s.size}` }); return res.end(); }
    fin = Math.min(fin, s.size - 1);
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${ini}-${fin}/${s.size}`, 'Content-Length': fin - ini + 1 });
    return createReadStream(ARCHIVO, { start: ini, end: fin }).pipe(res);
  }
  res.writeHead(200, { ...base, 'Content-Length': s.size });
  createReadStream(ARCHIVO).pipe(res);
}

const pagina = () => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>FarmaRadar · Video</title>
<meta name="description" content="FarmaRadar en 2 minutos: la red contra el desabasto de medicamentos.">
<meta property="og:title" content="FarmaRadar en 2 minutos">
<meta property="og:video" content="https://farmaradar.lat/video/FarmaRadar.mp4">
<meta name="theme-color" content="#04201c">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/estilos.css">
<style>
  body { margin: 0; min-height: 100dvh; background: radial-gradient(ellipse at 50% 0%, #0b3a33, #020f0d 70%); color: #e6f2ef; display: grid; place-items: center; }
  .v { width: min(100% - 32px, 1100px); display: grid; gap: 18px; padding: 28px 0; }
  .v-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .v-cab .marca-txt { color: #fff; font-size: 1.3rem; }
  .v h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.4rem); letter-spacing: -.02em; color: #fff; }
  .v p { margin: 0; color: #a7c9c1; }
  video { width: 100%; aspect-ratio: 16 / 9; border-radius: 18px; background: #000; box-shadow: 0 30px 80px rgb(0 0 0 / .5); }
  .v-botones { display: flex; gap: 10px; flex-wrap: wrap; }
  .v-botones .boton { text-decoration: none; }
  .v-botones .claro { background: transparent; color: #e6f2ef; border-color: rgb(255 255 255 / .25); }
</style>
</head>
<body>
<main class="v">
  <div class="v-cab"><a class="marca" href="/">${logo}</a><span>farmaradar.lat</span></div>
  <h1>FarmaRadar en 2 minutos</h1>
  <p>La red contra el desabasto de medicamentos: cadenas con Firecrawl, farmacias de barrio con la voz de ElevenLabs y todo en Google Maps.</p>
  <video controls playsinline preload="metadata" poster="/static/presentacion/resultado.png" src="/video/FarmaRadar.mp4"></video>
  <div class="v-botones">
    <a class="boton primario grande" href="/video/FarmaRadar.mp4?descargar=1" download="FarmaRadar.mp4">${ico.flecha} Descargar el video (MP4)</a>
    <a class="boton grande claro" href="/presentacion">Ver la presentación interactiva</a>
    <a class="boton grande claro" href="/">Probar FarmaRadar</a>
  </div>
</main>
</body>
</html>`;

export default function rutas(r) {
  r.get('/video', (req, res) => html(res, pagina()));
  r.get('/video/FarmaRadar.mp4', (req, res, { q }) => mp4(req, res, q.get('descargar') === '1'));
}
