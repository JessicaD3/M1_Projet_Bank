require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const hash = await bcrypt.hash('Password1', 10);

  await conn.execute('UPDATE users SET password = ? WHERE email IN (?, ?)', [
    hash,
    'admin@ourbank.fr',
    'jean.dupont@mail.fr',
  ]);

  console.log('✅ Mots de passe de test mis à jour (Password1)');
  await conn.end();
})();