# FarmaRadar

La red inteligente contra el desabasto de medicamentos: conecta en tiempo real a pacientes con farmacias de cadena
y boticarios de barrio mediante web scraping, agentes de voz y WhatsApp. Node 22.13 o más reciente, sin framework,
MySQL propia (`farmaradar`). Proyecto de UVLIS (Código), carpeta `farmaradar`, publicado en https://farmaradar.lat.

- Arrancar: `npm start` (UVLIS lo hace con «Iniciar» y le da el puerto en `PORT`).
- Comprobar que responde: `GET /salud` → 200.
- Configuración: `.env` (copia de `.env.example`; nunca va a git).

## Partes

| Ruta | Qué es |
|---|---|
| `/` | Landing: el problema, cómo funciona y el registro de farmacias. |
| `/buscar` → `/b/:id` | El buscador del paciente y su resultado en vivo: semáforo, mapa, genéricos y «Buscar en farmacias locales». |
| `/farmacias/registro` | Registro express del boticario (sin contraseña: recibe su enlace privado). |
| `/f` | Panel de la farmacia: solicitudes de su zona y sus datos. |
| `/r/:token` | Donde el boticario contesta «sí la tengo / no la tengo» y su precio (el enlace que va por WhatsApp). |
| `/panel` | Panel del equipo: tablero, búsquedas, farmacias, cadenas, integraciones, actividad y cuenta. |

**Acceso inicial al panel:** el usuario y la contraseña de `ADMIN_USUARIO` / `ADMIN_CLAVE_INICIAL` del `.env`
(se crea solo la primera vez que arranca). Cámbiala en **Mi cuenta**.

## Cómo funciona una búsqueda

1. **Fase 1**: cada cadena activa (Panel → Cadenas, con `{q}` donde va la medicina) se consulta con **Firecrawl**; a la
   vez **Gemma 4** identifica el principio activo y sugiere genéricos.
2. **Fase 2** (la pide el paciente): las farmacias de barrio del mismo CP, la misma colonia o a menos de 5 km reciben la
   solicitud: por WhatsApp (**n8n**), la más cercana además por llamada (**ElevenLabs**, con tope diario
   `LLAMADAS_POR_DIA`) y todas en su panel. Cada respuesta aparece en la pantalla del paciente; si dejó su WhatsApp,
   n8n le avisa.

## Las APIs (huecos listos)

Todas viven en `lib/integraciones.js` y se encienden solas al poner su clave en el `.env` y reiniciar. Sin ellas el
sistema funciona: las farmacias contestan desde su panel o su enlace.

| API | Variables | Contrato |
|---|---|---|
| Firecrawl | `FIRECRAWL_API_KEY` | `POST /v1/search` («medicina site:dominio de la cadena») y `POST /v1/scrape` de la ficha con extracción JSON; el precio sale de `product:price:amount` de la ficha. Caché de 30 min por cadena y medicina. |
| Google Maps | `GOOGLE_MAPS_API_KEY` | Mapa del resultado (marcadores del semáforo, «Cómo llegar») y el del registro de farmacia (tocar, arrastrar o buscar la dirección con Geocoder). Sin clave, Leaflet. |
| ElevenLabs (voz) | `ELEVENLABS_API_KEY` (opcional `ELEVENLABS_VOICE_ID`) | En `/r/:token` y en `/f` la farmacia escucha la pregunta (`GET /r/:token/voz.mp3`, texto a voz) y contesta hablando (`POST /r/:token/voz`, voz a texto con Scribe → sí/no y precio). |
| ElevenLabs (llamada, opcional) | además `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID` | Llamada saliente por Twilio con `{{farmacia}}`, `{{medicamento}}`, `{{token}}`; el agente contesta con su herramienta a `POST /api/webhooks/voz` `{token, tiene, precio, transcripcion}`. |
| n8n | `N8N_WEBHOOK_URL` | Recibe `{evento:'alerta', farmacias:[{nombre, whatsapp, token, enlace}]}` y `{evento:'confirmado', paciente_whatsapp, …}`; contesta a `POST /api/webhooks/n8n` `{token, tiene, precio, nota}`. |
| Gemma 4 | `GEMMA_URL`, `GEMMA_MODELO`, `GEMMA_API_KEY` | Cualquier API compatible con OpenAI (`/chat/completions`). |
| MojoAuth | `MOJOAUTH_API_KEY` | Pendiente: entrar sin contraseña. Hoy el boticario entra con su enlace privado. |

Los dos webhooks exigen la cabecera `X-FarmaRadar-Secreto` = `WEBHOOK_SECRETO`.

**Panel → Integraciones** prueba cada API en vivo (consultas gratuitas) y dice qué falta. Con la clave de ElevenLabs
(con permiso de «ElevenLabs Agents») el botón «Crear el agente de voz» crea el agente con su guion y la herramienta
`registrar_respuesta`; su id y el del número se guardan en la tabla `ajustes` (lo del `.env` manda). **Panel → Cadenas**
muestra la última consulta de cada cadena: si su web bloquea la lectura automática o no muestra los productos, se marca
como error y el paciente ve «No se pudo consultar» (nunca un «agotado» inventado).

## Código

- `server.js`: arranque y enrutado. `lib/`: base (`db.js`, `esquema.js`), `busqueda.js` (las dos fases),
  `integraciones.js` (las APIs), `seguridad.js`, `sesion.js`, `http.js`, `vistas.js`, `util.js`.
- `rutas/`: `publico.js` (landing, buscador, farmacias), `api.js` (API y webhooks), `panel.js`.
- `public/`: `estilos.css` (claro y oscuro), `resultado.js` (en vivo + mapa Leaflet), `buscar.js`, `ubicacion.js`, `comun.js`.

## Seguridad

Contraseñas con scrypt, sesiones en la base (cookie HttpOnly, SameSite), los POST del navegador deben venir de la misma
página, frenos por IP (búsquedas, registro, entrar, respuestas), los enlaces de farmacia y de solicitud no se pueden
adivinar y solo se guarda el sha256 del acceso. El paciente nunca ve teléfonos de las farmacias.
