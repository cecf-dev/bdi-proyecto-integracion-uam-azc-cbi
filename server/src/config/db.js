/**
 * BDI - Pool de Conexiones MySQL
 * 
 * Utiliza mysql2/promise para soporte nativo de async/await.
 * El pool gestiona automáticamente las conexiones.
 */

const mysql = require('mysql2/promise');
const config = require('./env');

/**
 * Pool de conexiones MySQL.
 * Se crea una sola vez y se reutiliza en toda la aplicación.
 */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Prueba la conexión a la base de datos.
 * Se invoca al iniciar el servidor para verificar conectividad.
 * 
 * @returns {Promise<boolean>} true si la conexión es exitosa
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    console.error('   Verifica que MySQL esté corriendo y las credenciales en .env sean correctas.');
    return false;
  }
};

module.exports = { pool, testConnection };
