# AGENTS.md — Contexto de Proyecto para el Agente (BDI)

> **Propósito:** Este archivo se carga automáticamente al inicio de cada conversación.
> Léelo completo antes de trabajar; resume **qué es el proyecto**, **cómo está
> organizado**, **qué se debe hacer** y **qué reglas respetar**.
>
> Fuentes de verdad (leer en este orden si necesitas detalle):
> 1. `docs/estado_BDI.md` — estado, hitos, verificación y plan de implementación.
> 2. `Estado_Actividades_BDI.md` — auditoría de cumplimiento de las 21 actividades técnicas.
> 3. `README.md` — instalación, endpoints y módulos.

---

## 1. Qué es el proyecto

**Botiquín Digital Inteligente (BDI)** — sistema web responsivo de la **UAM Azcapotzalco
(CBI), Proyecto de Integración**, que previene la automedicación y el consumo de medicamentos
caducados mediante:

- **Digitalización de recetas médicas** con IA multimodal (Groq / Llama 3 Vision).
- **Traducción de síntomas a terminología CIE-10** (parcial: hoy solo campo libre).
- **Inventario personal (botiquín)** con cálculo automático de caducidad y alertas.
- **Farmacias cercanas** con mapas Leaflet y **comparación de precios** vía SerpApi
  (Google Shopping MX).
- **Autenticación con Google OAuth + JWT** local.

Es un monorepositorio **client/server** con arquitectura estricta de **3 capas**:
Datos (MySQL) → Lógica (Express) → Visualización (React). El frontend **nunca** consulta la BD
directamente; todo pasa por la API REST.

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS 3 + React Router + Leaflet/react-leaflet + react-speech-recognition + @react-oauth/google |
| Backend | Node.js + Express 5 + MySQL (mysql2/promise) + JWT + Nodemailer + node-cron |
| BD | MySQL 8 (InnoDB, utf8mb4), pool de conexiones en `server/src/config/db.js` |
| IA | Groq SDK — modelo `qwen/qwen3.8-27b`, `temperature 0.1`, `max_tokens 800`, `response_format: {type:"json_object"}` |
| APIs externas | SerpApi (Google Shopping + Google Maps), Google OAuth (verifyIdToken) |

## 3. Estructura del repositorio

```
├── client/                    # Frontend React + Tailwind
│   └── src/
│       ├── App.jsx            # Rutas públicas/privadas (PrivateRoute)
│       ├── context/AuthContext.jsx
│       ├── services/api.js    # Axios + token JWT + manejo global de errores
│       ├── components/
│       │   ├── FormularioValidacion.jsx   # Validación humana de datos de la IA
│       │   └── layout/Navbar.jsx
│       └── pages/             # Home, Login, Dashboard, RecetaScanner,
│                              # HistorialRecetas, RecetaDetalle, Inventario, Farmacias
├── server/
│   └── src/
│       ├── app.js             # Express + helmet/cors/morgan/JSON 10mb + rutas
│       ├── config/            # env.js (variables), db.js (pool MySQL)
│       ├── middlewares/       # authMiddleware.js (JWT), errorHandler.js
│       ├── routes/            # auth, recetas, inventario, farmacias, notificaciones, health
│       ├── controllers/       # lógica de negocio (validación entrada + errores statusCode)
│       ├── models/            # capa de datos (SQL preparado/parametrizado, transacciones)
│       └── services/          # serpapiService, emailService, notificacionService
│   └── server.js              # entrada + scheduler node-cron (NOTIF_CRON_ENABLED)
├── database/
│   ├── schema.sql             # Esquema v3: usuarios, medicamentos, recetas,
│   │                          # receta_medicamentos, busquedas_precios
│   └── migraciones/           # 003_notificaciones_usuarios.sql
├── docs/
│   ├── estado_BDI.md          # ★ Estado + hitos + PLAN DE IMPLEMENTACIÓN (hitos 11-16)
│   └── (pruebas_*.md se crean según el plan)
└── Estado_Actividades_BDI.md  # ★ Auditoría de las 21 actividades técnicas
```

## 4. Convenciones y reglas de código

1. **Arquitectura de 3 capas**: los controladores NO escriben SQL; delegan en `models/`.
   Las llamadas externas van en `services/`. El frontend solo consume `services/api.js`.
2. **Rutas protegidas**: todos los endpoints bajo `/api/recetas`, `/api/inventario`,
   `/api/farmacias` y `/api/notificaciones` usan `authMiddleware` (JWT `Bearer`).
   `/api/auth/*` y `/api/health` son públicos.
3. **Errores**: lanzar `const error = new Error(msg); error.statusCode = NNN; throw error;`.
   El `errorHandler` devuelve JSON `{ success:false, error:{ message } }`.
4. **Validación de entrada** en cada controlador; saneo de fechas `YYYY-MM-DD`,
   unidades de medicamento contra lista permitida, rangos (cantidad 0-999999, umbral 1-365).
5. **Seguridad**: SQL siempre parametrizado (`?`), verificaciones de propiedad (`usuario_id`)
   en lecturas/actualizaciones/eliminaciones, transacciones para escrituras múltiples.
6. **IA**: prompts estrictos que devuelven SOLO JSON, `response_format: { type: "json_object" }`,
   modelo `qwen/qwen3.8-27b`, `temperature: 0.1`, `max_tokens: 800`. Comprimir imágenes con `sharp` antes de Groq.
7. Español en mensajes de interfaz y DOM. Sin secretos en el repo (`.env` ignorados).
8. No añadir comentarios innecesarios al código; el estilo existente usa comentarios `/** */`
   de cabecera de función.

## 5. Lo que ya está implementado (no reintentar)

- Login Google OAuth + JWT (`authController`, `AuthContext`, middleware).
- Escáner de recetas: Base64 → `POST /api/recetas/analizar` (Groq) → `FormularioValidacion` → `POST /api/recetas/guardar` (transaccional).
- Historial/CRUD de recetas (paginación, detalle con imagen, edición, eliminación, cascada).
- Inventario/botiquín: CRUD, `POST /api/inventario/batch` (lote receta→botiquín), alertas de
  caducidad (`computeEstado` en `medicamentoModel.js`), escáner de empaques con IA (`analizar`).
- Farmacias: precios SerpApi (Google Shopping MX), cercanas (GPS + Google Maps + Leaflet),
  historial de búsquedas.
- Dashboard con resumen, alertas y preferencias de notificación por correo
  (Nodemailer + node-cron; `POST /api/notificaciones/probar`).

## 6. Lo que FALTA — qué se debe hacer (según auditoría hito 1-21)

Estado: **13/21 completadas · 5 parciales · 3 pendientes** (detalle en `Estado_Actividades_BDI.md`).

Plan de trabajo priorizado (detallado en `docs/estado_BDI.md`, sección "Hitos 11–16"):

1. **Hito 11 — CIE-10 (ALTA):** crear tabla `cie10_categorias` + seed (`server/scripts/seed-cie10.js`),
   `cie10Service` (búsqueda normalizada), `cie10MapperService` (Groq síntoma→CIE-10),
   `relevanciaService` (filtro/ranking de diagnósticos), endpoints `GET /api/cie10?q=` y
   `POST /api/cie10/mapear`, autocompletado en `FormularioValidacion`.
2. **Hito 12 — Cámara y ubicación (ALTA):** componente `CameraCapture.jsx` con
   `navigator.mediaDevices.getUserMedia` (hoy solo hay `capture="environment"`); geolocalización
   en tiempo real con `watchPosition` en `Farmacias.jsx`; búsqueda por dirección con
   `POST /api/farmacias/geocodificar`.
3. **Hito 13 — Accesibilidad por voz (MEDIA):** hook `useVoz.js` (STT continuo + TTS con
   `speechSynthesis` es-MX), captura de síntomas por voz → `/api/cie10/mapear`, botones
   "🔊 Leer resultados" en `RecetaDetalle` y `Farmacias`.
4. **Hito 14 — Pruebas IA↔BD (ALTA):** suite Jest + Supertest con `groq-sdk` mockeado;
   tests de recetas (analizar→guardar→listar→editar→eliminar), inventario y seguridad (401/400/404).
5. **Hito 15 — Carga y rendimiento (MEDIA):** script `autocannon` sobre los GET principales +
   reporte en `docs/pruebas_carga.md`.
6. **Hito 16 — Usabilidad/accesibilidad (MEDIA):** axe + Lighthouse (WCAG 2.1 AA), revisión de
   contrastes y labels, responsividad 320/375/768/1024 px, e2e Playwright opcional.

Deuda técnica adicional: extraer `medico_nombre` en el prompt de recetas (hoy no se pide),
code-splitting del bundle (~524 kB), activar `NOTIF_CRON_ENABLED=true` solo en producción.

## 7. Comandos útiles

```bash
npm run install:all   # instala client y server
npm run dev:client    # frontend (Vite, http://localhost:5173)
npm run dev:server    # backend (Express + nodemon, puerto 5000)
npm run build:client  # build de producción
npm run db:setup      # mysql -u root -p < database/schema.sql
```

## 8. Notas del entorno (importantes)

- El backend **debe** arrancar en su puerto nativo `PORT=5000` (el frontend `VITE_API_URL`
  y el proxy de Vite lo esperan). No forzar puertos por terminal al iniciar el server.
- Puertos 5060-5061 bloqueados en Windows local; usar 5090+ para pruebas.
- Para notificaciones por correo se requiere App Password de Gmail (`SMTP_USER`/`SMTP_PASS`).
- `Groq` es gratuito con límite ~8,000 TPM: comprimir imágenes (`sharp`) antes de enviar y
  no pedir tokens máximos altos.

## 9. Reglas del agente

- Antes de proponer código, consulta `docs/estado_BDI.md` (plan) y la arquitectura existente;
  imita patrones ya presentes (controladores con `statusCode`, modelos con pool, etc.).
- Mantén la arquitectura de 3 capas; NUNCA conectes el frontend a MySQL.
- Verifica con `node --check` (server) y `npm run build:client` (client) al terminar cambios.
- No implementes hitos por iniciativa propia: el usuario decide cuál iniciar, salvo que indique lo contrario.