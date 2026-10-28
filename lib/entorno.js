/**
 * Carga el .env del proyecto antes que nada (lo que ya venga en el entorno, como PORT, manda).
 * Se importa primero en server.js para que la base de datos ya vea DB_*.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

try { process.loadEnvFile(join(RAIZ, '.env')); } catch { /* sin .env */ }

/** La dirección pública, sin barra final (para los enlaces que salen por WhatsApp o por voz). */
export const urlPublica = () => String(process.env.URL_PUBLICA || 'https://farmaradar.lat').replace(/\/+$/, '');
