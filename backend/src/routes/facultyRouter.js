const express = require("express");
const { getAssignedClasses } = require("../controllers/facultyController");
const authenticate = require("../middleware/auth");
const isFaculty = require("../middleware/isFaculty");

const router = express.Router();

router.use(authenticate, isFaculty);

router.get("/assigned-classes", getAssignedClasses);

module.exports = router;
