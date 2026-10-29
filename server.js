/**
 * FarmaRadar — la red contra el desabasto de medicamentos.
 *
 * - /                 landing
 * - /buscar, /b/:id   el buscador del paciente y su resultado en vivo (semáforo, mapa, fase 2)
 * - /farmacias/registro, /f, /r/:token   registro express, panel y respuesta del boticario
 * - /panel            panel del equipo (usuario inicial en el .env)
 * - /api/…            la API del buscador y los webhooks de n8n y del agente de voz
 * - /salud            → 200: así UVLIS sabe que responde
 *
 * El puerto llega en PORT (lo pone UVLIS al iniciar el servicio). Escucha solo en 127.0.0.1:
 * se publica en farmaradar.lat con el túnel de UVLIS.
 */
import './lib/entorno.js';
import { createServer } from 'node:http';
import { db } from './lib/db.js';
import { migrar } from './lib/esquema.js';
import { cargaAjustes } from './lib/integraciones.js';
import { Rutas, estatico, html, json } from './lib/http.js';
import { pagina, cabeceraPublica, pie, ico } from './lib/vistas.js';
import * as sesion from './lib/sesion.js';
import publico from './rutas/publico.js';
import api from './rutas/api.js';
import panel from './rutas/panel.js';
import presentacion from './rutas/presentacion.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

await migrar();
await cargaAjustes();
await sesion.limpiaVencidas();
setInterval(() => sesion.limpiaVencidas().catch(() => {}), 3600_000).unref();

const rutas = new Rutas();
publico(rutas);
api(rutas);
panel(rutas);
presentacion(rutas);

const noExiste = (req, res) => {
  if (req.url.startsWith('/api/')) return json(res, { error: 'no existe' }, 404);
  html(res, pagina({
    titulo: 'No encontrado · FarmaRadar',
    clase: 'app',
    cuerpo: `${cabeceraPublica()}<main class="ancho app-main angosto"><section class="caja-busqueda centro">
      <h1>${ico.radar} Esto no está en el radar</h1><p class="sub">La página que buscas no existe o ya caducó.</p>
      <a class="boton primario" href="/buscar">${ico.buscar} Buscar una medicina</a></section></main>${pie}`,
  }), 404);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/static/') && (req.method === 'GET' || req.method === 'HEAD')) {
      if (await estatico(req, res, url.pathname.slice('/static/'.length))) return;
      return noExiste(req, res);
    }
    const m = rutas.busca(req.method, url.pathname);
    if (!m) return noExiste(req, res);
    const r = await m.fn(req, res, { params: m.params, q: url.searchParams });
    if (r === false && !res.headersSent) noExiste(req, res);
  } catch (e) {
    console.error(e);
    if (res.headersSent) return res.end();
    const status = e.status || 500;
    if (req.url.startsWith('/api/')) return json(res, { error: status === 500 ? 'Algo falló. Intenta de nuevo.' : e.message }, status);
    html(res, '<!doctype html><meta charset="utf-8"><title>Error</title><p>Algo falló. Intenta de nuevo en un momento.</p>', status);
  }
});

server.listen(PORT, HOST, () => console.log(`FarmaRadar en http://${HOST}:${PORT}`));

// UVLIS lo detiene con SIGTERM: cerrar ordenado.
for (const s of ['SIGTERM', 'SIGINT']) {
  process.on(s, () => {
    server.close();
    Promise.resolve(db.cerrar()).catch(() => {}).finally(() => process.exit(0));
  });
}
