/**
 * Farmacias de demostración: para que el radar tenga farmacias de barrio en cualquier lugar.
 *  - Se crean alrededor de un punto (calles reales de la zona, nombres inventados) y se marcan «Demo».
 *  - No tienen teléfono: nunca reciben llamadas ni WhatsApp.
 *  - Cuando un paciente pide la fase 2, contestan solas tras unos segundos (unas sí, otras no).
 * Se borran todas desde Panel → Farmacias.
 */
import { db } from './db.js';
import { reverso } from './geo.js';
import { distanciaKm } from './util.js';

const NOMBRES = ['Lupita', 'San Judas', 'del Carmen', 'La Esperanza', 'Santa Rita', 'San José', 'La Guadalupana', 'del Parque',
  'Santa Cruz', 'La Salud', 'San Rafael', 'El Roble', 'Santa Teresa', 'Vida', 'del Sol', 'San Martín', 'La Providencia',
  'Don Chema', 'Las Rosas', 'El Buen Pastor', 'La Fe', 'del Mercado', 'La Paz', 'Santa Mónica', 'San Antonio', 'Bienestar',
  'Doña Mary', 'Los Ángeles', 'San Francisco', 'La Victoria', 'El Refugio', 'Santa Clara', 'del Pueblo', 'Santo Niño',
  'La Luz', 'San Pedro', 'La Familia', 'El Pocito', 'Medina', 'Aurora', 'Del Bosque', 'San Miguel', 'Los Pinos', 'Esmeralda'];
const TIPOS = ['Farmacia', 'Farmacia', 'Farmacia', 'Botica', 'Farmacia y Consultorio', 'Droguería'];

const azar = (a, b) => a + Math.random() * (b - a);
const uno = (l) => l[Math.floor(Math.random() * l.length)];

/** Un punto a `km` en dirección `grados` desde (lat, lng). */
function mueve(lat, lng, km, grados) {
  const r = (grados * Math.PI) / 180;
  return { lat: lat + (km / 111.32) * Math.cos(r), lng: lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(r) };
}

/** Crea `n` farmacias de demostración alrededor de un punto. → cuántas creó */
export async function creaAlrededor({ lat, lng, colonia = '', cp = '', ciudad = '' }, n = 5, { minKm = 0.25, maxKm = 2.5 } = {}) {
  let hechas = 0;
  for (let i = 0; i < n; i++) {
    const p = mueve(lat, lng, azar(minKm, maxKm), (360 / n) * i + azar(-25, 25));
    const g = await reverso(p.lat, p.lng);
    const calle = g?.calle || 'Calle principal';
    const nombre = `${uno(TIPOS)} ${uno(NOMBRES)}`;
    await db.ejecutar(
      `INSERT INTO farmacias (nombre, responsable, telefono, whatsapp, direccion, colonia, cp, ciudad, lat, lng, acepta_llamadas, acepta_whatsapp, activa, demo)
       VALUES (?, 'Demostración', '', '', ?, ?, ?, ?, ?, ?, 0, 0, 1, 1)`,
      [nombre, `${calle} ${Math.floor(azar(10, 990))}`, (g?.colonia || colonia || '').slice(0, 120), (g?.cp || cp || '').slice(0, 5),
        (g?.ciudad || ciudad || '').slice(0, 120), g?.lat ?? p.lat, g?.lng ?? p.lng]);
    hechas++;
  }
  return hechas;
}

/** Si no hay ninguna farmacia en `radioKm` del punto, crea unas de demostración. */
export async function aseguraCerca(punto, radioKm = 10) {
  if (punto?.lat == null || punto?.lng == null) return 0;
  const todas = await db.todos('SELECT lat, lng FROM farmacias WHERE activa = 1 AND lat IS NOT NULL');
  if (todas.some((f) => (distanciaKm(punto, f) ?? 99) <= radioKm)) return 0;
  const { n } = await db.uno('SELECT COUNT(*) AS n FROM farmacias WHERE demo = 1');
  if (Number(n) >= 3000) return 0; // tope: que nadie llene la base buscando en mil lugares
  return creaAlrededor(punto, 5);
}

/** Precio de referencia: lo que dieron las cadenas (si hay); si no, uno estable según la medicina. */
async function referencia(busquedaId, medicamento) {
  const p = (await db.todos("SELECT precio FROM resultados_cadena WHERE busqueda_id = ? AND precio IS NOT NULL AND estado = 'disponible'", [busquedaId]))
    .map((x) => Number(x.precio)).sort((a, b) => a - b);
  if (p.length) return p[Math.floor((p.length - 1) / 2)];
  let h = 0;
  for (const c of String(medicamento)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return 150 + (h % 750);
}
const redondea = (n) => Math.max(25, Math.round(n / 5) * 5);

/**
 * Las de demostración contestan solas. La más cercana «contesta por voz» y siempre la tiene (para que la
 * demo termine en verde); las demás: unas sí, otras no, y alguna no contesta.
 */
export function contestanSolas(busqueda, filas, responde) {
  const demos = filas.filter(({ f }) => f.demo);
  if (!demos.length) return;
  referencia(busqueda.id, busqueda.medicamento).then((base) => {
    demos.forEach(({ f, t }, i) => {
      const primera = i === 0;
      const r = Math.random();
      if (!primera && r < 0.2) return; // no contesta
      const tiene = primera || r < 0.55;
      const precio = tiene ? redondea(base * azar(0.72, 1.02)) : null;
      setTimeout(() => {
        responde(t, primera
          ? { tiene, precio, canal: 'llamada', nota: 'Farmacia de demostración', transcripcion: `Sí, sí la tengo. Se la dejo en ${precio} pesos.` }
          : { tiene, precio, canal: 'panel', nota: 'Farmacia de demostración' }).catch(() => {});
      }, primera ? azar(5000, 8000) : azar(4000, 28000));
    });
  }).catch(() => {});
}
