/**
 * Sesiones en la base: del equipo (panel) y de cada farmacia (su panel). Cookie HttpOnly con un token
 * cuyo sha256 es lo único que se guarda.
 */
import { db } from './db.js';
import { token, sha256 } from './seguridad.js';
import { cookies, cookie } from './http.js';

const NOMBRE = { equipo: 'fr_equipo', farmacia: 'fr_farmacia' };
const DURA = { equipo: 12 * 3600, farmacia: 60 * 24 * 3600 };

export async function abre(tipo, refId) {
  const t = token(32);
  await db.ejecutar('INSERT INTO sesiones (token_hash, tipo, ref_id, expira) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND)',
    [sha256(t), tipo, refId, DURA[tipo]]);
  return cookie(NOMBRE[tipo], t, { maxAge: DURA[tipo] });
}

export async function de(req, tipo) {
  const t = cookies(req)[NOMBRE[tipo]];
  if (!t) return null;
  const s = await db.uno('SELECT ref_id FROM sesiones WHERE token_hash = ? AND tipo = ? AND expira > UTC_TIMESTAMP()', [sha256(t), tipo]);
  return s ? s.ref_id : null;
}

export async function cierra(req, tipo) {
  const t = cookies(req)[NOMBRE[tipo]];
  if (t) await db.ejecutar('DELETE FROM sesiones WHERE token_hash = ?', [sha256(t)]);
  return cookie(NOMBRE[tipo], '', { borrar: true });
}

export async function cierraTodas(tipo, refId) {
  await db.ejecutar('DELETE FROM sesiones WHERE tipo = ? AND ref_id = ?', [tipo, refId]);
}

export const limpiaVencidas = () => db.ejecutar('DELETE FROM sesiones WHERE expira <= UTC_TIMESTAMP()');
