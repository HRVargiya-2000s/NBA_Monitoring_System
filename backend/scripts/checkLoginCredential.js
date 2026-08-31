require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');
const { findFacultyByIdentifier } = require('../src/models/userModel');

const identifier = process.argv[2] || 'admin@ldce.ac.in';
const password = process.argv[3] || 'LDCE@123';

(async () => {
  const counts = await pool.query(`
    SELECT
      COUNT(*)::int AS faculty_total,
      COUNT(*) FILTER (WHERE is_deleted = FALSE)::int AS faculty_active
    FROM faculty
  `);

  const user = await findFacultyByIdentifier(identifier);
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  console.log(JSON.stringify({
    database: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.DB_NAME,
    identifier,
    facultyCounts: counts.rows[0],
    userFound: Boolean(user),
    user: user ? {
      id: user.id,
      email: user.email,
      college_email: user.college_email,
      role: user.role,
    } : null,
    passwordMatches,
  }, null, 2));
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
