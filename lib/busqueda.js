/**
 * El corazón de FarmaRadar: una búsqueda y sus dos fases.
 *   Fase 1: cada cadena activa se consulta con Firecrawl (en paralelo) y Gemma busca el principio activo.
 *   Fase 2 (la pide el paciente): las farmacias de barrio cercanas reciben la solicitud —por WhatsApp (n8n),
 *   la más cercana además por llamada (ElevenLabs) y todas en su panel— y cada respuesta llega a la pantalla.
 */
import { db } from './db.js';
import * as api from './integraciones.js';
import { tokenHex } from './seguridad.js';
import { idPublico, normaliza, distanciaKm } from './util.js';
import { urlPublica } from './entorno.js';

const RADIO_KM = 5;
const MAX_FARMACIAS = 12;

export async function registra(tipo, texto, busquedaId = null) {
  await db.ejecutar('INSERT INTO actividad (tipo, texto, busqueda_id) VALUES (?, ?, ?)', [tipo, String(texto).slice(0, 500), busquedaId]).catch(() => {});
}

/** Crea la búsqueda y arranca la fase 1 en segundo plano. → id */
export async function crea({ medicamento, zona, cp, lat, lng, whatsapp, ip }) {
  const id = idPublico();
  await db.ejecutar(
    'INSERT INTO busquedas (id, medicamento, zona, cp, lat, lng, paciente_whatsapp, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, medicamento, zona, cp, lat, lng, whatsapp, ip],
  );
  await registra('busqueda', `Búsqueda de «${medicamento}»${zona ? ` en ${zona}` : ''}`, id);
  fase1(id, medicamento).catch((e) => console.error('Fase 1:', e));
  return id;
}

async function fase1(id, medicamento) {
  const cadenas = await db.todos('SELECT * FROM cadenas WHERE activa = 1 ORDER BY orden, id');
  const filas = [];
  for (const c of cadenas) {
    const { id: rid } = await db.ejecutar('INSERT INTO resultados_cadena (busqueda_id, cadena_id) VALUES (?, ?)', [id, c.id]);
    filas.push({ rid, c });
  }
  const genericos = (async () => {
    await db.ejecutar("UPDATE busquedas SET genericos_estado = 'consultando' WHERE id = ?", [id]);
    const g = await api.analizaMedicamento(medicamento);
    await db.ejecutar('UPDATE busquedas SET principio_activo = ?, genericos = ?, genericos_estado = ? WHERE id = ?',
      [g.principio_activo ?? null, g.genericos ? JSON.stringify(g.genericos) : null, g.estado, id]);
  })();
  await Promise.all([
    genericos,
    ...filas.map(async ({ rid, c }) => {
      const r = await api.consultaCadena(c, medicamento);
      await db.ejecutar('UPDATE resultados_cadena SET estado = ?, producto = ?, precio = ?, url = ?, detalle = ? WHERE id = ?',
        [r.estado, r.producto ?? null, r.precio ?? null, r.url ?? null, r.detalle ?? null, rid]);
    }),
  ]);
}

/** Las farmacias de barrio que le tocan a una búsqueda: mismo CP, misma colonia o a menos de 5 km. */
export async function cercanas(b) {
  const todas = await db.todos('SELECT * FROM farmacias WHERE activa = 1');
  const zona = normaliza(b.zona);
  return todas.map((f) => {
    const km = distanciaKm(b, f);
    const col = normaliza(f.colonia);
    const porZona = (b.cp && f.cp === b.cp) || (col.length > 2 && zona.length > 2 && (zona.includes(col) || col.includes(zona)));
    return { ...f, km, porZona };
  })
    .filter((f) => f.porZona || (f.km !== null && f.km <= RADIO_KM))
    .sort((a, b2) => (a.km ?? 99) - (b2.km ?? 99))
    .slice(0, MAX_FARMACIAS);
}

/** Lo que ve el paciente (sin teléfonos de nadie ni datos internos). */
export async function vistaPublica(id) {
  const b = await db.uno('SELECT * FROM busquedas WHERE id = ?', [id]);
  if (!b) return null;
  const cadenas = await db.todos(
    `SELECT r.estado, r.producto, r.precio, r.url, r.detalle, c.nombre FROM resultados_cadena r
     JOIN cadenas c ON c.id = r.cadena_id WHERE r.busqueda_id = ? ORDER BY c.orden, c.id`, [id]);
  const locales = await db.todos(
    `SELECT r.estado, r.canal, r.precio, r.nota, r.respondido, f.nombre, f.direccion, f.colonia, f.lat, f.lng
     FROM respuestas_locales r JOIN farmacias f ON f.id = r.farmacia_id WHERE r.busqueda_id = ?
     ORDER BY FIELD(r.estado, 'tiene', 'llamando', 'enviada', 'pendiente', 'no_tiene', 'sin_respuesta', 'error'), r.id`, [id]);
  const cerca = b.fase2 ? [] : await cercanas(b);
  return {
    id: b.id, medicamento: b.medicamento, zona: b.zona, creado: b.creado, fase2: Boolean(b.fase2),
    lat: b.lat, lng: b.lng,
    principio_activo: b.principio_activo,
    genericos: typeof b.genericos === 'string' ? JSON.parse(b.genericos) : b.genericos,
    genericos_estado: b.genericos_estado,
    cadenas, locales,
    cercanas: cerca.length,
    mapa: (b.fase2 ? locales : cerca).filter((f) => f.lat !== null && f.lng !== null)
      .map((f) => ({ nombre: f.nombre, direccion: f.direccion, lat: Number(f.lat), lng: Number(f.lng), estado: f.estado ?? null, precio: f.precio ?? null })),
    apis: { firecrawl: api.configurada('firecrawl'), elevenlabs: api.configurada('elevenlabs'), n8n: api.configurada('n8n'), gemma: api.configurada('gemma') },
  };
}

/** Llamadas hechas hoy (hora de México), para el tope diario. */
async function llamadasHoy() {
  const { n } = await db.uno(
    "SELECT COUNT(*) AS n FROM respuestas_locales WHERE canal = 'llamada' AND creado >= UTC_TIMESTAMP() - INTERVAL 24 HOUR");
  return Number(n) || 0;
}

/**
 * Fase 2: «Buscar en farmacias locales». Una sola vez por búsqueda.
 * → {ok, farmacias, whatsapp, llamada} o {error}
 */
export async function fase2(id) {
  const b = await db.uno('SELECT * FROM busquedas WHERE id = ?', [id]);
  if (!b) return { error: 'No existe esa búsqueda', status: 404 };
  const marcado = await db.ejecutar('UPDATE busquedas SET fase2 = 1 WHERE id = ? AND fase2 = 0', [id]);
  if (!marcado.cambios) return { error: 'Ya se avisó a las farmacias de esta búsqueda', status: 409 };

  const lista = await cercanas(b);
  if (!lista.length) {
    await registra('fase2', `Sin farmacias registradas cerca para «${b.medicamento}»`, id);
    return { ok: true, farmacias: 0, whatsapp: false, llamada: false };
  }
  const filas = [];
  for (const f of lista) {
    const t = tokenHex(16);
    await db.ejecutar('INSERT INTO respuestas_locales (busqueda_id, farmacia_id, token, canal, estado) VALUES (?, ?, ?, ?, ?)',
      [id, f.id, t, 'panel', 'enviada']);
    filas.push({ f, t });
  }

  // WhatsApp a todas las que lo aceptan (n8n).
  let whatsapp = false;
  const porWa = filas.filter(({ f }) => f.acepta_whatsapp && api.telefonoE164(f.whatsapp || f.telefono));
  if (porWa.length && api.configurada('n8n')) {
    const r = await api.avisaN8n('alerta', {
      busqueda: id, medicamento: b.medicamento, zona: b.zona,
      farmacias: porWa.map(({ f, t }) => ({ nombre: f.nombre, whatsapp: api.telefonoE164(f.whatsapp || f.telefono), token: t, enlace: `${urlPublica()}/r/${t}` })),
    });
    whatsapp = r.ok;
    if (r.ok) {
      for (const { t } of porWa) await db.ejecutar("UPDATE respuestas_locales SET canal = 'whatsapp' WHERE token = ?", [t]);
      await registra('whatsapp', `Alerta por WhatsApp a ${porWa.length} farmacia(s) por «${b.medicamento}»`, id);
    } else await registra('error', `n8n: ${r.detalle}`, id);
  }

  // Llamada a la más cercana que acepta llamadas (ElevenLabs), con tope diario.
  let llamada = false;
  const aLlamar = filas.find(({ f }) => f.acepta_llamadas && api.telefonoE164(f.telefono));
  const tope = Number(process.env.LLAMADAS_POR_DIA) || 20;
  if (aLlamar && api.configurada('elevenlabs')) {
    if (await llamadasHoy() >= tope) await registra('aviso', `Tope de ${tope} llamadas al día alcanzado: no se llamó`, id);
    else {
      const r = await api.llamaFarmacia({ telefono: aLlamar.f.telefono, farmacia: aLlamar.f.nombre, medicamento: b.medicamento, token: aLlamar.t });
      if (r.ok) {
        llamada = true;
        await db.ejecutar("UPDATE respuestas_locales SET canal = 'llamada', estado = 'llamando', nota = ? WHERE token = ?", [r.id ? `Llamada ${r.id}` : null, aLlamar.t]);
        await db.ejecutar('UPDATE busquedas SET llamada_hecha = 1 WHERE id = ?', [id]);
        await registra('llamada', `Llamada de voz a ${aLlamar.f.nombre} por «${b.medicamento}»`, id);
      } else await registra('error', `ElevenLabs: ${r.detalle}`, id);
    }
  }
  await registra('fase2', `Solicitud enviada a ${filas.length} farmacia(s) de barrio`, id);
  return { ok: true, farmacias: filas.length, whatsapp, llamada };
}

/**
 * Una farmacia contesta (por su enlace, su panel, WhatsApp o la llamada).
 * → {ok} o {error, status}
 */
export async function responde(token, { tiene, precio = null, nota = null, transcripcion = null, canal = null }) {
  const r = await db.uno(
    `SELECT r.*, f.nombre AS farmacia, f.direccion, f.colonia, b.medicamento, b.paciente_whatsapp
     FROM respuestas_locales r JOIN farmacias f ON f.id = r.farmacia_id JOIN busquedas b ON b.id = r.busqueda_id
     WHERE r.token = ?`, [token]);
  if (!r) return { error: 'Solicitud no encontrada', status: 404 };
  const estado = tiene ? 'tiene' : 'no_tiene';
  await db.ejecutar(
    `UPDATE respuestas_locales SET estado = ?, precio = ?, nota = ?, transcripcion = COALESCE(?, transcripcion),
       canal = COALESCE(?, canal), respondido = UTC_TIMESTAMP() WHERE id = ?`,
    [estado, tiene ? precio : null, nota, transcripcion, canal, r.id]);
  await registra('respuesta', `${r.farmacia} ${tiene ? `SÍ tiene «${r.medicamento}»${precio ? ` a $${precio}` : ''}` : `no tiene «${r.medicamento}»`}`, r.busqueda_id);
  if (tiene && r.paciente_whatsapp && api.configurada('n8n')) {
    await api.avisaN8n('confirmado', {
      busqueda: r.busqueda_id, medicamento: r.medicamento, paciente_whatsapp: api.telefonoE164(r.paciente_whatsapp),
      farmacia: r.farmacia, direccion: [r.direccion, r.colonia].filter(Boolean).join(', '), precio,
      enlace: `${urlPublica()}/b/${r.busqueda_id}`,
    });
  }
  return { ok: true };
}
