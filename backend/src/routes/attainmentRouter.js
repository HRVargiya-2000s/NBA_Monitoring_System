const express = require("express");
const multer = require("multer");
const {
  generateAttainmentByOffering,
  getStoredCoAttainmentByOffering,
  getCourseOutcomesByOfferingId,
  upsertCourseOutcomesForOffering,
  getProgramOutcomesGlobal,
  upsertProgramOutcomesGlobal,
  importProgramOutcomesFromDocument,
  importProgramSpecificOutcomesFromDocument,
  getProgramSpecificOutcomesByBranchCode,
  upsertProgramSpecificOutcomesByBranchCode,
  addCoPoPsoStrengthMapping,
  addCoPoPsoStrengthMappingBulk,
  updateCoPoPsoStrengthMapping,
  generateCoPoPsoAttainmentByOffering,
  getCoPoPsoStrengthByOffering,
  getCoPoPsoAttainmentByOffering,
  getDepartmentList,
  saveCoPoPsoAttainmentAverageByOffering,
  getCoPoPsoAttainmentAverageByYearBranch,
  downloadCoPoPsoAttainmentAverageExcelByYearBranch,
  downloadBatchAttainmentReportExcel,
  downloadNbaReportExcelByOffering
} = require("../controllers/attainmentController.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const authenticate = require("../middleware/auth");
const isFaculty = require("../middleware/isFaculty");

router.use(authenticate, isFaculty);

/*
POST /attainment/co/generate
Generate and persist offering-level component-wise and overall CO attainment
*/
router.post("/co/generate", generateAttainmentByOffering);

/*
GET /attainment/co/:offering_id
Fetch stored CO attainment report for an offering (no recalculation)
*/
router.get("/co/:offering_id", getStoredCoAttainmentByOffering);

/*
GET /attainment/course-outcomes/:offering_id
Fetch course outcomes for an offering
*/
router.get("/course-outcomes/:offering_id", getCourseOutcomesByOfferingId);
router.put("/course-outcomes/:offering_id", upsertCourseOutcomesForOffering);

/*
GET/PUT /attainment/program-outcomes
Fetch or save global PO1..PO11
*/
router.get("/program-outcomes", getProgramOutcomesGlobal);
router.put("/program-outcomes", upsertProgramOutcomesGlobal);
router.post("/program-outcomes/import", upload.single("file"), importProgramOutcomesFromDocument);

/*
GET/PUT /attainment/program-specific-outcomes/:branch_code
Fetch or save PSO1..PSO4 for a branch (blank descriptions are treated as no PSO)
*/
router.get("/program-specific-outcomes/:branch_code", getProgramSpecificOutcomesByBranchCode);
router.put("/program-specific-outcomes/:branch_code", upsertProgramSpecificOutcomesByBranchCode);
router.post("/program-specific-outcomes/import/:branch_code", upload.single("file"), importProgramSpecificOutcomesFromDocument);

/*
POST /attainment/co-po-pso/strength
Insert or reactivate CO-PO/PSO strength mapping for an offering
*/
router.post("/co-po-pso/strength", addCoPoPsoStrengthMapping);

/*
POST /attainment/co-po-pso/strength/bulk/:offering_id
Bulk create mappings from compact payload (co_numbers x po_ids/pso_ids)
*/
router.post("/co-po-pso/strength/bulk/:offering_id", addCoPoPsoStrengthMappingBulk);

/*
PUT /attainment/co-po-pso/strength
Update strength for an existing CO-PO/PSO mapping using composite keys
*/
router.put("/co-po-pso/strength", updateCoPoPsoStrengthMapping);

/*
POST /attainment/co-po-pso/generate
Generate and store CO-PO/PSO attainment rows from stored CO attainment
*/
router.post("/co-po-pso/generate", generateCoPoPsoAttainmentByOffering);

/*
GET /attainment/co-po-pso/strength/:offering_id
Fetch stored CO-PO/PSO strength mappings
*/
router.get("/co-po-pso/strength/:offering_id", getCoPoPsoStrengthByOffering);

/*
GET /attainment/co-po-pso/attainment/:offering_id
Fetch stored CO-PO/PSO attainment levels (no recalculation)
*/
router.get("/co-po-pso/attainment/:offering_id", getCoPoPsoAttainmentByOffering);

/*
POST /attainment/co-po-pso/average
Store offering-wise CO-PO/PSO average attainment rows
*/
router.post("/co-po-pso/average", saveCoPoPsoAttainmentAverageByOffering);

/*
GET /attainment/co-po-pso/average?accadmic_year=2024-25&branch_code=CE
Fetch all offered subjects for a branch/year with faculty and stored CO-PO/PSO average rows
*/
router.get("/co-po-pso/average", getCoPoPsoAttainmentAverageByYearBranch);

/*
GET /attainment/co-po-pso/average/download?accadmic_year=2024-25&branch_code=CE
Download branch/year PO-PSO attainment average summary in Excel
*/
router.get("/co-po-pso/average/download", downloadCoPoPsoAttainmentAverageExcelByYearBranch);

/*
GET /attainment/batch-report/download?batch_id=1&branch_code=CE
Download batch-level PO-PSO + CO average report in Excel
*/
router.get("/batch-report/download", downloadBatchAttainmentReportExcel);

/*
GET /attainment/co-po-pso/:offering_id
Fetch stored CO-PO/PSO attainment levels (no recalculation)
*/
router.get("/co-po-pso/:offering_id", getCoPoPsoAttainmentByOffering);

/*
GET /attainment/departments
Fetch department (branch) code and name list
*/
router.get("/departments", getDepartmentList);

/*
GET /attainment/nba-report/:offering_id/download
Generate and download NBA report in Excel format
*/
router.get("/nba-report/:offering_id/download", downloadNbaReportExcelByOffering);

module.exports = router;