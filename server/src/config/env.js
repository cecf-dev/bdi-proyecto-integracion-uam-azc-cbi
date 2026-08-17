/**
 * BDI - Configuración de Variables de Entorno
 * 
 * Valida que todas las variables de entorno requeridas estén presentes
 * antes de iniciar el servidor. Falla rápido si falta alguna.
 */

const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Lista de variables de entorno requeridas.
 * Se validan al importar este módulo.
 */
const requiredEnvVars = [
  'PORT',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
];

/**
 * Valida que las variables requeridas existan.
 * Solo muestra warning en desarrollo si faltan variables opcionales.
 */
const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `⚠️  Variables de entorno faltantes: ${missing.join(', ')}\n` +
      `   Copia server/.env.example a server/.env y completa los valores.`
    );
  }
};

validateEnv();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Base de Datos
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bdi_db',
  },

  // APIs externas
  groqApiKey: process.env.GROQ_API_KEY || '',
  serpApiKey: process.env.SERPAPI_KEY || '',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'bdi-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Notificaciones por correo (Nodemailer + SMTP)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  },
  notifCronEnabled: process.env.NOTIF_CRON_ENABLED === 'true',
  notifCronSchedule: process.env.NOTIF_CRON_SCHEDULE || '0 8 * * *',
  notifCronTimezone: process.env.NOTIF_CRON_TIMEZONE || 'America/Mexico_City',
};
