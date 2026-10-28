/**
 * Contraseñas (scrypt), tokens, sesiones en la base y frenos por IP.
 */
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptP = promisify(scrypt);

export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const tokenHex = (bytes = 16) => randomBytes(bytes).toString('hex');
export const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');

export async function hashClave(clave) {
  const sal = randomBytes(16);
  const h = await scryptP(String(clave), sal, 64);
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}

export async function claveCorrecta(clave, guardado) {
  const [tipo, salHex, hHex] = String(guardado ?? '').split('$');
  if (tipo !== 'scrypt' || !salHex || !hHex) return false;
  const h = await scryptP(String(clave), Buffer.from(salHex, 'hex'), 64);
  const esperado = Buffer.from(hHex, 'hex');
  return esperado.length === h.length && timingSafeEqual(esperado, h);
}

/** Compara dos textos en tiempo constante (para el secreto de los webhooks). */
export function iguales(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/**
 * Freno por clave (IP + acción): `max` intentos en `ventanaMs`. En memoria: basta para un solo proceso.
 * → true si todavía puede.
 */
const cubetas = new Map();
export function permite(clave, max, ventanaMs) {
  const ahora = Date.now();
  const c = cubetas.get(clave);
  if (!c || ahora - c.desde > ventanaMs) { cubetas.set(clave, { desde: ahora, n: 1 }); return true; }
  c.n += 1;
  return c.n <= max;
}
setInterval(() => {
  const ahora = Date.now();
  for (const [k, c] of cubetas) if (ahora - c.desde > 6 * 3600_000) cubetas.delete(k);
}, 600_000).unref();
