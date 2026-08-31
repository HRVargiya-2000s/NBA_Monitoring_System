const xlsx = require("xlsx");
const { pool } = require("../config/db/index.js");
const {
  getPaperForMarksUpload,
  isFacultyAssignedToOffering,
  clearExistingMarksForPaper,
  getOfferingStudentEnrollments,
  insertCoMarks,
  insertBulkMarks,
  getCoWiseTotalMarksByPaper,
  getMarksByPaperId,
  getStudentMarksForExam,
  getStudentMarksForOffering,
  autoMapStudentsToOffering
} = require("../models/marksModel.js");

const canBypassAssignmentCheck = (role) => role === "ADMIN" || role === "ASSOCIATE";

const ensureOfferingAccessForUpload = async (client, req, paperDetails) => {
  if (canBypassAssignmentCheck(req.user?.role)) {
    return true;
  }

  const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10);
  if (!offeringId) {
    return false;
  }

  return isFacultyAssignedToOffering(client, req.user?.id, offeringId);
};

const TOTAL_MARKS_MAP = {
  internal: 20,
  mid_sem: 30,
  viva: 30,
  external: 70
};

const CO_COLUMNS = [1, 2, 3, 4, 5, 6];
const LEGACY_STUDENT_START_ROW_ZERO_BASED = 6;

// Grade to Marks mapping for External exams (70 marks)
const EXTERNAL_GRADE_TO_MARKS = {
  "AA": 65,
  "AB": 56,
  "BB": 49,
  "BC": 42,
  "CC": 35,
  "CD": 29,
  "DD": 28,
  "FF": 22
};


// Grade to Marks mapping for Viva exams (30 marks)
const VIVA_GRADE_TO_MARKS = {
  "AA": 28,
  "AB": 24,
  "BB": 21,
  "BC": 18,
  "CC": 15,
  "CD": 13,
  "DD": 12,
  "FF": 10
};


const normalizeCellValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsedValue = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const parseGrade = (value) => {
  return String(value ?? "").trim().toUpperCase();
};

const normalizeHeaderCell = (value) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");

const detectHeaderIndex = (rows) => {
  const index = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeaderCell(cell));
    const hasEnrollment = normalized.some((cell) => cell.includes("ENROLLMENT"));
    const hasAnyCo = normalized.some((cell) => /^CO[1-6]$/.test(cell));
    return hasEnrollment || hasAnyCo;
  });

  return index;
};

const getCoColumnIndexMap = (headerRow) => {
  const coColumnMap = {};

  if (Array.isArray(headerRow)) {
    headerRow.forEach((cell, index) => {
      const normalized = normalizeHeaderCell(cell);
      const match = normalized.match(/^CO([1-6])$/);
      if (match) {
        coColumnMap[Number.parseInt(match[1], 10)] = index;
      }
    });
  }

  for (const coNumber of CO_COLUMNS) {
    if (coColumnMap[coNumber] === undefined) {
      // Legacy fallback: CO1 starts at column D (index 3)
      coColumnMap[coNumber] = coNumber + 2;
    }
  }

  return coColumnMap;
};

const getGradeColumnIndex = (headerRow) => {
  if (!Array.isArray(headerRow)) {
    return null;
  }

  const gradeIndex = headerRow.findIndex((cell) => normalizeHeaderCell(cell).includes("GRADE"));
  return gradeIndex >= 0 ? gradeIndex : null;
};

const parseSheetLayout = (sheet) => {
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true
  });

  const headerIndex = detectHeaderIndex(rows);
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : [];
  const coColumnMap = getCoColumnIndexMap(headerRow);
  const gradeColumnIndex = getGradeColumnIndex(headerRow);
  const studentStartRowIndex = headerIndex >= 0 ? headerIndex + 1 : LEGACY_STUDENT_START_ROW_ZERO_BASED;
  const studentRows = rows.slice(studentStartRowIndex);

  return {
    studentRows,
    coColumnMap,
    gradeColumnIndex
  };
};

const extractGradeFromRow = (row, gradeMapping, gradeColumnIndex = null) => {
  // Prefer the expected grade cells first, then fallback to scanning the whole row.
  const preferredIndexes = gradeColumnIndex !== null ? [gradeColumnIndex, 3, 10] : [3, 10];

  for (const index of preferredIndexes) {
    const grade = parseGrade(row[index]);
    if (gradeMapping[grade] !== undefined) {
      return grade;
    }
  }

  for (const cellValue of row) {
    const grade = parseGrade(cellValue);
    if (gradeMapping[grade] !== undefined) {
      return grade;
    }
  }

  return "";
};

// Helper function to process direct CO marking (internal, mid_sem)
const processDirectCoMarks = async (paperId, rows, totalMarksForExam, paperDetails, coColumnMap, validEnrollmentSet) => {
  const coMarksRows = [];
  const studentRows = [];
  const createdAt = Date.now();
  const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10) || null;

  for (const row of rows) {
    const enrollmentNo = String(row[1] ?? "").trim();

    if (!enrollmentNo) {
      continue;
    }

    if (validEnrollmentSet && !validEnrollmentSet.has(enrollmentNo)) {
      continue;
    }

    let studentTotal = 0;

    for (const coNumber of CO_COLUMNS) {
      const obtainedMarks = normalizeCellValue(row[coColumnMap[coNumber]]);
      studentTotal += obtainedMarks;

      coMarksRows.push({
        paper_id: paperId,
        enrollment_no: enrollmentNo,
        co_number: coNumber,
        obtained_marks: obtainedMarks,
        offering_id: offeringId,
        created_at: createdAt
      });
    }

    studentRows.push({
      paper_id: paperId,
      enrollment_no: enrollmentNo,
      obtained_marks: studentTotal,
      total_marks: totalMarksForExam,
      offering_id: offeringId,
      created_at: createdAt
    });
  }

  return { coMarksRows, studentRows };
};

// Helper function to process grades-based marking (external, viva)
const processGradedExamMarks = async (paperId, rows, totalMarksForExam, paperDetails, gradeMapping, coWeights, gradeColumnIndex, validEnrollmentSet) => {
  const coMarksRows = [];
  const studentRows = [];
  const createdAt = Date.now();
  const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10) || null;

  for (const row of rows) {
    const enrollmentNo = String(row[1] ?? "").trim();

    if (!enrollmentNo) {
      continue;
    }

    if (validEnrollmentSet && !validEnrollmentSet.has(enrollmentNo)) {
      continue;
    }

    const grade = extractGradeFromRow(row, gradeMapping, gradeColumnIndex);
    const studentTotal = gradeMapping[grade] ?? 0;

    const weights = CO_COLUMNS.map((coNumber) => Number(coWeights[coNumber] || 0));
    const raw = weights.map((percentage) => Math.floor((studentTotal * percentage) / 100));
    const allocated = raw.reduce((acc, value) => acc + value, 0);
    const lastWeightedIndex = weights.map((weight, index) => (weight > 0 ? index : -1)).filter((index) => index >= 0).pop();
    const remainderIndex = lastWeightedIndex !== undefined ? lastWeightedIndex : raw.length - 1;
    raw[remainderIndex] = raw[remainderIndex] + (studentTotal - allocated);

    CO_COLUMNS.forEach((coNumber, index) => {
      const obtainedMarks = raw[index];

      coMarksRows.push({
        paper_id: paperId,
        enrollment_no: enrollmentNo,
        co_number: coNumber,
        obtained_marks: obtainedMarks,
        offering_id: offeringId,
        created_at: createdAt
      });
    });

    studentRows.push({
      paper_id: paperId,
      enrollment_no: enrollmentNo,
      obtained_marks: studentTotal,
      total_marks: totalMarksForExam,
      offering_id: offeringId,
      created_at: createdAt
    });
  }

  return { coMarksRows, studentRows };
};

const getConfiguredCoWeights = async (client, paperId) => {
  const rows = await getCoWiseTotalMarksByPaper(client, paperId);

  if (!rows.length) {
    return null;
  }

  const markMap = {};
  let total = 0;

  for (const row of rows) {
    const coNumber = Number.parseInt(row.co_number, 10);
    const marks = Number(row.total_marks || 0);

    if (!coNumber || coNumber < 1 || coNumber > 6 || marks < 0) {
      continue;
    }

    markMap[coNumber] = marks;
    total += marks;
  }

  if (total <= 0) {
    return null;
  }

  const configuredWeights = {};
  for (const coNumber of CO_COLUMNS) {
    const marks = Number(markMap[coNumber] || 0);
    configuredWeights[coNumber] = (marks * 100) / total;
  }

  return configuredWeights;
};

// Upload marks for internal and mid_sem exams (direct CO values)
const uploadMarksInternalMidSem = async (req, res) => {
  const client = await pool.connect();

  try {
    const { paper_id } = req.body || {};
    const paperId = Number.parseInt(paper_id, 10);

    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    if (!paperId || Number.isNaN(paperId)) {
      return res.status(400).json({ message: "Invalid paper id" });
    }

    const paperDetails = await getPaperForMarksUpload(client, paperId);
    if (!paperDetails) {
      return res.status(404).json({ message: "Paper not found" });
    }

    const hasAccess = await ensureOfferingAccessForUpload(client, req, paperDetails);
    if (!hasAccess) {
      return res.status(403).json({ message: "You can upload marks only for offerings assigned to you" });
    }

    const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10);

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { studentRows: rows, coColumnMap } = parseSheetLayout(sheet);

    // Auto-map student enrollment numbers from spreadsheet if they exist in DB
    const uploadedEnrollments = [...new Set(rows.map(row => String(row[1] ?? "").trim()).filter(Boolean))];
    if (uploadedEnrollments.length > 0) {
      await autoMapStudentsToOffering(client, offeringId, uploadedEnrollments);
    }

    const validEnrollments = await getOfferingStudentEnrollments(client, offeringId);
    const validEnrollmentSet = new Set(validEnrollments);

    // Determine exam type from paper to get total marks
    const examType = paperDetails.paper.exam_type || "internal";
    const totalMarks = TOTAL_MARKS_MAP[examType];

    const { coMarksRows, studentRows } = await processDirectCoMarks(paperId, rows, totalMarks, paperDetails, coColumnMap, validEnrollmentSet);

    if (!studentRows.length) {
      return res.status(400).json({
        message: "No valid offering students found in uploaded sheet. Ensure enrollment numbers belong to this offering."
      });
    }

    await client.query("BEGIN");
    await clearExistingMarksForPaper(client, paperId);
    await insertCoMarks(client, coMarksRows);
    await insertBulkMarks(client, studentRows);
    await client.query("COMMIT");

    res.status(200).json({
      message: "Marks uploaded and aggregated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// Upload marks for external exams (70 marks, grade-based)
const uploadMarksExternal = async (req, res) => {
  const client = await pool.connect();

  try {
    const { paper_id } = req.body || {};
    const paperId = Number.parseInt(paper_id, 10);

    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    if (!paperId || Number.isNaN(paperId)) {
      return res.status(400).json({ message: "Invalid paper id" });
    }

    const paperDetails = await getPaperForMarksUpload(client, paperId);
    if (!paperDetails) {
      return res.status(404).json({ message: "Paper not found" });
    }

    const hasAccess = await ensureOfferingAccessForUpload(client, req, paperDetails);
    if (!hasAccess) {
      return res.status(403).json({ message: "You can upload marks only for offerings assigned to you" });
    }

    const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10);

    const totalMarks = 70; // External exam marks

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { studentRows: rows, gradeColumnIndex } = parseSheetLayout(sheet);

    // Auto-map student enrollment numbers from spreadsheet if they exist in DB
    const uploadedEnrollments = [...new Set(rows.map(row => String(row[1] ?? "").trim()).filter(Boolean))];
    if (uploadedEnrollments.length > 0) {
      await autoMapStudentsToOffering(client, offeringId, uploadedEnrollments);
    }

    const validEnrollments = await getOfferingStudentEnrollments(client, offeringId);
    const validEnrollmentSet = new Set(validEnrollments);

    const coWeights = await getConfiguredCoWeights(client, paperId);
    if (!coWeights) {
      return res.status(400).json({
        message: "CO config is required for graded exams. Save Step 2 CO total marks first."
      });
    }

    const { coMarksRows, studentRows } = await processGradedExamMarks(
      paperId,
      rows,
      totalMarks,
      paperDetails,
      EXTERNAL_GRADE_TO_MARKS,
      coWeights,
      gradeColumnIndex,
      validEnrollmentSet
    );

    if (!studentRows.length) {
      return res.status(400).json({
        message: "No valid offering students found in uploaded sheet. Ensure enrollment numbers belong to this offering."
      });
    }

    await client.query("BEGIN");
    await clearExistingMarksForPaper(client, paperId);
    await insertCoMarks(client, coMarksRows);
    await insertBulkMarks(client, studentRows);
    await client.query("COMMIT");

    res.status(200).json({
      message: "External exam marks uploaded and aggregated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// Upload marks for viva exams (30 marks, grade-based)
const uploadMarksViva = async (req, res) => {
  const client = await pool.connect();

  try {
    const { paper_id } = req.body || {};
    const paperId = Number.parseInt(paper_id, 10);

    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    if (!paperId || Number.isNaN(paperId)) {
      return res.status(400).json({ message: "Invalid paper id" });
    }

    const paperDetails = await getPaperForMarksUpload(client, paperId);
    if (!paperDetails) {
      return res.status(404).json({ message: "Paper not found" });
    }

    const hasAccess = await ensureOfferingAccessForUpload(client, req, paperDetails);
    if (!hasAccess) {
      return res.status(403).json({ message: "You can upload marks only for offerings assigned to you" });
    }

    const offeringId = Number.parseInt(paperDetails?.paper?.offering_id, 10);

    const totalMarks = 30; // Viva exam marks

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { studentRows: rows, gradeColumnIndex } = parseSheetLayout(sheet);

    // Auto-map student enrollment numbers from spreadsheet if they exist in DB
    const uploadedEnrollments = [...new Set(rows.map(row => String(row[1] ?? "").trim()).filter(Boolean))];
    if (uploadedEnrollments.length > 0) {
      await autoMapStudentsToOffering(client, offeringId, uploadedEnrollments);
    }

    const validEnrollments = await getOfferingStudentEnrollments(client, offeringId);
    const validEnrollmentSet = new Set(validEnrollments);

    const coWeights = await getConfiguredCoWeights(client, paperId);
    if (!coWeights) {
      return res.status(400).json({
        message: "CO config is required for graded exams. Save Step 2 CO total marks first."
      });
    }

    const { coMarksRows, studentRows } = await processGradedExamMarks(
      paperId,
      rows,
      totalMarks,
      paperDetails,
      VIVA_GRADE_TO_MARKS,
      coWeights,
      gradeColumnIndex,
      validEnrollmentSet
    );

    if (!studentRows.length) {
      return res.status(400).json({
        message: "No valid offering students found in uploaded sheet. Ensure enrollment numbers belong to this offering."
      });
    }

    await client.query("BEGIN");
    await clearExistingMarksForPaper(client, paperId);
    await insertCoMarks(client, coMarksRows);
    await insertBulkMarks(client, studentRows);
    await client.query("COMMIT");

    res.status(200).json({
      message: "Viva exam marks uploaded and aggregated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// Get all marks (and CO marks) for a specific paper
const getMarksByPaper = async (req, res) => {
  const client = await pool.connect();

  try {
    const { paper_id } = req.params;
    const paperId = Number.parseInt(paper_id, 10);

    if (!paperId || Number.isNaN(paperId)) {
      return res.status(400).json({ message: "Invalid paper id" });
    }

    const rows = await getMarksByPaperId(client, paperId);

    if (!rows.length) {
      return res.status(404).json({ message: "No marks found for this paper" });
    }

    // Group by enrollment number to structure response
    const marksMap = {};
    rows.forEach((row) => {
      if (!marksMap[row.enrollment_no]) {
        marksMap[row.enrollment_no] = {
          enrollment_no: row.enrollment_no,
          paper_id: row.paper_id,
          obtained_marks: row.obtained_marks,
          total_marks: row.total_marks,
          created_at: row.created_at,
          co_marks: []
        };
      }

      if (row.co_number) {
        marksMap[row.enrollment_no].co_marks.push({
          co_number: row.co_number,
          obtained_marks: row.co_obtained_marks
        });
      }
    });

    const result = Object.values(marksMap);

    res.status(200).json({
      message: "Marks retrieved successfully",
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// Get marks for one student across all papers of an exam
const getStudentMarksByExam = async (req, res) => {
  const client = await pool.connect();

  try {
    const { enrollment_no, exam_id } = req.params;
    const examId = Number.parseInt(exam_id, 10);

    if (!enrollment_no || enrollment_no.trim() === "") {
      return res.status(400).json({ message: "Invalid enrollment number" });
    }

    if (!examId || Number.isNaN(examId)) {
      return res.status(400).json({ message: "Invalid exam id" });
    }

    const rows = await getStudentMarksForExam(client, enrollment_no, examId);

    if (!rows.length) {
      return res.status(404).json({ message: "No marks found for this student and exam" });
    }

    // Group by paper to structure response
    const papersMap = {};
    rows.forEach((row) => {
      if (!papersMap[row.paper_id]) {
        papersMap[row.paper_id] = {
          paper_id: row.paper_id,
          exam_id: row.exam_id,
          enrollment_no: row.enrollment_no,
          obtained_marks: row.obtained_marks,
          total_marks: row.total_marks,
          created_at: row.created_at,
          co_marks: []
        };
      }

      if (row.co_number) {
        papersMap[row.paper_id].co_marks.push({
          co_number: row.co_number,
          obtained_marks: row.co_obtained_marks
        });
      }
    });

    const result = {
      enrollment_no: enrollment_no,
      exam_id: examId,
      papers: Object.values(papersMap)
    };

    res.status(200).json({
      message: "Student marks retrieved successfully",
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getOfferingStudentsForMarks = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    if (!canBypassAssignmentCheck(req.user?.role)) {
      const hasAccess = await isFacultyAssignedToOffering(client, req.user?.id, offeringId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You can access students only for offerings assigned to you" });
      }
    }

    const enrollments = await getOfferingStudentEnrollments(client, offeringId);
    return res.status(200).json({ offering_id: offeringId, enrollments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getStudentMarksByOffering = async (req, res) => {
  const { enrollment_no, offering_id } = req.params;

  if (!enrollment_no || !offering_id) {
    return res.status(400).json({ message: "Missing enrollment_no or offering_id" });
  }

  const offeringId = Number.parseInt(offering_id, 10);
  if (Number.isNaN(offeringId)) {
    return res.status(400).json({ message: "Invalid offering_id" });
  }

  try {
    const rows = await getStudentMarksForOffering(pool, enrollment_no, offeringId);

    if (!rows.length) {
      return res.status(404).json({ message: "No marks found for this student and offering" });
    }

    // Group by paper to structure the response like existing exam marks format
    const papersMap = {};
    rows.forEach((row) => {
      if (!papersMap[row.paper_id]) {
        papersMap[row.paper_id] = {
          paper_id: row.paper_id,
          exam_id: row.exam_id,
          exam_name: row.exam_name || row.exam_type,
          exam_type: row.exam_type,
          enrollment_no: row.enrollment_no,
          offering_id: row.offering_id,
          obtained_marks: row.obtained_marks,
          total_marks: row.total_marks,
          created_at: row.created_at,
          co_marks: []
        };
      }

      if (row.co_number !== null) {
        papersMap[row.paper_id].co_marks.push({
          co_number: row.co_number,
          obtained_marks: row.co_obtained_marks
        });
      }
    });

    res.status(200).json(Object.values(papersMap));
  } catch (error) {
    console.error("Error fetching student marks by offering:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  uploadMarksInternalMidSem,
  uploadMarksExternal,
  uploadMarksViva,
  getMarksByPaper,
  getStudentMarksByExam,
  getOfferingStudentsForMarks,
  getStudentMarksByOffering
};