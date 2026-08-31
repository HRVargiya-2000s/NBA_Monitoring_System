const express = require("express");
const multer = require("multer");
const authenticate = require("../middleware/auth.js");
const isAdmin = require("../middleware/isAdmin.js");
const { 
    createFaculty, 
    listUsers, 
    listCourses,
    listDepartments,
    getBranchCount,
    listBatchesByBranch,
    resetPassword, 
    bulkImportStudents,
    bulkImportFaculty 
} = require("../controllers/adminController.js");

const router = express.Router();

// Setup Multer for Excel file memory storage (same as marksRouter)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply authentication AND admin verification to all routes in this file
router.use(authenticate, isAdmin);

// Endpoints
router.post("/create-faculty", createFaculty);
router.get("/list", listUsers);
router.get("/courses", listCourses);
router.get("/departments", listDepartments);
router.get("/branch-count", getBranchCount);
router.get("/batches", listBatchesByBranch);
router.put("/reset-password", resetPassword);
router.put("/reset-password/:id", resetPassword);
router.post("/bulk-import", upload.single("file"), bulkImportStudents);
router.post("/bulk-import-faculty", upload.single("file"), bulkImportFaculty);

module.exports = router;