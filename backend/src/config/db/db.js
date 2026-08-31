const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : undefined,
    }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
    };

const pool = new Pool(poolConfig);

const FACULTY_TYPE_VALUES = ['ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN'];

const ensureFacultyTypeEnumValues = async () => {
    const { rows } = await pool.query(
        `SELECT 1
         FROM pg_type
         WHERE typname = 'faculty_type'`
    );

    if (!rows.length) {
        return;
    }

    for (const value of FACULTY_TYPE_VALUES) {
        const { rows: enumRows } = await pool.query(
            `SELECT 1
             FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'faculty_type'
               AND e.enumlabel = $1`,
            [value]
        );

        if (!enumRows.length) {
            await pool.query(`ALTER TYPE faculty_type ADD VALUE IF NOT EXISTS '${value}'`);
        }
    }
};

const InitDB = async () => {
    const initScriptPath = path.join(__dirname, 'up.sql');
    const initScript = fs.readFileSync(initScriptPath, 'utf-8');
    
    await pool.query(initScript); 
    await ensureFacultyTypeEnumValues();
}

const InitDummyData = async () => {
    const dummyScriptPath = path.join(__dirname, 'dummy.sql');
    const dummyScript = fs.readFileSync(dummyScriptPath, 'utf-8');

    await pool.query(dummyScript);
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    InitDB,
    InitDummyData,
};
