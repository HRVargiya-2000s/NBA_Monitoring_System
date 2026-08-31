const { pool } = require("../config/db/index.js");
const {
  insertExam,
  insertPaper,
    fetchPapersByExamId,
    findExamByTypeYearSession,
    findPaperByExamAndOffering,
    findPaperByOfferingAndExamMeta,
    isFacultyAssignedToOffering,
    getCoConfigByPaperId,
    upsertPaperCoConfig
} = require("../models/examModel.js");

const EXAM_TYPES = new Set(["internal", "external", "mid_sem", "viva"]);

const canBypassAssignmentCheck = (role) => role === "ADMIN" || role === "ASSOCIATE";

const hasOfferingAccess = async (client, req, offeringId) => {
        if (canBypassAssignmentCheck(req.user?.role)) {
                return true;
        }

        return isFacultyAssignedToOffering(client, req.user?.id, offeringId);
};

const createExam = async (req, res) => {
    const client = await pool.connect();

    try {
        const { exam_type, academic_year, session } = req.body || {};
    
        if (!exam_type || !academic_year || !session) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        await insertExam(client, { exam_type, academic_year, session });

        res.status(201).json({ message: "Exam created successfully" });
    } catch (error) {
        console.error("Error creating exam:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
}

const createPaper = async (req, res) => {
    const client = await pool.connect();

    try {
        const exam_id = parseInt(req.params.exam_id);
        if (isNaN(exam_id)) {
            return res.status(400).json({ message: "Invalid exam ID" });
        }

        const { exam_date, offering_id, max_marks, total_students } = req.body || {};
        if (!exam_date || !offering_id || !max_marks || total_students === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const offeringId = Number.parseInt(offering_id, 10);
        if (Number.isNaN(offeringId) || offeringId <= 0) {
            return res.status(400).json({ message: "Invalid offering_id" });
        }

        const totalStudents = Number.parseInt(total_students, 10);
        if (Number.isNaN(totalStudents) || totalStudents < 0) {
            return res.status(400).json({ message: "Invalid total_students" });
        }

        const allowed = await hasOfferingAccess(client, req, offeringId);
        if (!allowed) {
            return res.status(403).json({ message: "You can create paper only for offerings assigned to you" });
        }

        await insertPaper(client, { exam_id, exam_date, offering_id: offeringId, max_marks, total_students: totalStudents });

        res.status(201).json({ message: "Paper created successfully" });
    }catch (error) {
        console.error("Error creating paper:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
}

const getPapersByExamId = async (req, res) => {
    const client = await pool.connect();

    try {
        const exam_id = parseInt(req.params.exam_id);
        if (isNaN(exam_id)) {
            return res.status(400).json({ message: "Invalid exam ID" });
        }

        const papers = await fetchPapersByExamId(client, exam_id);
        res.status(200).json({ papers });
    }catch (error) {
        console.error("Error fetching papers:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
}

const ensurePaperForOffering = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            offering_id,
            exam_type,
            academic_year,
            session,
            exam_date,
            max_marks,
            total_students
        } = req.body || {};

        const offeringId = Number.parseInt(offering_id, 10);
        const totalStudents = Number.parseInt(total_students, 10);
        const maxMarks = Number.parseInt(max_marks, 10);
        const normalizedExamType = String(exam_type || "").trim().toLowerCase();

        if (!offeringId || Number.isNaN(offeringId)) {
            return res.status(400).json({ message: "Invalid offering_id" });
        }

        if (!EXAM_TYPES.has(normalizedExamType)) {
            return res.status(400).json({ message: "Invalid exam_type" });
        }

        if (!academic_year || !session) {
            return res.status(400).json({ message: "academic_year and session are required" });
        }

        const allowed = await hasOfferingAccess(client, req, offeringId);
        if (!allowed) {
            return res.status(403).json({ message: "You can access papers only for offerings assigned to you" });
        }

        let exam = await findExamByTypeYearSession(client, {
            exam_type: normalizedExamType,
            academic_year: String(academic_year).trim(),
            session: String(session).trim()
        });

        if (!exam) {
            exam = await insertExam(client, {
                exam_type: normalizedExamType,
                academic_year: String(academic_year).trim(),
                session: String(session).trim()
            });
        }

        let paper = await findPaperByExamAndOffering(client, exam.exam_id, offeringId);

        if (paper) {
            const co_config = await getCoConfigByPaperId(client, paper.paper_id);
            return res.status(200).json({ exists: true, exam, paper, co_config });
        }

        if (!exam_date || Number.isNaN(totalStudents) || totalStudents < 0 || Number.isNaN(maxMarks) || maxMarks <= 0) {
            return res.status(400).json({
                message: "exam_date, max_marks and non-negative total_students are required to create a new paper"
            });
        }

        paper = await insertPaper(client, {
            exam_id: exam.exam_id,
            exam_date,
            offering_id: offeringId,
            max_marks: maxMarks,
            total_students: totalStudents
        });

        return res.status(201).json({ exists: false, exam, paper, co_config: [] });
    } catch (error) {
        console.error("Error ensuring paper:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const getPaperByOfferingAndExamMeta = async (req, res) => {
    const client = await pool.connect();

    try {
        const { offering_id, exam_type, academic_year, session } = req.query || {};

        const offeringId = Number.parseInt(offering_id, 10);
        const normalizedExamType = String(exam_type || "").trim().toLowerCase();

        if (!offeringId || Number.isNaN(offeringId)) {
            return res.status(400).json({ message: "Invalid offering_id" });
        }

        if (!EXAM_TYPES.has(normalizedExamType)) {
            return res.status(400).json({ message: "Invalid exam_type" });
        }

        if (!academic_year || !session) {
            return res.status(400).json({ message: "academic_year and session are required" });
        }

        const allowed = await hasOfferingAccess(client, req, offeringId);
        if (!allowed) {
            return res.status(403).json({ message: "You can access papers only for offerings assigned to you" });
        }

        const paper = await findPaperByOfferingAndExamMeta(client, {
            offering_id: offeringId,
            exam_type: normalizedExamType,
            academic_year: String(academic_year).trim(),
            session: String(session).trim()
        });

        if (!paper) {
            return res.status(200).json({ exists: false, paper: null, co_config: [] });
        }

        const co_config = await getCoConfigByPaperId(client, paper.paper_id);
        return res.status(200).json({ exists: true, paper, co_config });
    } catch (error) {
        console.error("Error fetching paper by offering and exam metadata:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const upsertPaperCoConfigByPaperId = async (req, res) => {
    const client = await pool.connect();

    try {
        const paperId = Number.parseInt(req.params.paper_id, 10);
        if (!paperId || Number.isNaN(paperId)) {
            return res.status(400).json({ message: "Invalid paper_id" });
        }

        const { rows } = req.body || {};
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ message: "rows array is required" });
        }

                const paperQuery = `
                        SELECT p.paper_id, p.offering_id, p.max_marks
            FROM paper p
            WHERE p.paper_id = $1
              AND p.is_deleted = FALSE
            LIMIT 1
        `;
        const paperResult = await client.query(paperQuery, [paperId]);
        const paper = paperResult.rows[0];

        if (!paper) {
            return res.status(404).json({ message: "Paper not found" });
        }

        const allowed = await hasOfferingAccess(client, req, paper.offering_id);
        if (!allowed) {
            return res.status(403).json({ message: "You can update paper config only for offerings assigned to you" });
        }

        const normalizedRows = rows
            .map((row) => ({
                co_number: Number.parseInt(row?.co_number, 10),
                target_value: Number.parseInt(row?.target_value, 10),
                total_marks: Number.parseInt(row?.total_marks, 10)
            }))
            .filter((row) => !Number.isNaN(row.co_number));

        const invalidRow = normalizedRows.find(
            (row) => Number.isNaN(row.target_value) || row.target_value < 0 || row.target_value > 100 || Number.isNaN(row.total_marks) || row.total_marks < 0
        );
        if (invalidRow) {
            return res.status(400).json({ message: "Each row requires co_number, target_value(0-100), total_marks(>=0)" });
        }

        const paperMaxMarks = Number(paper.max_marks || 0);
        const totalConfiguredMarks = normalizedRows.reduce((sum, row) => sum + Number(row.total_marks || 0), 0);
        let rowsToSave = normalizedRows;

        if (paperMaxMarks > 0 && totalConfiguredMarks > 0) {
            // Convert arbitrary CO totals into proportional paper-level totals (sum equals paper max marks).
            const scaled = normalizedRows.map((row) => {
                const raw = (Number(row.total_marks || 0) / totalConfiguredMarks) * paperMaxMarks;
                return {
                    ...row,
                    total_marks: Math.floor(raw),
                    __fraction: raw - Math.floor(raw)
                };
            });

            let assigned = scaled.reduce((sum, row) => sum + row.total_marks, 0);
            let remaining = paperMaxMarks - assigned;

            if (remaining > 0) {
                const candidates = [...scaled].sort((a, b) => b.__fraction - a.__fraction);
                let idx = 0;
                while (remaining > 0 && candidates.length) {
                    candidates[idx % candidates.length].total_marks += 1;
                    remaining -= 1;
                    idx += 1;
                }
            }

            rowsToSave = scaled.map(({ __fraction, ...row }) => row);
        }

        await upsertPaperCoConfig(client, paperId, paper.offering_id, rowsToSave);
        const co_config = await getCoConfigByPaperId(client, paperId);

        return res.status(200).json({ message: "CO config saved", paper_id: paperId, co_config });
    } catch (error) {
        console.error("Error upserting paper CO config:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

module.exports = {
    createExam,
    createPaper,
    getPapersByExamId,
    ensurePaperForOffering,
    getPaperByOfferingAndExamMeta,
    upsertPaperCoConfigByPaperId
}