const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../src/config/db');

const clearFacultyCredentials = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`UPDATE branch SET hod_id = NULL WHERE hod_id IS NOT NULL`);

    const result = await client.query(`
      UPDATE faculty
      SET is_deleted = TRUE
      WHERE is_deleted = FALSE
      RETURNING id, email, college_email, type
    `);

    await client.query('COMMIT');

    console.log(`Cleared ${result.rowCount} active faculty credential(s).`);
    if (result.rowCount) {
      console.table(result.rows);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to clear faculty credentials:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

clearFacultyCredentials();
