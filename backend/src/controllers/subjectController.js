const { pool } = require("../config/db/index.js");
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");
const pdfParse = require("pdf-parse");
const {
  createSubjectRow,
  updateSubjectRow,
  updateSubjectSyllabusRow,
  syncSubjectTeachingBranches,
  getEligibleFacultiesForOffering,
  isFacultyEligibleForOffering,
  normalizeBranchCode,
  getFacultyAssignmentRequestsForHod,
  createFacultyAssignmentRequestRow,
  getFacultyAssignmentRequestById,
  approveFacultyAssignmentRequestRow,
  createOfferedSubjectRow,
  mapBatchStudentsToOffering,
  updateOfferedSubjectRow,
  createAssignedSubjectFacultyRow,
  updateAssignedSubjectFacultyRow,
  getFacultyBranchCodeById,
  getOfferedSubjectsByYearSession,
  getFacultyAssignedSubjects,
  getAcademicYearVariants,
  getAssignmentsByOfferingId,
  getOfferingCoordinatorIdByOfferingId,
  getStudentBatchMap,
  getOfferingsByYearSessionAndSubjects,
  bulkSyncStudentOfferingSubjects,
  getCurrentSubjectsForStudent,
  getAllSubjectsForStudent
} = require("../models/subjectModel.js");
const {
  upsertCourseOutcomesByOffering
} = require("../models/attainmentModel.js");

const toInt = (value) => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getRequestUserBranchCode = async (client, userId) => {
  const branchCode = await getFacultyBranchCodeById(client, userId);
  const normalized = normalizeBranchCode(branchCode);
  return normalized && normalized.length ? normalized : null;
};

const getBranchOptionsFromFacultyRows = (rows, excludeBranchCode = null) => {
  const seen = new Set();
  const options = [];

  for (const row of rows) {
    const branchCode = normalizeBranchCode(row.branch_code);
    if (!branchCode || branchCode === excludeBranchCode || seen.has(branchCode)) continue;
    seen.add(branchCode);
    options.push({
      branch_code: branchCode,
      branch_name: row.branch_name || branchCode,
    });
  }

  return options;
};

const createSubject = async (req, res) => {
  const client = await pool.connect();

  try {
    const { subject_code, name, syllabus_url, teaching_branch_codes, session } = req.body || {};

    if (!subject_code || !name) {
      return res.status(400).json({ message: "subject_code and name are required" });
    }

    await client.query("BEGIN");

    const row = await createSubjectRow(client, {
      subject_code: String(subject_code).trim(),
      name: String(name).trim(),
      syllabus_url,
      session: session ? String(session).trim().toUpperCase() : null
    });

    let branchCodesToSync = teaching_branch_codes;
    const creatorRole = String(req.user?.role || '').trim().toUpperCase();

    if (!Array.isArray(branchCodesToSync) || branchCodesToSync.length === 0) {
      const creatorBranchCode = await getRequestUserBranchCode(client, req.user?.id);

      if (creatorBranchCode) {
        branchCodesToSync = [creatorBranchCode];
        console.log(`[createSubject] Auto-populated teaching branch from creator: ${creatorBranchCode}`);
      } else {
        await client.query("ROLLBACK").catch(() => {});
        return res.status(400).json({
          message: "Unable to resolve creator branch. Please ensure admin/HOD profile has a valid branch_code."
        });
      }
    }

    if (Array.isArray(branchCodesToSync) && branchCodesToSync.length > 0) {
      row.teaching_branch_codes = await syncSubjectTeachingBranches(client, row.subject_code, branchCodesToSync);
    }

    await client.query("COMMIT");

    return res.status(201).json({ message: "Subject created successfully", subject: row });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Subject already exists"
      });
    }
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateSubject = async (req, res) => {
  const client = await pool.connect();

  try {
    const { subject_code } = req.params;
    const { name, syllabus_url, teaching_branch_codes, session } = req.body || {};

    if (!subject_code) {
      return res.status(400).json({ message: "subject_code path param is required" });
    }

    if (!name && !syllabus_url && !Array.isArray(teaching_branch_codes) && !session) {
      return res.status(400).json({ message: "At least one of name, syllabus_url, session, or teaching_branch_codes is required" });
    }

    await client.query("BEGIN");

    const row = await updateSubjectRow(client, subject_code, {
      name: name ? String(name).trim() : null,
      syllabus_url,
      session: session ? String(session).trim().toUpperCase() : null
    });

    if (!row) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Subject not found" });
    }

    if (Array.isArray(teaching_branch_codes)) {
      // If teaching_branch_codes is empty, use all active branches
      let branchCodesToSync = teaching_branch_codes;
      if (branchCodesToSync.length === 0) {
        const allBranchesResult = await client.query(
          `SELECT branch_code FROM branch WHERE is_deleted = FALSE
           ORDER BY CASE WHEN branch_code ~ '^[0-9]+$' THEN 0 ELSE 1 END, branch_code`
        );
        branchCodesToSync = allBranchesResult.rows.map(r => r.branch_code);
        console.log(`[updateSubject] Auto-populated teaching branches: ${branchCodesToSync.join(', ')}`);
      }
      row.teaching_branch_codes = await syncSubjectTeachingBranches(client, row.subject_code, branchCodesToSync);
    }

    await client.query("COMMIT");

    return res.status(200).json({ message: "Subject updated successfully", subject: row });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const extractPdfText = async (file) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  const fileName = String(file?.originalname || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");

  if (!file?.buffer) {
    return { text: "", error: "Syllabus PDF file is required" };
  }

  if (!isPdf) {
    return { text: "", error: "Only PDF syllabus files are supported" };
  }

  try {
    const parsed = await pdfParse(file.buffer);

    const text = String(parsed?.text || "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return { text: "", error: "Could not extract readable text from PDF" };
    }

    return { text, error: "" };
  } catch {
    return { text: "", error: "Failed to parse PDF. Please upload a valid text-based PDF file." };
  }
};

const normalizeCoDescription = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,\-–—]+/, "")
    .replace(/\s+[|•]+\s*$/g, "")
    .trim();

const extractCourseOutcomesFromText = (syllabusText) => {
  const text = String(syllabusText || "").replace(/\r/g, "\n");
  const compactText = text
    .replace(/\n(?=\s*(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*[1-6]\b)/gi, "\n")
    .replace(/[ \t]+/g, " ");
  const coPattern = /(?:^|\n|\b)(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*([1-6])\s*(?:[:.)\-–—]\s*|\s+)([\s\S]*?)(?=(?:\n|\b)(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*[1-6]\s*(?:[:.)\-–—]|\s+)|\n\s*(?:PO|PSO|Program\s+Outcome|List\s+of\s+Experiments|Reference|Text\s+Books?|Suggested\s+Specification|Teaching\s+Scheme)\b|$)/gi;
  const extracted = new Map();

  let match = coPattern.exec(compactText);
  while (match) {
    const coNumber = Number.parseInt(match[1], 10);
    const description = normalizeCoDescription(match[2]);
    if (coNumber >= 1 && coNumber <= 6 && description && !extracted.has(coNumber)) {
      extracted.set(coNumber, description);
    }
    match = coPattern.exec(compactText);
  }

  return Array.from({ length: 6 }, (_, index) => {
    const coNumber = index + 1;
    return {
      co_number: coNumber,
      co_description: extracted.get(coNumber) || ""
    };
  });
};

const makeEmptyCourseOutcomeRows = () =>
  Array.from({ length: 6 }, (_, index) => ({
    co_number: index + 1,
    co_description: ""
  }));

const cleanCourseOutcomeDescription = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,\-\u2013\u2014]+/, "")
    .replace(/\s+[|*\u2022]+\s*$/g, "")
    .trim();

const addExtractedCourseOutcome = (map, coNumber, description) => {
  const parsedCoNumber = Number.parseInt(coNumber, 10);
  const cleanDescription = cleanCourseOutcomeDescription(description);
  if (parsedCoNumber >= 1 && parsedCoNumber <= 6 && cleanDescription && !map.has(parsedCoNumber)) {
    map.set(parsedCoNumber, cleanDescription);
  }
};

const getCourseOutcomeSection = (text) => {
  const normalized = String(text || "").replace(/\r/g, "\n");
  const startMatch = normalized.match(/(?:course\s+outcomes?|student\s+outcomes?|learning\s+outcomes?)\s*:?\s*/i);
  if (!startMatch || startMatch.index == null) {
    return "";
  }

  const afterStart = normalized.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterStart.match(/\n\s*(?:program\s+outcomes?|po\s+mapping|pso|list\s+of\s+experiments|practical|reference|text\s+books?|suggested\s+specification|teaching\s+scheme|content\s*:|unit\s+\d+)\b/i);
  return endMatch && endMatch.index != null ? afterStart.slice(0, endMatch.index) : afterStart;
};

const robustExtractCourseOutcomesFromText = (syllabusText) => {
  const text = String(syllabusText || "").replace(/\r/g, "\n");
  const extracted = new Map();
  const compactText = text
    .replace(/\n(?=\s*(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*[1-6]\b)/gi, "\n")
    .replace(/[ \t]+/g, " ");
  const coPattern = /(?:^|\n|\b)(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*([1-6])\s*(?:[:.)\-\u2013\u2014]\s*|\s+)([\s\S]*?)(?=(?:\n|\b)(?:CO|C\.O\.|Course\s+Outcome)\s*[-:]?\s*[1-6]\s*(?:[:.)\-\u2013\u2014]|\s+)|\n\s*(?:PO|PSO|Program\s+Outcome|List\s+of\s+Experiments|Reference|Text\s+Books?|Suggested\s+Specification|Teaching\s+Scheme)\b|$)/gi;

  let match = coPattern.exec(compactText);
  while (match) {
    addExtractedCourseOutcome(extracted, match[1], match[2]);
    match = coPattern.exec(compactText);
  }

  const section = getCourseOutcomeSection(text)
    .replace(/\n(?=\s*(?:[1-6]|CO\s*[-:]?\s*[1-6])\s*[:.)\-\u2013\u2014]?\s+)/gi, "\n")
    .replace(/[ \t]+/g, " ");

  if (section) {
    const numberedPattern = /(?:^|\n)\s*(?:CO\s*[-:]?\s*)?([1-6])\s*(?:[:.)\-\u2013\u2014]\s*|\s+)([\s\S]*?)(?=\n\s*(?:CO\s*[-:]?\s*)?[1-6]\s*(?:[:.)\-\u2013\u2014]|\s+)|$)/gi;
    let numberedMatch = numberedPattern.exec(section);
    while (numberedMatch) {
      addExtractedCourseOutcome(extracted, numberedMatch[1], numberedMatch[2]);
      numberedMatch = numberedPattern.exec(section);
    }
  }

  return makeEmptyCourseOutcomeRows().map((row) => ({
    ...row,
    co_description: extracted.get(row.co_number) || ""
  }));
};

const uploadSubjectSyllabus = async (req, res) => {
  const client = await pool.connect();

  try {
    const subjectCode = normalizeCode(req.params?.subject_code || req.body?.subject_code);
    if (!subjectCode) {
      return res.status(400).json({ message: "subject_code is required" });
    }

    const parsed = await extractPdfText(req.file);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const offeringId = toInt(req.body?.offering_id);
    const fileName = normalizeCode(req.file.originalname) || `${subjectCode}_syllabus.pdf`;

    await client.query("BEGIN");

    const row = await updateSubjectSyllabusRow(client, subjectCode, {
      syllabus_url: `uploaded:${fileName}`,
      syllabus_file_name: fileName,
      syllabus_text: parsed.text
    });

    if (!row) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Subject not found" });
    }

    let courseOutcomeRows = [];
    let extractedRows = makeEmptyCourseOutcomeRows();
    let extractedCourseOutcomeCount = 0;

    if (offeringId) {
      const offeringResult = await client.query(
        `
          SELECT id
          FROM offered_subjects
          WHERE id = $1
            AND subject_code = $2
            AND is_deleted = FALSE
          LIMIT 1
        `,
        [offeringId, subjectCode]
      );

      if (!offeringResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "offering_id does not match this subject" });
      }

      extractedRows = robustExtractCourseOutcomesFromText(parsed.text);
      extractedCourseOutcomeCount = extractedRows.filter((co) => co.co_description).length;

      if (extractedCourseOutcomeCount > 0) {
        courseOutcomeRows = await upsertCourseOutcomesByOffering(client, offeringId, extractedRows);
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: extractedCourseOutcomeCount > 0
        ? `Syllabus uploaded successfully. ${extractedCourseOutcomeCount} course outcome(s) updated.`
        : "Syllabus uploaded successfully",
      subject: row,
      course_outcomes: courseOutcomeRows,
      extracted_course_outcomes: extractedRows,
      extracted_course_outcomes_count: extractedCourseOutcomeCount
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const createOfferedSubject = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      sem_number,
      faculty_corrdinator_id,
      accadmic_year,
      session,
      subject_code,
      batch_id,
      number_of_lectures,
      include_pso
    } = req.body || {};

    const payload = {
      sem_number: toInt(sem_number),
      faculty_corrdinator_id: req.user?.role === "HOD" ? toInt(req.user.id) : toInt(faculty_corrdinator_id),
      accadmic_year: accadmic_year ? String(accadmic_year).trim() : null,
      session: session ? String(session).trim() : null,
      subject_code: subject_code ? String(subject_code).trim() : null,
      batch_id: batch_id ? toInt(batch_id) : null,
      number_of_lectures: toInt(number_of_lectures),
      include_pso: typeof include_pso === "boolean" ? include_pso : null
    };

    if (!payload.sem_number || !payload.faculty_corrdinator_id || !payload.accadmic_year || !payload.session || !payload.subject_code) {
      return res.status(400).json({
        message: "sem_number, faculty_corrdinator_id, accadmic_year, session, and subject_code are required. batch_id is optional."
      });
    }

    const row = await createOfferedSubjectRow(client, payload);
    const mappedStudents = payload.batch_id
      ? await mapBatchStudentsToOffering(client, row.offering_id, payload.batch_id)
      : 0;

    return res.status(201).json({
      message: "Offered subject created successfully",
      offered_subject: row,
      mapped_students: mappedStudents
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateOfferedSubject = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = toInt(req.params?.offering_id);
    if (!offeringId) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const {
      sem_number,
      faculty_corrdinator_id,
      accadmic_year,
      session,
      subject_code,
      batch_id,
      number_of_lectures,
      include_pso
    } = req.body || {};

    const payload = {
      sem_number: toInt(sem_number),
      faculty_corrdinator_id: toInt(faculty_corrdinator_id),
      accadmic_year: accadmic_year ? String(accadmic_year).trim() : null,
      session: session ? String(session).trim() : null,
      subject_code: subject_code ? String(subject_code).trim() : null,
      batch_id: batch_id ? toInt(batch_id) : null,
      number_of_lectures: toInt(number_of_lectures),
      include_pso: typeof include_pso === "boolean" ? include_pso : null
    };

    const hasAnyField = Object.values(payload).some((value) => value !== null);
    if (!hasAnyField) {
      return res.status(400).json({ message: "At least one updatable field is required" });
    }

    const row = await updateOfferedSubjectRow(client, offeringId, payload);
    if (!row) {
      return res.status(404).json({ message: "Offered subject not found" });
    }

    return res.status(200).json({ message: "Offered subject updated successfully", offered_subject: row });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const assignSubjectFaculty = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id, faculty_id, role, division, total_lectures } = req.body || {};

    const payload = {
      offering_id: toInt(offering_id),
      faculty_id: toInt(faculty_id),
      role: role ? String(role).trim() : null,
      division: division ? String(division).trim() : null,
      total_lectures: toInt(total_lectures)
    };

    if (!payload.offering_id || !payload.faculty_id || !payload.role || !payload.division) {
      return res.status(400).json({ message: "offering_id, faculty_id, role, division are required" });
    }

    if (req.user?.role === "HOD") {
      const coordinatorId = await getOfferingCoordinatorIdByOfferingId(client, payload.offering_id);

      if (!coordinatorId) {
        return res.status(404).json({ message: "Offering not found" });
      }

      if (Number(coordinatorId) !== Number(req.user.id)) {
        return res.status(403).json({
          message: "HOD can assign faculty only for offerings created by them",
        });
      }

      const hodBranchCode = await getRequestUserBranchCode(client, req.user.id);
      const facultyBranchCode = normalizeBranchCode(await getFacultyBranchCodeById(client, payload.faculty_id));
      if (facultyBranchCode !== hodBranchCode) {
        return res.status(403).json({
          message: "Use the department request flow for faculty outside your department",
        });
      }
    }

    const isEligibleFaculty = await isFacultyEligibleForOffering(client, payload.offering_id, payload.faculty_id);
    if (!isEligibleFaculty) {
      return res.status(403).json({
        message: "Selected faculty is not eligible for this subject. Configure the subject teaching departments first.",
      });
    }

    const row = await createAssignedSubjectFacultyRow(client, payload);
    return res.status(201).json({ message: "Subject assigned to faculty successfully", assignment: row });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateAssignedSubjectFaculty = async (req, res) => {
  const client = await pool.connect();

  try {
    const assignmentId = toInt(req.params?.assignment_id);
    if (!assignmentId) {
      return res.status(400).json({ message: "Invalid assignment_id" });
    }

    const { offering_id, faculty_id, role, division, total_lectures } = req.body || {};

    const payload = {
      offering_id: toInt(offering_id),
      faculty_id: toInt(faculty_id),
      role: role ? String(role).trim() : null,
      division: division ? String(division).trim() : null,
      total_lectures: toInt(total_lectures)
    };

    const hasAnyField = Object.values(payload).some((value) => value !== null);
    if (!hasAnyField) {
      return res.status(400).json({ message: "At least one updatable field is required" });
    }

    const row = await updateAssignedSubjectFacultyRow(client, assignmentId, payload);
    if (!row) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    return res.status(200).json({ message: "Assigned subject faculty updated successfully", assignment: row });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getOfferedSubjectsByAcademicYearSession = async (req, res) => {
  const client = await pool.connect();

  try {
    const { accadmic_year, session } = req.query || {};

    if (!accadmic_year || !session) {
      return res.status(400).json({ message: "accadmic_year and session are required query params" });
    }

    const acadYearVariants = getAcademicYearVariants(accadmic_year);
    console.log(`[getOfferedSubjectsByAcademicYearSession] acadYearVariants for ${accadmic_year}:`, acadYearVariants);

    let branchCode = null;
    if (req.user?.role === "HOD") {
      // normalizeBranchCode returns empty string for missing values; convert falsy to null
      const b = normalizeBranchCode(await getFacultyBranchCodeById(client, req.user.id));
      branchCode = b && b.length ? b : null;
    }

    // Get offerings where this HOD is coordinator or from their branch
    const ownOfferings = await getOfferedSubjectsByYearSession(client, String(accadmic_year).trim(), String(session).trim(), {
      branchCode,
      coordinatorId: req.user?.id || null,
    });
    
    console.log(`[getOfferedSubjects] User ${req.user?.id} (HOD=${req.user?.role === 'HOD'}, branch=${branchCode}): Found ${ownOfferings.length} own offerings`);

    // If HOD, also get offerings from multi-disciplinary requests sent to this HOD's department
    let multiDisciplinaryOfferings = [];
    if (req.user?.role === "HOD" && branchCode) {
      const multiResult = await client.query(
        `
        SELECT DISTINCT
          o.id AS offering_id,
          o.accadmic_year,
          o.session,
          o.sem_number,
          o.subject_code,
          o.batch_id,
          o.include_pso,
          s.name AS subject_name,
          COALESCE(b.branch_code, fc.branch_code) AS branch_code,
          o.faculty_corrdinator_id,
          fc.name AS faculty_coordinator_name,
          fc.branch_code AS faculty_coordinator_branch_code,
          o.number_of_lectures,
          NULL AS assignment_id,
          NULL AS assigned_faculty_id,
          NULL AS assigned_faculty_name,
          NULL AS role,
          NULL AS division,
          NULL AS total_lectures
        FROM offered_subjects o
        JOIN subject s ON s.subject_code = o.subject_code
        LEFT JOIN batch b ON b.id = o.batch_id AND b.is_deleted = FALSE
        LEFT JOIN faculty fc ON fc.id = o.faculty_corrdinator_id
        JOIN faculty_assignment_request far ON far.offering_id = o.id
        WHERE o.accadmic_year = ANY($1::VARCHAR[])
          AND LOWER(o.session) = LOWER($2)
          AND o.is_deleted = FALSE
          AND s.is_deleted = FALSE
          AND o.subject_type = 'MULTIDISCIPLINARY'
          AND far.target_branch_code = $3
          AND far.status = 'PENDING'
        ORDER BY o.sem_number, o.subject_code
        `,
        [acadYearVariants, String(session).trim(), branchCode]
      );
      multiDisciplinaryOfferings = multiResult.rows;
      console.log(`[getOfferedSubjects] Found ${multiDisciplinaryOfferings.length} multi-disciplinary offerings with pending requests for ${branchCode}`);
    }

    // Merge and deduplicate offerings
    const allOfferings = [...ownOfferings, ...multiDisciplinaryOfferings];
    const uniqueOfferings = [];
    const seenIds = new Set();
    
    for (const offering of allOfferings) {
      const id = Number(offering.offering_id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueOfferings.push(offering);
      }
    }

    console.log(`[getOfferedSubjects] User ${req.user?.id} (${branchCode}) has ${ownOfferings.length} own offerings + ${multiDisciplinaryOfferings.length} multi-disciplinary offerings = ${uniqueOfferings.length} total`);

    return res.status(200).json({
      message: "Offered subjects fetched successfully",
      accadmic_year,
      session,
      branch_code: branchCode,
      items: uniqueOfferings
    });
  } catch (error) {
    console.error("[getOfferedSubjectsByAcademicYearSession] Error:", error.message, error.stack);
    return res.status(500).json({ 
      message: "Server error", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  } finally {
    client.release();
  }
};

const getEligibleFacultiesForOfferingController = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = toInt(req.query?.offering_id || req.params?.offering_id);

    if (!offeringId) {
      return res.status(400).json({ message: "offering_id is required" });
    }

    if (req.user?.role === "HOD") {
      const coordinatorId = await getOfferingCoordinatorIdByOfferingId(client, offeringId);

      if (!coordinatorId) {
        return res.status(404).json({ message: "Offering not found" });
      }

      const hodBranchCode = await getRequestUserBranchCode(client, req.user.id);
      const coordinatorBranchCode = await getRequestUserBranchCode(client, coordinatorId);
      
      // Check if HOD is coordinator OR if this is a multi-disciplinary offering with pending request for this HOD's branch
      const isCoordinator = Number(coordinatorId) === Number(req.user.id);
      let isMultiDisciplinaryRequestTarget = false;
      
      if (!isCoordinator && hodBranchCode) {
        const requestCheck = await client.query(
          `SELECT 1 FROM faculty_assignment_request far
           WHERE far.offering_id = $1 
           AND far.target_branch_code = $2 
           AND far.status IN ('PENDING', 'APPROVED')
           LIMIT 1`,
          [offeringId, hodBranchCode]
        );
        isMultiDisciplinaryRequestTarget = requestCheck.rows.length > 0;
      }

      if (!isCoordinator && !isMultiDisciplinaryRequestTarget) {
        return res.status(403).json({ message: "You don't have permission to assign faculty for this offering" });
      }

      const rows = await getEligibleFacultiesForOffering(client, offeringId);
      // If HOD has no branch code, don't filter; show all eligible faculties
      const ownItems = hodBranchCode ? rows.filter((row) => normalizeBranchCode(row.branch_code) === hodBranchCode) : rows;

      console.log(`[getEligibleFaculties] Offering ${offeringId}: isCoordinator=${isCoordinator}, isMultiDisciplinaryTarget=${isMultiDisciplinaryRequestTarget}, hodBranch=${hodBranchCode}, returning ${ownItems.length} faculty`);

      return res.status(200).json({
        message: "Eligible faculties fetched successfully",
        offering_id: offeringId,
        items: ownItems,
        request_targets: getBranchOptionsFromFacultyRows(rows, hodBranchCode),
        has_subject_mapping: rows.some((row) => row.has_subject_mapping),
      });
    }

    const rows = await getEligibleFacultiesForOffering(client, offeringId);

    return res.status(200).json({
      message: "Eligible faculties fetched successfully",
      offering_id: offeringId,
      items: rows,
      request_targets: [],
      has_subject_mapping: rows.some((row) => row.has_subject_mapping),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const createFacultyAssignmentRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = toInt(req.params?.offering_id || req.body?.offering_id);
    const { target_branch_code, role, division, total_lectures, note, subject_type } = req.body || {};

    const payload = {
      offering_id: offeringId,
      requesting_hod_id: toInt(req.user?.id),
      target_branch_code: normalizeBranchCode(target_branch_code),
      role: role ? String(role).trim().toLowerCase() : null,
      division: division ? String(division).trim() : null,
      total_lectures: toInt(total_lectures),
      note: note ? String(note).trim() : null,
      subject_type: subject_type ? String(subject_type).trim() : "DISCIPLINARY"
    };

    console.log(`[Faculty Request] Received request to ${payload.target_branch_code} (type: ${payload.subject_type})`);

    if (!payload.offering_id || !payload.target_branch_code || !payload.role || !payload.division) {
      return res.status(400).json({ message: "offering_id, target_branch_code, role, and division are required" });
    }

    const coordinatorId = await getOfferingCoordinatorIdByOfferingId(client, payload.offering_id);
    if (!coordinatorId) {
      return res.status(404).json({ message: "Offering not found" });
    }

    const userBranchCode = await getRequestUserBranchCode(client, req.user.id);
    const coordinatorBranchCode = await getRequestUserBranchCode(client, coordinatorId);

    // For disciplinary: user must be offering coordinator
    // For multi-disciplinary: user must be offering coordinator OR HOD of offering's branch
    const isCoordinator = Number(coordinatorId) === Number(req.user.id);
    const isOfferingDepartmentHod = userBranchCode === coordinatorBranchCode;
    
    const isAuthorized = payload.subject_type === "MULTIDISCIPLINARY" 
      ? (isCoordinator || isOfferingDepartmentHod)
      : isCoordinator;

    if (!isAuthorized) {
      const msg = payload.subject_type === "MULTIDISCIPLINARY"
        ? "Only offering coordinators or HODs of the offering department can send multi-disciplinary requests"
        : "Only offering coordinators can send disciplinary requests";
      console.log(`[Faculty Request] Authorization failed: isCoordinator=${isCoordinator}, isOfferingDepartmentHod=${isOfferingDepartmentHod}, type=${payload.subject_type}`);
      return res.status(403).json({ message: msg });
    }

    // For disciplinary, restrict target to external departments
    if (payload.subject_type === "DISCIPLINARY" && payload.target_branch_code === userBranchCode) {
      return res.status(400).json({ message: "Use direct assignment for your own department faculty" });
    }

    const eligibleRows = await getEligibleFacultiesForOffering(client, payload.offering_id);
    const targetAllowed = eligibleRows.some((row) => normalizeBranchCode(row.branch_code) === payload.target_branch_code);
    
    console.log(`[Faculty Request] Eligible branches: ${eligibleRows.map(r => r.branch_code).join(', ')}, Target: ${payload.target_branch_code}, Allowed: ${targetAllowed}, Type: ${payload.subject_type}`);
    
    // For DISCIPLINARY, restrict to departments configured to teach the subject.
    // For MULTIDISCIPLINARY, allow sending to any selected department.
    if (payload.subject_type === "DISCIPLINARY" && !targetAllowed) {
      return res.status(403).json({ message: "Selected department is not configured to teach this subject" });
    }

    const row = await createFacultyAssignmentRequestRow(client, payload);
    console.log(`[Faculty Request] Successfully created request to ${payload.target_branch_code}`);
    return res.status(201).json({ message: "Faculty request sent to target department HOD", request: row });
  } catch (error) {
    console.error("[Faculty Request Error]", error);
    if (error?.code === "23503") {
      return res.status(400).json({ message: "Invalid target department or offering" });
    }
    return res.status(500).json({ message: "Server error: " + error.message });
  } finally {
    client.release();
  }
};

const getFacultyAssignmentRequests = async (req, res) => {
  const client = await pool.connect();

  try {
    if (req.user?.role !== "HOD") {
      return res.status(403).json({ message: "Only HOD can view faculty assignment requests" });
    }

    const hodBranchCode = await getRequestUserBranchCode(client, req.user.id);
    const rows = await getFacultyAssignmentRequestsForHod(client, req.user.id, hodBranchCode);

    return res.status(200).json({
      message: "Faculty assignment requests fetched successfully",
      items: rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const approveFacultyAssignmentRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    if (req.user?.role !== "HOD") {
      return res.status(403).json({ message: "Only target department HOD can approve faculty requests" });
    }

    const requestId = toInt(req.params?.request_id);
    const { faculty_id, role, division, total_lectures } = req.body || {};
    const payload = {
      faculty_id: toInt(faculty_id),
      role: role ? String(role).trim().toLowerCase() : null,
      division: division ? String(division).trim() : null,
      total_lectures: toInt(total_lectures),
    };

    if (!requestId || !payload.faculty_id) {
      return res.status(400).json({ message: "request_id and faculty_id are required" });
    }

    await client.query("BEGIN");

    const request = await getFacultyAssignmentRequestById(client, requestId);
    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Faculty request not found" });
    }

    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Only pending requests can be approved" });
    }

    const hodBranchCode = await getRequestUserBranchCode(client, req.user.id);
    if (normalizeBranchCode(request.target_branch_code) !== hodBranchCode) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Only the requested department HOD can allocate faculty" });
    }

    const facultyBranchCode = normalizeBranchCode(await getFacultyBranchCodeById(client, payload.faculty_id));
    if (facultyBranchCode !== hodBranchCode) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Select faculty from your own department only" });
    }

    const assignmentPayload = {
      offering_id: request.offering_id,
      faculty_id: payload.faculty_id,
      role: payload.role || request.role || "assistant",
      division: payload.division || request.division,
      total_lectures: payload.total_lectures || request.total_lectures,
    };

    if (!assignmentPayload.division) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "division is required" });
    }

    const assignment = await createAssignedSubjectFacultyRow(client, assignmentPayload);
    const approvedRequest = await approveFacultyAssignmentRequestRow(client, requestId, {
      assigned_faculty_id: payload.faculty_id,
      handled_by_hod_id: req.user.id,
      role: assignmentPayload.role,
      division: assignmentPayload.division,
      total_lectures: assignmentPayload.total_lectures,
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Faculty allocated and request approved successfully",
      request: approvedRequest,
      assignment,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({ message: "This faculty is already assigned for this offering and division" });
    }
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getAssignedSubjects = async (req, res) => {
  try {
    const facultyId = parseInt(req.params.id);
    if (isNaN(facultyId)) {
      return res.status(400).json({ error: 'Invalid faculty ID' });
    }
    const subjects = await getFacultyAssignedSubjects(facultyId);
    res.status(200).json(subjects);
  } catch (err) {
    res.status(500).json({ error: 'Server Error: ' + err.message });
  }
};

const getAssignmentsForOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = toInt(req.params?.offering_id);

    if (!offeringId) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const rows = await getAssignmentsByOfferingId(client, offeringId);

    return res.status(200).json({
      message: "Assignments fetched successfully",
      offering_id: offeringId,
      items: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const normalizeCode = (value) => String(value ?? "").trim();
const normalizeKey = (value) => normalizeCode(value).toLowerCase();
const buildBranchSubjectKey = (branchCode, subjectCode) => `${normalizeKey(branchCode)}::${normalizeKey(subjectCode)}`;
const isBranchHeader = (value) => {
  const key = normalizeKey(value).replace(/[\s._-]/g, "");
  return key === "branch" || key === "branchcode" || key === "department" || key === "departmentcode";
};
const getEnrollmentYear = (enrollmentNo, accadmicYear) => {
  const enrollmentText = normalizeCode(enrollmentNo);
  const yearPrefix = enrollmentText.match(/^\d{2}/)?.[0];
  if (yearPrefix) {
    const parsed = Number.parseInt(yearPrefix, 10);
    if (Number.isFinite(parsed)) {
      return parsed >= 70 ? 1900 + parsed : 2000 + parsed;
    }
  }

  const academicStartYear = normalizeCode(accadmicYear).match(/\d{4}/)?.[0];
  return academicStartYear ? Number.parseInt(academicStartYear, 10) : new Date().getFullYear();
};

const resolveBatchForStudentUpload = async (client, branchCode, enrolledYear) => {
  const courseResult = await client.query(
    `SELECT id, duration_years FROM course WHERE LOWER(TRIM(name)) = 'be' AND is_deleted = FALSE ORDER BY id ASC LIMIT 1`
  );

  if (courseResult.rowCount === 0) {
    throw new Error("BE course not found. Create BE course before assigning student offerings.");
  }

  const courseId = courseResult.rows[0].id;
  const durationYears = Number.parseInt(courseResult.rows[0].duration_years, 10);
  const passingYear = Number.isFinite(durationYears) ? Number(enrolledYear) + durationYears : null;
  const numericEnrolledYear = Number.parseInt(enrolledYear, 10);
  const batchNo = Number.isFinite(numericEnrolledYear) && Number.isFinite(passingYear)
    ? `${numericEnrolledYear}-${passingYear}`
    : null;

  const batchResult = await client.query(
    `
      SELECT id
      FROM batch
      WHERE branch_code = $1
        AND course_id = $2
        AND enrolled_year = $3
        AND is_deleted = FALSE
      ORDER BY id DESC
      LIMIT 1
    `,
    [branchCode, courseId, enrolledYear]
  );

  if (batchResult.rowCount > 0) {
    if (passingYear || batchNo) {
      await client.query(
        `
          UPDATE batch
          SET
            passing_year = COALESCE($2, passing_year),
            batch_no = COALESCE($3, batch_no)
          WHERE id = $1
        `,
        [batchResult.rows[0].id, passingYear, batchNo]
      );
    }
    return batchResult.rows[0].id;
  }

  const createResult = await client.query(
    `
      INSERT INTO batch (branch_code, course_id, enrolled_year, passing_year, batch_no, number_of_students)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING id
    `,
    [branchCode, courseId, enrolledYear, passingYear, batchNo]
  );

  return createResult.rows[0].id;
};

const createMissingStudentsForOfferingUpload = async (client, studentRows, existingStudentMap, uploadBranchCode, accadmicYear) => {
  const missingRows = studentRows.filter((row) => !existingStudentMap.has(normalizeKey(row.enrollment_no)));
  if (!missingRows.length) {
    return 0;
  }

  const rowsToCreate = missingRows
    .map((row) => ({
      enrollment_no: normalizeCode(row.enrollment_no),
      branch_code: row.branch_code || uploadBranchCode,
      enrolled_year: getEnrollmentYear(row.enrollment_no, accadmicYear)
    }))
    .filter((row) => row.enrollment_no && row.branch_code);

  if (!rowsToCreate.length) {
    return 0;
  }

  const batchIdByKey = new Map();
  for (const row of rowsToCreate) {
    const key = `${row.branch_code}:${row.enrolled_year}`;
    if (!batchIdByKey.has(key)) {
      batchIdByKey.set(key, await resolveBatchForStudentUpload(client, row.branch_code, row.enrolled_year));
    }
  }

  const defaultPasswordHash = await bcrypt.hash("LDCE@123", 10);
  const values = [];
  const placeholders = rowsToCreate.map((row, index) => {
    const base = index * 6;
    values.push(
      row.enrollment_no,
      batchIdByKey.get(`${row.branch_code}:${row.enrolled_year}`),
      row.enrollment_no,
      "A",
      defaultPasswordHash,
      Date.now()
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  await client.query(
    `
      INSERT INTO student (enrollment_no, batch_id, name, current_division, password, created_at)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (enrollment_no)
      DO NOTHING
    `,
    values
  );

  return rowsToCreate.length;
};

const isTruthyFlag = (value) => {
  const raw = normalizeKey(value);
  return raw === "1" || raw === "y" || raw === "yes" || raw === "true" || raw === "x";
};

const uploadStudentOfferingSubjects = async (req, res) => {
  const client = await pool.connect();

  try {
    const { accadmic_year, session, branch_code } = req.body || {};

    if (!req.file) {
      return res.status(400).json({ message: "Excel file is required" });
    }

    if (!accadmic_year || !session) {
      return res.status(400).json({ message: "accadmic_year and session are required" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });

    if (rows.length < 2) {
      return res.status(400).json({ message: "Excel must contain header row and at least one student row" });
    }

    const headers = rows[0].map((header) => normalizeCode(header));
    const branchColumnIndex = headers.findIndex(isBranchHeader);
    const flaggedHeaderSubjectCodes = new Set();
    const uploadBranchCode = normalizeBranchCode(branch_code);

    const studentRows = rows.slice(1).map((row) => {
      const enrollmentNo = normalizeCode(row[0]);
      const rowBranchCode = branchColumnIndex > -1 ? normalizeBranchCode(row[branchColumnIndex]) : "";
      const selectedSubjectCodes = [];

      for (let col = 1; col < headers.length; col++) {
        if (col === branchColumnIndex) {
          continue;
        }

        const cellValue = normalizeCode(row[col]);
        if (!cellValue) {
          continue;
        }

        // Supports two formats:
        // 1) Subject code/value in cell (e.g., CS101)
        // 2) Flag in cell (1/yes/x/true) where header has subject code
        if (isTruthyFlag(cellValue)) {
          const subjectFromHeader = normalizeCode(headers[col]);
          if (subjectFromHeader) {
            flaggedHeaderSubjectCodes.add(subjectFromHeader);
            selectedSubjectCodes.push(subjectFromHeader);
          }
        } else {
          selectedSubjectCodes.push(cellValue);
        }
      }

      return {
        enrollment_no: enrollmentNo,
        branch_code: rowBranchCode,
        selected_subject_codes: [...new Set(selectedSubjectCodes)]
      };
    }).filter((row) => row.enrollment_no);

    if (!studentRows.length) {
      return res.status(400).json({ message: "No student rows found" });
    }

    const subjectCodes = [...new Set([
      ...flaggedHeaderSubjectCodes,
      ...studentRows.flatMap((row) => row.selected_subject_codes)
    ].filter(Boolean))];

    if (!subjectCodes.length) {
      return res.status(400).json({ message: "No subject references found in header row or student rows" });
    }

    const enrollmentNos = [...new Set(studentRows.map((row) => row.enrollment_no))];

    await client.query("BEGIN");

    let studentBatchRows = await getStudentBatchMap(client, enrollmentNos);
    let studentBranchMap = new Map(
      studentBatchRows
        .filter((row) => normalizeCode(row.enrollment_no))
        .map((row) => [
          normalizeKey(row.enrollment_no),
          {
            enrollment_no: normalizeCode(row.enrollment_no),
            branch_code: normalizeBranchCode(row.branch_code)
          }
        ])
    );

    const createdMissingStudents = await createMissingStudentsForOfferingUpload(
      client,
      studentRows,
      studentBranchMap,
      uploadBranchCode,
      accadmic_year
    );

    if (createdMissingStudents > 0) {
      studentBatchRows = await getStudentBatchMap(client, enrollmentNos);
      studentBranchMap = new Map(
        studentBatchRows
          .filter((row) => normalizeCode(row.enrollment_no))
          .map((row) => [
            normalizeKey(row.enrollment_no),
            {
              enrollment_no: normalizeCode(row.enrollment_no),
              branch_code: normalizeBranchCode(row.branch_code)
            }
          ])
      );
    }

    const offerings = await getOfferingsByYearSessionAndSubjects(client, String(accadmic_year).trim(), String(session).trim(), subjectCodes);
    const offeringMap = new Map(
      offerings
        .filter((row) => normalizeCode(row.subject_code) && normalizeCode(row.coordinator_branch_code))
        .map((row) => [
          buildBranchSubjectKey(row.coordinator_branch_code, row.subject_code),
          Number(row.offering_id)
        ])
    );

    const offeringIdsToClear = [...new Set(offerings.map((row) => Number(row.offering_id)).filter((value) => Number.isFinite(value)))];

    const rowsToSync = [];
    const missingStudents = [];
    const missingOfferings = [];

    for (const studentRow of studentRows) {
      const studentContext = studentBranchMap.get(normalizeKey(studentRow.enrollment_no));
      if (!studentContext) {
        missingStudents.push({ enrollment_no: studentRow.enrollment_no, reason: "Student not found" });
        continue;
      }

      const studentBranchCode = studentRow.branch_code || uploadBranchCode || studentContext.branch_code;

      if (!studentBranchCode) {
        missingStudents.push({ enrollment_no: studentRow.enrollment_no, reason: "Student branch not found" });
        continue;
      }

      for (const subjectCode of studentRow.selected_subject_codes) {
        const offeringId = offeringMap.get(buildBranchSubjectKey(studentBranchCode, subjectCode));
        if (!offeringId) {
          missingOfferings.push({
            enrollment_no: studentRow.enrollment_no,
            subject_code: subjectCode,
            student_branch_code: studentBranchCode
          });
          continue;
        }

        rowsToSync.push({ enrollment_no: studentContext.enrollment_no, offering_id: offeringId });
      }
    }

    if (!rowsToSync.length) {
      await client.query("ROLLBACK");
      return res.status(422).json({
        message: "No matching offerings found for the uploaded sheet",
        total_students: enrollmentNos.length,
        total_mappings_saved: 0,
        created_missing_students: createdMissingStudents,
        missing_students: missingStudents,
        missing_offerings: missingOfferings
      });
    }

    if (offeringIdsToClear.length) {
      await client.query(
        `
          UPDATE student_offering_subject
          SET is_deleted = TRUE
          WHERE enrollment_no = ANY($1::VARCHAR[])
            AND offering_id = ANY($2::INT[])
            AND is_deleted = FALSE
        `,
        [enrollmentNos, offeringIdsToClear]
      );
    }

    const inserted = await bulkSyncStudentOfferingSubjects(client, rowsToSync);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Student offering subjects uploaded successfully",
      accadmic_year,
      session,
      total_students: enrollmentNos.length,
      total_mappings_saved: inserted,
      created_missing_students: createdMissingStudents,
      missing_students: missingStudents,
      missing_offerings: missingOfferings
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getMyCurrentSubjects = async (req, res) => {
  try {
    const enrollmentNo = req.user?.id;

    if (!enrollmentNo) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user?.role !== "student") {
      return res.status(403).json({ message: "Only student can access current subjects endpoint" });
    }

    const rows = await getCurrentSubjectsForStudent(enrollmentNo);

    if (!rows.length) {
      return res.status(404).json({
        message: "No offered subjects found for current student semester"
      });
    }

    return res.status(200).json({
      message: "Current semester subjects fetched successfully",
      enrollment_no: enrollmentNo,
      accadmic_year: rows[0].accadmic_year,
      session: rows[0].session,
      sem_number: rows[0].sem_number,
      branch_code: rows[0].branch_code,
      branch_name: rows[0].branch_name,
      subjects: rows.map((row) => ({
        offering_id: row.offering_id,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        number_of_lectures: row.number_of_lectures,
        faculty_corrdinator_id: row.faculty_corrdinator_id,
        faculty_coordinator_name: row.faculty_coordinator_name
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
};

const getStudentAllSubjects = async (req, res) => {
  try {
    const enrollmentNo = req.params?.enrollment_no;

    if (!enrollmentNo) {
      return res.status(400).json({ message: "enrollment_no is required" });
    }

    const rows = await getAllSubjectsForStudent(enrollmentNo);

    if (!rows.length) {
      return res.status(404).json({
        message: "No offered subjects found for the specified student",
        subjects: []
      });
    }

    return res.status(200).json({
      message: "Student subjects fetched successfully",
      enrollment_no: enrollmentNo,
      subjects: rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
};

const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        branch_code,
        name
      FROM branch
      WHERE is_deleted = FALSE
      ORDER BY 
        CASE 
          WHEN branch_code ~ '^[0-9]+$' THEN 0
          ELSE 1
        END,
        branch_code
    `);
    
    const departments = result.rows || [];
    console.log(`[getDepartments] Returned ${departments.length} departments:`, departments.map(d => `${d.branch_code}:${d.name}`).join(', '));
    return res.status(200).json({ departments });
  } catch (err) {
    console.error("[getDepartments Error]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
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
};
