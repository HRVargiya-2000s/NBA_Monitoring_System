const { pool } = require("../config/db/index.js");

const BRANCH_CODE_ALIASES = {
    AI: "52",
    AUTO: "02",
    BIO: "03",
    CHEM: "05",
    CIVIL: "06",
    CV: "06",
    CE: "07",
    ELE: "09",
    EC: "11",
    ENV: "13",
    IT: "16",
    IC: "17",
    MECH: "19",
    PLASTIC: "23",
    RUBBER: "26",
    TEXTILE: "29"
};

const normalizeBranchCode = (value) => {
    const code = String(value || "").trim().toUpperCase();
    if (!code) return "";
    if (BRANCH_CODE_ALIASES[code]) return BRANCH_CODE_ALIASES[code];
    return code.split("").every((char) => char >= "0" && char <= "9") ? code.padStart(2, "0") : code;
};

const toInt = (value) => {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const getHodBranchCode = async (hodId) => {
    const result = await pool.query(
        `SELECT COALESCE(f.branch_code, b.branch_code) AS branch_code
         FROM faculty f
         LEFT JOIN branch b
           ON b.hod_id = f.id
          AND b.is_deleted = FALSE
         WHERE f.id = $1
           AND f.type = 'HOD'
           AND f.is_deleted = FALSE
         LIMIT 1`,
        [hodId]
    );

    return normalizeBranchCode(result.rows[0]?.branch_code);
};

const getDepartmentFaculties = async (req, res) => {
    try {
        const hodId = req.user?.id;
        if (!hodId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const hodBranch = await getHodBranchCode(hodId);

        if (!hodBranch) {
            return res.status(404).json({ error: "HOD branch not found" });
        }

        const facultyQuery = `
            WITH branch_aliases(alias, branch_code) AS (
                VALUES
                  ('AI', '52'), ('AUTO', '02'), ('BIO', '03'), ('CHEM', '05'),
                  ('CIVIL', '06'), ('CV', '06'), ('CE', '07'), ('ELE', '09'),
                  ('EC', '11'), ('ENV', '13'), ('IT', '16'), ('IC', '17'),
                  ('MECH', '19'), ('PLASTIC', '23'), ('RUBBER', '26'), ('TEXTILE', '29')
            )
            SELECT f.id, f.name, f.type, f.branch_code
            FROM faculty f
            LEFT JOIN branch_aliases alias
              ON alias.alias = UPPER(TRIM(f.branch_code))
            WHERE f.is_deleted = FALSE
              AND f.type IN ('ASSISTANT', 'HOD', 'ASSOCIATE')
              AND (
                $1::VARCHAR IS NULL OR
                COALESCE(
                  alias.branch_code,
                  CASE
                    WHEN TRIM(f.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(f.branch_code), 2, '0')
                    ELSE UPPER(TRIM(f.branch_code))
                  END
                ) = $1
              )
            ORDER BY f.type, f.name
        `;

        let result = await pool.query(facultyQuery, [hodBranch || null]);

        if (result.rowCount === 0) {
            result = await pool.query(facultyQuery, [null]);
        }

        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSubjectsList = async (req, res) => {
    try {
                const hodId = req.user?.id;
                if (!hodId) {
                        return res.status(401).json({ error: "Unauthorized" });
                }

                const hodBranch = await getHodBranchCode(hodId);

                if (!hodBranch) {
                        return res.status(404).json({ error: "HOD branch not found" });
                }

                const result = await pool.query(
                        `WITH branch_aliases(alias, branch_code) AS (
                                VALUES
                                    ('AI', '52'), ('AUTO', '02'), ('BIO', '03'), ('CHEM', '05'),
                                    ('CIVIL', '06'), ('CV', '06'), ('CE', '07'), ('ELE', '09'),
                                    ('EC', '11'), ('ENV', '13'), ('IT', '16'), ('IC', '17'),
                                    ('MECH', '19'), ('PLASTIC', '23'), ('RUBBER', '26'), ('TEXTILE', '29')
                        )
                        SELECT DISTINCT
                            s.subject_code,
                            s.name
                        FROM subject s
                        JOIN subject_teaching_branch stb
                            ON stb.subject_code = s.subject_code
                         AND stb.is_deleted = FALSE
                        LEFT JOIN branch_aliases alias
                            ON alias.alias = UPPER(TRIM(stb.branch_code))
                        WHERE s.is_deleted = FALSE
                            AND COALESCE(
                                alias.branch_code,
                                CASE
                                    WHEN TRIM(stb.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(stb.branch_code), 2, '0')
                                    ELSE UPPER(TRIM(stb.branch_code))
                                END
                            ) = $1
                        ORDER BY s.name, s.subject_code`,
                        [hodBranch]
                );

                res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getFacultyDetails = async (req, res) => {
    try {
        const hodId = req.user?.id;
        if (!hodId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const facultyId = toInt(req.params?.faculty_id);
        if (!facultyId) {
            return res.status(400).json({ error: "faculty_id is required" });
        }

        const hodBranch = await getHodBranchCode(hodId);
        if (!hodBranch) {
            return res.status(404).json({ error: "HOD branch not found" });
        }

        const facultyResult = await pool.query(
            `WITH branch_aliases(alias, branch_code) AS (
                VALUES
                    ('AI', '52'), ('AUTO', '02'), ('BIO', '03'), ('CHEM', '05'),
                    ('CIVIL', '06'), ('CV', '06'), ('CE', '07'), ('ELE', '09'),
                    ('EC', '11'), ('ENV', '13'), ('IT', '16'), ('IC', '17'),
                    ('MECH', '19'), ('PLASTIC', '23'), ('RUBBER', '26'), ('TEXTILE', '29')
            )
            SELECT
                f.id,
                f.name,
                f.type,
                f.email,
                f.college_email,
                f.mobile_no,
                f.branch_code,
                f.years_of_experience,
                f.joining_date,
                COALESCE(
                    alias.branch_code,
                    CASE
                        WHEN TRIM(f.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(f.branch_code), 2, '0')
                        ELSE UPPER(TRIM(f.branch_code))
                    END
                ) AS normalized_branch_code,
                br.name AS branch_name
            FROM faculty f
            LEFT JOIN branch_aliases alias
                ON alias.alias = UPPER(TRIM(f.branch_code))
            LEFT JOIN branch br
                ON br.branch_code = COALESCE(
                    alias.branch_code,
                    CASE
                        WHEN TRIM(f.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(f.branch_code), 2, '0')
                        ELSE UPPER(TRIM(f.branch_code))
                    END
                )
            WHERE f.id = $1
              AND f.is_deleted = FALSE
            LIMIT 1`,
            [facultyId]
        );

        const faculty = facultyResult.rows[0];
        if (!faculty) {
            return res.status(404).json({ error: "Faculty not found" });
        }

        if (normalizeBranchCode(faculty.normalized_branch_code) !== hodBranch) {
            return res.status(403).json({ error: "Faculty is not part of your department" });
        }

        const experienceResult = await pool.query(
            `SELECT id, starting_month_year, ending_month_year, description
             FROM faculty_experience
             WHERE faculty_id = $1
             ORDER BY id DESC`,
            [facultyId]
        );

        const subjectsResult = await pool.query(
            `SELECT
                asf.id AS assignment_id,
                os.id AS offering_id,
                os.subject_code,
                s.name AS subject_name,
                os.accadmic_year,
                os.session,
                os.sem_number,
                asf.role,
                asf.division,
                asf.total_lectures
             FROM assigned_subject_faculty asf
             JOIN offered_subjects os ON os.id = asf.offering_id AND os.is_deleted = FALSE
             JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
             WHERE asf.faculty_id = $1
               AND asf.is_deleted = FALSE
             ORDER BY os.accadmic_year DESC, os.sem_number DESC, os.subject_code ASC, asf.division ASC`,
            [facultyId]
        );

        return res.status(200).json({
            faculty: {
                ...faculty,
                branch_code: faculty.normalized_branch_code
            },
            experience: experienceResult.rows,
            assigned_subjects: subjectsResult.rows
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const getBatchStudents = async (req, res) => {
    try {
        const hodId = req.user?.id;
        if (!hodId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const batchId = toInt(req.params?.batch_id);
        if (!batchId) {
            return res.status(400).json({ error: "batch_id is required" });
        }

        const hodBranch = await getHodBranchCode(hodId);
        if (!hodBranch) {
            return res.status(404).json({ error: "HOD branch not found" });
        }

        const batchResult = await pool.query(
            `WITH branch_aliases(alias, branch_code) AS (
                VALUES
                    ('AI', '52'), ('AUTO', '02'), ('BIO', '03'), ('CHEM', '05'),
                    ('CIVIL', '06'), ('CV', '06'), ('CE', '07'), ('ELE', '09'),
                    ('EC', '11'), ('ENV', '13'), ('IT', '16'), ('IC', '17'),
                    ('MECH', '19'), ('PLASTIC', '23'), ('RUBBER', '26'), ('TEXTILE', '29')
            )
            SELECT
                b.id AS batch_id,
                b.branch_code,
                b.enrolled_year,
                b.passing_year,
                COALESCE(b.batch_no, b.enrolled_year::TEXT || '-' || b.passing_year::TEXT) AS batch_no,
                b.course_id,
                c.name AS course_name,
                br.name AS branch_name,
                COALESCE(
                    alias.branch_code,
                    CASE
                        WHEN TRIM(b.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(b.branch_code), 2, '0')
                        ELSE UPPER(TRIM(b.branch_code))
                    END
                ) AS normalized_branch_code
            FROM batch b
            LEFT JOIN course c ON c.id = b.course_id
            LEFT JOIN branch_aliases alias
                ON alias.alias = UPPER(TRIM(b.branch_code))
            LEFT JOIN branch br
                ON br.branch_code = COALESCE(
                    alias.branch_code,
                    CASE
                        WHEN TRIM(b.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(b.branch_code), 2, '0')
                        ELSE UPPER(TRIM(b.branch_code))
                    END
                )
            WHERE b.id = $1
              AND b.is_deleted = FALSE
            LIMIT 1`,
            [batchId]
        );

        const batch = batchResult.rows[0];
        if (!batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        if (normalizeBranchCode(batch.normalized_branch_code) !== hodBranch) {
            return res.status(403).json({ error: "Batch is not part of your department" });
        }

        const studentsResult = await pool.query(
            `SELECT
                s.enrollment_no,
                s.name,
                s.email,
                s.current_division,
                b.enrolled_year,
                b.passing_year,
                COALESCE(b.batch_no, b.enrolled_year::TEXT || '-' || b.passing_year::TEXT) AS batch_no,
                b.branch_code
             FROM student s
             JOIN batch b ON b.id = s.batch_id
             WHERE s.is_deleted = FALSE
               AND s.batch_id = $1
             ORDER BY s.current_division ASC, s.name ASC, s.enrollment_no ASC`,
            [batchId]
        );

        return res.status(200).json({
            batch: {
                ...batch,
                branch_code: batch.normalized_branch_code,
                student_count: studentsResult.rowCount
            },
            students: studentsResult.rows
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const getBatchesList = async (req, res) => {
    try {
        const hodId = req.user?.id;
        if (!hodId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const hodBranch = await getHodBranchCode(hodId);

        if (!hodBranch) {
            return res.status(404).json({ error: "HOD branch not found" });
        }

        const batchQuery = [
            "WITH branch_aliases(alias, branch_code) AS (",
            "  VALUES",
            "    ('AI', '52'), ('AUTO', '02'), ('BIO', '03'), ('CHEM', '05'),",
            "    ('CIVIL', '06'), ('CV', '06'), ('CE', '07'), ('ELE', '09'),",
            "    ('EC', '11'), ('ENV', '13'), ('IT', '16'), ('IC', '17'),",
            "    ('MECH', '19'), ('PLASTIC', '23'), ('RUBBER', '26'), ('TEXTILE', '29')",
            ")",
            "SELECT b.id AS batch_id, b.enrolled_year, b.passing_year,",
            "       COALESCE(b.batch_no, b.enrolled_year::TEXT || '-' || b.passing_year::TEXT) AS batch_no,",
            "       b.course_id, b.branch_code,",
            "       c.name AS course_name, br.name AS branch_name",
            "FROM batch b",
            "LEFT JOIN course c ON c.id = b.course_id",
            "LEFT JOIN branch br ON br.branch_code = b.branch_code",
            "LEFT JOIN branch_aliases alias ON alias.alias = UPPER(TRIM(b.branch_code))",
            "WHERE ($1::VARCHAR IS NULL OR COALESCE(",
            "  alias.branch_code,",
            "  CASE",
            "    WHEN TRIM(b.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(b.branch_code), 2, '0')",
            "    ELSE UPPER(TRIM(b.branch_code))",
            "  END",
            ") = $1)",
            "AND b.is_deleted = FALSE",
            "ORDER BY b.enrolled_year DESC, b.id DESC"
        ].join("\n");

        const result = await pool.query(batchQuery, [hodBranch || null]);

        // Return only batches for this HOD's branch
        // Don't fallback to all batches - HOD should only see their department's batches
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAcademicYearsByBatch = async (req, res) => {
    try {
        const batchId = req.query?.batch_id;
        if (!batchId) {
            return res.status(400).json({ error: "batch_id is required" });
        }

        const result = await pool.query(
            `SELECT DISTINCT o.accadmic_year
             FROM offered_subjects o
             WHERE o.batch_id = $1
               AND o.is_deleted = FALSE
             ORDER BY o.accadmic_year DESC`,
            [batchId]
        );

        const academicYears = result.rows.map(r => r.accadmic_year);
        console.log(`[getAcademicYearsByBatch] Batch ${batchId}: Found ${academicYears.length} academic years:`, academicYears);
        res.status(200).json({ batch_id: batchId, academic_years: academicYears });
    } catch (err) {
        console.error("[getAcademicYearsByBatch] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getAcademicYearsForHod = async (req, res) => {
    try {
        const hodId = req.user?.id;
        if (!hodId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const hodBranch = await getHodBranchCode(hodId);
        if (!hodBranch) {
            return res.status(404).json({ error: "HOD branch not found" });
        }

        console.log(`[getAcademicYearsForHod] HOD ${hodId}, Branch: ${hodBranch}`);

        const result = await pool.query(
            `SELECT DISTINCT o.accadmic_year
             FROM offered_subjects o
             WHERE o.faculty_corrdinator_id = $1
               AND o.is_deleted = FALSE
             ORDER BY o.accadmic_year DESC`,
            [hodId]
        );

        const academicYears = result.rows.map(r => r.accadmic_year);
        console.log(`[getAcademicYearsForHod] HOD ${hodId} (${hodBranch}): Found ${academicYears.length} academic years:`, academicYears);

        // If no years found by coordinator, get years from branch (where batch_id is null for SH)
        if (academicYears.length === 0) {
            const branchResult = await pool.query(
                `SELECT DISTINCT o.accadmic_year
                 FROM offered_subjects o
                 LEFT JOIN batch b ON b.id = o.batch_id
                 WHERE (b.branch_code = $1 OR o.subject_type = 'MULTIDISCIPLINARY')
                   AND o.is_deleted = FALSE
                 ORDER BY o.accadmic_year DESC`,
                [hodBranch]
            );
            const branchYears = branchResult.rows.map(r => r.accadmic_year);
            console.log(`[getAcademicYearsForHod] Fallback: Found ${branchYears.length} academic years for branch ${hodBranch}:`, branchYears);
            if (branchYears.length > 0) {
                return res.status(200).json({ hod_id: hodId, academic_years: branchYears });
            }
        }

        res.status(200).json({ hod_id: hodId, academic_years: academicYears });
    } catch (err) {
        console.error("[getAcademicYearsForHod] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const assignSubjectByHod = async (req, res) => {
    const { faculty_id, subject_code, academic_year, course, division, session, role, batch_id } = req.body;
    const sem_number = 1;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const hodId = req.user?.id || 1;

        if (!batch_id) {
            return res.status(400).json({ error: "batch_id is required" });
        }

        let offeringResult = await client.query(
            `SELECT id FROM offered_subjects WHERE sem_number = $1 AND subject_code = $2 AND accadmic_year = $3 AND batch_id = $4`,
            [sem_number, subject_code, academic_year, batch_id]
        );

        let offering_id;
        if (offeringResult.rows.length === 0) {
            const newOffering = await client.query(
                `INSERT INTO offered_subjects (sem_number, faculty_corrdinator_id, accadmic_year, session, subject_code, batch_id) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [sem_number, hodId, academic_year, session, subject_code, batch_id]
            );
            offering_id = newOffering.rows[0].id;
        } else {
            offering_id = offeringResult.rows[0].id;
        }

        await client.query(
            `INSERT INTO assigned_subject_faculty (offering_id, faculty_id, role, division) VALUES ($1, $2, $3, $4)`,
            [offering_id, faculty_id, role, division]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: "Subject assigned successfully!" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Assignment Error:", error);

        if (error.code === '23505') {
            return res.status(400).json({ error: "This faculty is already assigned to this subject and division!" });
        }
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
};

module.exports = { getDepartmentFaculties, getSubjectsList, getFacultyDetails, getBatchStudents, getBatchesList, getAcademicYearsByBatch, getAcademicYearsForHod, assignSubjectByHod };
