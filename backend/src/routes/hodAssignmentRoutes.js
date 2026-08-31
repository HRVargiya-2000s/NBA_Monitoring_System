const express = require("express");
const {
  getDepartmentFaculties,
  getSubjectsList,
  getFacultyDetails,
  getBatchStudents,
  getBatchesList,
  getAcademicYearsByBatch,
  getAcademicYearsForHod,
  assignSubjectByHod
} = require("../controllers/hodAssignmentController");
const authenticate = require("../middleware/auth");
const isHod = require("../middleware/isHod");

const router = express.Router();
router.use(authenticate, isHod);

// Fetch dropdown data
router.get("/department-faculties", getDepartmentFaculties);
router.get("/subjects-list", getSubjectsList);
router.get("/faculty/:faculty_id", getFacultyDetails);
router.get("/batch/:batch_id/students", getBatchStudents);
router.get("/batches-list", getBatchesList);
router.get("/academic-years-by-batch", getAcademicYearsByBatch);
router.get("/academic-years-for-hod", getAcademicYearsForHod);

// Submit assignment form
router.post("/assign", assignSubjectByHod);

module.exports = router;