const express = require("express");
const multer = require("multer");
const authenticate = require("../middleware/auth.js");
const {
	generateNbaContent,
	copyPreviousNbaContent,
	clearNbaCacheByOfferingId
} = require("../controllers/nbaGeneratorController.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const isFaculty = require("../middleware/isFaculty");

router.use(authenticate, isFaculty);

// POST /nba/generate
// form-data:
// - subject_name (required)
// - file (required, PDF only)
router.post("/generate", upload.single("file"), generateNbaContent);

// GET /nba/reuse/:offering_id
// Returns latest previously generated data for this offering_id.
router.get("/reuse/:offering_id", copyPreviousNbaContent);

// DELETE /nba/cache/:offering_id
// Hard-deletes only nba_generation_cache rows for this offering_id.
router.delete("/cache/:offering_id", clearNbaCacheByOfferingId);

module.exports = router;
