const { pool } = require('../config/db');

const findUserByIdentifier = async (identifier) => {
    const normalizedIdentifier = String(identifier || '').trim();

    // We check enrollment_no, personal email, and college email for students.
    const query = `
        SELECT
            enrollment_no AS id,
            enrollment_no AS enrollment_number,
            name,
            email,
            college_email AS institute_email,
            password
        FROM student 
        WHERE (
            TRIM(enrollment_no) = $1
            OR LOWER(TRIM(email)) = LOWER($1)
            OR LOWER(TRIM(college_email)) = LOWER($1)
        )
          AND is_deleted = FALSE
    `;
    const { rows } = await pool.query(query, [normalizedIdentifier]);
    
    if (rows[0]) {
        rows[0].role = 'student'; 
    }
    return rows[0];
};

const findFacultyByIdentifier = async (identifier) => {
    const normalizedIdentifier = String(identifier || '').trim();

    // Faculty lookup supports authenticated id and both personal/college email-based flows.
    const query = `
        SELECT id, name, email, college_email, password, type as role
        FROM faculty 
        WHERE (
            id::text = $1
            OR LOWER(TRIM(email)) = LOWER($1)
            OR LOWER(TRIM(college_email)) = LOWER($1)
        )
          AND is_deleted = FALSE
    `;
    const { rows } = await pool.query(query, [normalizedIdentifier]);
    return rows[0];
};

const getStudentProfile = async (id) => {
    const query = `
        SELECT 
            s.*,
            'student' as role,
            b2.name as branch_name,
            bt.enrolled_year,
            bt.passing_year,
            json_build_object(
                'line_1', cur_addr.line_1, 'city', cur_addr.city,
                'state', cur_addr.state, 'pincode', cur_addr.pincode
            ) as current_address,
            (SELECT json_agg(ed) FROM (
                SELECT institute_name, passing_year, remarks 
                FROM education_details 
                WHERE student_enrollment_no = s.enrollment_no 
                  AND person_type = 'student'
                  AND is_deleted = FALSE
            ) ed) as education
        FROM student s
        LEFT JOIN batch bt       ON s.batch_id = bt.id
        LEFT JOIN branch b2      ON bt.branch_code = b2.branch_code
        LEFT JOIN address cur_addr ON s.current_address_id = cur_addr.id
        WHERE s.enrollment_no = $1 AND s.is_deleted = FALSE
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
};

const getFacultyProfile = async (id) => {
    const query = `
        SELECT 
            f.id,
            f.name,
            f.email,
            f.mobile_no,
            f.college_email,
            f.type            AS role,
            f.years_of_experience,
            f.joining_date,
            f.profile_url,
            b.name            AS branch_name,
            CASE 
                WHEN cur_addr.id IS NULL THEN NULL
                ELSE json_build_object(
                    'line_1',  cur_addr.line_1,
                    'city',    cur_addr.city,
                    'state',   cur_addr.state,
                    'pincode', cur_addr.pincode
                )
            END AS current_address,
            (
                SELECT json_agg(ed ORDER BY ed.passing_year DESC)
                FROM (
                    SELECT institute_name, passing_year, remarks
                    FROM education_details
                    WHERE faculty_id  = f.id
                      AND person_type = 'faculty'
                      AND is_deleted  = FALSE
                ) ed
            ) AS education,
            (
                SELECT json_agg(ex ORDER BY ex.id ASC)
                FROM (
                    SELECT id, starting_month_year, ending_month_year, description
                    FROM faculty_experience
                    WHERE faculty_id = f.id
                      AND is_deleted = FALSE
                ) ex
            ) AS experience,
            (
                SELECT json_agg(subj ORDER BY subj.accadmic_year DESC, subj.sem_number ASC)
                FROM (
                                        SELECT
                                                os.id          AS offering_id,
                                                s.name         AS subject_name,
                                                s.subject_code,
                                                s.syllabus_url,
                                                s.syllabus_file_name,
                                                os.accadmic_year,
                                                os.session,
                                                os.sem_number,
                                            os.include_pso,
                                                asf.role       AS teaching_role,
                                                asf.division,
                                                asf.total_lectures,
                                                COALESCE(b.branch_code, fc.branch_code) AS branch_code
                                        FROM assigned_subject_faculty asf
                                        JOIN offered_subjects os ON asf.offering_id = os.id
                                        JOIN subject s           ON os.subject_code  = s.subject_code
                                        LEFT JOIN batch b        ON b.id = os.batch_id
                                        LEFT JOIN faculty fc     ON fc.id = os.faculty_corrdinator_id
                                        WHERE asf.faculty_id = f.id
                                            AND asf.is_deleted  = FALSE
                                            AND os.is_deleted   = FALSE
                ) subj
            ) AS assigned_subjects
        FROM faculty f
        LEFT JOIN branch b           ON f.branch_code        = b.branch_code
        LEFT JOIN address cur_addr   ON f.current_address_id = cur_addr.id
        WHERE f.id = $1 AND f.is_deleted = FALSE
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
};

const updateFacultyProfile = async (id, fields) => {
    const {
        name, mobile_no, college_email,
        years_of_experience, joining_date,
        line_1, city, state, pincode,
        experience
    } = fields;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const normalizedYears =
            years_of_experience === '' || years_of_experience === null || years_of_experience === undefined
                ? null
                : Number(years_of_experience);

        await client.query(
            `UPDATE faculty
             SET name=$1, mobile_no=$2, college_email=$3, years_of_experience=$4, joining_date=$5
             WHERE id=$6`,
            [name, mobile_no || null, college_email || null, Number.isNaN(normalizedYears) ? null : normalizedYears, joining_date || null, id]
        );

        const { rows } = await client.query(
            `SELECT current_address_id FROM faculty WHERE id = $1`, [id]
        );
        const existingAddrId = rows[0]?.current_address_id;
        const hasAddressFields = Boolean(line_1 || city || state || pincode);

        if (existingAddrId) {
            await client.query(
                `UPDATE address SET line_1=$1, city=$2, state=$3, pincode=$4 WHERE id=$5`,
                [line_1 || '', city || '', state || '', pincode || '', existingAddrId]
            );
        } else if (hasAddressFields) {
            const { rows: newAddr } = await client.query(
                `INSERT INTO address(line_1, city, state, pincode) VALUES($1,$2,$3,$4) RETURNING id`,
                [line_1 || '', city || '', state || '', pincode || '']
            );
            await client.query(
                `UPDATE faculty SET current_address_id=$1 WHERE id=$2`,
                [newAddr[0].id, id]
            );
        }

        if (Array.isArray(experience)) {
            const incomingIds = experience
                .map((exp) => exp?.id)
                .filter((expId) => Number.isInteger(Number(expId)))
                .map((expId) => Number(expId));

            if (incomingIds.length > 0) {
                await client.query(
                    `DELETE FROM faculty_experience
                     WHERE faculty_id = $1
                       AND id <> ALL($2::int[])`,
                    [id, incomingIds]
                );
            } else {
                await client.query(
                    `DELETE FROM faculty_experience
                     WHERE faculty_id = $1`,
                    [id]
                );
            }

            for (const exp of experience) {
                const start = exp?.starting_month_year || null;
                const end = exp?.ending_month_year || null;
                const description = exp?.description || null;
                const parsedId = Number(exp?.id);

                if (!start && !description) {
                    continue;
                }

                if (Number.isInteger(parsedId)) {
                    await client.query(
                        `UPDATE faculty_experience
                         SET starting_month_year = $1,
                             ending_month_year = $2,
                             description = $3
                         WHERE id = $4 AND faculty_id = $5`,
                        [start || 'N/A', end, description, parsedId, id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO faculty_experience (faculty_id, starting_month_year, ending_month_year, description)
                         VALUES ($1, $2, $3, $4)`,
                        [id, start || 'N/A', end, description]
                    );
                }
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateStudentPassword = async (enrollment_no, newPassword) => {
    return await pool.query(
        'UPDATE student SET password = $1 WHERE enrollment_no = $2',
        [newPassword, enrollment_no]
    );
};

const updateFacultyPassword = async (id, newPassword) => {
    return await pool.query(
        'UPDATE faculty SET password = $1 WHERE id = $2',
        [newPassword, id]
    );
};

module.exports = { findUserByIdentifier, findFacultyByIdentifier, getStudentProfile, getFacultyProfile, updateStudentPassword, updateFacultyProfile, updateFacultyPassword };
