const db = require('../config/db/db.js');

const insertOrUpdateAttendance = async (client, lecture_id, attendanceData) => {
    const query = `
        INSERT INTO marked_attendance (lecture_id, enrollment_no, status, is_deleted)
        VALUES ($1, $2, $3, FALSE)
        ON CONFLICT (lecture_id, enrollment_no) 
        DO UPDATE SET status = EXCLUDED.status,
                      is_deleted = FALSE
    `;
    
    for (let record of attendanceData) {
        await client.query(query, [lecture_id, record.enrollment_no, record.status]);
    }
};

const fetchAttendanceList = async (offeringId, division, batchId) => {
    const query = `
        SELECT
            s.enrollment_no,
            s.name,
            tl.date_of_lecture AS date,
            tl.division,
            ma.status,
            lp.description AS topic
        FROM marked_attendance ma
        JOIN taken_lecture tl ON ma.lecture_id = tl.id
        JOIN lecture_plan lp ON tl.lecture_plan_id = lp.id
        JOIN student s ON ma.enrollment_no = s.enrollment_no
        WHERE lp.offering_id = $1
          AND ma.is_deleted = FALSE
          AND tl.is_deleted = FALSE
          AND lp.is_deleted = FALSE
          AND ($2::VARCHAR IS NULL OR tl.division = $2)
          AND ($3::INT IS NULL OR s.batch_id = $3)
        ORDER BY tl.date_of_lecture DESC, s.enrollment_no ASC
    `;
    
    const result = await db.query(query, [offeringId, division || null, batchId || null]);
    return result.rows;
};

const fetchStudentReport = async (studentId, offeringId) => {
    const query = `
        SELECT
            sub.name AS subject_name,
            os.subject_code,
            lp.description AS topic,
            tl.date_of_lecture AS date,
            tl.division,
            ma.status
        FROM marked_attendance ma
        JOIN taken_lecture tl ON ma.lecture_id = tl.id
        JOIN lecture_plan lp ON tl.lecture_plan_id = lp.id
        JOIN offered_subjects os ON os.id = lp.offering_id
        JOIN subject sub ON sub.subject_code = os.subject_code
        WHERE ma.enrollment_no = $1
          AND ma.is_deleted = FALSE
          AND tl.is_deleted = FALSE
          AND lp.is_deleted = FALSE
          AND os.is_deleted = FALSE
          AND sub.is_deleted = FALSE
          AND ($2::INT IS NULL OR lp.offering_id = $2)
        ORDER BY sub.name ASC, tl.date_of_lecture DESC
    `;

    const result = await db.query(query, [studentId, offeringId || null]);
    return result.rows;
};

const getStudentByEnrollmentNo = async (client, enrollmentNo) => {
    const query = `
        SELECT enrollment_no, batch_id, current_division
        FROM student
        WHERE enrollment_no = $1
          AND is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [enrollmentNo]);
    return result.rows[0] || null;
};

const getAttendanceSessionForStudentMarking = async (client, sessionId) => {
    const query = `
        SELECT
            ats.id AS session_id,
            ats.lecture_id,
            ats.offering_id,
            ats.division,
            ats.status,
            ats.started_at,
            ats.duration_minutes,
            ats.started_at + (ats.duration_minutes * INTERVAL '1 minute') AS expires_at,
            (ats.started_at + (ats.duration_minutes * INTERVAL '1 minute') <= CURRENT_TIMESTAMP) AS is_expired,
            tl.id AS taken_lecture_id,
            tl.is_deleted AS taken_lecture_is_deleted
        FROM attendance_session ats
        JOIN taken_lecture tl
            ON tl.id = ats.lecture_id
        WHERE ats.id = $1
          AND ats.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [sessionId]);
    return result.rows[0] || null;
};

const isStudentEnrolledInOffering = async (client, enrollmentNo, offeringId) => {
    const query = `
        SELECT 1
        FROM student_offering_subject sos
        JOIN offered_subjects os
            ON os.id = sos.offering_id
           AND os.is_deleted = FALSE
        JOIN student s
            ON s.enrollment_no = sos.enrollment_no
           AND s.is_deleted = FALSE
        WHERE sos.enrollment_no = $1
          AND sos.offering_id = $2
          AND sos.is_deleted = FALSE
          AND (os.batch_id IS NULL OR os.batch_id = s.batch_id)
        LIMIT 1
    `;

    const result = await client.query(query, [enrollmentNo, offeringId]);
    return result.rowCount > 0;
};

const getMarkedAttendanceForLecture = async (client, lectureId, enrollmentNo) => {
    const query = `
        SELECT id, lecture_id, enrollment_no, status, created_at
        FROM marked_attendance
        WHERE lecture_id = $1
          AND enrollment_no = $2
          AND is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [lectureId, enrollmentNo]);
    return result.rows[0] || null;
};

const insertStudentAttendanceMark = async (client, lectureId, enrollmentNo) => {
    const query = `
        INSERT INTO marked_attendance (
            lecture_id,
            enrollment_no,
            status,
            created_at,
            is_deleted
        )
        VALUES ($1, $2, 'PRESENT', CURRENT_TIMESTAMP, FALSE)
        RETURNING id, lecture_id, enrollment_no, status, created_at
    `;

    const result = await client.query(query, [lectureId, enrollmentNo]);
    return result.rows[0];
};

const getAttendanceAssignmentById = async (client, assignmentId) => {
    const query = `
        SELECT
            asf.id AS assignment_id,
            asf.offering_id,
            asf.faculty_id,
            asf.division,
            asf.role AS faculty_role,
            asf.total_lectures,
            os.subject_code,
            s.name AS subject_name,
            os.sem_number AS semester,
            os.accadmic_year AS academic_year,
            UPPER(os.session) AS academic_session,
            b.id AS batch_id,
            NULL::VARCHAR AS batch_name,
            br.branch_code,
            br.name AS branch_name
        FROM assigned_subject_faculty asf
        JOIN offered_subjects os
            ON os.id = asf.offering_id
           AND os.is_deleted = FALSE
        JOIN subject s
            ON s.subject_code = os.subject_code
           AND s.is_deleted = FALSE
        LEFT JOIN batch b
            ON b.id = os.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE asf.id = $1
          AND asf.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [assignmentId]);
    return result.rows[0] || null;
};

const getActiveAttendanceSessionForFaculty = async (client, facultyId) => {
    const query = `
        SELECT
            ats.id,
            ats.assignment_id,
            ats.lecture_id,
            ats.faculty_id,
            ats.offering_id,
            ats.division,
            ats.status,
            ats.started_at,
            ats.ended_at,
            ats.duration_minutes,
            os.subject_code,
            s.name AS subject_name,
            os.sem_number AS semester,
            os.accadmic_year AS academic_year,
            UPPER(os.session) AS academic_session,
            b.id AS batch_id,
            NULL::VARCHAR AS batch_name,
            br.branch_code,
            br.name AS branch_name,
            asf.faculty_id,
            asf.role AS faculty_role,
            asf.total_lectures
        FROM attendance_session ats
        JOIN assigned_subject_faculty asf
            ON asf.id = ats.assignment_id
           AND asf.is_deleted = FALSE
        JOIN offered_subjects os
            ON os.id = ats.offering_id
           AND os.is_deleted = FALSE
        JOIN subject s
            ON s.subject_code = os.subject_code
           AND s.is_deleted = FALSE
        LEFT JOIN batch b
            ON b.id = os.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE ats.faculty_id = $1
          AND ats.status = 'ACTIVE'
          AND ats.is_deleted = FALSE
        ORDER BY ats.started_at DESC, ats.id DESC
        LIMIT 1
    `;

    const result = await client.query(query, [facultyId]);
    return result.rows[0] || null;
};

const getAttendanceSessionById = async (client, sessionId) => {
    const query = `
        SELECT
            ats.id,
            ats.assignment_id,
            ats.lecture_id,
            ats.faculty_id,
            ats.offering_id,
            ats.division,
            ats.status,
            ats.started_at,
            ats.ended_at,
            ats.duration_minutes,
            os.subject_code,
            s.name AS subject_name,
            os.sem_number AS semester,
            os.accadmic_year AS academic_year,
            UPPER(os.session) AS academic_session,
            b.id AS batch_id,
            NULL::VARCHAR AS batch_name,
            br.branch_code,
            br.name AS branch_name,
            asf.faculty_id,
            asf.role AS faculty_role,
            asf.total_lectures
        FROM attendance_session ats
        JOIN assigned_subject_faculty asf
            ON asf.id = ats.assignment_id
           AND asf.is_deleted = FALSE
        JOIN offered_subjects os
            ON os.id = ats.offering_id
           AND os.is_deleted = FALSE
        JOIN subject s
            ON s.subject_code = os.subject_code
           AND s.is_deleted = FALSE
        LEFT JOIN batch b
            ON b.id = os.batch_id
           AND b.is_deleted = FALSE
        LEFT JOIN branch br
            ON br.branch_code = b.branch_code
           AND br.is_deleted = FALSE
        WHERE ats.id = $1
          AND ats.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [sessionId]);
    return result.rows[0] || null;
};

const getActiveAttendanceSessionByFacultyAndAssignment = async (client, facultyId, assignmentId) => {
    const query = `
        SELECT id
        FROM attendance_session
        WHERE faculty_id = $1
          AND assignment_id = $2
          AND status = 'ACTIVE'
          AND is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [facultyId, assignmentId]);
    return result.rows[0] || null;
};

const getAnyActiveAttendanceSessionByFaculty = async (client, facultyId) => {
    const query = `
        SELECT id
        FROM attendance_session
        WHERE faculty_id = $1
          AND status = 'ACTIVE'
          AND is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [facultyId]);
    return result.rows[0] || null;
};

const getOrCreateLecturePlanForOffering = async (client, offeringId) => {
    const existing = await client.query(
        `
            SELECT id, offering_id, description, created_at
            FROM lecture_plan
            WHERE offering_id = $1
              AND is_deleted = FALSE
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `,
        [offeringId]
    );

    if (existing.rows[0]) {
        return existing.rows[0];
    }

    const created = await client.query(
        `
            INSERT INTO lecture_plan (offering_id, description, is_deleted)
            VALUES ($1, NULL, FALSE)
            RETURNING id, offering_id, description, created_at
        `,
        [offeringId]
    );

    return created.rows[0];
};

const createTakenLecture = async (client, lecturePlanId, dateOfLecture, division, facultyId, durationMinutes, status) => {
    const query = `
        INSERT INTO taken_lecture (
            lecture_plan_id,
            date_of_lecture,
            division,
            faculty_id,
            duration_minutes,
            status,
            is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        RETURNING id, lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status, created_at
    `;

    const result = await client.query(query, [lecturePlanId, dateOfLecture, division, facultyId, durationMinutes, status]);
    return result.rows[0];
};

const createAttendanceSession = async (client, payload) => {
    const query = `
        INSERT INTO attendance_session (
            assignment_id,
            lecture_id,
            faculty_id,
            offering_id,
            division,
            status,
            started_at,
            ended_at,
            duration_minutes,
            created_at,
            updated_at,
            is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, NULL, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE)
        RETURNING id, assignment_id, lecture_id, faculty_id, offering_id, division, status, started_at, ended_at, duration_minutes
    `;

    const result = await client.query(query, [
        payload.assignment_id,
        payload.lecture_id,
        payload.faculty_id,
        payload.offering_id,
        payload.division,
        payload.status,
        payload.duration_minutes
    ]);

    return result.rows[0];
};

const endAttendanceSession = async (client, sessionId) => {
    const query = `
        UPDATE attendance_session
        SET status = 'ENDED',
            ended_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND is_deleted = FALSE
        RETURNING id, lecture_id, status, started_at, ended_at, duration_minutes
    `;

    const result = await client.query(query, [sessionId]);
    return result.rows[0] || null;
};

const updateTakenLectureStatus = async (client, lectureId, status) => {
    const query = `
        UPDATE taken_lecture
        SET status = $2
        WHERE id = $1
          AND is_deleted = FALSE
        RETURNING id
    `;

    const result = await client.query(query, [lectureId, status]);
    return result.rows[0] || null;
};

module.exports = {
    insertOrUpdateAttendance,
    fetchAttendanceList,
    fetchStudentReport,
    getStudentByEnrollmentNo,
    getAttendanceSessionForStudentMarking,
    isStudentEnrolledInOffering,
    getMarkedAttendanceForLecture,
    insertStudentAttendanceMark,
    getAttendanceAssignmentById,
    getActiveAttendanceSessionForFaculty,
    getAttendanceSessionById,
    getActiveAttendanceSessionByFacultyAndAssignment,
    getAnyActiveAttendanceSessionByFaculty,
    getOrCreateLecturePlanForOffering,
    createTakenLecture,
    createAttendanceSession,
    endAttendanceSession,
    updateTakenLectureStatus
};
