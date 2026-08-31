const express = require("express");
const multer = require("multer");
const {
  createSubject,
  updateSubject,
  uploadSubjectSyllabus,
  createOfferedSubject,
  updateOfferedSubject,
  assignSubjectFaculty,
  updateAssignedSubjectFaculty,
  getOfferedSubjectsByAcademicYearSession,
  getAssignedSubjects,
  getAssignmentsForOffering,
  getEligibleFacultiesForOfferingController,
  createFacultyAssignmentRequest,
  getFacultyAssignmentRequests,
  approveFacultyAssignmentRequest,
  getMyCurrentSubjects,
  uploadStudentOfferingSubjects,
  getStudentAllSubjects,
  getDepartments
} = require("../controllers/subjectController.js");
const authenticate = require("../middleware/auth");
const isFaculty = require("../middleware/isFaculty");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate); // All routes require authentication

// Departments list - accessible to all authenticated users
router.get("/departments", getDepartments);

// Subject master
router.post("/create", isFaculty, createSubject);
router.post("/:subject_code/syllabus", isFaculty, upload.single("file"), uploadSubjectSyllabus);
router.put("/:subject_code", isFaculty, updateSubject);

// Offered subjects by semester
router.post("/offered/create", isFaculty, createOfferedSubject);
router.put("/offered/:offering_id", isFaculty, updateOfferedSubject);

// HOD assignment of subject to faculty
router.post("/assignment/create", isFaculty, assignSubjectFaculty);
router.put("/assignment/:assignment_id", isFaculty, updateAssignedSubjectFaculty);

// Query based fetch
// GET /subject/offered?accadmic_year=2024-25&session=odd
router.get("/offered", getOfferedSubjectsByAcademicYearSession);
router.get("/offered/:offering_id/assignments", getAssignmentsForOffering);
router.get("/offered/:offering_id/eligible-faculties", getEligibleFacultiesForOfferingController);
router.get("/faculty-requests", getFacultyAssignmentRequests);
router.post("/faculty-requests/:request_id/assign", isFaculty, approveFacultyAssignmentRequest);
router.post("/offered/:offering_id/faculty-requests", isFaculty, createFacultyAssignmentRequest);

//get assigned subject to a faculty
router.get("/assign-subject/:id", getAssignedSubjects);
router.get("/assign-subjected/:id", getAssignedSubjects);

// Student self endpoint: no input required
router.get("/my/current-subjects", getMyCurrentSubjects);

// Faculty bulk upload of student to offerings mapping
router.post("/student-offerings/upload", isFaculty, upload.single("file"), uploadStudentOfferingSubjects);

// Get a specific student's fully enrolled subjects overview
router.get("/student/:enrollment_no/subjects", getStudentAllSubjects);

module.exports = router;
