// Genera la narración de cada diapositiva con ElevenLabs → public/presentacion/voz-N.mp3. Uso: node scripts/voz-presentacion.mjs
import '../lib/entorno.js';
import { writeFile } from 'node:fs/promises';
import { DIAPOSITIVAS } from '../rutas/presentacion.js';

const clave = process.env.ELEVENLABS_API_KEY;
const voz = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
if (!clave) { console.error('Falta ELEVENLABS_API_KEY'); process.exit(1); }
for (const [i, d] of DIAPOSITIVAS.entries()) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: d.voz, model_id: 'eleven_multilingual_v2', language_code: 'es', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
  });
  if (!r.ok) { console.error(`Diapositiva ${i + 1}: ElevenLabs respondió ${r.status}`); process.exit(1); }
  await writeFile(new URL(`../public/presentacion/voz-${i + 1}.mp3`, import.meta.url), Buffer.from(await r.arrayBuffer()));
  process.stdout.write(`${i + 1} `);
}
console.log('\nListo.');
process.exit(0);
