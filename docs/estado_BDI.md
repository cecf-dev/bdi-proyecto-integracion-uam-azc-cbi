# Estado del Proyecto BDI - Botiquín Digital Inteligente

> **Versión del documento:** v4.1
> **Última actualización:** 2026-08-28
> **Hito actual:** 10 — Escáner de medicamentos con IA (implementado y verificado E2E + campo)

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

## Siguiente Paso Lógico (pendiente)

### Candidatos para el siguiente hito (NO iniciar sin indicación del equipo)

- ✔ REALIZADO (2026-08-28): prueba en campo del hito 10 con imagen real desde el navegador → OK.
- Opción híbrida del hito 10: decodificación de código GS1 DataMatrix (GTIN/lote/caducidad
  exactos) con ZXing-js; si no se detecta, caer al análisis visual con Groq.
- Historial de envíos de notificaciones en BD (tabla `notificaciones_enviadas` + vista en el Dashboard).
- Code-splitting del bundle del cliente (~524 kB; Leaflet + react-speech-recognition perezosos).
- Soporte offline/PWA del Dashboard.
- Activar `NOTIF_CRON_ENABLED=true` en producción una vez desplegado.
