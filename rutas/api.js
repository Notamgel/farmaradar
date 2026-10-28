/**
 * La API del buscador (la usa la pantalla del paciente) y los dos webhooks de vuelta:
 *   POST /api/busquedas                {medicamento, zona, lat?, lng?, whatsapp?} → {id}
 *   GET  /api/busquedas/:id            → lo que ve el paciente (se pregunta cada pocos segundos)
 *   POST /api/busquedas/:id/locales    → fase 2 (una vez)
 *   POST /api/webhooks/n8n             {token, tiene, precio?, nota?}             (X-FarmaRadar-Secreto)
 *   POST /api/webhooks/voz             {token, tiene, precio?, transcripcion?}    (X-FarmaRadar-Secreto)
 */
import { json, cuerpo, mismoOrigen, ipDe } from '../lib/http.js';
import { permite, iguales } from '../lib/seguridad.js';
import { texto, coord } from '../lib/util.js';
import * as busqueda from '../lib/busqueda.js';

const ID = /^[A-Za-z0-9_-]{16}$/;

const aBool = (v) => v === true || v === 1 || ['1', 'true', 'si', 'sí', 'yes'].includes(String(v ?? '').trim().toLowerCase());
const aPrecio = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};

async function webhook(req, res, canal) {
  if (!iguales(req.headers['x-farmaradar-secreto'], process.env.WEBHOOK_SECRETO)) return json(res, { error: 'no permitido' }, 403);
  const b = await cuerpo(req);
  const tokenR = String(b.token ?? '').trim();
  if (!/^[0-9a-f]{32}$/.test(tokenR)) return json(res, { error: 'falta el token de la solicitud' }, 400);
  const r = await busqueda.responde(tokenR, {
    tiene: aBool(b.tiene), precio: aPrecio(b.precio), nota: texto(b.nota, 300) || null,
    transcripcion: b.transcripcion ? String(b.transcripcion).slice(0, 20000) : null, canal,
  });
  if (r.error) return json(res, { error: r.error }, r.status);
  json(res, { ok: true });
}

export default function api(r) {
  r.post('/api/busquedas', async (req, res) => {
    if (!mismoOrigen(req)) return json(res, { error: 'origen no permitido' }, 403);
    if (!permite(`busca:${ipDe(req)}`, 30, 3600_000)) return json(res, { error: 'Demasiadas búsquedas seguidas. Espera un poco.' }, 429);
    const b = await cuerpo(req);
    const medicamento = texto(b.medicamento, 160);
    if (medicamento.length < 3) return json(res, { error: 'Escribe el nombre de la medicina (al menos 3 letras)', campo: 'medicamento' }, 400);
    const zona = texto(b.zona, 160);
    const cp = /^\d{5}$/.test(zona) ? zona : (zona.match(/\b\d{5}\b/)?.[0] ?? '');
    let lat = coord(b.lat, 90), lng = coord(b.lng, 180);
    if (lat === null || lng === null) { lat = null; lng = null; }
    const whatsapp = texto(b.whatsapp, 20).replace(/[^\d+]/g, '');
    if (whatsapp && whatsapp.replace(/\D/g, '').length < 10) return json(res, { error: 'El WhatsApp debe tener 10 dígitos', campo: 'whatsapp' }, 400);
    const id = await busqueda.crea({ medicamento, zona, cp, lat, lng, whatsapp, ip: ipDe(req) });
    json(res, { id }, 201);
  });

  r.get('/api/busquedas/:id', async (req, res, { params }) => {
    if (!ID.test(params.id)) return json(res, { error: 'no existe' }, 404);
    const v = await busqueda.vistaPublica(params.id);
    if (!v) return json(res, { error: 'no existe' }, 404);
    json(res, v);
  });

  r.post('/api/busquedas/:id/locales', async (req, res, { params }) => {
    if (!mismoOrigen(req)) return json(res, { error: 'origen no permitido' }, 403);
    if (!ID.test(params.id)) return json(res, { error: 'no existe' }, 404);
    if (!permite(`fase2:${ipDe(req)}`, 8, 3600_000)) return json(res, { error: 'Demasiadas solicitudes seguidas. Espera un poco.' }, 429);
    const r2 = await busqueda.fase2(params.id);
    if (r2.error) return json(res, { error: r2.error }, r2.status);
    json(res, r2);
  });

  r.post('/api/webhooks/n8n', (req, res) => webhook(req, res, 'whatsapp'));
  r.post('/api/webhooks/voz', (req, res) => webhook(req, res, 'llamada'));
}
