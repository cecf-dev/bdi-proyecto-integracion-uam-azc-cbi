# Botiquín Digital Inteligente (BDI)

Sistema web responsivo para digitalizar recetas médicas y gestionar inventarios de medicamentos.

## 🏥 Descripción

El BDI previene la automedicación y el consumo de fármacos caducados mediante:

- **Digitalización de recetas**: Extracción de datos clínicos de recetas manuscritas usando IA multimodal (Groq / Llama 3 Vision)
- **Traducción CIE-10**: Conversión de síntomas coloquiales a terminología médica estándar
- **Geolocalización**: Búsqueda de farmacias cercanas con mapas interactivos
- **Comparación de precios**: Integración con Google Shopping vía SerpApi
- **Autenticación segura**: Login con Google OAuth

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React, Vite, Tailwind CSS, Leaflet |
| Backend | Node.js, Express.js, Nodemailer, node-cron |
| Base de Datos | MySQL |
| IA | Groq SDK (Llama 3 Vision) |
| APIs | SerpApi, Google OAuth |

## 📁 Estructura del Proyecto

```
├── client/          # Frontend React + Tailwind CSS
├── server/          # Backend Node.js + Express
├── database/        # Scripts SQL
└── docs/            # Documentación
```

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js >= 18
- MySQL >= 8.0
- Claves API: Groq, SerpApi, Google OAuth

### Instalación

```bash
# Clonar el repositorio
git clone <url-del-repo>

# Instalar dependencias del client
cd client
npm install

# Instalar dependencias del server
cd ../server
npm install
```

### Configuración

1. Copiar los archivos de ejemplo `.env.example` a `.env` en `client/` y `server/`
2. Completar las variables de entorno con tus claves
3. Para las notificaciones por correo: generar una [App Password de Gmail](https://myaccount.google.com/apppasswords)
   y completar `SMTP_USER`, `SMTP_PASS` y `EMAIL_FROM` en `server/.env`. Activar el recordatorio
   diario automático con `NOTIF_CRON_ENABLED=true`

### Base de Datos

```bash
# Crear la BD bdi_db y todas las tablas (idempotente)
mysql -u root -p < database/schema.sql
```

Si la base de datos ya existía con el esquema v1, ejecutar los 2 `ALTER` que se
encuentran comentados al final de `database/schema.sql` (renombran `imagen_url` a
`imagen_base64 LONGTEXT` y agregan `paciente_nombre`).

Si la base de datos ya existía con el esquema v2, aplicar la migración de notificaciones:

```bash
mysql -u root -p bdi_db < database/migraciones/003_notificaciones_usuarios.sql
```

### Scripts Raíz (opcional)

Desde la raíz del monorepositorio:

```bash
npm run install:all   # instala client y server
npm run dev:client    # frontend (Vite)
npm run dev:server    # backend (Express con nodemon)
npm run build:client  # build de producción del frontend
npm run db:setup      # crea el esquema de BD
```

### Ejecución en Desarrollo

```bash
# Terminal 1 - Frontend
cd client
npm run dev

# Terminal 2 - Backend
cd server
npm run dev
```

## Módulos Implementados

| Módulo | Descripción |
|--------|-------------|
| Autenticación | Login con Google OAuth + JWT (rol paciente/admin) |
| Escáner de recetas | Captura en Base64, análisis con Groq (Llama 3 Vision), validación y guardado |
| Historial de recetas | Listado paginado, detalle con imagen, edición y eliminación |
| Inventario (botiquín) | CRUD de medicamentos con cálculo automático de caducidad (vigente / por vencer / caducado) |
| Escáner de medicamentos | Foto del empaque → IA (Groq Vision) → prellenado del formulario → confirmación humana |
| Receta → botiquín | Registro en lote de los medicamentos de una receta al guardarla |
| Farmacias | Precios vía SerpApi (Google Shopping), farmacias cercanas (Google Maps + Leaflet) e historial de búsquedas |
| Dashboard | Panel con resumen, alertas de caducidad y accesos rápidos |
| Notificaciones por correo | Recordatorio diario automático de caducidad (Nodemailer + node-cron), preferencias por usuario y correo de prueba |

## API Endpoints

Todas las rutas bajo `/api/recetas`, `/api/inventario`, `/api/farmacias` y
`/api/notificaciones` requieren JWT (`Authorization: Bearer <token>`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/google` | Login con Google (recibe `credential`) |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| POST | `/api/recetas/analizar` | Analiza imagen Base64 con IA |
| POST | `/api/recetas/guardar` | Guarda receta validada + medicamentos (transaccional) |
| GET | `/api/recetas?page=&limit=` | Historial paginado |
| GET | `/api/recetas/:id` | Detalle completo (con imagen) |
| PUT | `/api/recetas/:id` | Edita datos clínicos y medicamentos |
| DELETE | `/api/recetas/:id` | Elimina del historial (cascada) |
| GET | `/api/inventario` | Botiquín con resumen de alertas |
| POST | `/api/inventario/analizar` | Analiza foto de empaque con IA (Groq Vision) |
| POST | `/api/inventario` | Agrega medicamento |
| POST | `/api/inventario/batch` | Agrega lote (máx. 50, transaccional) |
| PUT | `/api/inventario/:id` | Actualiza medicamento |
| DELETE | `/api/inventario/:id` | Elimina medicamento |
| POST | `/api/farmacias/buscar` | Precios (SerpApi Google Shopping) |
| POST | `/api/farmacias/cercanas` | Farmacias con GPS (SerpApi Google Maps) |
| GET | `/api/farmacias/historial` | Últimas 10 búsquedas |
| GET | `/api/notificaciones/preferencias` | Preferencias de notificación del usuario |
| PUT | `/api/notificaciones/preferencias` | Actualiza notif_activas y umbral de días (1-365) |
| POST | `/api/notificaciones/probar` | Envía correo de prueba al usuario autenticado |

## Licencia

Proyecto académico - Universidad Autónoma Metropolitana, Unidad Azcapotzalco.
