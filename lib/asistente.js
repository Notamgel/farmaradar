/**
 * El asistente de voz de FarmaRadar: entiende lo que dice el paciente (ya transcrito por ElevenLabs) y arma lo que
 * le contesta. Los textos los arma SIEMPRE el servidor con datos de la búsqueda (nada de texto libre a la voz).
 */
import { normaliza } from './util.js';

const RELLENO = new Set(('hola oye oiga buenas buenos dias tardes noches farmaradar farma radar por favor porfa gracias ayudame ayudas '
  + 'a me puedes podrias quiero quisiera necesito ocupo busco estoy buscando ando buscame buscar encuentrame encontrar conseguir consigo '
  + 'donde hay venden encuentro tienen tiene alguien urge hace falta la el las los un una unas unos de del medicina medicamento '
  + 'medicinas medicamentos pastillas pastilla caja cajas que se llama llamado llamada algo y').split(' '));
const SEPARA = new Set(['en', 'cerca', 'por', 'rumbo', 'codigo']);
const sinAcento = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** «Busco insulina glargina en la colonia Roma» → {medicamento: 'insulina glargina', zona: 'Roma'} */
export function entiendeBusqueda(texto) {
  const W = String(texto ?? '').toLowerCase().replace(/[¿?¡!.,;:"«»]/g, ' ').split(/\s+/).filter(Boolean);
  const N = W.map(sinAcento);
  // La zona empieza en el primer «en / cerca de / por» que va después de la medicina; un CP de 5 cifras también es zona.
  let corte = -1;
  for (let i = 1; i < N.length; i++) {
    if (SEPARA.has(N[i]) && N.slice(0, i).some((w) => !RELLENO.has(w))) { corte = i; break; }
  }
  const med = (corte < 0 ? W : W.slice(0, corte)).filter((w, k) => !RELLENO.has(N[k]) && !/^\d{5}$/.test(w));
  let zona = corte < 0 ? [] : W.slice(corte + 1).filter((w) => !['de', 'la', 'el', 'colonia', 'col', 'código', 'codigo', 'postal', 'por', 'favor', 'porfa', 'gracias', 'rumbo'].includes(sinAcento(w)));
  const cp = W.find((w) => /^\d{5}$/.test(w));
  if (cp) zona = [cp];
  const titulo = (l) => l.join(' ').replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return { medicamento: med.join(' ').slice(0, 160), zona: titulo(zona).slice(0, 160) };
}

/** ¿Dijo que sí? → true | false | null */
export function entiendeSiNo(texto) {
  const t = normaliza(texto).replace(/[¿?¡!.,]/g, ' ');
  if (/\b(no|nel|mejor no|asi esta bien|ya no|despues)\b/.test(t) && !/\bno se\b/.test(t)) return false;
  if (/\b(si|sip|claro|va|vale|dale|orale|okay|ok|por favor|adelante|pregunta|preguntales|hazlo|andale|sale|simon|porfa)\b/.test(t)) return true;
  return null;
}

const pesosHablados = (n) => {
  const v = Number(n); const e = Math.floor(v); const c = Math.round((v - e) * 100);
  return `${e.toLocaleString('es-MX')} pesos${c ? ` con ${c} centavos` : ''}`;
};

export const FRASES = {
  saludo: 'Hola, soy FarmaRadar. ¿Qué medicina buscas, y en qué colonia o código postal?',
  'no-entendi': 'Perdón, no alcancé a entender qué medicina buscas. ¿Me la repites? Por ejemplo: insulina glargina en Polanco.',
  'va-resultados': 'Va. Aquí tienes todo lo que encontré.',
  'sin-respuesta': 'Todavía no contesta ninguna farmacia. En cuanto alguna conteste, aparece aquí en verde.',
};

/** Lo que dice el asistente según el momento de la búsqueda `v` (vistaPublica). */
export function frase(que, v) {
  const med = v.medicamento;
  if (que === 'inicio') return `Va. Estoy buscando ${med}${v.zona ? ` cerca de ${v.zona}` : ''}. Dame unos segundos.`;
  if (que === 'resumen') {
    const hay = v.cadenas.filter((c) => c.estado === 'disponible' && c.precio).sort((a, b) => a.precio - b.precio);
    const pregunta = v.cercanas && !v.fase2
      ? ` ¿Quieres que les pregunte a las ${v.cercanas} farmacias de barrio cerca de ti? A veces sale más barato.` : '';
    if (!hay.length) return `En las cadenas no aparece disponible ${med}.${pregunta || ' Puedes intentar con otro nombre o con el principio activo.'}`;
    const [a, b] = hay;
    return `Encontré ${med} en ${hay.length === 1 ? 'una cadena' : `${hay.length} cadenas`}. La más barata es ${a.nombre}, a ${pesosHablados(a.precio)}.`
      + (b ? ` También en ${b.nombre}, a ${pesosHablados(b.precio)}.` : '') + pregunta;
  }
  if (que === 'preguntando') return `Listo. Ya les pregunté a ${v.locales.length} farmacias cerca de ti. Te aviso en cuanto alguna conteste.`;
  if (que === 'encontrada') {
    const l = v.locales.filter((x) => x.estado === 'tiene').sort((a, b) => (a.precio ?? 1e9) - (b.precio ?? 1e9))[0];
    if (!l) return FRASES['sin-respuesta'];
    return `¡Buenas noticias! ${l.nombre}${l.colonia ? `, en ${l.colonia},` : ''} sí la tiene${l.precio ? `, a ${pesosHablados(l.precio)}` : ''}. Te la marqué en el mapa.`;
  }
  return null;
}
