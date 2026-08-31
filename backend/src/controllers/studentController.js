const {
    getStudentProfileByEnrollmentNo,
    getEnrolledClassesByStudent,
    getActiveAttendanceSessionsForStudent
} = require('../models/studentModel');

const getProfile = async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const student = await getStudentProfileByEnrollmentNo(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        return res.status(200).json({
            message: "Student profile fetched successfully",
            student
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const getEnrolledClasses = async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const student = await getStudentProfileByEnrollmentNo(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const items = await getEnrolledClassesByStudent(studentId);

        return res.status(200).json({
            message: "Enrolled classes fetched successfully",
            items
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const getActiveAttendanceSessions = async (req, res) => {
    try {
        const studentId = req.user?.id;
        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const student = await getStudentProfileByEnrollmentNo(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const items = await getActiveAttendanceSessionsForStudent(studentId);

        return res.status(200).json({
            message: "Active attendance sessions fetched successfully",
            items
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    getProfile,
    getEnrolledClasses,
    getActiveAttendanceSessions
};
