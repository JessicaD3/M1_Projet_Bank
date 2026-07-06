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

  // Réinitialise le mot de passe ET réactive TOUS les comptes
  await conn.execute('UPDATE users SET password = ?, is_actif = TRUE', [hash]);

  console.log('✅ Tous les comptes réinitialisés (mot de passe : Password1, comptes actifs)');
  await conn.end();
})();