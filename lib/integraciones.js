/**
 * Las APIs de FarmaRadar. Cada una vive aquí, detrás de una función, y se enciende sola en cuanto su
 * clave está en el .env (sin clave: «pendiente» y el sistema sigue funcionando por el panel del boticario).
 *
 *   Firecrawl   → fase 1: precio y existencia en la web de cada cadena.
 *   ElevenLabs  → fase 2: llamada de voz a la farmacia de barrio más cercana.
 *   n8n         → fase 2: alerta por WhatsApp a las farmacias de la colonia y aviso al paciente.
 *   Gemma 4     → principio activo y genéricos bioequivalentes.
 *   MojoAuth    → entrar sin contraseña (pendiente: hoy el boticario entra con su enlace privado).
 *
 * Contratos de vuelta (los dos webhooks llevan la cabecera X-FarmaRadar-Secreto = WEBHOOK_SECRETO):
 *   POST /api/webhooks/n8n  {token, tiene: true|false, precio?, nota?}       ← el boticario contestó por WhatsApp
 *   POST /api/webhooks/voz  {token, tiene: true|false, precio?, transcripcion?} ← herramienta del agente de voz
 */
import { urlPublica } from './entorno.js';
import { db } from './db.js';

const normaliza = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Lo del .env manda; si falta, lo que el panel guardó en la tabla `ajustes` (p. ej. el agente de voz que creó).
const ajustes = new Map();
const env = (k) => String(process.env[k] ?? '').trim() || ajustes.get(k) || '';

export async function cargaAjustes() {
  for (const a of await db.todos('SELECT clave, valor FROM ajustes')) ajustes.set(a.clave, a.valor);
}
async function guardaAjuste(clave, valor) {
  await db.ejecutar('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [clave, valor]);
  ajustes.set(clave, valor);
}
const espera = (ms) => AbortSignal.timeout(ms);

export const INTEGRACIONES = [
  { id: 'firecrawl', nombre: 'Firecrawl', rol: 'Consulta precios y existencias en las webs de las cadenas (fase 1).', vars: ['FIRECRAWL_API_KEY'], premio: 'Best Use of Firecrawl' },
  { id: 'elevenlabs', nombre: 'ElevenLabs', rol: 'Le pregunta al boticario con voz natural y entiende su respuesta hablada (fase 2).', vars: ['ELEVENLABS_API_KEY'], premio: 'Best Use of ElevenLabs' },
  { id: 'n8n', nombre: 'n8n + WhatsApp', rol: 'Manda la alerta por WhatsApp a las farmacias de la colonia y avisa al paciente (fase 2).', vars: ['N8N_WEBHOOK_URL'], premio: 'Best n8n Integration' },
  { id: 'gemma', nombre: 'Gemma 4', rol: 'Identifica el principio activo y sugiere genéricos bioequivalentes.', vars: ['GEMMA_URL', 'GEMMA_MODELO'], premio: 'Best Use of Gemma 4' },
  { id: 'mojoauth', nombre: 'MojoAuth', rol: 'Registro y entrada sin contraseña para pacientes y boticarios.', vars: ['MOJOAUTH_API_KEY'], premio: 'Best Auth with MojoAuth' },
];

export const configurada = (id) => INTEGRACIONES.find((i) => i.id === id)?.vars.every((v) => env(v)) ?? false;

export const estado = () => INTEGRACIONES.map((i) => ({
  ...i, configurada: i.vars.every((v) => env(v)), faltan: i.vars.filter((v) => !env(v)),
}));

/** Teléfono de México a formato internacional (+52 y 10 dígitos). → '' si no parece válido. */
export function telefonoE164(t) {
  let d = String(t ?? '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d.length === 10 ? `+52${d}` : '';
}

const aNumero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};

/* ── Firecrawl (fase 1) ─────────────────────────────────────────────────── */

const FC = 'https://api.firecrawl.dev/v1';
const fcCab = () => ({ Authorization: `Bearer ${env('FIRECRAWL_API_KEY')}`, 'Content-Type': 'application/json' });
const cacheCadena = new Map(); // «cadena|medicina» → {hasta, r}: la misma consulta en 30 min no vuelve a gastar créditos

/**
 * Busca el medicamento en el sitio de la cadena (búsqueda web de Firecrawl limitada a su dominio) y lee con Firecrawl
 * la ficha del producto que mejor coincide: nombre, precio y si se puede comprar. El precio sale de los datos de la
 * propia ficha (product:price:amount) cuando los trae; nunca del resumen del buscador, que puede ser viejo.
 * → {estado: disponible|agotado|sin_resultado|error|sin_configurar, producto?, precio?, url, detalle?}
 */
export async function consultaCadena(cadena, medicamento) {
  const url = cadena.url_busqueda.replace('{q}', encodeURIComponent(medicamento));
  if (!configurada('firecrawl')) return { estado: 'sin_configurar', url, detalle: 'Falta la clave de Firecrawl' };
  let dominio;
  try { dominio = new URL(cadena.url_busqueda.replace('{q}', 'x')).hostname.replace(/^www\./, ''); } catch { return { estado: 'error', url, detalle: 'La dirección de la cadena no es válida' }; }
  const clave = `${dominio}|${normaliza(medicamento)}`;
  const guardada = cacheCadena.get(clave);
  if (guardada && guardada.hasta > Date.now()) return guardada.r;
  const r = await consultaEnSitio(dominio, url, medicamento);
  if (r.estado !== 'error') cacheCadena.set(clave, { hasta: Date.now() + 30 * 60_000, r });
  if (cacheCadena.size > 500) cacheCadena.delete(cacheCadena.keys().next().value);
  return r;
}

async function consultaEnSitio(dominio, url, medicamento) {
  try {
    // 1) Las fichas del sitio que hablan de esa medicina.
    const b = await fetch(`${FC}/search`, {
      method: 'POST', headers: fcCab(), signal: espera(45_000),
      body: JSON.stringify({ query: `${medicamento} site:${dominio}`, limit: 5, lang: 'es', country: 'mx' }),
    });
    const db_ = await b.json().catch(() => ({}));
    if (!b.ok || !db_?.success) return { estado: 'error', url, detalle: `Firecrawl no pudo buscar (${b.status})` };
    const palabras = normaliza(medicamento).split(' ').filter((w) => w.length > 3);
    const fichas = (db_.data ?? [])
      .map((x) => ({ url: String(x.url ?? '').replace(/[?#].*$/, ''), titulo: normaliza(x.title) }))
      .filter((x) => { try { return new URL(x.url).hostname.replace(/^www\./, '') === dominio; } catch { return false; } })
      .filter((x) => !/\/(search|buscar|catalogsearch)/i.test(x.url))
      .filter((x) => palabras.every((w) => x.titulo.includes(w) || normaliza(x.url).replace(/[-_/]/g, ' ').includes(w)));
    if (!fichas.length) return { estado: 'sin_resultado', url, detalle: 'No aparece en su tienda en línea' };

    // 2) Leer la ficha.
    const ficha = fichas[0].url;
    const s = await fetch(`${FC}/scrape`, {
      method: 'POST', headers: fcCab(), signal: espera(60_000),
      body: JSON.stringify({
        url: ficha, formats: ['json'], onlyMainContent: true,
        jsonOptions: {
          prompt: `Ficha de un producto en la tienda en línea de una farmacia de México. Se busca «${medicamento}». `
            + 'Lee SOLO el producto principal de la ficha (ignora carruseles y productos relacionados): su nombre, su precio '
            + 'actual en pesos (solo el número) y si se puede comprar ahora (disponible = false si dice agotado, sin existencia '
            + 'o no disponible). coincide = true si es esa medicina (mismo principio activo o marca). No inventes datos.',
          schema: {
            type: 'object',
            properties: { producto: { type: 'string' }, precio: { type: 'number' }, disponible: { type: 'boolean' }, coincide: { type: 'boolean' } },
            required: ['producto', 'coincide'],
          },
        },
      }),
    });
    const d = await s.json().catch(() => ({}));
    if (!s.ok || !d?.success) {
      const bloqueada = /engines failed|blocking|403|access denied/i.test(String(d?.error ?? ''));
      return { estado: 'error', url: ficha, detalle: bloqueada ? 'Su web no deja consultarla automáticamente' : `Firecrawl respondió ${s.status}` };
    }
    const j = d.data?.json ?? {};
    const meta = d.data?.metadata ?? {};
    if (j.coincide === false) return { estado: 'sin_resultado', url, detalle: 'No aparece en su tienda en línea' };
    const precio = aNumero(meta['product:price:amount'] ?? meta.price) ?? aNumero(j.precio);
    const agotado = j.disponible === false || /outofstock|out of stock/i.test(String(meta['product:availability'] ?? meta.availability ?? ''));
    return {
      estado: agotado ? 'agotado' : 'disponible',
      producto: String(j.producto || meta['og:title'] || '').slice(0, 250) || null,
      precio: agotado ? null : precio,
      url: ficha,
    };
  } catch (e) {
    return { estado: 'error', url, detalle: e.name === 'TimeoutError' ? 'La página tardó demasiado' : String(e.message).slice(0, 200) };
  }
}

/* ── Gemma 4 (principio activo y genéricos) ─────────────────────────────── */

/**
 * Cualquier API compatible con OpenAI (Ollama, OpenRouter, vLLM, Google AI Studio en modo OpenAI…).
 * GEMMA_URL es la base, por ejemplo http://127.0.0.1:11434/v1 → se le añade /chat/completions.
 * → {estado: listo|sin_configurar|error, principio_activo?, genericos?: [{nombre, nota}]}
 */
export async function analizaMedicamento(medicamento) {
  if (!configurada('gemma')) return { estado: 'sin_configurar' };
  try {
    const r = await fetch(`${env('GEMMA_URL').replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(env('GEMMA_API_KEY') ? { Authorization: `Bearer ${env('GEMMA_API_KEY')}` } : {}) },
      body: JSON.stringify({
        model: env('GEMMA_MODELO'),
        temperature: 0,
        messages: [
          { role: 'system', content: 'Eres un apoyo farmacéutico para México. Respondes SOLO con JSON válido, sin texto alrededor. '
            + 'Nunca inventes precios, marcas ni presentaciones que no conozcas con certeza. Si no estás seguro, deja la lista vacía.' },
          { role: 'user', content: `Medicamento buscado: «${medicamento}».\n`
            + 'Devuelve {"principio_activo": "...", "genericos": [{"nombre": "...", "nota": "..."}]} con el principio activo '
            + 'y hasta 4 opciones genéricas o bioequivalentes autorizadas en México con ese mismo principio activo, '
            + 'concentración y vía. En "nota" di en una frase qué tener en cuenta. Sin precios.' },
        ],
      }),
      signal: espera(45_000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { estado: 'error', detalle: `Gemma respondió ${r.status}` };
    const txt = String(d?.choices?.[0]?.message?.content ?? '').replace(/^```(json)?|```$/gm, '').trim();
    const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    return {
      estado: 'listo',
      principio_activo: String(j.principio_activo ?? '').slice(0, 200) || null,
      genericos: (Array.isArray(j.genericos) ? j.genericos : []).slice(0, 4)
        .map((g) => ({ nombre: String(g?.nombre ?? '').slice(0, 160), nota: String(g?.nota ?? '').slice(0, 300) }))
        .filter((g) => g.nombre),
    };
  } catch (e) {
    return { estado: 'error', detalle: String(e.message).slice(0, 200) };
  }
}

/* ── ElevenLabs (fase 2: la llamada) ────────────────────────────────────── */

/**
 * Llamada saliente con el agente conversacional de ElevenLabs (número conectado por Twilio).
 * Las variables llegan al prompt del agente como {{farmacia}}, {{medicamento}}, {{token}}.
 * El agente contesta con su herramienta «registrar_respuesta» → POST /api/webhooks/voz.
 * → {ok, id?, detalle?}
 */
export const puedeLlamar = () => Boolean(env('ELEVENLABS_API_KEY') && env('ELEVENLABS_AGENT_ID') && env('ELEVENLABS_PHONE_NUMBER_ID'));

export async function llamaFarmacia({ telefono, farmacia, medicamento, token }) {
  if (!puedeLlamar()) return { ok: false, detalle: 'Falta el agente o el número de ElevenLabs' };
  const to = telefonoE164(telefono);
  if (!to) return { ok: false, detalle: 'El teléfono de la farmacia no es válido' };
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: env('ELEVENLABS_AGENT_ID'),
        agent_phone_number_id: env('ELEVENLABS_PHONE_NUMBER_ID'),
        to_number: to,
        conversation_initiation_client_data: {
          dynamic_variables: { farmacia, medicamento, token, url_respuesta: `${urlPublica()}/api/webhooks/voz` },
        },
      }),
      signal: espera(30_000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) return { ok: false, detalle: `ElevenLabs respondió ${r.status}${d?.message ? `: ${String(d.message).slice(0, 200)}` : ''}` };
    return { ok: true, id: d.conversation_id ?? d.callSid ?? null };
  } catch (e) {
    return { ok: false, detalle: String(e.message).slice(0, 200) };
  }
}

/* ── n8n (fase 2: WhatsApp) ─────────────────────────────────────────────── */

/**
 * Manda un evento al webhook de n8n. Dos eventos:
 *   alerta:     {medicamento, zona, farmacias: [{nombre, whatsapp, enlace}]}  → n8n escribe a cada farmacia
 *   confirmado: {medicamento, paciente_whatsapp, farmacia, direccion, precio, enlace} → n8n avisa al paciente
 * → {ok, detalle?}
 */
export async function avisaN8n(evento, datos) {
  if (!configurada('n8n')) return { ok: false, detalle: 'Falta el webhook de n8n' };
  try {
    const r = await fetch(env('N8N_WEBHOOK_URL'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-FarmaRadar-Secreto': env('WEBHOOK_SECRETO') },
      body: JSON.stringify({ evento, ...datos, url_respuesta: `${urlPublica()}/api/webhooks/n8n` }),
      signal: espera(20_000),
    });
    return r.ok ? { ok: true } : { ok: false, detalle: `n8n respondió ${r.status}` };
  } catch (e) {
    return { ok: false, detalle: String(e.message).slice(0, 200) };
  }
}

/* ── Revisión en vivo (Panel → Integraciones) ───────────────────────────── */

const ELEVEN = 'https://api.elevenlabs.io/v1';
const xi = () => ({ 'xi-api-key': env('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' });
const leeJson = async (r) => r.json().catch(() => ({}));
const sinPermiso = (d) => /missing the permission|missing_permissions/i.test(JSON.stringify(d?.detail ?? d ?? ''));

let revisionCache = { hasta: 0, datos: null };

/**
 * Prueba cada API con una consulta gratuita y dice qué falta, en palabras.
 * → { firecrawl: {ok, texto}, elevenlabs: {ok, texto, puedeCrearAgente, telefonos:[{id, numero, etiqueta}]}, n8n, gemma, mojoauth }
 */
export async function revisa({ fresca = false } = {}) {
  if (!fresca && revisionCache.datos && revisionCache.hasta > Date.now()) return revisionCache.datos;
  const r = {};
  const intenta = async (id, fn) => { try { r[id] = await fn(); } catch (e) { r[id] = { ok: false, texto: e.name === 'TimeoutError' ? 'No respondió a tiempo.' : `No se pudo comprobar: ${String(e.message).slice(0, 120)}` }; } };

  await Promise.all([
    intenta('firecrawl', async () => {
      if (!env('FIRECRAWL_API_KEY')) return { ok: false, texto: 'Falta la clave (FIRECRAWL_API_KEY).' };
      const x = await fetch('https://api.firecrawl.dev/v1/team/credit-usage', { headers: { Authorization: `Bearer ${env('FIRECRAWL_API_KEY')}` }, signal: espera(15_000) });
      const d = await leeJson(x);
      if (!x.ok || !d?.success) return { ok: false, texto: `La clave no es válida (Firecrawl respondió ${x.status}).` };
      return { ok: true, texto: `Clave válida · ${Number(d.data?.remaining_credits ?? 0).toLocaleString('es-MX')} créditos disponibles.` };
    }),
    intenta('elevenlabs', async () => {
      if (!env('ELEVENLABS_API_KEY')) return { ok: false, texto: 'Falta la clave (ELEVENLABS_API_KEY).' };
      const sub = await fetch(`${ELEVEN}/user/subscription`, { headers: xi(), signal: espera(15_000) });
      const d = await leeJson(sub);
      if (!sub.ok) return { ok: false, texto: `La clave no es válida (ElevenLabs respondió ${sub.status}).` };
      const quedan = Math.max(0, Number(d.character_limit ?? 0) - Number(d.character_count ?? 0));
      return {
        ok: true,
        texto: `Voz lista: la farmacia escucha la pregunta y contesta hablando. Quedan ${quedan.toLocaleString('es-MX')} caracteres de voz este mes.`
          + (puedeLlamar() ? ' Llamadas por teléfono: activas.' : ''),
      };
    }),
    intenta('gemma', async () => {
      if (!env('GEMMA_URL') || !env('GEMMA_MODELO')) return { ok: false, texto: 'Faltan la dirección de la API (GEMMA_URL) y el nombre del modelo (GEMMA_MODELO).' };
      const x = await fetch(`${env('GEMMA_URL').replace(/\/+$/, '')}/models`, { headers: env('GEMMA_API_KEY') ? { Authorization: `Bearer ${env('GEMMA_API_KEY')}` } : {}, signal: espera(15_000) });
      return x.ok ? { ok: true, texto: 'Responde.' } : { ok: false, texto: `La API respondió ${x.status}: revisa la dirección y la clave.` };
    }),
    intenta('n8n', async () => (env('N8N_WEBHOOK_URL')
      ? { ok: true, texto: 'Dirección puesta. Se prueba al mandar la primera alerta.' }
      : { ok: false, texto: 'Falta la dirección del webhook de n8n (N8N_WEBHOOK_URL).' })),
    intenta('mojoauth', async () => ({ ok: false, texto: env('MOJOAUTH_API_KEY') ? 'Clave puesta; falta programar la entrada sin contraseña.' : 'Falta la clave; además hay que programar la entrada sin contraseña.' })),
  ]);
  revisionCache = { hasta: Date.now() + 60_000, datos: r };
  return r;
}

/* ── El agente de voz, creado desde el panel ────────────────────────────── */

const GUION = `Eres la asistente de voz de FarmaRadar, una red que ayuda a pacientes a encontrar medicinas agotadas en México.
Llamas a la farmacia «{{farmacia}}» de parte de un paciente que está cerca y busca «{{medicamento}}».

Cómo hablar: español de México, amable, breve y natural. Una pregunta a la vez. No vendes nada ni pides datos personales.

Qué hacer:
1. Saluda, di que llamas de FarmaRadar de parte de un paciente cercano y pregunta si tienen {{medicamento}}.
2. Si la tienen, pregunta el precio por caja o pieza.
3. Si no saben o no la tienen, agradece.
4. Antes de despedirte, usa SIEMPRE la herramienta «registrar_respuesta» con: tiene (true o false), precio (solo el número en pesos, si lo dijeron) y transcripcion (un resumen breve de lo que dijo el boticario).
5. Despídete en una frase.

Nunca inventes un precio ni una existencia que no te hayan dicho.`;

/**
 * Crea en ElevenLabs la herramienta «registrar_respuesta» (→ /api/webhooks/voz) y el agente con el guion,
 * y guarda su id. Si en la cuenta hay un solo número, lo toma. → {ok, texto}
 */
export async function creaAgenteVoz() {
  if (!env('ELEVENLABS_API_KEY')) return { ok: false, texto: 'Falta la clave de ElevenLabs.' };
  if (env('ELEVENLABS_AGENT_ID')) return { ok: false, texto: 'El agente ya existe.' };
  try {
    const t = await fetch(`${ELEVEN}/convai/tools`, {
      method: 'POST', headers: xi(), signal: espera(30_000),
      body: JSON.stringify({
        tool_config: {
          type: 'webhook',
          name: 'registrar_respuesta',
          description: 'Registra en FarmaRadar lo que contestó la farmacia. Úsala una vez, antes de colgar.',
          api_schema: {
            url: `${urlPublica()}/api/webhooks/voz`,
            method: 'POST',
            request_headers: { 'X-FarmaRadar-Secreto': env('WEBHOOK_SECRETO') },
            request_body_schema: {
              type: 'object',
              properties: {
                token: { type: 'string', dynamic_variable: 'token' },
                tiene: { type: 'boolean', description: 'true si la farmacia tiene el medicamento, false si no' },
                precio: { type: 'number', description: 'Precio en pesos que dijo el boticario; omítelo si no lo dijo' },
                transcripcion: { type: 'string', description: 'Resumen breve de lo que dijo el boticario' },
              },
              required: ['token', 'tiene'],
            },
          },
        },
      }),
    });
    const dt = await leeJson(t);
    if (sinPermiso(dt)) return { ok: false, texto: 'La clave no tiene permiso para los agentes de voz (actívalo en ElevenLabs → API Keys).' };
    if (!t.ok || !dt.id) return { ok: false, texto: `ElevenLabs no creó la herramienta (${t.status}): ${String(dt?.detail?.message ?? dt?.detail ?? '').slice(0, 200)}` };

    const a = await fetch(`${ELEVEN}/convai/agents/create`, {
      method: 'POST', headers: xi(), signal: espera(30_000),
      body: JSON.stringify({
        name: 'FarmaRadar · llamada al boticario',
        conversation_config: {
          agent: {
            first_message: 'Hola, buenas. Le llamo de FarmaRadar de parte de un paciente que está cerca. ¿Tendrá {{medicamento}}?',
            language: 'es',
            prompt: { prompt: GUION, tool_ids: [dt.id] },
          },
          tts: { model_id: 'eleven_flash_v2_5' },
        },
      }),
    });
    const da = await leeJson(a);
    if (!a.ok || !da.agent_id) return { ok: false, texto: `ElevenLabs no creó el agente (${a.status}): ${String(da?.detail?.message ?? da?.detail ?? '').slice(0, 200)}` };
    await guardaAjuste('ELEVENLABS_AGENT_ID', da.agent_id);

    let extra = '';
    if (!env('ELEVENLABS_PHONE_NUMBER_ID')) {
      const tel = await fetch(`${ELEVEN}/convai/phone-numbers`, { headers: xi(), signal: espera(15_000) });
      const lista = tel.ok ? await leeJson(tel) : [];
      const nums = Array.isArray(lista) ? lista : [];
      if (nums.length === 1) { await guardaAjuste('ELEVENLABS_PHONE_NUMBER_ID', nums[0].phone_number_id); extra = ` Llamará desde ${nums[0].phone_number}.`; }
      else extra = nums.length ? ' Elige abajo el número que llama.' : ' Falta conectar un número de teléfono en ElevenLabs.';
    }
    revisionCache.hasta = 0;
    return { ok: true, texto: `Agente de voz creado.${extra}` };
  } catch (e) {
    return { ok: false, texto: `No se pudo crear el agente: ${String(e.message).slice(0, 200)}` };
  }
}

/** Elige el número de ElevenLabs desde el que se llama. */
export async function eligeTelefono(id) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(id ?? ''))) return { ok: false, texto: 'Número no válido.' };
  await guardaAjuste('ELEVENLABS_PHONE_NUMBER_ID', id);
  revisionCache.hasta = 0;
  return { ok: true, texto: 'Número guardado.' };
}

/* ── ElevenLabs: la pregunta en voz y la respuesta hablada ──────────────── */

const cacheVoz = new Map(); // texto → mp3 (la misma pregunta no se vuelve a generar)

/** La pregunta al boticario en voz natural. → Buffer mp3 o null */
export async function vozPregunta(texto) {
  if (!env('ELEVENLABS_API_KEY')) return null;
  if (cacheVoz.has(texto)) return cacheVoz.get(texto);
  const voz = env('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';
  const r = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_64`, {
    method: 'POST', headers: xi(), signal: espera(30_000),
    body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2', language_code: 'es' }),
  });
  if (!r.ok) return null;
  const mp3 = Buffer.from(await r.arrayBuffer());
  cacheVoz.set(texto, mp3);
  if (cacheVoz.size > 100) cacheVoz.delete(cacheVoz.keys().next().value);
  return mp3;
}

/** Lo que dijo el boticario, a texto (ElevenLabs Scribe). → {ok, texto?, detalle?} */
export async function transcribe(audio, tipo = 'audio/webm') {
  if (!env('ELEVENLABS_API_KEY')) return { ok: false, detalle: 'Falta la clave de ElevenLabs' };
  try {
    const f = new FormData();
    f.append('model_id', 'scribe_v1');
    f.append('language_code', 'spa');
    f.append('file', new Blob([audio], { type: tipo }), tipo.includes('mp4') ? 'respuesta.mp4' : 'respuesta.webm');
    const r = await fetch(`${ELEVEN}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': env('ELEVENLABS_API_KEY') }, body: f, signal: espera(45_000) });
    const d = await leeJson(r);
    if (!r.ok) return { ok: false, detalle: `ElevenLabs respondió ${r.status}` };
    return { ok: true, texto: String(d.text ?? '').trim() };
  } catch (e) {
    return { ok: false, detalle: String(e.message).slice(0, 200) };
  }
}

const NUMEROS = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900, mil: 1000,
  diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };

/**
 * Entiende «sí, tengo, a 390» / «no, se nos acabó». → {tiene: true|false|null, precio: número|null}
 * tiene = null si no queda claro (entonces el boticario elige con los botones).
 */
export function entiendeRespuesta(texto) {
  const t = normaliza(texto).replace(/[¿?¡!.,]/g, ' ');
  const no = /\b(no (la |lo |las |los |me |nos )?(tengo|tenemos|hay|queda|quedan|manejamos|contamos)|agotad|se (nos |me )?(acabo|termino)|sin existencia|no hay|ya no)\b/.test(t)
    || /^\s*no\b/.test(t);
  const si = /\b(si|claro|tengo|tenemos|hay|me queda|nos queda|quedan|contamos con)\b/.test(t);
  let precio = null;
  const dig = String(texto).replace(/(\d),(\d{3})/g, '$1$2').match(/\$?\s*(\d{2,6}(?:\.\d{1,2})?)/);
  if (dig) precio = aNumero(dig[1]);
  else {
    let n = 0, visto = false;
    for (const w of t.split(/\s+/)) { if (w in NUMEROS) { n = w === 'mil' ? (n || 1) * 1000 : n + NUMEROS[w]; visto = true; } }
    if (visto && n >= 10) precio = n;
  }
  return { tiene: no ? false : si || precio ? true : null, precio: no ? null : precio };
}
