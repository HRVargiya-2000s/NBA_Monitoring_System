
const { pool } = require('../config/db/index.js');

const ACADEMIC_BRANCHES = [
    ['52', 'AI', 'Artificial Intelligence'],
    ['02', 'AUTO', 'Automobile Engineering'],
    ['03', 'BIO', 'Biomedical Engineering'],
    ['05', 'CHEM', 'Chemical Engineering'],
    ['06', 'CIVIL', 'Civil Engineering'],
    ['07', 'CE', 'Computer Engineering'],
    ['09', 'ELE', 'Electrical Engineering'],
    ['11', 'EC', 'Electronics and Communication Engineering'],
    ['13', 'ENV', 'Environmental Engineering'],
    ['16', 'IT', 'Information Technology'],
    ['17', 'IC', 'Instrumentation and Control Engineering'],
    ['19', 'MECH', 'Mechanical Engineering'],
    ['23', 'PLASTIC', 'Plastic Technology'],
    ['26', 'RUBBER', 'Rubber Technology'],
    ['29', 'TEXTILE', 'Textile Technology']
];

const ACADEMIC_COURSES = [
    ['BE', 4],
    ['ME', 2],
    ['MCA', 2]
];

const ensureAcademicSeedData = async () => {
    const branchCodes = ACADEMIC_BRANCHES.map(([code]) => code);

    for (const [branchCode, shortName, name] of ACADEMIC_BRANCHES) {
        await pool.query(
            `INSERT INTO branch (branch_code, name, logo_url, hod_id, created_at, is_deleted)
             VALUES ($1, $2, NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE)
             ON CONFLICT (branch_code)
             DO UPDATE SET
               name = EXCLUDED.name,
               is_deleted = FALSE`,
            [branchCode, name]
        );
    }

    await pool.query(
        `UPDATE course
         SET is_deleted = TRUE
         WHERE LOWER(TRIM(name)) NOT IN ('be', 'me', 'mca')`
    );

    await pool.query(
        `WITH seed(name, duration_years) AS (
           VALUES ('BE'::varchar, 4), ('ME'::varchar, 2), ('MCA'::varchar, 2)
         )
         UPDATE course c
         SET duration_years = seed.duration_years,
             is_deleted = FALSE
         FROM seed
         WHERE LOWER(TRIM(c.name)) = LOWER(seed.name)`
    );

    await pool.query(
        `WITH seed(name, duration_years) AS (
           VALUES ('BE'::varchar, 4), ('ME'::varchar, 2), ('MCA'::varchar, 2)
         )
         INSERT INTO course (name, duration_years, created_at, is_deleted)
         SELECT seed.name, seed.duration_years, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE
         FROM seed
         WHERE NOT EXISTS (
           SELECT 1
           FROM course c
           WHERE LOWER(TRIM(c.name)) = LOWER(seed.name)
         )`
    );

    await pool.query(
        `WITH ranked_courses AS (
           SELECT id,
                  ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY id ASC) AS row_rank
           FROM course
           WHERE LOWER(TRIM(name)) IN ('be', 'me', 'mca')
             AND is_deleted = FALSE
         )
         UPDATE course c
         SET is_deleted = TRUE
         FROM ranked_courses r
         WHERE c.id = r.id
           AND r.row_rank > 1`
    );
};

const getBranchShortName = (branchCode) => {
    const match = ACADEMIC_BRANCHES.find(([code]) => code === branchCode);
    return match?.[1] || branchCode;
};

const insertFaculty = async (client, data) => {
    const query = `
        INSERT INTO faculty (name, type, branch_code, mobile_no, email, college_email, password, years_of_experience, joining_date, created_at)
        SELECT $1::varchar, $2::faculty_type, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::varchar, $8::int, $9::date, EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE NOT EXISTS (
            SELECT 1
            FROM faculty
            WHERE LOWER(TRIM(email::text)) = LOWER(TRIM($5::text))
              AND is_deleted = FALSE
        )
        RETURNING id, name, email, type;
    `;
    const values = [
        data.name,
        data.type,
        data.branch_code || null,
        data.mobile_no || null,
        data.email,
        data.college_email || null,
        data.password,
        data.years_of_experience ?? null,
        data.joining_date || null
    ];
    const result = await client.query(query, values);
    return result.rows[0] || null;
};

const getCoursesList = async () => {
    await ensureAcademicSeedData();

    const query = `
        SELECT id, name, duration_years
        FROM course
        WHERE is_deleted = FALSE
        ORDER BY name ASC
    `;
    const result = await pool.query(query);
    return result.rows;
};

const getDepartmentsList = async () => {
    await ensureAcademicSeedData();

    const query = `
        SELECT branch_code, name
        FROM branch
        WHERE is_deleted = FALSE
        ORDER BY branch_code ASC
    `;

    const result = await pool.query(query);
    return result.rows.map((row) => ({
        ...row,
        short_name: getBranchShortName(row.branch_code),
        display_name: `${getBranchShortName(row.branch_code)} - ${row.branch_code}`
    }));
};

const getActiveBranchCount = async () => {
    await ensureAcademicSeedData();

    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM branch
         WHERE is_deleted = FALSE`
    );

    return result.rows[0]?.count || 0;
};

const getBatchesByBranch = async (branchCode) => {
    const query = `
        SELECT
            b.id AS batch_id,
            b.branch_code,
            b.enrolled_year,
            b.passing_year,
            COALESCE(b.batch_no, b.enrolled_year::TEXT || '-' || b.passing_year::TEXT) AS batch_no,
            b.course_id,
            c.name AS course_name
        FROM batch b
        LEFT JOIN course c ON c.id = b.course_id
        WHERE b.is_deleted = FALSE
          AND b.branch_code = $1
        ORDER BY b.enrolled_year DESC, b.id DESC
    `;

    const result = await pool.query(query, [branchCode]);
    return result.rows;
};

const getStudentsList = async ({ division, enrolled_year, branch_code, name }) => {
    let query = `
        SELECT
            s.enrollment_no,
            s.name,
            s.email,
            s.current_division,
            b.enrolled_year,
            b.passing_year,
            COALESCE(b.batch_no, b.enrolled_year::TEXT || '-' || b.passing_year::TEXT) AS batch_no,
            br.name as branch_name,
            b.branch_code
        FROM student s
        JOIN batch b ON s.batch_id = b.id
        LEFT JOIN branch br ON b.branch_code = br.branch_code
        WHERE s.is_deleted = FALSE
    `;
    const params = [];
    let paramCount = 1;

    if (division) {
        query += ` AND s.current_division = $${paramCount}`;
        params.push(division);
        paramCount++;
    }
    if (enrolled_year) {
        query += ` AND b.enrolled_year = $${paramCount}`;
        params.push(enrolled_year);
        paramCount++;
    }
    if (branch_code) {
        query += ` AND b.branch_code = $${paramCount}`;
        params.push(branch_code);
        paramCount++;
    }
    if (name) {
        query += ` AND s.name ILIKE $${paramCount}`;
        params.push(`%${name}%`);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
};

const getFacultyList = async ({ role, branch_code, name }) => {
    let query = `
        SELECT f.id, f.name, f.email, f.type as role, f.branch_code 
        FROM faculty f
        WHERE f.is_deleted = FALSE
    `;
    const params = [];
    let paramCount = 1;
    
    // role here could be 'ASSISTANT', 'HOD', etc.
    if (role && role !== 'faculty') { 
        query += ` AND f.type::text = $${paramCount}`;
        params.push(String(role).trim());
        paramCount++;
    }

    if (branch_code) {
        query += ` AND f.branch_code = $${paramCount}`;
        params.push(branch_code);
        paramCount++;
    }

    if (name) {
        query += ` AND f.name ILIKE $${paramCount}`;
        params.push(`%${name}%`);
    }

    const result = await pool.query(query, params);
    return result.rows;
};

const insertBulkStudents = async (client, students) => {
    if (!students.length) return;

    const values = [];
    const placeholders = students.map((student, index) => {
        const base = index * 6;
        values.push(
            student.enrollment_no,
            student.batch_id,
            student.name,
            student.current_division,
            student.password, // Hashed password
            Date.now() // created_at
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });

    const query = `
        INSERT INTO student (enrollment_no, batch_id, name, current_division, password, created_at)
        VALUES ${placeholders.join(", ")}
    `;
    await client.query(query, values);
};

module.exports = {
    insertFaculty,
    getStudentsList,
    getFacultyList,
    insertBulkStudents,
    getCoursesList,
    getDepartmentsList,
    getActiveBranchCount,
    getBatchesByBranch
};
