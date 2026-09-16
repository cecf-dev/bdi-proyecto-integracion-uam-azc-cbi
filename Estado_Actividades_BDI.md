# Estado de Actividades Técnicas — Botiquín Digital Inteligente (BDI)

> **Rol:** Auditoría de código (Ingeniero de Software Senior)
> **Fecha de auditoría:** 2026-09-15
> **Repositorio auditado:** `bdi-proyecto-integracion-uam-azc-cbi`
> **Metodología:** Revisión exhaustiva de los directorios `client/`, `server/`, `database/` y `docs/`, comparando el código existente contra la lista de actividades técnicas oficiales.

---

## Resumen Ejecutivo

De las **21 actividades** evaluadas:

| Estado | Cantidad |
|--------|----------|
| 🟢 Completada | **13** |
| 🟡 Parcialmente Completada | **5** |
| 🔴 Pendiente | **3** |

**Fortalezas detectadas:** La arquitectura de 3 capas (Datos → Lógica → Visualización) está sólidamente implementada. El backend es seguro (Helmet + CORS + JWT), con validaciones de entrada robustas, transacciones SQL y un manejo de errores consistente. Los módulos de autenticación, recetas con IA (Groq Vision), inventario con cálculo de caducidad y farmacias (SerpApi + Leaflet) están funcionalmente completos y verificados E2E según `docs/estado_BDI.md`.

**Brechas detectadas:** No existe un catálogo CIE-10 en la base de datos ni un mapeador de síntomas → códigos CIE-10. No hay algoritmo de relevancia para diagnósticos. No se encuentran pruebas automatizadas (unitarias/integración/carga) ni validaciones de accesibilidad en el repositorio. El acceso a cámara solo usa el atributo `capture="environment"` de un `<input type="file">` (sin componente getUserMedia). No hay Text-to-Speech. La geolocalización no es en "tiempo real" (`watchPosition`). La búsqueda de farmacias no es por dirección, solo por GPS.

---

## Capa de Datos y Arquitectura

### Actividad 1: Diseñar el modelo de base de datos relacional en MySQL
- **Estado:** 🟢 Completada
- **Justificación:** Existe un script SQL de definición de esquema completo y versionado, con 5 tablas relacionales, relaciones, restricciones de integridad y una migración evolutiva documentada.
- **Implementación:**
  - `database/schema.sql` (v3): tablas `usuarios`, `medicamentos`, `recetas`, `receta_medicamentos` y `busquedas_precios`.
  - Motor `InnoDB`, charset `utf8mb4_unicode_ci`, PKs `INT UNSIGNED AUTO_INCREMENT`, FKs nombradas con `ON DELETE CASCADE` (ej. `fk_medicamentos_usuario`, `fk_recetas_usuario`, `fk_recetamed_receta`), índices en `email`, `google_id`, `usuario_id`, `fecha_caducidad`, `estado`.
  - Columna `estado ENUM('vigente','por_vencer','caducado')` se recalculó en código para mantener alertas al día.
  - `database/migraciones/003_notificaciones_usuarios.sql`: agrega `notif_activas` y `notif_umbral_dias` a `usuarios`.
  - `schema.sql` L86 y L135-137 documentan las migraciones v1→v2 (`imagen_url` → `imagen_base64 LONGTEXT`, columna `paciente_nombre`).

### Actividad 2: Configurar el servidor backend con Node.js y Express.js
- **Estado:** 🟢 Completada
- **Justificación:** El servidor está configurado con Express 5, punto de entrada, configuración centralizada de entorno, pool de conexiones MySQL, seguridad, logging, rutas y manejo de errores.
- **Implementación:**
  - `server/server.js`: arranque del servidor, verificación de conexión MySQL (`testConnection`), scheduler `node-cron`.
  - `server/src/app.js`: middlewares `helmet()`, `cors()` (origin `CLIENT_URL`), `express.json({ limit: '10mb' })` para Base64, `morgan`, rutas montadas en `/api/...` y handlers `notFound`/`errorHandler`.
  - `server/src/config/env.js`: variables de entorno validadas (puerto por defecto 5000).
  - `server/src/config/db.js`: pool `mysql2/promise` con `connectionLimit: 10`, keep-alive.
  - `server/src/routes/healthRoutes.js`: endpoint `GET /api/health` con diagnóstico de la BD.
  - `server/package.json`: scripts `start` y `dev` (nodemon); dependencias `express`, `mysql2`, `helmet`, `cors`, `morgan`, `node-cron`, `nodemailer`, `serpapi`, `groq-sdk`, `google-auth-library`, `jsonwebtoken`, `sharp`.

### Actividad 3: Integrar los códigos clínicos de la CIE-10 a la base de datos
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** La CIE-10 solo está presente como un **campo de texto libre** (`codigo_cie10 VARCHAR(20)`) en la tabla `recetas`. No existe una tabla maestra/catálogo de códigos CIE-10, no hay script de carga/seed con los ~14,000 códigos clínicos, ni validación del formato contra un catálogo real. El sistema almacena el código tal cual lo entrega la IA o el usuario, sin resolver "texto coloquial → término CIE-10".
- **Implementación (parcial):**
  - `database/schema.sql` L82: `codigo_cie10 VARCHAR(20)` en `recetas`.
  - `server/src/controllers/recetaController.js` L134, L182, L337, L374: recibe y persiste `codigo_cie10`.
  - `server/src/models/recetaModel.js` L35, L46, L128, L177: inserciones/lecturas del campo.
  - `client/src/pages/RecetaDetalle.jsx` L361-366: muestra el código CIE-10.
  - **No encontrado:** ninguna tabla `cie10_codigos`/`cie10_categorias`, seed SQL, servicio de normalización ni endpoint de búsqueda.
- **Propuesta de Implementación:**
  1. Crear `database/cie10.sql` con catálogo (código, descripción, categoría) y agregar la tabla al esquema:
     ```sql
     CREATE TABLE IF NOT EXISTS cie10_categorias (
       id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       codigo VARCHAR(10) NOT NULL UNIQUE,      -- ej. 'J02'
       descripcion VARCHAR(255) NOT NULL,        -- ej. 'Faringitis aguda'
       capitulo VARCHAR(120),
       INDEX idx_cie10_desc (descripcion)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
     ```
  2. Agregar un seed masivo (CSV o INSERTs generado con un script `scripts/seed-cie10.js` usando la fuente pública de la CIE-10).
  3. Crear `server/src/services/cie10Service.js` con: normalización (mayúsculas, sin tildes), búsqueda por coincidencia (`LIKE`/FULLTEXT) y mapeo de sinónimos coloquiales.
  4. Exponer `GET /api/cie10?q=` (protegido) y autocompletado en el frontend del formulario de validación (`FormularioValidacion.jsx`).

### Actividad 4: Realizar pruebas de carga y rendimiento del servidor backend
- **Estado:** 🔴 Pendiente
- **Justificación:** No existen scripts, configuraciones ni resultados de pruebas de carga/rendimiento en el repositorio. No se encontraron dependencias del tipo `artillery`, `k6`, `autocannon`, JMeter, `wrk`, pruebas de estrés ni métricas (tiempos de respuesta, throughput, límites de conexiones). Solo se documentan pruebas E2E funcionales manuales en `docs/estado_BDI.md` (secciones "Estado de Verificación"), que no equivalen a pruebas de carga.
- **Propuesta de Implementación:**
  1. Añadir en el servidor la devDependency `artillery` (o usar script con `autocannon`) y un script `npm run load:test -- server/scripts/load-test.js`.
  2. Script de referencia (Node, `autocannon`):
     ```js
     const autocannon = require('autocannon');

     autocannon(
       {
         url: 'http://localhost:5000/api/recetas?page=1',
         headers: { Authorization: `Bearer ${process.env.JWT_TEST}` },
         connections: 100,
         duration: 30,
         method: 'GET',
       },
       (err, result) => {
         if (err) throw err;
         console.log(`Requests: ${result.requests.total} | Lat. p95: ${result.latency.p95}ms | Errores: ${result.errors}`);
       }
     );
     ```
  3. Probar escenarios principales: `GET /api/recetas` (paginado), `GET /api/inventario`, `GET /api/inventario/alertas` y `GET /api/health`.
  4. Documentar resultados en `docs/pruebas_carga.md` (línea base, p95, p99, errores, límite de conexiones con el pool fijado en 10).

---

## Lógica y Backend

### Actividad 5: Crear la lógica o algoritmo para calcular y validar la caducidad de los medicamentos
- **Estado:** 🟢 Completada
- **Justificación:** El algoritmo está implementado, se recalcula tanto en escritura como en lectura (para que las alertas estén siempre al día), y se expone a través de endpoints dedicados.
- **Implementación:**
  - `server/src/models/medicamentoModel.js`:
    - L18-32 `computeEstado(fechaCaducidad)` → `'vigente' | 'por_vencer' (≤30 días) | 'caducado'`.
    - L39-46 `diasRestantes()` → días restantes (negativo si caducó).
    - L52-55 `rowToMedicamento()` recalcula el estado en cada lectura.
    - L188-204 `findAlertas(usuarioId, dias)` consulta `fecha_caducidad <= (CURDATE() + INTERVAL ? DAY)` con umbral saneado (1-365).
  - `server/src/controllers/inventarioController.js`: `GET /api/inventario` (resumen vigentes/porVencer/caducados, L292-297) y `GET /api/inventario/alertas?dias=30` (L320-356).
  - Frontend: `client/src/pages/Inventario.jsx` (banner proactivo de alertas L287-323) y `client/src/pages/Dashboard.jsx` (L182-231).

### Actividad 6: Programar los endpoints REST para la gestión del inventario y el registro de usuarios
- **Estado:** 🟢 Completada
- **Justificación:** Existe un CRUD completo del inventario con validaciones, paginación de alertas y un endpoint transaccional para lote; el registro de usuarios se resuelve mediante Google OAuth (crea el usuario si no existe).
- **Implementación:**
  - `server/src/routes/inventarioRoutes.js` (protegidas con JWT): `GET /`, `GET /alertas`, `POST /analizar`, `POST /`, `POST /batch` (máx. 50, transaccional), `PUT /:id`, `DELETE /:id`.
  - `server/src/controllers/inventarioController.js`: `normalizarDatos()` (validación de nombre, cantidad 0-999999, unidades permitidas, fechas YYYY-MM-DD), `crearBatch()` (L396-440).
  - `server/src/models/medicamentoModel.js`: `create`, `createMany` (L99-148, transacción), `update`, `remove`, siempre con verificación `usuario_id`.
  - Registro de usuarios: `server/src/controllers/authController.js` — `googleLogin()` (L34-98) busca por email y crea con `userModel.create()` si no existe (`server/src/models/userModel.js` L39-49).

### Actividad 7: Programar la función de mapeo de texto/síntomas coloquiales a términos médicos CIE-10
- **Estado:** 🔴 Pendiente
- **Justificación:** No existe ninguna función, servicio ni endpoint que convierta texto/síntomas coloquiales (ej. "me duele la garganta") en términos médicos CIE-10. El único vínculo con CIE-10 es el campo libre `codigo_cie10` que se rellena manualmente o por la IA, sin normalización de sinónimos (confirmed por grep: sin coincidencias de `sintoma|síntoma|symptom|map`).
- **Propuesta de Implementación (híbrida con Groq, coherente con la arquitectura):**
  1. Crear `server/src/services/cie10MapperService.js`:
     ```js
     const Groq = require('groq-sdk');
     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

     // Convierte síntomas coloquiales en un candidato CIE-10
     const mapearSintoma = async (descripcion) => {
       const completion = await groq.chat.completions.create({
         model: 'qwen/qwen3.6-27b', // mismo modelo ya usado en el proyecto
         temperature: 0.2,
         messages: [
           {
             role: 'system',
             content:
               'Eres un codificador clínico. Devuelve SOLO un JSON: ' +
               '{"codigo_encontrado": null, "codigos_candidatos": [' +
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
  2. Crear `GET /api/cie10/mapear?sintoma=...` (o `POST`) en `server/src/routes/` y el controlador correspondiente.
  3. En la parte "local" del mapeo, consultar la tabla `cie10_categorias` (Actividad 3) para validar/confirmar el código candidato que devuelve la IA.
  4. Frontend: botón "Traducir a CIE-10" en `FormularioValidacion.jsx` junto al campo `diagnostico`/`codigo_cie10`, mostrando los candidatos con su relevancia para que el usuario confirme.

### Actividad 8: Implementar un algoritmo de filtro de relevancia para los diagnósticos
- **Estado:** 🔴 Pendiente
- **Justificación:** No existe ningún algoritmo de ranking/relevancia aplicado a diagnósticos. Cuando la IA procesa una receta se guarda un único `diagnostico` (`recetaModel.createConMedicamentos`), y no hay puntuación, ordenamiento, umbral de confianza ni deduplicación de diagnósticos candidatos.
- **Propuesta de Implementación:**
  1. Extender el `systemPrompt` de `analizarReceta` para que devuelva un arreglo de diagnósticos con peso:
     ```json
     "diagnosticos_candidatos": [
       { "texto": "Faringitis aguda", "codigo_cie10": "J02", "relevancia": 0.92 }
     ]
     ```
  2. Crear `server/src/services/relevanciaService.js` con un filtro de relevancia determinista sobre los candidatos:
     ```js
     // Puntúa por coincidencia de tokens con los medicamentos prescritos y síntomas
     const calcularRelevancia = (candidatos, medicamentos = []) =>
       candidatos
         .map((c) => ({
           ...c,
           score:
             c.relevancia * 0.7 +
             coincidenciaMedicamentos(c.texto, medicamentos) * 0.3,
         }))
         .sort((a, b) => b.score - a.score)
         .filter((c) => c.score >= 0.5);
     ```
  3. Elegir el diagnóstico de mayor `score` como `diagnostico`/`codigo_cie10` final y devolver la lista ordenada al frontend para validación humana.
  4. Actualizar `FormularioValidacion.jsx` para mostrar el diagnóstico principal y la lista ordenada de alternativas.

### Actividad 9: Crear la API para el manejo de coordenadas e integrar geolocalización en tiempo real
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** La API de coordenadas existe (`POST /api/farmacias/cercanas` con validación de lat/lng y consulta a Google Maps vía SerpApi) y el frontend integra Leaflet con la geolocalización del navegador. Sin embargo, se usa `navigator.geolocation.getCurrentPosition()` (una sola toma), **sin `watchPosition()`** para seguimiento en tiempo real, y no hay búsqueda por dirección (geocodificación de texto).
- **Implementación (parcial):**
  - `server/src/controllers/farmaciaController.js` L81-116: `buscarCercanas` valida coordenadas (`esCoordenada`, L18-21) y delega en `serpapiService.buscarFarmaciasCercanas(lat, lng)`.
  - `server/src/services/serpapiService.js` L60-98: motor `google_maps`, query `farmacias`, extrae `gps_coordinates` (lat/lng), dirección, rating, teléfono (máx. 15).
  - `server/src/routes/farmaciaRoutes.js` L23: `POST /api/farmacias/cercanas`.
  - `client/src/pages/Farmacias.jsx`: `obtenerPosicion()` (L11-29, `getCurrentPosition`), `MapContainer`/`Marker`/`Popup` de react-leaflet (L241-265) con `divIcon` personalizado.
- **Propuesta de Implementación:**
  1. En `Farmacias.jsx`, agregar un modo de seguimiento con `navigator.geolocation.watchPosition()` que actualice `posicion` y re-consulte `/api/farmacias/cercanas` cada 30 s (o cuando el usuario se mueve > umbral de metros):
     ```js
     const watchId = navigator.geolocation.watchPosition(
       async (pos) => {
         const nueva = { lat: pos.coords.latitude, lng: pos.coords.longitude };
         setPosicion(nueva);
         const resp = await api.post('/farmacias/cercanas', nueva);
         setFarmacias(resp.data);
       },
       (err) => setMapaError(err.message),
       { enableHighAccuracy: true, maximumAge: 10000 }
     );
     // en cleanup: navigator.geolocation.clearWatch(watchId);
     ```
  2. Para la búsqueda por dirección, agregar un input de dirección y geocodificar con SerpApi (`engine: 'google_maps'` con `type: 'places'`/geocoding) o con el endpoint `GET https://nominatim.openstreetmap.org/search?q=<direccion>&format=json` (gratuito y compatible con Leaflet), devolviendo lat/lng al mapa.
  3. Exponer `POST /api/farmacias/geocodificar` en el backend que reciba `{ direccion }` y regrese `{ lat, lng }`, reutilizando las validaciones de `farmaciaController`.

---

## Integración de Inteligencia Artificial (LLM multimodales)

### Actividad 10: Implementar el controlador backend para el consumo de la API LLM (Groq) enfocado en extraer datos de cajas de medicamentos
- **Estado:** 🟢 Completada
- **Justificación:** El controlador analiza imágenes de empaques con Groq (multimodal), comprime las imágenes para optimizar tokens, fuerza JSON con `response_format`, reintenta ante fallos de validación JSON y normaliza la salida.
- **Implementación:**
  - `server/src/controllers/inventarioController.js`:
    - `POST /api/inventario/analizar` → `analizar()` (L168-274).
    - `comprimirImagen()` (L142-158): `sharp` → resize 1280px máx., JPEG q80.
    - System prompt estricto de "experto farmacéutico" (L191-201) con regla de último día del mes para caducidad mes/año.
    - Modelo `qwen/qwen3.6-27b`, `temperature: 0.1`, `response_format: { type: 'json_object' }`, reintento ante `json_validate_failed` (L207-238).
    - `sanitizarExtraidos()` (L95-131): normaliza fechas, unidades, cantidades (0-999999), máx. 20 medicamentos, descarta sin nombre.
  - Ruta: `server/src/routes/inventarioRoutes.js` L29.

### Actividad 11: Implementar el controlador backend de procesamiento de recetas médicas utilizando la API LLM
- **Estado:** 🟢 Completada
- **Justificación:** El controlador envía la imagen de la receta a Groq Vision, fuerza JSON, lo parsea con manejo de errores y devuelve los datos clínicos estructurados al frontend.
- **Implementación:**
  - `server/src/controllers/recetaController.js`:
    - `POST /api/recetas/analizar` → `analizarReceta()` (L23-117): system prompt clínico (L37-57), mensaje multimodal con `image_url` (L68-76), modelo `qwen/qwen3.6-27b`, `temperature: 0.1`, `response_format json_object`, validación de Base64 (L28-32) y parseo con error controlado (L90-97).
    - `POST /api/recetas/guardar` → `guardarReceta()` (L125-210): filtra medicamentos, valida fecha, persiste de forma transaccional.
  - Ruta: `server/src/routes/recetaRoutes.js` L17 y L23.
  - Persistencia atómica: `server/src/models/recetaModel.js` `createConMedicamentos()` (L24-83).

### Actividad 12: Realizar pruebas de integración funcional entre la base de datos y los modelos LLM
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** La integración se verificó de forma manual/E2E contra el servidor real + MySQL + Groq real, según `docs/estado_BDI.md` (Hitos 9 y 10: "POST /api/inventario/analizar 200 en ~2.7s extrayendo PARACETAMOL...", "prueba en campo 2026-08-28... 200 en ~4.2s"). Sin embargo, **no existe ningún test automatizado** committeado (sin `jest`, `vitest`, `supertest`, ni scripts `test`), por lo que la prueba no es reproducible dentro del repositorio.
- **Propuesta de Implementación:**
  1. Agregar en `server/package.json` las devDependencies `jest`/`supertest` (o `vitest`) y un script `npm test`.
  2. Prepara un archivo de pruebas con la IA **mockeada** (inyectar un `groq` falso en el controlador) para evitar consumir créditos y hacer el test determinista:
     ```js
     // server/tests/integracionReceta.test.js (esquema)
     const request = require('supertest');
     const app = require('../src/app');

     it('POST /api/recetas/analizar devuelve JSON estructurado y lo guarda en BD', async () => {
       // 1. mock de groq devolviendo { paciente_nombre, diagnostico, medicamentos }
       // 2. POST /api/recetas/analizar con imagenBase64 sintética -> 200
       // 3. POST /api/recetas/guardar -> 201
       // 4. GET /api/recetas -> la receta existe con codigo_cie10
     });
     ```
  3. Añadir un test E2E real opcional, marcado `@manual`, reproducir la verificación documentada en `docs/estado_BDI.md` y guardar un registro JSON de resultados.
  4. Ejecutar `node --check` (ya usado en el proyecto) + `npm test` en CI y documentar en `docs/pruebas_ia.md`.

---

## Frontend y Experiencia de Usuario

### Actividad 13: Configurar la estructura base del proyecto web con React y Tailwind CSS
- **Estado:** 🟢 Completada
- **Justificación:** Proyecto React + Vite con Tailwind CSS 3 completamente configurado, rutas, contexto de autenticación, sistema de diseño y una paleta de colores extendida.
- **Implementación:**
  - `client/package.json`: `react`, `react-router-dom`, `axios`, `@react-oauth/google`, `leaflet` + `react-leaflet`, `react-speech-recognition`.
  - `client/vite.config.js`: puerto 5173 y proxy `/api` → backend.
  - `client/tailwind.config.js`: paleta `primary/accent/surface`, fuentes `Inter`/`Outfit`, animaciones `fade-in`/`slide-up`.
  - `client/src/index.css`: `@tailwind base/components/utilities`, clases `.btn-primary`, `.btn-secondary`, `.glass-card`, `.badge-*`, estilos de pines Leaflet.
  - `client/src/main.jsx` y `client/src/App.jsx`: `GoogleOAuthProvider` + `AuthProvider` + rutas públicas/privadas (`PrivateRoute`).

### Actividad 14: Implementar el módulo de autenticación de inicio de sesión con Google (Google OAuth/Firebase)
- **Estado:** 🟢 Completada
- **Justificación:** Login con Google implementado de punta a punta: botón OAuth en el frontend, verificación del token en el backend, generación de JWT propio, persistencia en `localStorage`, interceptor Axios y cierre de sesión.
- **Implementación:**
  - Frontend: `client/src/main.jsx` (`GoogleOAuthProvider`), `client/src/pages/Login.jsx` (componente `GoogleLogin` con `useOneTap`), `client/src/context/AuthContext.jsx` (`loginWithGoogle`, `logout`, restauración de sesión con `GET /auth/me`).
  - Interceptor de token: `client/src/services/api.js` (L28-37 agrega `Authorization: Bearer`, L43-67 redirige a `/login` en 401).
  - Backend: `server/src/controllers/authController.js` (`verifyIdToken` con `google-auth-library`, L45-48; `generateToken`, L20-26), `server/src/routes/authRoutes.js` (`POST /api/auth/google`, `GET /api/auth/me`), `server/src/middlewares/authMiddleware.js`.

### Actividad 15: Programar el componente React para acceso a la cámara y captura de fotografías
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** El acceso a cámara se resuelve únicamente con `<input type="file" accept="image/*" capture="environment">` (`client/src/pages/Inventario.jsx` L365-372), que en móvil abre la cámara; la captura se convierte a Base64 con `FileReader`. No existe un componente dedicado que use `navigator.mediaDevices.getUserMedia()` con visor en vivo (grep devuelve 0 coincidencias), ni flujo de captura para escritorio, enfoque, permiso explícito o galería previa. El escáner de recetas (`RecetaScanner.jsx`) depende de subir archivo o arrastrar, sin botón de cámara.
- **Propuesta de Implementación:**
  1. Crear `client/src/components/CameraCapture.jsx` reutilizable (flujo receta y medicamento):
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
         onCapture(canvas.toDataURL('image/jpeg', 0.85)); // dataURL Base64
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
  2. Integrarlo en `RecetaScanner.jsx` (antes de la zona de drag&drop) y en `Inventario.jsx` (alternativa al `<input capture>`).
  3. La captura debe enviarse a los endpoints existentes `POST /api/recetas/analizar` y `POST /api/inventario/analizar` (ya aceptan `image_url: dataURL`).

### Actividad 16: Conectar la interfaz frontend de captura de recetas y escaneo de medicamentos con los endpoints del backend
- **Estado:** 🟢 Completada
- **Justificación:** Ambas interfaces envían la imagen en Base64 y consumen los endpoints del backend, con el token JWT inyectado por el interceptor.
- **Implementación:**
  - `client/src/pages/RecetaScanner.jsx`: `handleSimulateSend()` L85-109 → `POST /recetas/analizar`; `handleConfirmReceta()` L112-120 → `POST /recetas/guardar` (imagen + datos validados); `handleAddToInventory()` L123-130 → `POST /inventario/batch`.
  - `client/src/pages/Inventario.jsx`: `analizarImagen()` L214-234 → `POST /inventario/analizar`; CRUD vía `GET/POST/PUT/DELETE /inventario` (L120-156).
  - `client/src/services/api.js`: baseURL `VITE_API_URL` y token Bearer automático.

### Actividad 17: Crear un componente de formulario dinámico para la edición y validación humana de los datos extraídos por la IA
- **Estado:** 🟢 Completada
- **Justificación:** Existe un formulario dinámico que pre-llena los datos de la IA, permite editar cada campo, agregar/eliminar medicamentos y solo entonces persistir (validación humana obligatoria).
- **Implementación:**
  - `client/src/components/FormularioValidacion.jsx`: estado `formData` inicializado con `initialData` de la IA (L6-12), `handleChange`/`handleMedicamentoChange` (L21-39), `addMedicamento`/`removeMedicamento` (L41-55), flujo `handleSubmit` → `onConfirm` (guardado) + `handleAddToInventory` (receta→botiquín, L81-103).
  - Reutilizado en `RecetaScanner.jsx` L223-230.
  - El mismo patrón de edición dinámica se replica en `client/src/pages/RecetaDetalle.jsx` (modo edición, L182-318).

### Actividad 18: Implementar el componente visual para la búsqueda manual de farmacias por dirección y renderizado del mapa (Leaflet)
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** El renderizado del mapa con Leaflet está completo (tiles OpenStreetMap, marcadores con `divIcon`, popups, centrado en la posición del usuario). La parte pendiente es la **"búsqueda manual por dirección"**: actualmente solo existe "Usar mi ubicación" (`getCurrentPosition`), sin un campo de texto que geocodifique una dirección.
- **Implementación (parcial):**
  - `client/src/pages/Farmacias.jsx`: `MapContainer`/`TileLayer`/`Marker`/`Popup` (L241-265), `iconoFarmacia`/`iconoUsuario` (L8-9), `obtenerPosicion()` (L11-29), botón "Usar mi ubicación" (L225-231).
  - Estilos de pines: `client/src/index.css` (L128-144).
  - Backend de coordenadas: `POST /api/farmacias/cercanas` (ver Actividad 9).
- **Propuesta de Implementación:**
  1. Agregar un input de dirección sobre el mapa con geocodificación vía Nominatim (gratuito, HTTPS) en el cliente:
     ```js
     const geocodificar = async (direccion) => {
       const r = await fetch(
         `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(direccion)}`
       );
       const datos = await r.json();
       if (datos.length === 0) throw new Error('Dirección no encontrada');
       return { lat: Number(datos[0].lat), lng: Number(datos[0].lon) };
     };
     ```
  2. Al obtener `{lat, lng}` por dirección, llamar a `POST /api/farmacias/cercanas` con esas coordenadas y centrar el `MapContainer` (flyTo).
  3. Alternativa más robusta: crear `POST /api/farmacias/geocodificar` en el backend con SerpApi (`engine: 'google_maps'`, tipo place/geocoding) para no exponer llamadas directas a terceros desde el navegador.

### Actividad 19: Diseñar la vista dinámica de la tabla comparativa de precios y conectar la interfaz web con SerpApi
- **Estado:** 🟢 Completada
- **Justificación:** La interfaz está conectada a SerpApi (Google Shopping MX) y renderiza dinámicamente las ofertas del medicamento (título, tienda, precio, enlace) cada vez que se busca. Nota: la vista se implementa como **tarjetas/cards** comparativas (no una `<table>` literal), pero cumple funcionalmente el objetivo de comparación de precios.
- **Implementación:**
  - `server/src/services/serpapiService.js` L17-52: `buscarPreciosMedicamento()` con `engine: 'google_shopping'`, `gl: 'mx'`, `hl: 'es'`, `google_domain: 'google.com.mx'`, normaliza top 20 (título, precio, tienda, link, imagen).
  - `server/src/controllers/farmaciaController.js` L28-75: `POST /api/farmacias/buscar` (valida nombre ≤ 100 car.) y guarda historial; `GET /api/farmacias/historial` (L122-146).
  - `server/src/models/farmaciaModel.js`: `createBusqueda`/`findHistorial` (tabla `busquedas_precios`, JSON).
  - `client/src/pages/Farmacias.jsx`: formulario de búsqueda (L85-106), render de ofertas (L192-218) y sección de historial (L295-314).

### Actividad 20: Programar los componentes de accesibilidad en React: captura de síntomas por voz (Speech-to-Text) y lectura de resultados (Text-to-Speech)
- **Estado:** 🟡 Parcialmente Completada
- **Justificación:** El Speech-to-Text está implementado con `react-speech-recognition` (es-MX), pero **solo para dictar el nombre del medicamento** en la búsqueda de precios de `Farmacias.jsx` (no para "captura de síntomas", que no existe). El Text-to-Speech no está implementado en ningún componente (grep de `speechSynthesis`/`SpeechSynthesis`: 0 resultados).
- **Implementación (parcial — STT):**
  - `client/src/pages/Farmacias.jsx`: `useSpeechRecognition()` (L49-54), `toggleDictado()` con `startListening({ language: 'es-MX', continuous: false })` (L64-71), efecto que vuelca el `transcript` al input (L56-62), botón "Dictar nombre del medicamento" (L151-169).
  - Dependencia: `react-speech-recognition` en `client/package.json`.
- **Propuesta de Implementación:**
  1. Crear un hook reutilizable `client/src/hooks/useVoz.js` que encapsule STT (dictado de síntomas) y TTS (lectura de resultados):
     ```js
     import { useState } from 'react';
     import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

     export const useVoz = () => {
       const { transcript, listening, resetTranscript } = useSpeechRecognition();

       const iniciarDictado = () => {
         resetTranscript();
         SpeechRecognition.startListening({ language: 'es-MX', continuous: true });
       };
       const detenerDictado = () => SpeechRecognition.stopListening();

       const leerEnVozAlta = (texto) => {
         if (!('speechSynthesis' in window)) return;
         const voz = speechSynthesis
           .getVoices()
           .find((v) => v.lang.startsWith('es'));
         const u = new SpeechSynthesisUtterance(texto);
         u.lang = 'es-MX';
         u.rate = 0.95;
         if (voz) u.voice = voz;
         speechSynthesis.cancel();
         speechSynthesis.speak(u);
       };

       return { transcript, listening, iniciarDictado, detenerDictado, leerEnVozAlta };
     };
     ```
  2. Agregar un módulo/página "Captura de síntomas por voz" que envía el texto dictado a `POST /api/cie10/mapear` (Actividad 7) y devuelve candidatos CIE-10.
  3. Agregar botones de "🔊 Leer resultados" en `RecetaDetalle.jsx` y en la vista comparativa de precios de `Farmacias.jsx`, llamando `leerEnVozAlta(...)`.

### Actividad 21: Realizar pruebas de usabilidad, responsividad y validaciones de accesibilidad
- **Estado:** 🔴 Pendiente
- **Justificación:** No hay evidencia de pruebas de usabilidad, responsividad ni validaciones de accesibilidad en el repositorio: no hay tests (e2e/unit), ni herramientas de auditoría (axe, Lighthouse), ni reportes (resultados de PageSpeed, tester de contraste, checklist de WCAG). La documentación (`docs/estado_BDI.md`) describe verificaciones E2E funcionales y build exitoso, pero no auditorías de accesibilidad. Las `aria-label` detectables (ej. `FormularioValidacion.jsx` L266) son escasas y no sistemáticas.
- **Propuesta de Implementación:**
  1. Integrar auditoría automatizada en build/CI: agregar `@axe-core/react` en desarrollo y ejecutar Lighthouse (comando CLI o CI) para evaluar las 4 categorías (Accesibilidad, Mejores Prácticas, SEO, Rendimiento).
  2. Ejecutar auditoría manual de accesibilidad (WCAG 2.1 AA): contraste de color (paletas `primary-600/accent-600` sobre blanco), foco visible (`focus-visible`), jerarquía de encabezados, etiquetas `label` en todos los inputs (varios inputs en `Farmacias.jsx` y `Dashboard.jsx` hoy dependen solo de `placeholder`), navegación por teclado y lector de pantalla (VoiceOver/NVDA).
  3. Pruebas de responsividad: probar breakpoints (320, 375, 768, 1024) en `RecetaScanner`, `Inventario`, `Farmacias`, `Dashboard` y la tabla comparativa de precios; documentar capturas en `docs/pruebas_ux.md`.
  4. Configurar `playwright` con tests e2e de flujos críticos (login → escanear → validar → guardar → inventario → farmacias) y badges de accesibilidad (comando `@axe-core/playwright`), guardando los reportes en `docs/`.

---

## Anexo: Endpoints verificados en el código

| Método | Endpoint | Archivo |
|--------|----------|---------|
| POST | `/api/auth/google`, `/api/auth/me` | `server/src/routes/authRoutes.js` |
| GET | `/api/health` | `server/src/routes/healthRoutes.js` |
| POST/GET/PUT/DELETE | `/api/recetas/*` | `server/src/routes/recetaRoutes.js` |
| GET/POST/PUT/DELETE | `/api/inventario/*` | `server/src/routes/inventarioRoutes.js` |
| POST/GET | `/api/farmacias/*` | `server/src/routes/farmaciaRoutes.js` |
| GET/PUT/POST | `/api/notificaciones/*` | `server/src/routes/notificacionRoutes.js` |

## Observaciones generales

1. **Buenas prácticas confirmadas:** uso de `prepareStatement`/parámetros en todas las consultas SQL (protección contra inyección), transacciones en escrituras múltiples, verificación de propiedad (`usuario_id`) en lecturas/actualizaciones/eliminaciones, validación y saneamiento de entrada en cada controlador, y manejo centralizado de errores.
2. **Deuda detectada:** secretos posibles en `server/.env`/`client/.env` presentes en el working tree (aunque `.gitignore` los protege); el bundle del cliente es ~524 kB (code-splitting sugerido, ya señalado en `docs/estado_BDI.md`); falta `medico_nombre` en el prompt de extracción de receta (el campo se guarda pero la IA no lo devuelve).
3. **Priorización sugerida** para cerrar brechas: (a) catálogo + mapeador CIE-10 con filtro de relevancia, (b) conjunto de pruebas automatizadas (unitarias/integración/carga), (c) componente de cámara `getUserMedia`, (d) geolocalización en tiempo real + búsqueda por dirección, (e) STT de síntomas + TTS, (f) auditorías de accesibilidad/responsividad.