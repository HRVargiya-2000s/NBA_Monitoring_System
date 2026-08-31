const getPaperForMarksUpload = async (client, paperId) => {
  const paperQuery = `
    SELECT p.paper_id, p.offering_id, p.max_marks, e.exam_type
    FROM paper p
    JOIN exam e ON e.exam_id = p.exam_id
    WHERE p.paper_id = $1
      AND p.is_deleted = FALSE
      AND e.is_deleted = FALSE
  `;

  const paperResult = await client.query(paperQuery, [paperId]);
  if (!paperResult.rows.length) {
    return null;
  }

  return {
    paper: paperResult.rows[0]
  };
};

const isFacultyAssignedToOffering = async (client, facultyId, offeringId) => {
  const query = `
    SELECT 1
    FROM assigned_subject_faculty
    WHERE faculty_id = $1
      AND offering_id = $2
      AND is_deleted = FALSE
    LIMIT 1
  `;

  const result = await client.query(query, [facultyId, offeringId]);
  return result.rows.length > 0;
};

const clearExistingMarksForPaper = async (client, paperId) => {
  await client.query(`DELETE FROM co_marks WHERE paper_id = $1`, [paperId]);
  await client.query(`DELETE FROM marks WHERE paper_id = $1`, [paperId]);
};

const getOfferingStudentEnrollments = async (client, offeringId) => {
  const query = `
    SELECT sos.enrollment_no
    FROM student_offering_subject sos
    JOIN student s ON s.enrollment_no = sos.enrollment_no
    WHERE sos.offering_id = $1
      AND sos.is_deleted = FALSE
      AND s.is_deleted = FALSE
    ORDER BY sos.enrollment_no DESC
  `;

  let result = await client.query(query, [offeringId]);
  let enrollments = result.rows.map((row) => String(row.enrollment_no));

  if (enrollments.length === 0) {
    const batchResult = await client.query(
      `SELECT batch_id FROM offered_subjects WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [offeringId]
    );
    const batchId = batchResult.rows[0]?.batch_id;
    if (batchId) {
      await client.query(
        `
          INSERT INTO student_offering_subject (enrollment_no, offering_id, created_at, is_deleted)
          SELECT s.enrollment_no, $1, CURRENT_TIMESTAMP, FALSE
          FROM student s
          WHERE s.batch_id = $2
            AND s.is_deleted = FALSE
          ON CONFLICT (enrollment_no, offering_id)
          DO UPDATE SET
            is_deleted = FALSE,
            created_at = EXCLUDED.created_at
        `,
        [offeringId, batchId]
      );
      result = await client.query(query, [offeringId]);
      enrollments = result.rows.map((row) => String(row.enrollment_no));
    }
  }

  return enrollments;
};

const autoMapStudentsToOffering = async (client, offeringId, enrollmentNos) => {
  if (!enrollmentNos || !enrollmentNos.length) {
    return 0;
  }

  const studentsResult = await client.query(
    `SELECT enrollment_no FROM student WHERE enrollment_no = ANY($1::VARCHAR[]) AND is_deleted = FALSE`,
    [enrollmentNos]
  );
  const existingEnrollments = studentsResult.rows.map((r) => String(r.enrollment_no));

  if (!existingEnrollments.length) {
    return 0;
  }

  const values = [];
  const placeholders = existingEnrollments.map((enrollmentNo, index) => {
    const baseIndex = index * 2;
    values.push(enrollmentNo, offeringId);
    return `($${baseIndex + 1}, $${baseIndex + 2}, CURRENT_TIMESTAMP, FALSE)`;
  });

  const query = `
    INSERT INTO student_offering_subject (enrollment_no, offering_id, created_at, is_deleted)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (enrollment_no, offering_id)
    DO UPDATE SET is_deleted = FALSE
    RETURNING enrollment_no
  `;

  const result = await client.query(query, values);
  return result.rowCount;
};

const insertCoMarks = async (client, rows) => {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = rows.map((row, index) => {
    const baseIndex = index * 6;
    values.push(
      row.paper_id,
      row.offering_id,
      row.enrollment_no,
      row.co_number,
      row.obtained_marks,
      row.created_at
    );

    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  });

  const query = `
    INSERT INTO co_marks
      (paper_id, offering_id, enrollment_no, co_number, obtained_marks, created_at)
    VALUES ${placeholders.join(", ")}
  `;

  await client.query(query, values);
};

const upsertCoWiseTargetTotalMarks = async (client, paperId, coTotalMarksRows) => {
  if (!coTotalMarksRows.length) {
    return;
  }

  const values = [];
  const placeholders = coTotalMarksRows.map((row, index) => {
    const baseIndex = index * 4;
    values.push(
      paperId,
      row.co_number,
      0,
      row.total_marks
    );

    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
  });

  const query = `
    INSERT INTO co_wise_target_value (paper_id, co_number, target_value, total_marks)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (paper_id, co_number)
    DO UPDATE SET total_marks = EXCLUDED.total_marks
  `;

  await client.query(query, values);
};

const getCoWiseTotalMarksByPaper = async (client, paperId) => {
  const query = `
    SELECT co_number, total_marks
    FROM co_wise_target_value
    WHERE paper_id = $1
    ORDER BY co_number
  `;

  const result = await client.query(query, [paperId]);
  return result.rows;
};

const insertBulkMarks = async (client, rows) => {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = rows.map((row, index) => {
    const baseIndex = index * 6;
    values.push(
      row.paper_id,
      row.enrollment_no,
      row.obtained_marks,
      row.total_marks,
      row.offering_id,
      row.created_at
    );

    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  });

  const query = `
    INSERT INTO marks
      (paper_id, enrollment_no, obtained_marks, total_marks, offering_id, created_at)
    VALUES ${placeholders.join(", ")}
  `;

  await client.query(query, values);
};

const getMarksByPaperId = async (client, paperId) => {
  const query = `
    SELECT 
      m.paper_id,
      m.enrollment_no,
      m.obtained_marks,
      m.total_marks,
      m.created_at,
      cm.co_number,
      cm.obtained_marks as co_obtained_marks
    FROM marks m
    LEFT JOIN co_marks cm ON m.paper_id = cm.paper_id 
      AND m.enrollment_no = cm.enrollment_no
    WHERE m.paper_id = $1
    ORDER BY m.enrollment_no, cm.co_number
  `;

  const result = await client.query(query, [paperId]);
  return result.rows;
};

const getStudentMarksForExam = async (client, enrollmentNo, examId) => {
  const query = `
    SELECT 
      m.paper_id,
      p.exam_id,
      m.enrollment_no,
      m.obtained_marks,
      m.total_marks,
      m.created_at,
      cm.co_number,
      cm.obtained_marks as co_obtained_marks
    FROM marks m
    INNER JOIN paper p ON m.paper_id = p.paper_id
    LEFT JOIN co_marks cm ON m.paper_id = cm.paper_id 
      AND m.enrollment_no = cm.enrollment_no
    WHERE m.enrollment_no = $1 AND p.exam_id = $2
    ORDER BY m.paper_id, cm.co_number
  `;

  const result = await client.query(query, [enrollmentNo, examId]);
  return result.rows;
};

const getStudentMarksForOffering = async (client, enrollmentNo, offeringId) => {
  const query = `
    SELECT 
      m.paper_id,
      p.exam_id,
      CONCAT(e.exam_type, ' ', e.academic_year, ' ', e.session) AS exam_name,
      e.exam_type,
      m.enrollment_no,
      m.offering_id,
      m.obtained_marks,
      m.total_marks,
      m.created_at,
      cm.co_number,
      cm.obtained_marks as co_obtained_marks
    FROM marks m
    INNER JOIN paper p ON m.paper_id = p.paper_id
    INNER JOIN exam e ON p.exam_id = e.exam_id
    LEFT JOIN co_marks cm ON m.paper_id = cm.paper_id 
      AND m.enrollment_no = cm.enrollment_no
    WHERE m.enrollment_no = $1 AND m.offering_id = $2
    ORDER BY m.paper_id, cm.co_number
  `;

  const result = await client.query(query, [enrollmentNo, offeringId]);
  return result.rows;
};

module.exports = {
  getPaperForMarksUpload,
  isFacultyAssignedToOffering,
  clearExistingMarksForPaper,
  getOfferingStudentEnrollments,
  insertCoMarks,
  insertBulkMarks,
  upsertCoWiseTargetTotalMarks,
  getCoWiseTotalMarksByPaper,
  getMarksByPaperId,
  getStudentMarksForExam,
  getStudentMarksForOffering,
  autoMapStudentsToOffering
};