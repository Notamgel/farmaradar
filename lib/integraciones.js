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

const env = (k) => String(process.env[k] ?? '').trim();
const espera = (ms) => AbortSignal.timeout(ms);

export const INTEGRACIONES = [
  { id: 'firecrawl', nombre: 'Firecrawl', rol: 'Consulta precios y existencias en las webs de las cadenas (fase 1).', vars: ['FIRECRAWL_API_KEY'], premio: 'Best Use of Firecrawl' },
  { id: 'elevenlabs', nombre: 'ElevenLabs', rol: 'Llama por teléfono a la farmacia de barrio y pregunta por la medicina (fase 2).', vars: ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_PHONE_NUMBER_ID'], premio: 'Best Use of ElevenLabs' },
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

/**
 * Consulta la página de búsqueda de una cadena y extrae el producto, el precio y si hay existencia.
 * → {estado: disponible|agotado|sin_resultado|error|sin_configurar, producto?, precio?, url, detalle?}
 */
export async function consultaCadena(cadena, medicamento) {
  const url = cadena.url_busqueda.replace('{q}', encodeURIComponent(medicamento));
  if (!configurada('firecrawl')) return { estado: 'sin_configurar', url, detalle: 'Falta la clave de Firecrawl' };
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('FIRECRAWL_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['json'],
        onlyMainContent: true,
        jsonOptions: {
          prompt: `Página de resultados de búsqueda de una farmacia en México. Busca el producto que mejor coincida con «${medicamento}». `
            + 'Devuelve su nombre exacto como aparece, su precio en pesos (solo el número) y si se puede comprar ahora '
            + '(disponible = false si dice agotado, sin existencia, no disponible o no hay resultados). '
            + 'Si no aparece ningún producto parecido, encontrado = false. No inventes datos que no estén en la página.',
          schema: {
            type: 'object',
            properties: {
              encontrado: { type: 'boolean' },
              producto: { type: 'string' },
              precio: { type: 'number' },
              disponible: { type: 'boolean' },
              url_producto: { type: 'string' },
            },
            required: ['encontrado'],
          },
        },
      }),
      signal: espera(60_000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.success) return { estado: 'error', url, detalle: `Firecrawl respondió ${r.status}${d?.error ? `: ${String(d.error).slice(0, 200)}` : ''}` };
    const j = d.data?.json ?? d.data?.extract ?? {};
    if (!j.encontrado) return { estado: 'sin_resultado', url, detalle: 'No aparece en su catálogo en línea' };
    return {
      estado: j.disponible === false ? 'agotado' : 'disponible',
      producto: String(j.producto ?? '').slice(0, 250) || null,
      precio: aNumero(j.precio),
      url: /^https?:\/\//.test(String(j.url_producto ?? '')) ? String(j.url_producto).slice(0, 500) : url,
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
export async function llamaFarmacia({ telefono, farmacia, medicamento, token }) {
  if (!configurada('elevenlabs')) return { ok: false, detalle: 'Falta la clave de ElevenLabs' };
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
