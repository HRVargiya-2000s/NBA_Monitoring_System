const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXTERNAL_MARKS_TO_GRADE = {
  65: "AA",
  56: "AB",
  49: "BB",
  42: "BC",
  35: "CC",
  29: "CD",
  28: "DD",
  22: "FF"
};

const VIVA_MARKS_TO_GRADE = {
  28: "AA",
  24: "AB",
  21: "BB",
  18: "BC",
  15: "CC",
  13: "CD",
  12: "DD",
  10: "FF"
};

const generateExcelForOffering = async (client, offeringId) => {
  // 1. Fetch offering context
  const contextRes = await client.query(
    `
      SELECT
        o.id AS offering_id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        s.subject_code,
        s.name AS subject_name,
        b.name AS branch_name,
        b.branch_code
      FROM offered_subjects o
      JOIN subject s ON s.subject_code = o.subject_code
      LEFT JOIN faculty f ON f.id = o.faculty_corrdinator_id
      LEFT JOIN branch b ON b.branch_code = f.branch_code
      WHERE o.id = $1
        AND o.is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );
  const context = contextRes.rows[0];
  if (!context) {
    throw new Error("Offering not found");
  }

  // 2. Fetch assigned faculty names
  const facultyRes = await client.query(
    `
      SELECT f.name
      FROM assigned_subject_faculty asf
      JOIN faculty f ON f.id = asf.faculty_id
      WHERE asf.offering_id = $1
        AND asf.is_deleted = FALSE
    `,
    [offeringId]
  );
  const facultyNames = facultyRes.rows.map((row) => row.name);
  if (context.faculty_coordinator_name) {
    facultyNames.push(context.faculty_coordinator_name);
  }
  // Remove duplicates and join
  const uniqueFaculty = Array.from(new Set(facultyNames)).join(", ");
  context.faculty_name = uniqueFaculty;

  // 3. Fetch enrolled students
  const studentsRes = await client.query(
    `
      SELECT s.enrollment_no, s.name 
      FROM student_offering_subject sos 
      JOIN student s ON s.enrollment_no = sos.enrollment_no 
      WHERE sos.offering_id = $1 
        AND sos.is_deleted = FALSE 
        AND s.is_deleted = FALSE 
      ORDER BY s.enrollment_no
    `,
    [offeringId]
  );
  const students = studentsRes.rows;

  // 4. Fetch strength mappings
  const strengthRes = await client.query(
    `
      SELECT co_number, outcome_type, outcome_code, strength, justification
      FROM co_po_pso_strength_mapping
      WHERE offering_id = $1
        AND is_deleted = FALSE
    `,
    [offeringId]
  );
  const strengthMappings = strengthRes.rows;

  // 5. Fetch papers
  const papersRes = await client.query(
    `
      SELECT p.paper_id, e.exam_type, p.max_marks
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
    `,
    [offeringId]
  );
  const papersData = papersRes.rows;

  // 6. Fetch papers CO-wise total marks
  const coTotalRes = await client.query(
    `
      SELECT paper_id, co_number, total_marks
      FROM co_wise_target_value
      WHERE paper_id IN (
        SELECT paper_id FROM paper WHERE offering_id = $1 AND is_deleted = FALSE
      )
    `,
    [offeringId]
  );
  const coTotalMarks = coTotalRes.rows;

  // Structure papers payload
  const papers = {
    mid_sem: null,
    internal: null,
    external: null,
    viva: null
  };

  for (const paper of papersData) {
    const limits = {};
    coTotalMarks
      .filter((row) => row.paper_id === paper.paper_id)
      .forEach((row) => {
        limits[row.co_number] = Number(row.total_marks);
      });

    papers[paper.exam_type] = {
      paper_id: paper.paper_id,
      max_marks: Number(paper.max_marks),
      co_limits: limits
    };
  }

  // 7. Fetch all student total marks
  const totalMarksRes = await client.query(
    `
      SELECT paper_id, enrollment_no, obtained_marks
      FROM marks
      WHERE offering_id = $1
        AND is_deleted = FALSE
    `,
    [offeringId]
  );
  const studentTotals = totalMarksRes.rows;

  // 8. Fetch all student CO-wise marks
  const coMarksRes = await client.query(
    `
      SELECT paper_id, enrollment_no, co_number, obtained_marks
      FROM co_marks
      WHERE offering_id = $1
        AND is_deleted = FALSE
    `,
    [offeringId]
  );
  const studentCoMarks = coMarksRes.rows;

  // Structure student marks payload
  const studentMarks = {};
  for (const student of students) {
    studentMarks[student.enrollment_no] = {
      mid_sem: {},
      internal: {},
      external_grade: "",
      viva_grade: ""
    };
  }

  // Populate Mid Sem and Internal CO marks
  for (const row of studentCoMarks) {
    const enroll = row.enrollment_no;
    if (!studentMarks[enroll]) continue;

    const paper = papersData.find((p) => p.paper_id === row.paper_id);
    if (!paper) continue;

    if (paper.exam_type === "mid_sem") {
      studentMarks[enroll].mid_sem[row.co_number] = Number(row.obtained_marks);
    } else if (paper.exam_type === "internal") {
      studentMarks[enroll].internal[row.co_number] = Number(row.obtained_marks);
    }
  }

  // Populate External and Viva grades using total marks reverse lookup
  for (const row of studentTotals) {
    const enroll = row.enrollment_no;
    if (!studentMarks[enroll]) continue;

    const paper = papersData.find((p) => p.paper_id === row.paper_id);
    if (!paper) continue;

    const marksVal = Number(row.obtained_marks);

    if (paper.exam_type === "external") {
      studentMarks[enroll].external_grade = EXTERNAL_MARKS_TO_GRADE[marksVal] || "";
    } else if (paper.exam_type === "viva") {
      studentMarks[enroll].viva_grade = VIVA_MARKS_TO_GRADE[marksVal] || "";
    }
  }

  // Query course outcomes descriptions
  const coDescRes = await client.query(
    `
      SELECT co_number, co_description
      FROM course_outcome
      WHERE offering_id = $1
        AND is_deleted = FALSE
      ORDER BY co_number
    `,
    [offeringId]
  );
  const courseOutcomes = coDescRes.rows;

  // Query lecture plan from NBA validation cache
  const cacheRes = await client.query(
    `
      SELECT generated_payload
      FROM nba_generation_cache
      WHERE offering_id = $1
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [offeringId]
  );
  const cachePayload = cacheRes.rows[0]?.generated_payload || null;
  const lecturePlan = cachePayload?.lecture_plan || [];

  // Combine into single payload
  const payload = {
    context,
    students,
    strength_mappings: strengthMappings,
    papers,
    student_marks: studentMarks,
    course_outcomes: courseOutcomes,
    lecture_plan: lecturePlan
  };

  // Write JSON to temporary file
  const tempJsonDir = path.join(__dirname, "../../../tmp");
  if (!fs.existsSync(tempJsonDir)) {
    fs.mkdirSync(tempJsonDir, { recursive: true });
  }
  const tempJsonPath = path.join(tempJsonDir, `data_${offeringId}_${Date.now()}.json`);
  fs.writeFileSync(tempJsonPath, JSON.stringify(payload, null, 2), "utf8");

  // Output file path
  const filename = `C2C_att_report_${offeringId}_${Date.now()}.xlsx`;
  const outputPath = path.join(tempJsonDir, filename);

  const templatePath = process.env.EXCEL_TEMPLATE_PATH || path.join(__dirname, "../../templates/CO_PO_template.xlsx");
  const scriptPath = path.join(__dirname, "excelGenerator.py");
  const pythonCmd = process.env.PYTHON_PATH || "python";

  // Execute python script
  return new Promise((resolve, reject) => {
    const cmd = `"${pythonCmd}" "${scriptPath}" "${tempJsonPath}" "${templatePath}" "${outputPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      // Clean up JSON file
      try {
        fs.unlinkSync(tempJsonPath);
      } catch (e) {
        console.error("Failed to delete temp JSON file", e);
      }

      if (error) {
        console.error("Python script exited with error command:", cmd);
        console.error("stderr:", stderr);
        return reject(new Error(`Failed to generate excel sheet: ${stderr || error.message}`));
      }

      resolve(outputPath);
    });
  });
};

module.exports = {
  generateExcelForOffering
};
