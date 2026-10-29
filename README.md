# 💊 FarmaRadar

> **La red inteligente contra el desabasto de medicamentos que conecta en tiempo real a pacientes con farmacias de cadena y boticarios de barrio mediante web scraping, voz con IA y automatización.**

🌐 **En vivo:** [farmaradar.lat](https://farmaradar.lat) · 🎬 **Presentación con voz:** [farmaradar.lat/presentacion](https://farmaradar.lat/presentacion) · 📄 [PDF](https://farmaradar.lat/presentacion.pdf)

---

## 💡 Inspiración y Problemática (El Dolor Social)

En México y Latinoamérica, el **desabasto de medicamentos críticos** (diabetes, hipertensión, tratamientos oncológicos y salud mental) obliga a miles de familias y cuidadores a peregrinar de sucursal en sucursal bajo el sol, perder horas vitales o pagar sobreprecios de hasta el 400%.

Detectamos dos grandes fallas estructurales en el mercado actual:
1. **Silos cerrados en grandes cadenas:** Las cadenas comerciales (San Pablo, Farmacias del Ahorro, Guadalajara) no comparten inventarios ni cuentan con APIs públicas unificadas; nunca le dirán al paciente si la farmacia de enfrente sí tiene la medicina.
2. **Desconexión digital de las farmacias de barrio:** El **40% de las farmacias son independientes o locales**. No tienen página web ni tienda en línea, pero **muchas veces sí cuentan con existencia en mostrador** de lotes locales o equivalentes cuando las grandes cadenas ya los agotaron.

---

## 🚀 ¿Qué hace FarmaRadar?

**FarmaRadar** es un buscador unificado y asistente de voz del lado del paciente que opera en **dos fases de rescate**:

1. **Fase 1 — Rastreo Multi-Cadena en Tiempo Real (`Firecrawl`):** Busca la medicina en el sitio de cada cadena (Farmacias del Ahorro, Farmacias Guadalajara y Farmacias Benavides) y lee la ficha del producto: nombre exacto, precio y existencia. El precio sale de los datos de la propia ficha; nunca se inventa.
2. **Fase 2 — Rescate de Farmacias de Barrio sin Internet (`ElevenLabs`):** Cuando el medicamento está agotado en las cadenas, FarmaRadar le pregunta por el paciente a las farmacias independientes cercanas:
   - **🎙️ Pregunta con voz natural (`ElevenLabs`):** El boticario escucha la pregunta («Un paciente cerca busca insulina glargina, ¿la tiene? ¿a qué precio?») y **contesta hablando**; FarmaRadar transcribe su respuesta, entiende si la tiene y el precio, y la pantalla del paciente se pone en verde.
   - **🗣️ «Háblale a FarmaRadar»:** El paciente también puede buscar sin escribir: dice qué medicina busca y dónde, y FarmaRadar le contesta con voz qué encontró, a qué precio y quién la tiene cerca.
   - **🗺️ Mapa (`Google Maps`):** Cada farmacia aparece con el color del semáforo, su precio y el botón «Cómo llegar».

---

## 🛠️ Cómo lo construimos y Tecnologías Integradas

* **🔥 Firecrawl (API REST `/v1/search` + `/v1/scrape`):** Búsqueda web limitada al dominio de cada cadena y extracción JSON de la ficha del producto (producto, precio, existencia), con caché de 30 minutos.
* **🎙️ ElevenLabs (Text-to-Speech + Speech-to-Text):** Voz multilingüe (`eleven_multilingual_v2`) para preguntar al boticario y para el asistente del paciente, y transcripción con **Scribe** para entender lo que contestan. El código también soporta llamadas telefónicas salientes con un agente conversacional de ElevenLabs (se activan al configurar el agente y un número).
* **🗺️ Google Maps (Maps JavaScript + Geocoding):** Mapa del resultado, ubicación de la colonia o código postal del paciente y registro de farmacias en el mapa.
* **⚡ n8n (listo para conectar):** FarmaRadar envía los eventos `alerta` y `confirmado` al webhook de n8n configurado y recibe las confirmaciones de WhatsApp en `POST /api/webhooks/n8n`.
* **💜 Lovable:** Algunos detalles de diseño de la interfaz se prototiparon con Lovable.
* **Node.js + MySQL**, sin framework; panel del equipo, panel del boticario y registro express de farmacias.

> Para la demo hay **farmacias de barrio de demostración** (marcadas «Demo») en 35 ciudades: contestan solas y no tienen teléfono. Se borran desde el panel.

---

## 🏆 Retos a los que aplica (Challenges)

- **Best Use of Firecrawl**
- **Best Use of ElevenLabs**
- **Best n8n Integration**
- **Best Built with Lovable**

---

## ⚙️ Instalación y Ejecución Local

```bash
# 1. Instalar dependencias (Node 22 o más reciente y MySQL)
npm install

# 2. Configurar variables de entorno: copia .env.example a .env y llena
DB_HOST=127.0.0.1
DB_USER=farmaradar
DB_PASSWORD=tu_clave
DB_NAME=farmaradar
FIRECRAWL_API_KEY=tu_api_key
ELEVENLABS_API_KEY=tu_api_key
GOOGLE_MAPS_API_KEY=tu_api_key
N8N_WEBHOOK_URL=tu_webhook_n8n   # opcional

# 3. Iniciar servidor (crea las tablas solo)
npm start

# 4. (Opcional) Farmacias de demostración en todo México
node scripts/demo-farmacias.mjs
```

📚 Documentación técnica (rutas, APIs, seguridad): [`docs/TECNICO.md`](docs/TECNICO.md) · Licencia: [MIT](LICENSE)
