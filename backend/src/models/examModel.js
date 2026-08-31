const insertExam = async (client, data) => {
    const query = `
        INSERT INTO exam (exam_type, academic_year, session, created_at)
        VALUES ($1, $2, $3, EXTRACT(EPOCH FROM NOW())::BIGINT)
        RETURNING exam_id, exam_type, academic_year, session
    `;

    const result = await client.query(query, [
        data.exam_type,
        data.academic_year,
        data.session
    ]);

    return result.rows[0];
};

const insertPaper = async (client, data) => {
    const query = `
        INSERT INTO paper (exam_id, exam_date, offering_id, max_marks, total_students, created_at)
        VALUES ($1, $2, $3, $4, $5, EXTRACT(EPOCH FROM NOW())::BIGINT)
        RETURNING paper_id, exam_id, offering_id, exam_date, max_marks, total_students
    `;
    const result = await client.query(query, [
        data.exam_id,
        data.exam_date,
        data.offering_id,
        data.max_marks,
        data.total_students
    ]);

    return result.rows[0];
};

const fetchPapersByExamId = async (client, exam_id) => {
    const query = `
        SELECT p.paper_id, p.exam_date, p.offering_id, p.max_marks, p.paper_url,
               s.subject_code, s.name AS subject_name,
               e.exam_type, e.academic_year, e.session
        FROM paper p
        JOIN exam e ON e.exam_id = p.exam_id
        JOIN offered_subjects os ON os.id = p.offering_id
        JOIN subject s ON s.subject_code = os.subject_code
        WHERE p.exam_id = $1 AND p.is_deleted = false
    `;
    const result = await client.query(query, [exam_id]);
    return result.rows;
}

const findExamByTypeYearSession = async (client, payload) => {
    const query = `
        SELECT exam_id, exam_type, academic_year, session
        FROM exam
        WHERE exam_type = $1
          AND academic_year = $2
          AND LOWER(session) = LOWER($3)
          AND is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [payload.exam_type, payload.academic_year, payload.session]);
    return result.rows[0] || null;
};

const findPaperByExamAndOffering = async (client, examId, offeringId) => {
    const query = `
        SELECT p.paper_id, p.exam_id, p.offering_id, p.exam_date, p.max_marks, p.total_students,
               e.exam_type, e.academic_year, e.session
        FROM paper p
        JOIN exam e ON e.exam_id = p.exam_id
        WHERE p.exam_id = $1
          AND p.offering_id = $2
          AND p.is_deleted = FALSE
          AND e.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [examId, offeringId]);
    return result.rows[0] || null;
};

const findPaperByOfferingAndExamMeta = async (client, payload) => {
    const query = `
        SELECT p.paper_id, p.exam_id, p.offering_id, p.exam_date, p.max_marks, p.total_students,
               e.exam_type, e.academic_year, e.session
        FROM paper p
        JOIN exam e ON e.exam_id = p.exam_id
        WHERE p.offering_id = $1
          AND e.exam_type = $2
          AND e.academic_year = $3
          AND LOWER(e.session) = LOWER($4)
          AND p.is_deleted = FALSE
          AND e.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [
        payload.offering_id,
        payload.exam_type,
        payload.academic_year,
        payload.session
    ]);

    return result.rows[0] || null;
};

const isFacultyAssignedToOffering = async (client, facultyId, offeringId) => {
    const query = `
        SELECT 1
        FROM assigned_subject_faculty asf
        WHERE asf.faculty_id = $1
          AND asf.offering_id = $2
          AND asf.is_deleted = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [facultyId, offeringId]);
    return result.rows.length > 0;
};

const getCoConfigByPaperId = async (client, paperId) => {
    const query = `
        SELECT co_number, target_value, total_marks
        FROM co_wise_target_value
        WHERE paper_id = $1
        ORDER BY co_number ASC
    `;

    const result = await client.query(query, [paperId]);
    return result.rows;
};

const upsertPaperCoConfig = async (client, paperId, offeringId, rows) => {
    if (!rows.length) {
        return;
    }

    const values = [];
    const placeholders = rows.map((row, index) => {
        const base = index * 5;
        values.push(paperId, offeringId, row.co_number, row.target_value, row.total_marks);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    const query = `
        INSERT INTO co_wise_target_value (paper_id, offering_id, co_number, target_value, total_marks)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (paper_id, co_number)
        DO UPDATE SET
            offering_id = EXCLUDED.offering_id,
            target_value = EXCLUDED.target_value,
            total_marks = EXCLUDED.total_marks
    `;

    await client.query(query, values);
};

module.exports = {
    insertExam,
    insertPaper,
    fetchPapersByExamId,
    findExamByTypeYearSession,
    findPaperByExamAndOffering,
    findPaperByOfferingAndExamMeta,
    isFacultyAssignedToOffering,
    getCoConfigByPaperId,
    upsertPaperCoConfig
};
