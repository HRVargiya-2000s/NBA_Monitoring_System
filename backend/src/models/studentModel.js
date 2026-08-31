const { pool } = require('../config/db');

const getStudentProfileByEnrollmentNo = async (enrollmentNo) => {
    const query = `
        SELECT
            s.enrollment_no AS id,
            s.enrollment_no AS enrollment_number,
            s.name,
            s.email,
            br.branch_code,
            br.name AS branch_name,
            (
                SELECT os.sem_number
                FROM student_offering_subject sos
                JOIN offered_subjects os
                    ON os.id = sos.offering_id
                   AND os.is_deleted = FALSE
                WHERE sos.enrollment_no = s.enrollment_no
                  AND sos.is_deleted = FALSE
                ORDER BY os.accadmic_year DESC, os.sem_number DESC, os.id DESC
                LIMIT 1
            ) AS semester,
            s.current_division AS division,
            b.id AS batch_id,
            NULL::VARCHAR AS batch_name
        FROM student s
        LEFT JOIN batch b
            ON b.id = s.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE s.enrollment_no = $1
          AND s.is_deleted = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [enrollmentNo]);
    return rows[0] || null;
};

const getEnrolledClassesByStudent = async (enrollmentNo) => {
    const query = `
        SELECT
            os.id AS offering_id,
            os.subject_code,
            sub.name AS subject_name,
            br.branch_code,
            br.name AS branch_name,
            os.sem_number AS semester,
            s.current_division AS division,
            b.id AS batch_id,
            NULL::VARCHAR AS batch_name,
            os.accadmic_year AS academic_year,
            UPPER(os.session) AS session
        FROM student_offering_subject sos
        JOIN student s
            ON s.enrollment_no = sos.enrollment_no
           AND s.is_deleted = FALSE
        JOIN offered_subjects os
            ON os.id = sos.offering_id
           AND os.is_deleted = FALSE
        JOIN subject sub
            ON sub.subject_code = os.subject_code
           AND sub.is_deleted = FALSE
        LEFT JOIN batch b
            ON b.id = os.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE sos.enrollment_no = $1
          AND sos.is_deleted = FALSE
          AND (os.batch_id IS NULL OR os.batch_id = s.batch_id)
        ORDER BY os.accadmic_year DESC, os.sem_number ASC, sub.name ASC, os.id ASC
    `;

    const { rows } = await pool.query(query, [enrollmentNo]);
    return rows;
};

const getActiveAttendanceSessionsForStudent = async (enrollmentNo) => {
    const query = `
        SELECT
            ats.id AS session_id,
            ats.lecture_id,
            ats.offering_id,
            os.subject_code,
            sub.name AS subject_name,
            ats.faculty_id,
            f.name AS faculty_name,
            br.branch_code,
            br.name AS branch_name,
            os.sem_number AS semester,
            ats.division,
            os.accadmic_year AS academic_year,
            UPPER(os.session) AS academic_session,
            ats.status,
            ats.started_at,
            ats.duration_minutes,
            ats.started_at + (ats.duration_minutes * INTERVAL '1 minute') AS expires_at
        FROM attendance_session ats
        JOIN student_offering_subject sos
            ON sos.offering_id = ats.offering_id
           AND sos.is_deleted = FALSE
        JOIN student st
            ON st.enrollment_no = sos.enrollment_no
           AND st.is_deleted = FALSE
        JOIN offered_subjects os
            ON os.id = ats.offering_id
           AND os.is_deleted = FALSE
        JOIN subject sub
            ON sub.subject_code = os.subject_code
           AND sub.is_deleted = FALSE
        JOIN faculty f
            ON f.id = ats.faculty_id
           AND f.is_deleted = FALSE
        JOIN assigned_subject_faculty asf
            ON asf.id = ats.assignment_id
           AND asf.offering_id = ats.offering_id
           AND asf.faculty_id = ats.faculty_id
           AND asf.division = ats.division
           AND asf.is_deleted = FALSE
        LEFT JOIN batch b
            ON b.id = os.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE sos.enrollment_no = $1
          AND ats.status = 'ACTIVE'
          AND ats.is_deleted = FALSE
          AND ats.started_at + (ats.duration_minutes * INTERVAL '1 minute') > CURRENT_TIMESTAMP
          AND ats.division = st.current_division
          AND (os.batch_id IS NULL OR os.batch_id = st.batch_id)
        ORDER BY ats.started_at DESC, ats.id DESC
    `;

    const { rows } = await pool.query(query, [enrollmentNo]);
    return rows;
};

module.exports = {
    getStudentProfileByEnrollmentNo,
    getEnrolledClassesByStudent,
    getActiveAttendanceSessionsForStudent
};
