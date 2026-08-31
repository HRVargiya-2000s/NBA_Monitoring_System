require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, InitDB } = require('../src/config/db');

const DEFAULT_ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'System Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@ldce.ac.in',
  password: process.env.SEED_ADMIN_PASSWORD || process.env.DEFAULT_PASSWORD || 'LDCE@123',
};

(async () => {
  await InitDB();

  const existing = await pool.query(
    `SELECT id, email
     FROM faculty
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       AND is_deleted = FALSE
     LIMIT 1`,
    [DEFAULT_ADMIN.email]
  );

  if (existing.rowCount > 0) {
    console.log(`Admin already exists: ${existing.rows[0].email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

  const created = await pool.query(
    `INSERT INTO faculty (name, type, email, college_email, password, created_at, is_deleted)
     VALUES ($1, 'ADMIN', $2, $2, $3, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE)
     RETURNING id, email, type`,
    [DEFAULT_ADMIN.name, DEFAULT_ADMIN.email, hashedPassword]
  );

  console.log(`Created ${created.rows[0].type} login: ${created.rows[0].email}`);
})()
  .catch((error) => {
    console.error('Failed to seed admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
