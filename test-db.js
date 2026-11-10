require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ 
  connectionString: process.env.DATABASE_URL 
});

// Este evento captura los errores silenciosos del socket
client.on('error', (err) => {
  console.error('🔥 ERROR CAPTURADO EN EL SOCKET:', err);
});

client.connect()
  .then(() => {
    console.log('✅ ¡CONEXIÓN EXITOSA!');
    return client.query('SELECT count(*) FROM scenarios');
  })
  .then(res => {
    console.log('Escenarios en la BD:', res.rows[0].count);
    client.end();
  })
  .catch(err => {
    console.error('❌ DETALLE DEL ERROR:', err.message);
    console.error('Código de error:', err.code);
    console.error('Stack:', err.stack);
    client.end();
  });