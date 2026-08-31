const express = require('express');
const {
	createNewLecturePlan,
	updateLecturePlanById,
	deleteLecturePlanById,
	getLecturePlansForOffering,
	createNewLecture,
	getLecturesForFaculty
} = require('../controllers/lectureController.js');
const authenticate = require('../middleware/auth.js');
const isFaculty = require('../middleware/isFaculty.js');

const router = express.Router();

router.use(authenticate);

router.post('/plan/create', isFaculty, createNewLecturePlan);
router.put('/plan/:lecture_plan_id', isFaculty, updateLecturePlanById);
router.delete('/plan/:lecture_plan_id', isFaculty, deleteLecturePlanById);
router.get('/plan/offering/:offering_id', getLecturePlansForOffering);

router.post('/create', isFaculty, createNewLecture);
router.get('/faculty/:faculty_id', isFaculty, getLecturesForFaculty);
module.exports = router;