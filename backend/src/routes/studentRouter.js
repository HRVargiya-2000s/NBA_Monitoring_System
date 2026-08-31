const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const isStudent = require('../middleware/isStudent');
const {
    getProfile,
    getEnrolledClasses,
    getActiveAttendanceSessions
} = require('../controllers/studentController');

router.use(authenticate, isStudent);

router.get('/profile', getProfile);
router.get('/enrolled-classes', getEnrolledClasses);
router.get('/attendance/sessions/active', getActiveAttendanceSessions);

module.exports = router;
