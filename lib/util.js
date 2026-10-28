import { randomBytes } from 'node:crypto';

/** Escapa texto para HTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Minúsculas, sin acentos ni signos (para comparar colonias). */
export const normaliza = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Texto limpio de un formulario, con tope. */
export const texto = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Id público de 16 caracteres (no se puede adivinar). */
export const idPublico = () => randomBytes(12).toString('base64url').slice(0, 16);

export const coord = (v, max) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e6) / 1e6 : null;
};

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(a, b) {
  if ([a?.lat, a?.lng, b?.lat, b?.lng].some((x) => x === null || x === undefined)) return null;
  const R = 6371, rad = (x) => (Number(x) * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const pesos = (n) => (n === null || n === undefined ? '' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

export const fecha = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
