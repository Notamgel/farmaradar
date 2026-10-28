/**
 * Lo mínimo de HTTP sin framework: rutas con parámetros, cuerpo (JSON o formulario), cookies,
 * respuestas con cabeceras de seguridad y archivos de public/.
 */
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { RAIZ } from './entorno.js';

const PUBLIC = join(RAIZ, 'public');
const TIPOS = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

/* Leaflet (mapa) y sus mosaicos de OpenStreetMap son lo único de fuera. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com",
  "style-src 'self' https://cdnjs.cloudflare.com",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

export function cabeceras(extra = {}) {
  return {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    ...extra,
  };
}

export function html(res, cuerpo, status = 200, extra = {}) {
  res.writeHead(status, cabeceras({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra }));
  res.end(cuerpo);
}

export function json(res, datos, status = 200, extra = {}) {
  res.writeHead(status, cabeceras({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }));
  res.end(JSON.stringify(datos));
}

export function redirige(res, a, extra = {}) {
  res.writeHead(303, cabeceras({ Location: a, 'Cache-Control': 'no-store', ...extra }));
  res.end();
}

export function ipDe(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

export function cookies(req) {
  const out = {};
  for (const par of String(req.headers.cookie ?? '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}

export function cookie(nombre, valor, { maxAge = null, borrar = false } = {}) {
  const partes = [`${nombre}=${borrar ? '' : encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') partes.push('Secure');
  if (borrar) partes.push('Max-Age=0');
  else if (maxAge) partes.push(`Max-Age=${maxAge}`);
  return partes.join('; ');
}

/** Cuerpo de la petición (hasta 64 KB): JSON o formulario. */
export async function cuerpo(req, tope = 64 * 1024) {
  const trozos = [];
  let n = 0;
  for await (const t of req) {
    n += t.length;
    if (n > tope) { const e = new Error('demasiado grande'); e.status = 413; throw e; }
    trozos.push(t);
  }
  const txt = Buffer.concat(trozos).toString('utf8');
  const tipo = String(req.headers['content-type'] ?? '');
  if (tipo.includes('application/json')) {
    try { return JSON.parse(txt || '{}'); } catch { const e = new Error('JSON no válido'); e.status = 400; throw e; }
  }
  return Object.fromEntries(new URLSearchParams(txt));
}

/**
 * Un POST que cambia algo debe venir de esta misma página (Origin o Referer con nuestro host).
 * Los webhooks no pasan por aquí: van con su secreto.
 */
export function mismoOrigen(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const o = req.headers.origin || req.headers.referer;
  if (!o) return false;
  try { return new URL(o).host === host; } catch { return false; }
}

/** Archivos de public/ (solo de ahí, sin listados ni rutas que salgan). */
export async function estatico(req, res, ruta) {
  const rel = normalize(decodeURIComponent(ruta)).replace(/^([/\\])+/, '');
  if (rel.includes('..') || rel.startsWith('.')) return false;
  const archivo = join(PUBLIC, rel);
  if (!archivo.startsWith(PUBLIC)) return false;
  try {
    const s = await stat(archivo);
    if (!s.isFile()) return false;
    res.writeHead(200, cabeceras({ 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=300' }));
    res.end(await readFile(archivo));
    return true;
  } catch { return false; }
}

/** Enrutador con `:param`. */
export class Rutas {
  constructor() { this.lista = []; }
  agrega(metodo, patron, fn) {
    const nombres = [];
    const re = new RegExp('^' + patron.replace(/:([a-zA-Z]+)/g, (_, n) => { nombres.push(n); return '([^/]+)'; }) + '/?$');
    this.lista.push({ metodo, re, nombres, fn });
  }
  get(p, fn) { this.agrega('GET', p, fn); }
  post(p, fn) { this.agrega('POST', p, fn); }
  busca(metodo, ruta) {
    for (const r of this.lista) {
      if (r.metodo !== metodo && !(metodo === 'HEAD' && r.metodo === 'GET')) continue;
      const m = r.re.exec(ruta);
      if (m) return { fn: r.fn, params: Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}
