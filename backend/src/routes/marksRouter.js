const express = require("express");
const multer = require("multer");
const authenticate = require("../middleware/auth");
const isFaculty = require("../middleware/isFaculty");
const {
  uploadMarksInternalMidSem,
  uploadMarksExternal,
  uploadMarksViva,
  getMarksByPaper,
  getStudentMarksByExam,
  getOfferingStudentsForMarks,
  getStudentMarksByOffering
} = require("../controllers/marksController.js");

const router = express.Router();
router.use(authenticate);

// Store file in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

/*
POST /marks/upload/internal-midsem
Body:
- paper_id
- file (Excel)
For internal (20 marks) and mid_sem (30 marks) exams with direct CO values
*/
router.post("/upload/internal-midsem", isFaculty, upload.single("file"), uploadMarksInternalMidSem);

/*
POST /marks/upload/external
Body:
- paper_id
- file (Excel)
For external exams (70 marks) with grade-based marking
*/
router.post("/upload/external", isFaculty, upload.single("file"), uploadMarksExternal);

/*
POST /marks/upload/viva
Body:
- paper_id
- file (Excel)
For viva exams (30 marks) with grade-based marking
*/
router.post("/upload/viva", isFaculty, upload.single("file"), uploadMarksViva);

/*
GET /marks/paper/:paper_id
Get all marks (and CO marks) for a specific paper
*/
router.get("/paper/:paper_id", isFaculty, getMarksByPaper);

/*
GET /marks/offering/:offering_id/students
Get valid student enrollments mapped to an offering
*/
router.get("/offering/:offering_id/students", isFaculty, getOfferingStudentsForMarks);

/*
GET /marks/student/:enrollment_no/exam/:exam_id
Get marks for one student across all papers of an exam
*/
router.get("/student/:enrollment_no/exam/:exam_id", getStudentMarksByExam);

/*
GET /marks/student/:enrollment_no/offering/:offering_id
Get marks for one student across all papers of a specific offering
*/
router.get("/student/:enrollment_no/offering/:offering_id", getStudentMarksByOffering);

module.exports = router;