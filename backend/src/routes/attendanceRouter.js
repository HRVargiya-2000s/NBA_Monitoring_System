const express = require('express');
const router = express.Router();
const {markAttendance, submitAttendance, getAttendanceList, getStudentReport, startAttendanceSession, getActiveAttendanceSession, endAttendanceSession} = require('../controllers/attendanceController');
const authenticate = require('../middleware/auth');
const isFaculty = require('../middleware/isFaculty');
const isStudent = require('../middleware/isStudent');

router.use(authenticate);

// POST /attendance/mark
router.post('/mark', isStudent, markAttendance);

// POST /api/attendance/submit
router.post('/submit', isFaculty, submitAttendance);

// POST /attendance/session/start
router.post('/session/start', isFaculty, startAttendanceSession);

// GET /attendance/session/active
router.get('/session/active', isFaculty, getActiveAttendanceSession);

// POST /attendance/session/:session_id/end
router.post('/session/:session_id/end', isFaculty, endAttendanceSession);

// GET /api/attendance/list?offering_id=5&division=A&batch_id=1
router.get('/list', isFaculty, getAttendanceList);

// GET /api/attendance/report/CS2021001?offering_id=5
router.get('/report/:studentId', getStudentReport);

module.exports = router;
