/**
 * MySQL (base propia: farmaradar). Lo mismo en todo el código:
 *   todos(sql, params) → filas · uno(sql, params) → fila o null · ejecutar(sql, params) → { id, cambios }
 */
import mysql from 'mysql2/promise';

if (!process.env.DB_USER) {
  console.error('Falta la base de datos: pon DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en el .env');
  process.exit(1);
}

const limpiar = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmaradar',
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 10,
  timezone: 'Z',
});
// Todas las fechas en UTC (CURRENT_TIMESTAMP y UTC_TIMESTAMP iguales); se muestran en hora de México.
pool.pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));

export const db = {
  async todos(sql, p = []) { const [r] = await pool.query(sql, limpiar(p)); return r; },
  async uno(sql, p = []) { const [r] = await pool.query(sql, limpiar(p)); return r[0] ?? null; },
  async ejecutar(sql, p = []) {
    const [r] = await pool.query(sql, limpiar(p));
    return { id: Number(r.insertId) || 0, cambios: Number(r.affectedRows) || 0 };
  },
  cerrar: () => pool.end(),
};
