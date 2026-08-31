const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const { pool } = require('../config/db/index.js');
const {
    insertFaculty,
    getStudentsList,
    getFacultyList,
    insertBulkStudents,
    getCoursesList,
    getDepartmentsList,
    getActiveBranchCount,
    getBatchesByBranch
} = require('../models/adminModel.js');
const {
    updateStudentPassword,
    updateFacultyPassword,
    findUserByIdentifier,
    findFacultyByIdentifier
} = require('../models/userModel.js');

const VALID_FACULTY_TYPES = new Set(['ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN']);

const normalizeTextCell = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const normalizeBranchCodeCell = (value) => {
    const branchCode = normalizeTextCell(value).toUpperCase();
    if (!branchCode) return "";
    return branchCode.split("").every((char) => char >= "0" && char <= "9") ? branchCode.padStart(2, "0") : branchCode;
};

const normalizeBranchLookupKey = (value) => normalizeBranchCodeCell(value);
const isLikelyBranchCode = (value) => /^[A-Z0-9]{1,20}$/.test(String(value || ''));

const normalizeDateCell = (value) => {
    if (!value) return null;

    if (typeof value === "number" && Number.isFinite(value)) {
        const parsed = xlsx.SSF.parse_date_code(value);
        if (parsed) {
            const year = String(parsed.y).padStart(4, "0");
            const month = String(parsed.m).padStart(2, "0");
            const day = String(parsed.d).padStart(2, "0");
            return year + "-" + month + "-" + day;
        }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    if (!text) return null;

    const isoMatch = text.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})/);
    if (isoMatch) {
        return isoMatch[1] + "-" + isoMatch[2].padStart(2, "0") + "-" + isoMatch[3].padStart(2, "0");
    }

    const indianMatch = text.match(/^([0-9]{1,2})[-/]([0-9]{1,2})[-/]([0-9]{4})/);
    if (indianMatch) {
        return indianMatch[3] + "-" + indianMatch[2].padStart(2, "0") + "-" + indianMatch[1].padStart(2, "0");
    }

    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
    }

    return null;
};

const getRowValue = (row, keys) => {
    const normalizeKey = (key) => String(key || '')
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const keyMap = new Map();
    for (const existingKey of Object.keys(row || {})) {
        keyMap.set(normalizeKey(existingKey), existingKey);
    }

    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
            return row[key];
        }

        const normalizedLookup = keyMap.get(normalizeKey(key));
        if (normalizedLookup !== undefined) {
            const value = row[normalizedLookup];
            if (value !== undefined && value !== null) {
                return value;
            }
        }
    }
    return '';
};

// 1. POST /create-faculty
const createFaculty = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, type, branch_code, email, college_email, password } = req.body;

        if (!name || !type || !email || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newFaculty = await insertFaculty(client, {
            name, type, branch_code, email, college_email, password: hashedPassword
        });

        if (!newFaculty) {
            return res.status(200).json({ message: "Faculty already exists. Duplicate row was skipped.", faculty: null });
        }

        res.status(201).json({ message: "Faculty created successfully", faculty: newFaculty });
    } catch (error) {
        console.error("Error creating faculty:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

// 2. GET /list
// Query Params: ?role=student&division=A&enrolled_year=2024&branch_code=CE&name=het
const listUsers = async (req, res) => {
    try {
        const { role, division, enrolled_year, branch_code, name } = req.query;

        if (!role) {
            return res.status(400).json({ message: "Role query parameter is required (e.g., student, ASSISTANT, HOD)" });
        }

        let users = [];
        if (role === 'student') {
            users = await getStudentsList({ division, enrolled_year, branch_code, name });
        } else {
            // For faculty types
            users = await getFacultyList({ role, branch_code, name });
        }

        res.status(200).json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// 2.1 GET /courses
const listCourses = async (req, res) => {
    try {
        const courses = await getCoursesList();
        res.status(200).json({ courses });
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// 2.2 GET /departments
const listDepartments = async (req, res) => {
    try {
        const departments = await getDepartmentsList();
        res.status(200).json({ departments });
    } catch (error) {
        console.error("Error fetching departments:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// 2.2.1 GET /branch-count
const getBranchCount = async (req, res) => {
    try {
        const count = await getActiveBranchCount();
        res.status(200).json({ count });
    } catch (error) {
        console.error("Error fetching branch count:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// 2.3 GET /batches?branch_code=CE
const listBatchesByBranch = async (req, res) => {
    try {
        const branchCode = String(req.query?.branch_code || '').trim();
        if (!branchCode) {
            return res.status(400).json({ message: "branch_code is required" });
        }

        const batches = await getBatchesByBranch(branchCode);
        res.status(200).json({ batches });
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// 3. PUT /reset-password OR /reset-password/:id (legacy)
// identifier can be: student enrollment_no, student email, faculty email, or legacy path param id
const resetPassword = async (req, res) => {
    try {
        const identifier = (req.body.identifier || req.body.email || req.params.id || '').trim();
        const { role } = req.body; // Need to know if we are resetting a student or faculty

        if (!role) {
            return res.status(400).json({ message: "Role is required in the body to identify user type" });
        }

        if (!identifier) {
            return res.status(400).json({ message: "Identifier is required to reset password" });
        }

        const defaultPassword = process.env.DEFAULT_PASSWORD || "LDCE@123";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        if (role === 'student') {
            const student = await findUserByIdentifier(identifier);
            if (!student || student.role !== 'student') {
                return res.status(404).json({ message: "Student not found for provided identifier" });
            }
            await updateStudentPassword(student.id, hashedPassword);
        } else {
            const faculty = await findFacultyByIdentifier(identifier);
            if (!faculty) {
                return res.status(404).json({ message: "Faculty not found for provided identifier" });
            }
            await updateFacultyPassword(faculty.id, hashedPassword);
        }

        res.status(200).json({
            message: `Password reset to default for ${identifier}`,
            defaultPassword
        });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const normalizeEnrollment = (value) => {
    if (value === undefined || value === null) return '';

    // Prefer raw numeric cell values from xlsx to avoid lossy formatted strings like 2.3028E+11.
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return '';
        return String(Math.trunc(value));
    }

    let text = String(value).trim();
    if (!text) return '';

    // For purely numeric values, drop trailing .0 that may come from spreadsheet formatting.
    if (/^\d+\.0+$/.test(text)) {
        text = text.split('.')[0];
    }

    return text;
};

const getImportErrorResponse = (error) => {
    if (error?.code === '23505') {
        return {
            status: 409,
            body: { message: "Duplicate enrollment number conflict. Import aborted." }
        };
    }

    if (error?.code === '23503') {
        return {
            status: 400,
            body: { message: "Invalid batch, branch, course, or related reference found during import." }
        };
    }

    if (['22P02', '22001', '22007', '23502'].includes(error?.code)) {
        return {
            status: 400,
            body: { message: "Uploaded file contains an invalid or missing value for a required field." }
        };
    }

    return {
        status: 500,
        body: { message: "Server error during import" }
    };
};

const buildBatchNo = (enrolledYear, passingYear) => {
    if (!Number.isFinite(enrolledYear) || !Number.isFinite(passingYear)) return null;
    return `${enrolledYear}-${passingYear}`;
};

// 4. POST /bulk-import (Students)
const bulkImportStudents = async (req, res) => {
    const client = await pool.connect();
    let txStarted = false;
    try {
        if (!req.file) return res.status(400).json({ message: "Excel file required" });
        const { batch_id, branch_code, enrolled_year, course_id } = req.body;
        const normalizedBranchCode = String(branch_code || '').trim() || null;

        // Parse file first so we can derive student count for newly created batches.
        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { raw: true, defval: '' });

        const studentsToInsert = [];
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const rawEnrollment = row.EnrollmentNo;
            const rawEnrollmentType = typeof rawEnrollment;
            const enrollmentNo = normalizeEnrollment(row.EnrollmentNo);
            const studentName = String(row.Name || '').trim();
            if (!enrollmentNo || !studentName) continue;

            const plainTextPassword = row.DefaultPassword ? String(row.DefaultPassword) : "LDCE@123";
            const hashedPassword = await bcrypt.hash(plainTextPassword, 10);
            const currentDivision = String(row.Division || "A").trim() || "A";

            if (enrollmentNo.length > 20) {
                return res.status(400).json({
                    message: `EnrollmentNo '${enrollmentNo}' on row ${index + 2} is too long. Maximum length is 20 characters.`
                });
            }

            if (studentName.length > 100) {
                return res.status(400).json({
                    message: `Name for enrollment '${enrollmentNo}' on row ${index + 2} is too long. Maximum length is 100 characters.`
                });
            }

            if (currentDivision.length > 5) {
                return res.status(400).json({
                    message: `Division '${currentDivision}' on row ${index + 2} is too long. Maximum length is 5 characters.`
                });
            }

            studentsToInsert.push({
                enrollment_no: enrollmentNo,
                name: studentName,
                current_division: currentDivision,
                password: hashedPassword,
                row_number: index + 2,
                raw_enrollment: rawEnrollment,
                raw_enrollment_type: rawEnrollmentType
            });
        }

        if (!studentsToInsert.length) {
            return res.status(400).json({ message: "No valid student rows found in uploaded file" });
        }

        const seenInFile = new Map();
        const duplicateInFile = [];
        for (const student of studentsToInsert) {
            const key = student.enrollment_no;
            if (seenInFile.has(key)) {
                const firstStudent = studentsToInsert.find((s) => s.enrollment_no === key);
                duplicateInFile.push({
                    enrollment_no: key,
                    first_row: seenInFile.get(key),
                    duplicate_row: student.row_number,
                    first_raw_enrollment_type: firstStudent?.raw_enrollment_type,
                    duplicate_raw_enrollment_type: student.raw_enrollment_type
                });
            } else {
                seenInFile.set(key, student.row_number);
            }
        }

        const uniqueStudentsToInsert = [];
        const seenEnrollmentNumbers = new Set();
        for (const student of studentsToInsert) {
            if (seenEnrollmentNumbers.has(student.enrollment_no)) {
                continue;
            }
            seenEnrollmentNumbers.add(student.enrollment_no);
            uniqueStudentsToInsert.push(student);
        }
        studentsToInsert.length = 0;
        studentsToInsert.push(...uniqueStudentsToInsert);

        const enrollmentNumbers = studentsToInsert.map((s) => s.enrollment_no);

        const existingStudents = await client.query(
            `SELECT enrollment_no
             FROM student
             WHERE enrollment_no = ANY($1::varchar[])
               AND is_deleted = FALSE`,
            [enrollmentNumbers]
        );

        const existingEnrollmentNumbers = new Set(existingStudents.rows.map((r) => r.enrollment_no));
        const skippedExistingStudents = existingEnrollmentNumbers.size;
        const skippedDuplicateRows = duplicateInFile.length;
        const newStudentsToInsert = studentsToInsert.filter((student) => !existingEnrollmentNumbers.has(student.enrollment_no));
        studentsToInsert.length = 0;
        studentsToInsert.push(...newStudentsToInsert);

        if (!studentsToInsert.length) {
            return res.status(200).json({
                message: "No new students imported. Duplicate rows were skipped.",
                imported_count: 0,
                skipped_existing: skippedExistingStudents,
                skipped_duplicate_rows: skippedDuplicateRows
            });
        }

        let resolvedBatchId = batch_id;
        let batchCreated = false;
        let resolvedBatchNo = null;

        // Preferred path: resolve/create batch from branch_code + course_id + enrolled_year.
        if (!resolvedBatchId) {
            if (!enrolled_year || !course_id) {
                return res.status(400).json({
                    message: "Provide either batch_id OR course_id + enrolled_year. Branch is required only for BE."
                });
            }

            const normalizedEnrolledYear = String(enrolled_year).trim();
            const normalizedCourseId = String(course_id).trim();

            if (!/^\d+$/.test(normalizedEnrolledYear) || !/^\d+$/.test(normalizedCourseId)) {
                return res.status(400).json({
                    message: "course_id and enrolled_year must be valid numbers"
                });
            }

            await client.query("BEGIN");
            txStarted = true;

            const courseExists = await client.query(
                `SELECT id, name, duration_years FROM course WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
                [normalizedCourseId]
            );

            if (courseExists.rowCount === 0) {
                return res.status(404).json({
                    message: `Course not found for course_id=${normalizedCourseId}`
                });
            }

            const courseName = String(courseExists.rows[0]?.name || "").trim().toUpperCase();
            const requiresBranch = courseName === "BE";

            if (requiresBranch && !normalizedBranchCode) {
                return res.status(400).json({
                    message: "Branch is required for BE student import."
                });
            }

            if (normalizedBranchCode) {
                const branchExists = await client.query(
                    `SELECT branch_code FROM branch WHERE branch_code = $1 AND is_deleted = FALSE LIMIT 1`,
                    [normalizedBranchCode]
                );

                if (branchExists.rowCount === 0) {
                    return res.status(404).json({
                        message: `Branch not found for branch_code=${normalizedBranchCode}`
                    });
                }
            }

            const durationYears = Number.parseInt(courseExists.rows[0]?.duration_years, 10);
            const parsedEnrolledYear = Number.parseInt(normalizedEnrolledYear, 10);
            const passingYear = Number.isFinite(durationYears) && Number.isFinite(parsedEnrolledYear)
                ? parsedEnrolledYear + durationYears
                : null;
            const batchNo = buildBatchNo(parsedEnrolledYear, passingYear);

            const batchLookup = await client.query(
                `SELECT id, batch_no, passing_year
                 FROM batch
                 WHERE branch_code IS NOT DISTINCT FROM $1
                   AND course_id = $2
                   AND enrolled_year = $3
                   AND is_deleted = FALSE
                 ORDER BY id DESC
                 LIMIT 1`,
                [normalizedBranchCode, normalizedCourseId, normalizedEnrolledYear]
            );

            if (batchLookup.rowCount === 0) {
                const createBatch = await client.query(
                    `INSERT INTO batch (branch_code, course_id, enrolled_year, passing_year, batch_no, number_of_students)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, batch_no`,
                    [normalizedBranchCode, normalizedCourseId, normalizedEnrolledYear, passingYear, batchNo, studentsToInsert.length]
                );
                resolvedBatchId = createBatch.rows[0].id;
                resolvedBatchNo = createBatch.rows[0].batch_no;
                batchCreated = true;
            } else {
                resolvedBatchId = batchLookup.rows[0].id;
                resolvedBatchNo = batchNo || batchLookup.rows[0].batch_no;
                if (passingYear || batchNo) {
                    await client.query(
                        `
                            UPDATE batch
                            SET
                                passing_year = COALESCE($2, passing_year),
                                batch_no = COALESCE($3, batch_no)
                            WHERE id = $1
                        `,
                        [resolvedBatchId, passingYear, batchNo]
                    );
                }
            }
        } else {
            await client.query("BEGIN");
            txStarted = true;
            const batchResult = await client.query(
                `SELECT COALESCE(batch_no, enrolled_year::TEXT || '-' || passing_year::TEXT) AS batch_no
                 FROM batch
                 WHERE id = $1
                   AND is_deleted = FALSE
                 LIMIT 1`,
                [resolvedBatchId]
            );
            resolvedBatchNo = batchResult.rows[0]?.batch_no || null;
        }

        const studentsWithBatch = studentsToInsert.map((student) => ({
            enrollment_no: student.enrollment_no,
            batch_id: resolvedBatchId,
            name: student.name,
            current_division: student.current_division,
            password: student.password
        }));

        await insertBulkStudents(client, studentsWithBatch);
        await client.query("COMMIT");

        res.status(201).json({
            message: `${studentsWithBatch.length} students imported successfully`,
            imported_count: studentsWithBatch.length,
            skipped_existing: skippedExistingStudents,
            skipped_duplicate_rows: skippedDuplicateRows,
            batch_id: resolvedBatchId,
            batch_no: resolvedBatchNo || null,
            batch_created: batchCreated
        });
    } catch (error) {
        if (txStarted) {
            await client.query("ROLLBACK").catch(() => {});
        }
        console.error(error);
        const response = getImportErrorResponse(error);

        if (process.env.NODE_ENV !== 'production') {
            response.body.error = error.message;
            response.body.code = error.code;
        }

        return res.status(response.status).json(response.body);
    } finally {
        client.release();
    }
};

// 5. POST /bulk-import-faculty
const bulkImportFaculty = async (req, res) => {
    const client = await pool.connect();
    let txStarted = false;
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file required' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { raw: true, defval: '' });

        const requestBranchCode = normalizeBranchLookupKey(req.body?.branch_code);

        const incomingBranchCandidates = [...new Set(
            rows
                .map((row) => getRowValue(row, ['BranchCode', 'Branch Code', 'branch_code', 'branchCode', 'branch code', 'Branch', 'Department', 'Dept']))
                .map((value) => normalizeBranchLookupKey(value || requestBranchCode))
                .filter(Boolean)
        )];

        const branchCodesToEnsure = incomingBranchCandidates.filter(isLikelyBranchCode);
        if (branchCodesToEnsure.length) {
            await client.query(
                `INSERT INTO branch (branch_code, name, logo_url, hod_id, created_at, is_deleted)
                 SELECT code, code, NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE
                 FROM UNNEST($1::varchar[]) AS code
                 ON CONFLICT (branch_code)
                 DO UPDATE SET is_deleted = FALSE`,
                [branchCodesToEnsure]
            );
        }

        const branchLookup = new Map();
        const branchResult = await client.query(
            `SELECT branch_code, name
             FROM branch
             WHERE is_deleted = FALSE`
        );

        for (const branch of branchResult.rows) {
            const code = normalizeTextCell(branch.branch_code);
            if (!code) continue;

            branchLookup.set(normalizeBranchLookupKey(code), code);

            const name = normalizeTextCell(branch.name);
            if (name) {
                branchLookup.set(normalizeBranchLookupKey(name), code);
            }
        }

        const facultyToInsert = [];
        const skippedBranchCodes = new Set();
        for (const row of rows) {
            const name = normalizeTextCell(getRowValue(row, ['Name', 'name']));
            const type = normalizeTextCell(getRowValue(row, ['Type', 'type'])).toUpperCase();
            const email = normalizeTextCell(getRowValue(row, ['Email', 'email']));

            if (!name || !type || !email) {
                continue;
            }

            if (!VALID_FACULTY_TYPES.has(type)) {
                return res.status(400).json({
                    message: `Invalid faculty type '${type}'. Allowed values are ASSISTANT, HOD, ASSOCIATE, ADMIN.`
                });
            }

            const originalBranchValue = getRowValue(row, ['BranchCode', 'Branch Code', 'branch_code', 'branchCode', 'branch code', 'Branch', 'Department', 'Dept']);

            facultyToInsert.push({
                name,
                type,
                branch_code: (() => {
                    const branchCodeKey = normalizeBranchLookupKey(originalBranchValue || requestBranchCode);
                    if (!branchCodeKey) return null;

                    const resolvedBranchCode = branchLookup.get(branchCodeKey);
                    if (resolvedBranchCode) return resolvedBranchCode;

                    skippedBranchCodes.add(normalizeTextCell(originalBranchValue || requestBranchCode));
                    return null;
                })(),
                mobile_no: normalizeTextCell(getRowValue(row, ['MobileNo', 'Mobile No', 'mobile_no', 'mobileNo', 'mobile'])) || null,
                email,
                college_email: normalizeTextCell(getRowValue(row, ['CollegeEmail', 'College Email', 'college_email', 'collegeEmail'])) || null,
                joining_date: normalizeDateCell(getRowValue(row, ['JoiningDate', 'Joining Date', 'joining_date', 'joiningDate'])),
                password: getRowValue(row, ['DefaultPassword', 'Default Password', 'default_password', 'defaultPassword'])
                    ? String(getRowValue(row, ['DefaultPassword', 'Default Password', 'default_password', 'defaultPassword']))
                    : (process.env.DEFAULT_PASSWORD || 'LDCE@123')
            });
        }

        if (!facultyToInsert.length) {
            return res.status(400).json({ message: 'No valid faculty rows found in uploaded file' });
        }

        const uniqueFacultyToInsert = [];
        const seenFacultyEmails = new Set();
        let skippedDuplicateRows = 0;
        for (const faculty of facultyToInsert) {
            const emailKey = faculty.email.toLowerCase();
            if (seenFacultyEmails.has(emailKey)) {
                skippedDuplicateRows += 1;
                continue;
            }
            seenFacultyEmails.add(emailKey);
            uniqueFacultyToInsert.push(faculty);
        }

        const existingFacultyResult = await client.query(
            `SELECT LOWER(email) AS email
             FROM faculty
             WHERE LOWER(email) = ANY($1::text[])
               AND is_deleted = FALSE`,
            [[...seenFacultyEmails]]
        );
        const existingFacultyEmails = new Set(existingFacultyResult.rows.map((row) => row.email));
        const skippedExisting = existingFacultyEmails.size;
        facultyToInsert.length = 0;
        facultyToInsert.push(...uniqueFacultyToInsert.filter((faculty) => !existingFacultyEmails.has(faculty.email.toLowerCase())));

        if (!facultyToInsert.length) {
            return res.status(200).json({
                message: 'No new faculty imported. Duplicate rows were skipped.',
                imported_count: 0,
                skipped_existing: skippedExisting,
                skipped_duplicate_rows: skippedDuplicateRows,
                warnings: skippedBranchCodes.size
                    ? [`Ignored unknown branch codes: ${[...skippedBranchCodes].join(', ')}`]
                    : []
            });
        }

        await client.query('BEGIN');
        txStarted = true;

        const createdFaculty = [];
        for (const faculty of facultyToInsert) {
            const hashedPassword = await bcrypt.hash(faculty.password, 10);
            const inserted = await insertFaculty(client, {
                ...faculty,
                password: hashedPassword
            });
            if (inserted) {
                createdFaculty.push(inserted);
            }
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message: `${createdFaculty.length} faculty members imported successfully`,
            imported_count: createdFaculty.length,
            skipped_existing: skippedExisting,
            skipped_duplicate_rows: skippedDuplicateRows,
            faculty: createdFaculty,
            warnings: skippedBranchCodes.size
                ? [`Ignored unknown branch codes: ${[...skippedBranchCodes].join(', ')}`]
                : []
        });
    } catch (error) {
        if (txStarted) {
            await client.query('ROLLBACK');
        }

        console.error('Error bulk importing faculty:', error);

        if (error?.code === '23503') {
            return res.status(400).json({
                message: 'Invalid branch code or related reference found in the uploaded faculty file.'
            });
        }

        if (['22P02', '22007', '22001'].includes(error?.code)) {
            return res.status(400).json({
                message: 'Uploaded faculty file contains an invalid value for a required field.'
            });
        }

        return res.status(500).json({ message: 'Server error during faculty import' });
    } finally {
        client.release();
    }
};

module.exports = {
    createFaculty,
    listUsers,
    listCourses,
    listDepartments,
    getBranchCount,
    listBatchesByBranch,
    resetPassword,
    bulkImportStudents,
    bulkImportFaculty
};
