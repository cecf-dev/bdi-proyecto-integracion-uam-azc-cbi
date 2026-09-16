# Estado del Proyecto BDI - Botiquín Digital Inteligente

> **Versión del documento:** v5.0
> **Última actualización:** 2026-09-15
> **Hito actual:** 10 — Escáner de medicamentos con IA (implementado y verificado E2E + campo)
> **Próximo hito:** 11 — Catálogo CIE-10 + mapeo de síntomas + filtro de relevancia

---

## Resumen General

El sistema web responsivo BDI digitaliza recetas médicas con IA (Groq / Llama 3 Vision),
gestiona el inventario de medicamentos con alertas de caducidad y permite comparar precios
y localizar farmacias. Arquitectura estricta de 3 capas (Datos / Lógica / Visualización);
el frontend nunca se comunica directamente con la base de datos.

---

## Progreso Técnico (todos los hitos completados)

### 1. Base de Datos (MySQL)
- `database/schema.sql` (v2): `usuarios`, `medicamentos`, `recetas`, `receta_medicamentos`, `busquedas_precios`.
- PKs `INT UNSIGNED AUTO_INCREMENT`, FKs nombradas con `ON DELETE CASCADE`, `ENUM` con `NOT NULL`,
  charset `utf8mb4_unicode_ci`, `InnoDB`, índices en FKs/email/estado/caducidad.
- Migración aplicada a la BD existente: `imagen_base64 LONGTEXT` (antes `imagen_url TEXT`) y columna `paciente_nombre`.

### 2. Autenticación (iteraciones v1.0/v1.1)
- Login con Google OAuth 2.0, JWT propio, `AuthContext.jsx`, middleware `authMiddleware.js` en todas las rutas protegidas.

### 3. Módulo de Recetas (completo)
- `RecetaScanner.jsx`: captura de imagen (drag & drop + input), conversión a Base64 con `FileReader` (sin Multer).
- `POST /api/recetas/analizar`: análisis multimodal con Groq (prompt estricto, `response_format json_object`).
- `FormularioValidacion.jsx`: revisión y corrección de datos extraídos por la IA antes de guardar.
- `POST /api/recetas/guardar`: persistencia transaccional (receta + medicamentos) en `recetaModel.createConMedicamentos()`.
- `GET /api/recetas`: historial paginado (`findByUsuario`, medicamentos en 1 consulta `IN`, sin Base64).
- `GET /api/recetas/:id`: detalle completo con imagen Base64 y verificación de propiedad (`findByIdUsuario`).
- `PUT /api/recetas/:id`: edición de datos clínicos y reemplazo de medicamentos (transacción).
- `DELETE /api/recetas/:id`: eliminación con cascada de medicamentos.
- Vistas: `HistorialRecetas.jsx` (cards enlazadas al detalle), `RecetaDetalle.jsx` (imagen, datos, edición inline, eliminar).

### 4. Módulo de Inventario / Botiquín (completo)
- `medicamentoModel.js`: CRUD con verificación de propiedad y cálculo automático de estado
  (`vigente` / `por_vencer` <= 30 días / `caducado`), recalculado en cada lectura y escritura.
- Endpoints: `GET /api/inventario` (lista + resumen), `POST` (crear), `POST /batch` (lote transaccional,
  máx. 50, conexión receta → botiquín), `PUT /:id`, `DELETE /:id`.
- `GET /api/inventario/alertas?dias=30`: recordatorios con `dias_restantes` calculado (umbral saneado, máx. 365).
- `Inventario.jsx`: una sola columna, resumen de alertas, formulario agregar/editar, cards con badge,
  banner proactivo de alertas con días restantes.

### 5. Conexión Receta → Botiquín
- Al guardar una receta, `FormularioValidacion` ofrece "Agregar al Botiquín" / "No, gracias"
  (mapeo nombre_medicamento/dosis/indicaciones → nombre/dosis/notas) vía `POST /api/inventario/batch`.

### 6. Módulo de Farmacias (completo)
- `serpapiService.js`: precios (Google Shopping MX, top 20) y farmacias cercanas (Google Maps con coordenadas GPS).
- `farmaciaModel.js`: historial en `busquedas_precios` (JSON, lectura con `JSON_LENGTH`).
- Endpoints: `POST /api/farmacias/buscar`, `POST /api/farmacias/cercanas` (validación lat/lng), `GET /api/farmacias/historial`.
- `Farmacias.jsx`: búsqueda de precios, mapa Leaflet con pines `divIcon` personalizados (geolocalización del navegador),
  lista de farmacias con rating, historial. Dictado por voz del medicamento (`react-speech-recognition`, es-MX).

### 7. Dashboard
- `Dashboard.jsx`: saludo personalizado, resumen numérico, accesos rápidos (una columna),
  alertas de caducidad consumiendo `/inventario/alertas` ("Caduca en X día(s)"), recetas recientes enlazadas al detalle.

### 8. Preparación Final
- Fix del build del cliente (`vite build`; antes `tsc` fallaba por falta de tsconfig).
- `package.json` raíz con `install:all`, `dev:client`, `dev:server`, `build:client`, `start:server`, `db:setup`.
- `README.md` actualizado: preparación de BD, scripts raíz, módulos y tabla de 17 endpoints.
- `.env.example` de client y server completos; `.gitignore` protege `.env`.

### 9. Notificaciones de caducidad por correo (completo)
- **Tecnología decidida:** Nodemailer + SMTP de Gmail (App Password) + node-cron (scheduler diario).
- **Migración 003** (`database/migraciones/003_notificaciones_usuarios.sql`, aplicada a la BD local):
  columnas `notif_activas TINYINT(1) DEFAULT 1` y `notif_umbral_dias INT UNSIGNED DEFAULT 30` en `usuarios`.
  `schema.sql` actualizado a v3 (para instalaciones nuevas).
- **Capa de Datos:** `notificacionModel.js` — `getPreferencias`, `updatePreferencias`, `findDestinatarios`
  (usuarios con notif_activas=1 y email válido). Las alertas se reutilizan de `medicamentoModel.findAlertas`.
- **Capa de Lógica:**
  - `services/emailService.js`: transporter Nodemailer (SMTP Gmail, secure 465), validación de configuración
    (503 si faltan credenciales) y plantilla HTML responsiva de una columna con estilos inline
    (estado caducado/por vencer, días restantes, fecha es-MX).
  - `services/notificacionService.js`: `enviarResumenDiario()` (secuencial, omite usuarios sin alertas,
    resumen con errores por destinatario) y `enviarCorreoPrueba()` (solo al usuario autenticado).
  - Scheduler en `server.js`: node-cron `0 8 * * *` (America/Mexico_City), activado solo con
    `NOTIF_CRON_ENABLED=true`.
- **Endpoints (protegidos con JWT):**
  - `GET /api/notificaciones/preferencias` — email, notif_activas, notif_umbral_dias del usuario.
  - `PUT /api/notificaciones/preferencias` — valida booleano y umbral 1-365 (saneado), actualiza.
  - `POST /api/notificaciones/probar` — envía el resumen real de alertas al correo del usuario
    (verificación de entrega sin spamear; 503 claro si SMTP no configurado).
- **Capa de Visualización:** tarjeta "Notificaciones por correo" en `Dashboard.jsx` (una columna):
  checkbox estático "Recibir recordatorio diario", input numérico de umbral (1-365),
  botones amplios y estáticos "Guardar preferencias" y "Enviar correo de prueba" con mensajes de estado.
- **Dependencias nuevas:** `nodemailer` y `node-cron` en `server/package.json`.
- **Configuración:** variables `SMTP_HOST/PORT/SECURE/USER/PASS`, `EMAIL_FROM`, `NOTIF_CRON_*`
  agregadas a `env.js`, `server/.env.example` y `server/.env` (placeholders vacíos listos para rellenar).

### 10. Escáner de Medicamentos con IA (completo)
- **Capa de Lógica:** `POST /api/inventario/analizar` en `inventarioController.analizar()`.
  - Recibe `{ imagenBase64 }` (data URL), la comprime con `sharp` (máx. 1280px, JPEG q80)
    para reducir consumo de tokens del plan gratuito de Groq.
  - Prompt estricto (JSON puro, campos del botiquín) + `response_format json_object`,
    modelo `qwen/qwen3.6-27b`, reintento automático ante `json_validate_failed`.
  - `sanitizarExtraidos()`: normaliza fechas (YYYY-MM-DD), unidades contra la lista
    permitida, cantidades 0-999999, máx. 20 medicamentos; descarta los sin nombre.
  - Aprendizaje importante (documentado para el equipo): el modelo piensa
    (chain-of-thought) antes del JSON; sin `response_format` devuelve `<think>...`.
    `max_completion_tokens` altos exceden el límite de 8,000 TPM del plan gratuito.
    La compresión de imagen fue clave (análisis en ~2.7s).
- **Capa de Visualización:** `Inventario.jsx` — botón "📷 Escanear Medicamento con IA"
  (una columna, estático y amplio), zona de captura (clic/arrastrar, `capture="environment"`
  para cámara móvil), vista previa, botones "Cambiar foto" / "Analizar con IA", lista de
  medicamentos detectados con "Usar estos datos" → prellenan el formulario existente
  (validación humana obligatoria) → guarda con `POST /api/inventario` (reutilizado).
- Sin cambios de esquema de BD (usa la tabla `medicamentos` existente).

---

## Arquitectura (3 capas)

```
Frontend (React + Tailwind)  →  API REST (Express + JWT)  →  Capa de Datos (Modelos)  →  MySQL
Integraciones: Groq SDK, SerpApi (servicio), Leaflet, React Speech Recognition
```

```
client/src/
├── components/layout/Navbar.jsx
├── components/FormularioValidacion.jsx
├── context/AuthContext.jsx
├── services/api.js               (Axios + JWT + manejo global de errores)
└── pages/
    ├── Home.jsx, Login.jsx, Dashboard.jsx
    ├── RecetaScanner.jsx, HistorialRecetas.jsx, RecetaDetalle.jsx
    ├── Inventario.jsx, Farmacias.jsx
    └── App.jsx                   (rutas públicas/privadas)

server/src/
├── config/        env.js, db.js (pool mysql2)
├── middlewares/   authMiddleware.js, errorHandler.js
├── models/        userModel, recetaModel, medicamentoModel, farmaciaModel, notificacionModel
├── controllers/   authController, recetaController, inventarioController, farmaciaController, notificacionController
├── routes/        authRoutes, recetaRoutes, inventarioRoutes, farmaciaRoutes, notificacionRoutes, healthRoutes
├── services/      serpapiService.js, emailService.js, notificacionService.js
└── app.js
server/server.js   (punto de entrada + scheduler node-cron del recordatorio diario)

database/schema.sql
```

---

## Endpoints Activos (todos protegidos con JWT excepto /api/auth y /api/health)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/google` | Login con Google |
| GET | `/api/auth/me` | Perfil del usuario |
| POST | `/api/recetas/analizar` | Análisis de imagen con IA (Groq) |
| POST | `/api/recetas/guardar` | Guardar receta validada (transaccional) |
| GET | `/api/recetas` | Historial paginado |
| GET | `/api/recetas/:id` | Detalle completo con imagen |
| PUT | `/api/recetas/:id` | Editar datos clínicos y medicamentos |
| DELETE | `/api/recetas/:id` | Eliminar receta |
| GET | `/api/inventario` | Botiquín con resumen |
| GET | `/api/inventario/alertas` | Recordatorios de caducidad (umbral en días) |
| POST | `/api/inventario/analizar` | Analiza foto de empaque con IA (Groq Vision) |
| POST | `/api/inventario` | Agregar medicamento |
| POST | `/api/inventario/batch` | Agregar lote (máx. 50) |
| PUT | `/api/inventario/:id` | Actualizar medicamento |
| DELETE | `/api/inventario/:id` | Eliminar medicamento |
| POST | `/api/farmacias/buscar` | Precios (SerpApi Google Shopping) |
| POST | `/api/farmacias/cercanas` | Farmacias con GPS (Google Maps) |
| GET | `/api/farmacias/historial` | Últimas 10 búsquedas |
| GET | `/api/notificaciones/preferencias` | Preferencias de notificación del usuario |
| PUT | `/api/notificaciones/preferencias` | Actualiza notif_activas y umbral de días |
| POST | `/api/notificaciones/probar` | Correo de prueba al usuario autenticado |

---

## Estado de Verificación

- Pruebas E2E ejecutadas contra servidor real + JWT real + MySQL real en cada hito
  (crear/leer/editar/eliminar, propiedad de datos con 404, validaciones 400, 401 sin token, cascada).
- Integración real con SerpApi verificada (ofertas y farmacias con coordenadas).
- `node --check` en todos los archivos del backend y `npm run build` del cliente sin errores.
- Hito 9 verificado con servidor real (puerto 5095) y JWT firmado:
  - `GET /notificaciones/preferencias`: 401 sin token, 200 con datos reales del usuario.
  - `PUT /notificaciones/preferencias`: 400 con body inválido; umbral 45 aplicado; umbral 999 saneado a 365.
  - `POST /notificaciones/probar`: 503 con mensaje claro (SMTP aún sin credenciales).
  - Regresión de `/inventario` y `/inventario/alertas?dias=45` OK.
  - Scheduler registra "Notificaciones automáticas deshabilitadas" con `NOTIF_CRON_ENABLED=false`.
- ENTREGA REAL VERIFICADA (2026-08-17): con App Password de Gmail configurada en `server/.env`
  (`SMTP_USER` corregido al correo completo), `POST /api/notificaciones/probar` respondió 200 y el
  correo llegó a la bandeja del usuario (messageId de Gmail confirmado). Asunto:
  "BDI [Prueba]: todo en orden en tu botiquín" (botiquín vacío en ese momento).
- Repositorio publicado en GitHub: https://github.com/cecf-dev/bdi-proyecto-integracion-uam-azc-cbi
  (commit inicial `a109878` en `main`).
- Hito 10 verificado E2E (servidor real puerto 5095 + JWT real + Groq real):
  - `POST /api/inventario/analizar`: 401 sin token, 400 sin imagen.
  - Con imagen sintética de caja de medicamento (SVG→PNG): 200 en ~2.7s extrayendo
    nombre "PARACETAMOL", dosis "500 mg", 20 tabletas, lote "AB1234" y caducidad
    "01/2027" → "2027-01-31" (regla de último día del mes aplicada por la IA).
  - `node --check` backend OK y `npm run build` cliente OK (bundle ~524 kB).
- PRUEBA EN CAMPO (2026-08-28, servidor real puerto 5000 + JWT real + Groq real + navegador):
  - Login con Google real, Dashboard e Inventario cargaron con 200.
  - Escáner de medicamentos con imagen real: `POST /api/inventario/analizar` 200 en ~4.2s,
    1 medicamento detectado y prellenado en el formulario para confirmación humana.
  - Módulo escáner en campo: OK.
- Diagnóstico Groq documentado: sin `response_format` el modelo emite `<think>`; con él
  y la imagen comprimida el JSON es válido y rápido.

## Notas del Entorno

- Puertos TCP 5060-5061 bloqueados en la máquina Windows local; usar 5090+ para pruebas.
- IMPORTANTE (2026-08-28): el backend debe arrancar en su puerto nativo `PORT=5000`, que es
  el que esperan el frontend (`client/.env VITE_API_URL`) y el proxy de Vite (`vite.config.js`).
  No forzar `PORT` al iniciar el backend por terminal (heredado al proceso hijo), o el login
  fallará con "Error de conexión" (`api.js` status 0) por no coincidir con el puerto esperado.
- Bundle JS ~518 kB (Leaflet + React + speech); warning de tamaño, candidato a code-splitting.
- El modelo `usuarios` guarda el email de Google (destinatario de las notificaciones, ya en uso).
- Migración 003 ya aplicada a la BD local (`bdi_db`); no ejecutarla dos veces.

---

## Plan de Implementación Pendiente (Hitos 11–16)

> **Origen de este plan:** Auditoría de código completa (2026-09-15) documentada en
> `Estado_Actividades_BDI.md`. Define los hitos para cerrar las brechas detectadas
> (catálogo CIE-10 sin integrar, sin mapeador de síntomas ni filtro de relevancia,
> cámara solo con `capture`, geolocalización no en tiempo real y sin búsqueda por
> dirección, sin TTS, y sin pruebas automatizadas/carga/accesibilidad).

### Roadmap resumido

| Hito | Entregable clave | Prioridad | Dependencias |
|------|------------------|-----------|--------------|
| 11 | CIE-10: catálogo + mapeo de síntomas + relevancia | Alta | Ninguna |
| 12 | Cámara `getUserMedia` + geolocalización en tiempo real + búsqueda por dirección | Alta | Ninguna |
| 13 | Accesibilidad por voz: STT de síntomas + TTS | Media | Hito 11 (mapeo CIE-10) |
| 14 | Pruebas automatizadas de integración IA↔BD | Alta | Ninguna |
| 15 | Pruebas de carga y rendimiento | Media | Hito 14 (mismo script `test`) |
| 16 | Pruebas de usabilidad, responsividad y accesibilidad | Media | Hitos 12-13 |

---

### Hito 11 — Catálogo CIE-10 + mapeo de síntomas a CIE-10 + filtro de relevancia

**Objetivo:** pasar de un campo libre `codigo_cie10` a un modelo con catálogo oficial,
traducción de texto/síntomas coloquiales a códigos y ranking de diagnósticos.

**11.1 Catálogo en la capa de datos**
- Crear `database/migraciones/004_cie10_catalogo.sql` y agregar la tabla al final de `database/schema.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS cie10_categorias (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,        -- ej. 'J02'
    descripcion VARCHAR(255) NOT NULL,         -- ej. 'Faringitis aguda'
    capitulo VARCHAR(120),
    INDEX idx_cie10_desc (descripcion)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
- Crear `server/scripts/seed-cie10.js` (Node + `mysql2/promise`) que cargue el catálogo
  (fuente pública CIE-10, formato CSV/JSON) con `INSERT ... ON DUPLICATE KEY UPDATE` e
  inserciones por lotes. Agregar script npm `"seed:cie10"` en `server/package.json`.

**11.2 Mapeador local (búsqueda textual normalizada)**
- Crear `server/src/services/cie10Service.js` con:
  - `normalizar(texto)`: mayúsculas, sin tildes, sin signos de puntuación.
  - `buscarPorTexto(q, limite)`: `SELECT ... WHERE descripcion LIKE ?` (prefijo) + FULLTEXT.
- Endpoint **`GET /api/cie10?q=`** (protegido por JWT) en `server/src/routes/cie10Routes.js`
  → autocompletado del frontend.

**11.3 Mapeador semántico con Groq (texto coloquial → CIE-10)**
- Crear `server/src/services/cie10MapperService.js` (reutiliza el modelo ya usado, `qwen/qwen3.6-27b`):
  ```js
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Convierte síntomas coloquiales en candidatos CIE-10 con relevancia
  const mapearSintoma = async (descripcion) => {
    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un codificador clínico. Devuelve SOLO un JSON: ' +
            '{"codigo_encontrado": null, "candidatos": [' +
            '{"codigo":"J02","descripcion":"Faringitis aguda","relevancia":0.9}], ' +
            '"texto_normalizado":"..."}. Usa la CIE-10.',
        },
        { role: 'user', content: `Paciente refiere: ${descripcion}` },
      ],
      response_format: { type: 'json_object' },
    });
    return JSON.parse(completion.choices[0].message.content);
  };
  module.exports = { mapearSintoma };
  ```
- Los candidatos devueltos por la IA se **contrastan contra `cie10_categorias`** para
  confirmar que el código existe en el catálogo.
- Endpoint **`POST /api/cie10/mapear`** (`{ descripcion }`) con validación de entrada
  reutilizando el patrón de los controladores actuales (errores con `statusCode`).

**11.4 Filtro de relevancia de diagnósticos**
- Crear `server/src/services/relevanciaService.js`:
  - Modificar el `systemPrompt` de `recetaController.analizarReceta()` para que devuelva
    `diagnosticos_candidatos: [{ texto, codigo_cie10, relevancia }]`.
  - `calcularRelevancia(candidatos, medicamentos)` → puntúa `relevancia * 0.7 + coincidencia
    de tokens con los medicamentos prescritos * 0.3`, ordena descendente y descarta `score < 0.5`.
  - El diagnóstico de mayor score llena `diagnostico` y `codigo_cie10`; los demás se devuelven
    al frontend para validación humana.

**11.5 Frontend**
- `FormularioValidacion.jsx`: campo `diagnostico` con autocompletado desde `GET /api/cie10?q=`
  y botón "Traducir a CIE-10" que llama a `POST /api/cie10/mapear` y muestra los candidatos
  ordenados por relevancia para confirmar.
- `RecetaDetalle.jsx`: mostrar el diagnóstico principal y las alternativas con su relevancia.

**Verificación:** `seed:cie10` carga el catálogo (COUNT > 13,000); `GET /api/cie10?q=` responde
200 en <50 ms (índices); `POST /api/cie10/mapear` con "me duele la garganta" → J02 relevancia > 0.8;
un diagnóstico candidato con score < 0.5 queda fuera del ranking.

---

### Hito 12 — Cámara `getUserMedia` + geolocalización en tiempo real + búsqueda por dirección

**Objetivo:** captura fotográfica con visor real (no solo `capture`), seguimiento de ubicación
en vivo y geocodificación por dirección para las farmacias.

**12.1 Componente de cámara (capa visualización)**
- Crear `client/src/components/CameraCapture.jsx`:
  ```jsx
  import { useRef, useState, useEffect } from 'react';

  export default function CameraCapture({ onCapture, label = 'Tomar foto' }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [activo, setActivo] = useState(false);

    const iniciar = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setActivo(true);
    };

    const capturar = () => {
      const canvas = document.createElement('canvas');
      const v = videoRef.current;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d').drawImage(v, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg', 0.85)); // dataURL compatible con /analizar
      detener();
    };

    const detener = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setActivo(false);
    };

    useEffect(() => () => detener(), []);

    return activo ? (
      <div>
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
        <button type="button" onClick={capturar} className="btn-primary w-full mt-3">{label}</button>
        <button type="button" onClick={detener} className="btn-secondary w-full mt-2">Cancelar</button>
      </div>
    ) : (
      <button type="button" onClick={iniciar} className="btn-accent w-full">📷 {label}</button>
    );
  }
  ```
- Integrar en `RecetaScanner.jsx` y `Inventario.jsx` como alternativa a la zona de drag&drop,
  manteniendo el flujo actual `imagenBase64 → POST /recetas/analizar | /inventario/analizar`.
- Manejar permisos denegados (`NotAllowedError`) con mensaje claro y fallback al `input file`.

**12.2 Geolocalización en tiempo real**
- En `client/src/pages/Farmacias.jsx`, agregar modo "Seguimiento en vivo" con
  `navigator.geolocation.watchPosition()` que actualiza `posicion` y re-consulta
  `POST /api/farmacias/cercanas` cuando el desplazamiento supere un umbral (ej. 30 m).
- Limpiar el watcher con `clearWatch()` en `useEffect` cleanup.

**12.3 Búsqueda manual por dirección**
- En el backend, crear **`POST /api/farmacias/geocodificar`** (`{ direccion }`) en
  `farmaciaController.js` (mismo estilo de validación que `buscarCercanas`).
- Implementación del servicio en `serpapiService.js` (geocoding vía SerpApi Google Maps)
  o como fallback con Nominatim/OpenStreetMap; devolver `{ lat, lng }`.
- En el frontend, input "Buscar farmacia por dirección" + botón "Buscar" → geocodifica,
  centra el `MapContainer` (flyTo) y consulta las farmacias cercanas a esa coordenada.

**Verificación:** captura desde cámara produce una imagen analizable por Groq; el mapa se
actualiza solo al moverse (>30 m); escribir una dirección válida centra el mapa y lista farmacias.

---

### Hito 13 — Accesibilidad por voz: captura de síntomas (STT) y lectura de resultados (TTS)

**Objetivo:** completar el dictado por voz (hoy solo sirve para el nombre del medicamento)
y añadir la lectura de resultados en voz alta.

**13.1 Hook reutilizable `client/src/hooks/useVoz.js`**
- STT: extiende `react-speech-recognition` (ya instalado) con `continuous: true` para
  capturar frases largas de síntomas.
- TTS: usa la Web Speech API (`speechSynthesis`) con selección de voz en español:
  ```js
  const leerEnVozAlta = (texto) => {
    if (!('speechSynthesis' in window)) return;
    const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-MX';
    u.rate = 0.95;
    if (voz) u.voice = voz;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  ```

**13.2 Captura de síntomas por voz**
- Nueva vista (o sección en Dashboard): botón "🎤 Dictar mis síntomas" → el texto transcrito
  se envía a `POST /api/cie10/mapear` (Hito 11) y se muestran los diagnósticos candidatos.

**13.3 Lectura de resultados (TTS)**
- Botón "🔊 Leer" en `RecetaDetalle.jsx` (lee diagnóstico y medicamentos) y en la vista de
  precios de `Farmacias.jsx` (lee el medicamento y las ofertas más baratas).

**Verificación:** dictado captura ≥1 síntoma completo en es-MX; reproducción audible en
Chrome/Edge/Android; contraste de botones de voz cumpliendo WCAG AA (control del Temporary
button del micrófono).

---

### Hito 14 — Pruebas automatizadas de integración IA ↔ Base de datos

**Objetivo:** volver reproducible la validación E2E (hoy manual) con una suite de tests.

- Agregar devDependencies `jest` y `supertest` en `server/package.json` y script `"test": "jest"`.
- **Mock del LLM**: inyectar un `groq` falso en `recetaController` e `inventarioController`
  (patrón inyección de dependencias o `jest.mock('groq-sdk')`) para que los tests no consuman
  créditos ni dependan de red.
- `server/tests/integracionReceta.test.js`: analizar (200, JSON estructurado) → guardar (201,
  transaccional) → listar (aparece en historial) → detalle → editar → eliminar.
- `server/tests/integracionInventario.test.js`: `analizar` (build del JSON de medicamentos),
  CRUD, `batch`, alertas de caducidad (estado `caducado`/`por_vencer`/`vigente` correcto).
- Tests de seguridad: 401 sin token, 404 para IDs ajenos al usuario, 400 con payloads inválidos.
- Test E2E real opcional marcado (con `GROQ_API_KEY` real) que replica la verificación del
  Hito 10 y guarda el resultado en `docs/pruebas_ia.md`.

**Verificación:** `npm test` en servidor real + MySQL local pasa completo (la suite se integra
al mismo `npm run dev` sin interferir; la BD debe estar levantada).

---

### Hito 15 — Pruebas de carga y rendimiento del backend

**Objetivo:** línea base de rendimiento y umbrales de degradación.

- Agregar devDependency `autocannon` (ligera) o configurar `artillery`.
- `server/scripts/load-test.js`: script que golpea los endpoints de lectura principales
  (`GET /api/health`, `GET /api/recetas?page=1`, `GET /api/inventario`, `GET /api/inventario/alertas`)
  con 100 conexiones durante 30 s usando un JWT de prueba.
- Guardar resultados y conclusiones en `docs/pruebas_carga.md` (p50/p95/p99, throughput,
  errores). Ajustar `connectionLimit` del pool (`db.js`, hoy 10) según resultados.
- Considerar habilitar gzip (`compression`) si el payload JSON del historial lo justifica.

**Verificación:** informe con números de la máquina de desarrollo y, si se dispone,
de una máquina de referencia; sin errores 5xx bajo carga normal.

---

### Hito 16 — Pruebas de usabilidad, responsividad y validaciones de accesibilidad

**Objetivo:** cerrar la actividad 21 con evidencia reproducible.

- **Accesibilidad automatizada:** integrar `@axe-core/react` en desarrollo (o `@axe-core/playwright`
  en los e2e); correr Lighthouse y guardar reportes en `docs/lighthouse/`.
- **Planes de acción WCAG 2.1 AA:**
  - Auditoría de contraste de la paleta (`primary-600`/`accent-600` sobre blanco).
  - Añadir `label` a inputs que hoy dependen solo de `placeholder` (`Farmacias`, `Dashboard`,
    formulario de inventario).
  - Revisar foco visible (`focus-visible`) y jerarquía de encabezados en las páginas.
- **Responsividad:** probar breakpoints 320 / 375 / 768 / 1024 px en `RecetaScanner`,
  `Inventario`, `Farmacias`, `Dashboard` y la vista comparativa de precios; documentar con
  capturas en `docs/pruebas_ux.md`.
- **E2E Playwright** (si el tiempo lo permite): login → escanear → validar → guardar →
  inventario → farmacias, con checks básicos de accesibilidad.

**Verificación:** reportes Lighthouse ≥ 90 en Accesibilidad y Mejores Prácticas; checklist de
WCAG AA revisado sin incidencias críticas; capturas de los 4 breakpoints por pantalla.

---

## Mejoras adicionales (deuda técnica detectada en la auditoría)

- **`medico_nombre` nunca se extrae:** el `systemPrompt` de `recetaController.analizarReceta()`
  no pide este campo aunque la tabla lo almacena. Agregarlo al prompt y mapearlo en
  `FormularioValidacion.jsx`.
- **Code-splitting del cliente (~524 kB):** cargar `react-leaflet`/`leaflet` y
  `react-speech-recognition` con `React.lazy`/`dynamic import` solo en las vistas que los usan.
- **Secretos en el working tree:** `server/.env` y `client/.env` existen localmente; al rotar
  claves, verificar que `.gitignore` los excluya y nunca versionarlos.
- **Activar notificaciones en producción:** `NOTIF_CRON_ENABLED=true` una vez desplegado.
- **Opcional (hito 10 ampliado):** leer códigos GS1 DataMatrix (GTIN/lote/caducidad exactos)
  con ZXing-js, cayendo al análisis visual de Groq si no se detecta.
