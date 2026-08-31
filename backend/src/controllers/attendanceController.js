const db = require('../config/db/db.js');
const {
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
    endAttendanceSession: finalizeAttendanceSession,
    updateTakenLectureStatus
} = require('../models/attendanceModel.js');

const VALID_ATTENDANCE_SESSION_DURATIONS = new Set([15, 30, 45, 60]);

const markAttendance = async (req, res) => {
    let client;
    try {
        const studentId = req.user?.id;
        const sessionId = Number.parseInt(req.body?.session_id, 10);
        const verification = req.body?.verification || {};
        const bleVerified = verification.ble_verified === true;
        const biometricVerified = verification.biometric_verified === true;

        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!sessionId || Number.isNaN(sessionId)) {
            return res.status(400).json({ error: "Valid session_id is required" });
        }

        client = await db.pool.connect();
        await client.query('BEGIN');

        const student = await getStudentByEnrollmentNo(client, studentId);
        if (!student) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Student not found" });
        }

        const session = await getAttendanceSessionForStudentMarking(client, sessionId);
        if (!session) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Attendance session not found" });
        }

        if (session.taken_lecture_is_deleted) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Lecture not found" });
        }

        if (session.status !== 'ACTIVE') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Attendance session is not active" });
        }

        if (session.is_expired) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Attendance session expired" });
        }

        const isEnrolled = await isStudentEnrolledInOffering(client, studentId, session.offering_id);
        if (!isEnrolled) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Student is not enrolled in this offering" });
        }

        if (session.division !== student.current_division) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Student is not eligible for this session" });
        }

        const existingAttendance = await getMarkedAttendanceForLecture(client, session.lecture_id, studentId);
        if (existingAttendance) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "Attendance already marked" });
        }

        const attendance = await insertStudentAttendanceMark(client, session.lecture_id, studentId);

        await client.query('COMMIT');

        return res.status(201).json({
            message: "Attendance marked successfully",
            attendance: {
                session_id: session.session_id,
                lecture_id: attendance.lecture_id,
                student_id: attendance.enrollment_no,
                status: attendance.status,
                ble_verified: bleVerified,
                biometric_verified: biometricVerified,
                marked_at: attendance.created_at
            }
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
        }
        if (error?.code === '23505') {
            return res.status(409).json({ error: "Attendance already marked" });
        }
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (client) {
            client.release();
        }
    }
};

// 1. POST /submit -> Enter attendance
const submitAttendance = async (req, res) => {
    try {
        // Expecting body: { lecture_id: 1, attendanceData: [{ enrollment_no: "123", status: "PRESENT" }, ...] }
        const { lecture_id, attendanceData } = req.body;

        if (!lecture_id || !attendanceData || !attendanceData.length) {
            return res.status(400).json({ error: "lecture_id and attendanceData are required" });
        }

        // We use a transaction because we are inserting multiple records
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Call the model function, passing the transaction client
            await insertOrUpdateAttendance(client, lecture_id, attendanceData);

            await client.query('COMMIT');
            res.status(201).json({ message: "Attendance submitted successfully" });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err; // Let the outer catch block log it and send the 500 response
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// 2. GET /list?offering_id=... -> Get attendance list for an offering
const getAttendanceList = async (req, res) => {
    try {
        const { offering_id, division, batch_id } = req.query;
        const offeringId = Number.parseInt(offering_id, 10);
        const batchId = batch_id !== undefined ? Number.parseInt(batch_id, 10) : null;

        if (!offeringId || Number.isNaN(offeringId)) {
            return res.status(400).json({ error: "Valid offering_id query parameter is required" });
        }

        if (batch_id !== undefined && (batchId === null || Number.isNaN(batchId))) {
            return res.status(400).json({ error: "Invalid batch_id" });
        }

        const rows = await fetchAttendanceList(offeringId, division, batchId);
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// 3. GET /report/:studentId -> All attendance of a student
const getStudentReport = async (req, res) => {
    try {
        const { studentId } = req.params;
        const offeringId = req.query?.offering_id ? Number.parseInt(req.query.offering_id, 10) : null;

        if (req.query?.offering_id && (!offeringId || Number.isNaN(offeringId))) {
            return res.status(400).json({ error: "Invalid offering_id" });
        }

        const rows = await fetchStudentReport(studentId, offeringId);
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const startAttendanceSession = async (req, res) => {
    const client = await db.pool.connect();
    try {
        const facultyId = Number.parseInt(req.user?.id, 10);
        const assignmentId = Number.parseInt(req.body?.assignment_id, 10);
        const durationMinutes = Number.parseInt(req.body?.duration_minutes, 10);

        if (!facultyId || Number.isNaN(facultyId)) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!assignmentId || Number.isNaN(assignmentId)) {
            return res.status(400).json({ error: "Invalid assignment_id" });
        }

        if (!VALID_ATTENDANCE_SESSION_DURATIONS.has(durationMinutes)) {
            return res.status(400).json({ error: "duration_minutes must be one of 15, 30, 45, 60" });
        }

        await client.query('BEGIN');

        const assignment = await getAttendanceAssignmentById(client, assignmentId);
        if (!assignment) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Assignment not found" });
        }

        if (Number(assignment.faculty_id) !== facultyId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Assignment does not belong to faculty" });
        }

        console.log("start-session: assignment validated");

        const existingActiveSession = await getAnyActiveAttendanceSessionByFaculty(client, facultyId);
        if (existingActiveSession) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "An active attendance session already exists" });
        }

        console.log("start-session: active session check passed");

        const lecturePlan = await getOrCreateLecturePlanForOffering(client, assignment.offering_id);
        console.log("start-session: lecture plan resolved");
        const today = new Date().toISOString().slice(0, 10);

        const lecture = await createTakenLecture(
            client,
            lecturePlan.id,
            today,
            assignment.division,
            facultyId,
            durationMinutes,
            'planned'
        );

        console.log("start-session: taken lecture created");

        await createAttendanceSession(client, {
            assignment_id: assignment.assignment_id,
            lecture_id: lecture.id,
            faculty_id: facultyId,
            offering_id: assignment.offering_id,
            division: assignment.division,
            status: 'ACTIVE',
            duration_minutes: durationMinutes
        });

        console.log("start-session: session created");

        const session = await getActiveAttendanceSessionForFaculty(client, facultyId);

        await client.query('COMMIT');

        return res.status(201).json({
            message: "Attendance session started successfully",
            session: session ? {
                id: session.id,
                assignment_id: session.assignment_id,
                lecture_id: session.lecture_id,
                offering_id: session.offering_id,
                faculty_id: session.faculty_id,
                subject_code: session.subject_code,
                subject_name: session.subject_name,
                branch_code: session.branch_code,
                branch_name: session.branch_name,
                semester: session.semester,
                division: session.division,
                academic_year: session.academic_year,
                academic_session: session.academic_session,
                status: session.status,
                started_at: session.started_at,
                duration_minutes: session.duration_minutes
            } : null
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error?.code === '23505') {
            return res.status(409).json({ error: "An active attendance session already exists" });
        }
        console.error("Start attendance session error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        client.release();
    }
};

const getActiveAttendanceSession = async (req, res) => {
    const client = await db.pool.connect();
    try {
        const facultyId = Number.parseInt(req.user?.id, 10);
        if (!facultyId || Number.isNaN(facultyId)) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const session = await getActiveAttendanceSessionForFaculty(client, facultyId);

        if (!session) {
            return res.status(200).json({
                message: "No active attendance session",
                session: null
            });
        }

        return res.status(200).json({
            message: "Active attendance session fetched successfully",
            session: {
                id: session.id,
                assignment_id: session.assignment_id,
                lecture_id: session.lecture_id,
                offering_id: session.offering_id,
                faculty_id: session.faculty_id,
                subject_code: session.subject_code,
                subject_name: session.subject_name,
                branch_code: session.branch_code,
                branch_name: session.branch_name,
                semester: session.semester,
                division: session.division,
                academic_year: session.academic_year,
                academic_session: session.academic_session,
                status: session.status,
                started_at: session.started_at,
                duration_minutes: session.duration_minutes
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        client.release();
    }
};

const endAttendanceSession = async (req, res) => {
    const client = await db.pool.connect();
    try {
        const facultyId = Number.parseInt(req.user?.id, 10);
        const sessionId = Number.parseInt(req.params?.session_id, 10);

        if (!facultyId || Number.isNaN(facultyId)) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!sessionId || Number.isNaN(sessionId)) {
            return res.status(400).json({ error: "Invalid session_id" });
        }

        await client.query('BEGIN');

        const sessionRow = await getAttendanceSessionById(client, sessionId);
        if (!sessionRow) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Session not found" });
        }

        if (Number(sessionRow.faculty_id) !== facultyId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Session does not belong to faculty" });
        }

        if (String(sessionRow.status) === 'ENDED' || String(sessionRow.status) === 'CANCELLED') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "Session is already ended or cancelled" });
        }

        const updatedSession = await finalizeAttendanceSession(client, sessionId);
        if (!updatedSession) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Session not found" });
        }

        await updateTakenLectureStatus(client, updatedSession.lecture_id, 'completed');

        await client.query('COMMIT');

        return res.status(200).json({
            message: "Attendance session ended successfully",
            session: {
                id: updatedSession.id,
                lecture_id: updatedSession.lecture_id,
                status: updatedSession.status,
                started_at: updatedSession.started_at,
                ended_at: updatedSession.ended_at,
                duration_minutes: updatedSession.duration_minutes
            }
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        client.release();
    }
};

module.exports = {
    markAttendance,
    submitAttendance,
    getAttendanceList,
    getStudentReport,
    startAttendanceSession,
    getActiveAttendanceSession,
    endAttendanceSession
};
