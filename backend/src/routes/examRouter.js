const express = require("express");
const {
	createExam,
	createPaper,
	getPapersByExamId,
	ensurePaperForOffering,
	getPaperByOfferingAndExamMeta,
	upsertPaperCoConfigByPaperId
} = require("../controllers/examController.js");
const authenticate = require("../middleware/auth");
const isFaculty = require("../middleware/isFaculty");

const router = express.Router();

router.use(authenticate, isFaculty);

router.post("/create", createExam) 
router.post("/:exam_id/create-paper", createPaper) 
router.get("/:exam_id/papers", getPapersByExamId)
router.get("/paper/by-offering", getPaperByOfferingAndExamMeta)
router.post("/paper/ensure", ensurePaperForOffering)
router.put("/paper/:paper_id/co-config", upsertPaperCoConfigByPaperId)

module.exports = router;