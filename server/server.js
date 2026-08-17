/**
 * BDI - Punto de Entrada del Servidor
 * 
 * Inicia la aplicación Express, verifica la conexión a MySQL
 * y escucha en el puerto configurado.
 */

const app = require('./src/app');
const config = require('./src/config/env');
const { testConnection } = require('./src/config/db');
const cron = require('node-cron');
const notificacionService = require('./src/services/notificacionService');

const PORT = config.port;

/**
 * Inicia el scheduler del recordatorio diario de caducidad.
 * Se activa solo si NOTIF_CRON_ENABLED=true en server/.env.
 */
const startScheduler = () => {
  if (!config.notifCronEnabled) {
    console.log('🔕 Notificaciones automáticas deshabilitadas (NOTIF_CRON_ENABLED=false)');
    return;
  }

  cron.schedule(
    config.notifCronSchedule,
    async () => {
      console.log(`🔔 [${new Date().toISOString()}] Ejecutando recordatorio diario de caducidad...`);
      try {
        const resumen = await notificacionService.enviarResumenDiario();
        console.log(
          `✅ Recordatorio completado: ${resumen.enviados} enviado(s), ` +
          `${resumen.conAlertas} usuario(s) con alertas, ` +
          `${resumen.omitidosSinAlertas} omitido(s) sin alertas, ` +
          `${resumen.errores.length} error(es).`
        );
      } catch (error) {
        console.error('❌ Error en el recordatorio diario:', error.message);
      }
    },
    {
      timezone: config.notifCronTimezone,
    }
  );

  console.log(
    `🔔 Recordatorio diario programado: "${config.notifCronSchedule}" (${config.notifCronTimezone})`
  );
};

/**
 * Inicia el servidor.
 * Intenta conectar a MySQL antes de escuchar peticiones.
 */
const startServer = async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🏥 Botiquín Digital Inteligente (BDI)  ║');
  console.log('║   Servidor Backend v1.0                  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Verificar conexión a MySQL (no bloquea el inicio)
  await testConnection();

  // Iniciar scheduler de recordatorios diarios de caducidad
  startScheduler();

  // Iniciar servidor HTTP
  app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`📡 API disponible en:     http://localhost:${PORT}/api`);
    console.log(`❤️  Health check:          http://localhost:${PORT}/api/health`);
    console.log(`🌍 Entorno:               ${config.nodeEnv}`);
    console.log('');
  });
};

// Manejar errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Arrancar
startServer();
