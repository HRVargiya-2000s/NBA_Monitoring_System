const { pool } = require("../config/db/index.js");

const getAcademicYearVariants = (value) => {
  const text = String(value || "").trim();
  if (!text) return [];

  const variants = new Set([text]);
  const parts = text.split("-").map((part) => part.trim());

  // e.g. "2023" -> ["2023", "2023-24", "2023-2024"]
  if (parts.length === 1 && text.length === 4) {
    const start = Number.parseInt(text, 10);
    if (Number.isFinite(start)) {
      variants.add(text + "-" + String((start + 1) % 100).padStart(2, "0"));
      variants.add(text + "-" + String(start + 1));
    }
  }

  // e.g. "2023-24" -> ["2023-24", "2023-2024", "2023"]
  if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 2) {
    variants.add(parts[0] + "-20" + parts[1]);
    variants.add(parts[0]);
  }

  // e.g. "2023-2024" -> ["2023-2024", "2023-24", "2023"]
  if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4) {
    variants.add(parts[0] + "-" + parts[1].slice(-2));
    variants.add(parts[0]);
  }

  return [...variants];
};

const createSubjectRow = async (client, payload) => {
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS session VARCHAR(10)`);
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_file_name VARCHAR(255)`);
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_text TEXT`);

  const result = await client.query(
    `
      INSERT INTO subject (subject_code, name, syllabus_url, session, created_at, is_deleted)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, FALSE)
      RETURNING id, subject_code, name, syllabus_url, session, syllabus_file_name
    `,
    [payload.subject_code, payload.name, payload.syllabus_url || null, payload.session || null]
  );

  return result.rows[0];
};

const updateSubjectRow = async (client, subjectCode, payload) => {
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS session VARCHAR(10)`);
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_file_name VARCHAR(255)`);
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_text TEXT`);

  const result = await client.query(
    `
      UPDATE subject
      SET name = COALESCE($2, name),
          syllabus_url = COALESCE($3, syllabus_url),
          session = COALESCE($4, session)
      WHERE subject_code = $1
        AND is_deleted = FALSE
      RETURNING id, subject_code, name, syllabus_url, session, syllabus_file_name
    `,
    [subjectCode, payload.name || null, payload.syllabus_url || null, payload.session || null]
  );

  return result.rows[0] || null;
};

const updateSubjectSyllabusRow = async (client, subjectCode, payload) => {
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_file_name VARCHAR(255)`);
  await client.query(`ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_text TEXT`);

  const result = await client.query(
    `
      UPDATE subject
      SET syllabus_url = COALESCE($2, syllabus_url),
          syllabus_file_name = $3,
          syllabus_text = $4
      WHERE subject_code = $1
        AND is_deleted = FALSE
      RETURNING id, subject_code, name, syllabus_url, session, syllabus_file_name
    `,
    [subjectCode, payload.syllabus_url || null, payload.syllabus_file_name || null, payload.syllabus_text || null]
  );

  return result.rows[0] || null;
};

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

const normalizeBranchCodes = (values) => {
  const rawValues = Array.isArray(values) ? values : [];
  return [...new Set(rawValues.map(normalizeBranchCode).filter(Boolean))];
};

const syncSubjectTeachingBranches = async (client, subjectCode, branchCodes = []) => {
  const normalizedBranchCodes = normalizeBranchCodes(branchCodes);

  await client.query(
    `
      UPDATE subject_teaching_branch
      SET is_deleted = TRUE
      WHERE subject_code = $1
        AND is_deleted = FALSE
    `,
    [subjectCode]
  );

  if (!normalizedBranchCodes.length) {
    return [];
  }

  const result = await client.query(
    `
      INSERT INTO subject_teaching_branch (subject_code, branch_code, created_at, is_deleted)
      SELECT $1, branch_code, CURRENT_TIMESTAMP, FALSE
      FROM unnest($2::VARCHAR[]) AS branch_code
      ON CONFLICT (subject_code, branch_code) WHERE is_deleted = FALSE
      DO UPDATE SET is_deleted = FALSE
      RETURNING branch_code
    `,
    [subjectCode, normalizedBranchCodes]
  );

  return result.rows.map((row) => row.branch_code);
};

const getEligibleFacultiesForOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      WITH branch_aliases(alias, branch_code) AS (
        VALUES
          ('AI', '52'),
          ('AUTO', '02'),
          ('BIO', '03'),
          ('CHEM', '05'),
          ('CIVIL', '06'),
          ('CV', '06'),
          ('CE', '07'),
          ('ELE', '09'),
          ('EC', '11'),
          ('ENV', '13'),
          ('IT', '16'),
          ('IC', '17'),
          ('MECH', '19'),
          ('PLASTIC', '23'),
          ('RUBBER', '26'),
          ('TEXTILE', '29')
      ),
      offering_context AS (
        SELECT
          o.id AS offering_id,
          o.subject_code,
          COALESCE(
            owner_alias.branch_code,
            CASE
              WHEN TRIM(COALESCE(b.branch_code, fc.branch_code)) ~ '^[0-9]+$'
                THEN LPAD(TRIM(COALESCE(b.branch_code, fc.branch_code)), 2, '0')
              ELSE UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code)))
            END
          ) AS owner_branch_code
        FROM offered_subjects o
        LEFT JOIN batch b ON b.id = o.batch_id AND b.is_deleted = FALSE
        LEFT JOIN faculty fc ON fc.id = o.faculty_corrdinator_id AND fc.is_deleted = FALSE
        LEFT JOIN branch_aliases owner_alias
          ON owner_alias.alias = UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code)))
        WHERE o.id = $1
          AND o.is_deleted = FALSE
        LIMIT 1
      ),
      mapped_branches AS (
        SELECT DISTINCT
          COALESCE(
            map_alias.branch_code,
            CASE
              WHEN TRIM(stb.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(stb.branch_code), 2, '0')
              ELSE UPPER(TRIM(stb.branch_code))
            END
          ) AS branch_code
        FROM subject_teaching_branch stb
        JOIN offering_context oc ON oc.subject_code = stb.subject_code
        LEFT JOIN branch_aliases map_alias
          ON map_alias.alias = UPPER(TRIM(stb.branch_code))
        WHERE stb.is_deleted = FALSE
      ),
      eligible_branches AS (
        SELECT branch_code, TRUE AS has_subject_mapping
        FROM mapped_branches
        UNION ALL
        SELECT owner_branch_code, FALSE AS has_subject_mapping
        FROM offering_context
        WHERE NOT EXISTS (SELECT 1 FROM mapped_branches)
          AND owner_branch_code IS NOT NULL
        UNION ALL
        SELECT target_branch_code AS branch_code, FALSE AS has_subject_mapping
        FROM faculty_assignment_request
        WHERE offering_id = $1 AND is_deleted = FALSE
      ),
      normalized_faculty AS (
        SELECT
          f.*,
          COALESCE(
            faculty_alias.branch_code,
            CASE
              WHEN TRIM(f.branch_code) ~ '^[0-9]+$' THEN LPAD(TRIM(f.branch_code), 2, '0')
              ELSE UPPER(TRIM(f.branch_code))
            END
          ) AS normalized_branch_code
        FROM faculty f
        LEFT JOIN branch_aliases faculty_alias
          ON faculty_alias.alias = UPPER(TRIM(f.branch_code))
      )
      SELECT
        f.id,
        f.name,
        f.type,
        f.branch_code,
        br.name AS branch_name,
        BOOL_OR(eb.has_subject_mapping) AS has_subject_mapping
      FROM eligible_branches eb
      JOIN normalized_faculty f ON f.normalized_branch_code = eb.branch_code
      LEFT JOIN branch br ON br.branch_code = f.normalized_branch_code
      WHERE f.is_deleted = FALSE
        AND f.type IN ('ASSISTANT', 'HOD', 'ASSOCIATE')
      GROUP BY f.id, f.name, f.type, f.branch_code, br.name
      ORDER BY f.branch_code, f.type, f.name
    `,
    [offeringId]
  );

  return result.rows;
};

const isFacultyEligibleForOffering = async (client, offeringId, facultyId) => {
  const rows = await getEligibleFacultiesForOffering(client, offeringId);
  return rows.some((row) => Number(row.id) === Number(facultyId));
};

const createOfferedSubjectRow = async (client, payload) => {
  const result = await client.query(
    `
      INSERT INTO offered_subjects
        (sem_number, faculty_corrdinator_id, accadmic_year, session, subject_code, batch_id, number_of_lectures, include_pso, created_at, is_deleted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, FALSE)
      RETURNING id AS offering_id, sem_number, faculty_corrdinator_id, accadmic_year, session, subject_code, batch_id, number_of_lectures, include_pso
    `,
    [
      payload.sem_number,
      payload.faculty_corrdinator_id,
      payload.accadmic_year,
      payload.session,
      payload.subject_code,
      payload.batch_id || null,
      payload.number_of_lectures || null,
      typeof payload.include_pso === "boolean" ? payload.include_pso : true
    ]
  );

  return result.rows[0];
};

const mapBatchStudentsToOffering = async (client, offeringId, batchId) => {
  if (!offeringId || !batchId) {
    return 0;
  }

  const result = await client.query(
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
      RETURNING enrollment_no
    `,
    [offeringId, batchId]
  );

  return result.rowCount;
};

const backfillOfferingStudentsFromBatch = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT batch_id
      FROM offered_subjects
      WHERE id = $1
        AND is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );

  const batchId = result.rows[0]?.batch_id;
  if (!batchId) {
    return 0;
  }

  return mapBatchStudentsToOffering(client, offeringId, batchId);
};

const updateOfferedSubjectRow = async (client, offeringId, payload) => {
  const result = await client.query(
    `
      UPDATE offered_subjects
      SET sem_number = COALESCE($2, sem_number),
          faculty_corrdinator_id = COALESCE($3, faculty_corrdinator_id),
          accadmic_year = COALESCE($4, accadmic_year),
          session = COALESCE($5, session),
          subject_code = COALESCE($6, subject_code),
          batch_id = COALESCE($7, batch_id),
          number_of_lectures = COALESCE($8, number_of_lectures),
          include_pso = COALESCE($9, include_pso)
      WHERE id = $1
        AND is_deleted = FALSE
      RETURNING id AS offering_id, sem_number, faculty_corrdinator_id, accadmic_year, session, subject_code, batch_id, number_of_lectures, include_pso
    `,
    [
      offeringId,
      payload.sem_number || null,
      payload.faculty_corrdinator_id || null,
      payload.accadmic_year || null,
      payload.session || null,
      payload.subject_code || null,
      payload.batch_id || null,
      payload.number_of_lectures || null,
      typeof payload.include_pso === "boolean" ? payload.include_pso : null
    ]
  );

  return result.rows[0] || null;
};

const createAssignedSubjectFacultyRow = async (client, payload) => {
  const result = await client.query(
    `
      INSERT INTO assigned_subject_faculty
        (offering_id, faculty_id, role, division, total_lectures, created_at, is_deleted)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, FALSE)
      RETURNING id, offering_id, faculty_id, role, division, total_lectures
    `,
    [
      payload.offering_id,
      payload.faculty_id,
      payload.role,
      payload.division,
      payload.total_lectures || null
    ]
  );

  return result.rows[0];
};

const updateAssignedSubjectFacultyRow = async (client, assignmentId, payload) => {
  const result = await client.query(
    `
      UPDATE assigned_subject_faculty
      SET offering_id = COALESCE($2, offering_id),
          faculty_id = COALESCE($3, faculty_id),
          role = COALESCE($4, role),
          division = COALESCE($5, division),
          total_lectures = COALESCE($6, total_lectures)
      WHERE id = $1
        AND is_deleted = FALSE
      RETURNING id, offering_id, faculty_id, role, division, total_lectures
    `,
    [
      assignmentId,
      payload.offering_id || null,
      payload.faculty_id || null,
      payload.role || null,
      payload.division || null,
      payload.total_lectures || null
    ]
  );

  return result.rows[0] || null;
};

const getFacultyBranchCodeById = async (client, facultyId) => {
  const result = await client.query(
    `
      SELECT COALESCE(f.branch_code, hb.branch_code) AS branch_code
      FROM faculty f
      LEFT JOIN branch hb
        ON hb.hod_id = f.id
       AND hb.is_deleted = FALSE
      WHERE f.id = $1
        AND f.is_deleted = FALSE
      LIMIT 1
    `,
    [facultyId]
  );

  return result.rows[0]?.branch_code || null;
};

const getOfferingFacultyRequestContext = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        os.id AS offering_id,
        os.subject_code,
        s.name AS subject_name,
        COALESCE(b.branch_code, fc.branch_code) AS owner_branch_code,
        os.faculty_corrdinator_id
      FROM offered_subjects os
      JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
      LEFT JOIN batch b ON b.id = os.batch_id AND b.is_deleted = FALSE
      LEFT JOIN faculty fc ON fc.id = os.faculty_corrdinator_id AND fc.is_deleted = FALSE
      WHERE os.id = $1
        AND os.is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );

  return result.rows[0] || null;
};

const getFacultyAssignmentRequestsForHod = async (client, hodId, hodBranchCode) => {
  const result = await client.query(
    `
      SELECT
        far.id AS request_id,
        far.offering_id,
        far.requesting_hod_id,
        rh.name AS requesting_hod_name,
        far.target_branch_code,
        target_branch.name AS target_branch_name,
        far.status,
        far.assigned_faculty_id,
        af.name AS assigned_faculty_name,
        far.handled_by_hod_id,
        far.role,
        far.division,
        far.total_lectures,
        far.note,
        far.created_at,
        far.updated_at,
        CASE
          WHEN far.requesting_hod_id = $1 THEN 'OUTGOING'
          WHEN far.target_branch_code = $2 THEN 'INCOMING'
          ELSE 'OTHER'
        END AS direction,
        os.subject_code,
        s.name AS subject_name,
        os.sem_number,
        os.accadmic_year,
        os.session
      FROM faculty_assignment_request far
      JOIN offered_subjects os ON os.id = far.offering_id AND os.is_deleted = FALSE
      JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
      JOIN faculty rh ON rh.id = far.requesting_hod_id AND rh.is_deleted = FALSE
      LEFT JOIN branch target_branch ON target_branch.branch_code = far.target_branch_code
      LEFT JOIN faculty af ON af.id = far.assigned_faculty_id AND af.is_deleted = FALSE
      WHERE far.is_deleted = FALSE
        AND (far.requesting_hod_id = $1 OR far.target_branch_code = $2)
      ORDER BY far.created_at DESC, far.id DESC
    `,
    [hodId, hodBranchCode]
  );

  return result.rows;
};

const createFacultyAssignmentRequestRow = async (client, payload) => {
  const result = await client.query(
    `
      INSERT INTO faculty_assignment_request
        (offering_id, requesting_hod_id, target_branch_code, role, division, total_lectures, note, created_at, updated_at, is_deleted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE)
      ON CONFLICT (offering_id, target_branch_code, division)
      WHERE is_deleted = FALSE AND status = 'PENDING'
      DO UPDATE SET
        role = EXCLUDED.role,
        total_lectures = EXCLUDED.total_lectures,
        note = EXCLUDED.note,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id AS request_id, offering_id, requesting_hod_id, target_branch_code, status, role, division, total_lectures, note
    `,
    [
      payload.offering_id,
      payload.requesting_hod_id,
      payload.target_branch_code,
      payload.role,
      payload.division,
      payload.total_lectures || null,
      payload.note || null
    ]
  );

  return result.rows[0];
};

const getFacultyAssignmentRequestById = async (client, requestId) => {
  const result = await client.query(
    `
      SELECT
        far.*,
        os.faculty_corrdinator_id
      FROM faculty_assignment_request far
      JOIN offered_subjects os ON os.id = far.offering_id AND os.is_deleted = FALSE
      WHERE far.id = $1
        AND far.is_deleted = FALSE
      LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
};

const approveFacultyAssignmentRequestRow = async (client, requestId, payload) => {
  const result = await client.query(
    `
      UPDATE faculty_assignment_request
      SET status = 'APPROVED',
          assigned_faculty_id = $2,
          handled_by_hod_id = $3,
          role = COALESCE($4, role),
          division = COALESCE($5, division),
          total_lectures = COALESCE($6, total_lectures),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_deleted = FALSE
      RETURNING id AS request_id, offering_id, requesting_hod_id, target_branch_code, status, assigned_faculty_id, handled_by_hod_id, role, division, total_lectures
    `,
    [requestId, payload.assigned_faculty_id, payload.handled_by_hod_id, payload.role || null, payload.division || null, payload.total_lectures || null]
  );

  return result.rows[0] || null;
};

const getOfferedSubjectsByYearSession = async (client, accadmicYear, session, options = {}) => {
  const { branchCode = null, coordinatorId = null } = options;

  const result = await client.query(
    `
      WITH branch_aliases(alias, branch_code) AS (
        VALUES
          ('AI', '52'),
          ('AUTO', '02'),
          ('BIO', '03'),
          ('CHEM', '05'),
          ('CIVIL', '06'),
          ('CV', '06'),
          ('CE', '07'),
          ('ELE', '09'),
          ('EC', '11'),
          ('ENV', '13'),
          ('IT', '16'),
          ('IC', '17'),
          ('MECH', '19'),
          ('PLASTIC', '23'),
          ('RUBBER', '26'),
          ('TEXTILE', '29')
      )
      SELECT
        o.id AS offering_id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        o.subject_code,
        o.batch_id,
        o.include_pso,
        s.name AS subject_name,
        COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code) AS branch_code,
        o.faculty_corrdinator_id,
        fc.name AS faculty_coordinator_name,
        COALESCE(fc.branch_code, hb_coord.branch_code) AS faculty_coordinator_branch_code,
        o.number_of_lectures,
        asf.id AS assignment_id,
        asf.faculty_id AS assigned_faculty_id,
        af.name AS assigned_faculty_name,
        asf.role,
        asf.division,
        asf.total_lectures
      FROM offered_subjects o
      JOIN subject s ON s.subject_code = o.subject_code
      LEFT JOIN batch b ON b.id = o.batch_id AND b.is_deleted = FALSE
      LEFT JOIN faculty fc ON fc.id = o.faculty_corrdinator_id
      LEFT JOIN branch hb_coord ON hb_coord.hod_id = fc.id AND hb_coord.is_deleted = FALSE
      LEFT JOIN branch_aliases owner_alias
        ON owner_alias.alias = UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)))
      LEFT JOIN assigned_subject_faculty asf ON asf.offering_id = o.id AND asf.is_deleted = FALSE
      LEFT JOIN faculty af ON af.id = asf.faculty_id
      WHERE o.accadmic_year = ANY($1::VARCHAR[])
        AND LOWER(o.session) = LOWER($2)
        AND (
          $3::VARCHAR IS NULL OR
          o.faculty_corrdinator_id = $4 OR
          COALESCE(
            owner_alias.branch_code,
            CASE
              WHEN TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)) ~ '^[0-9]+$'
                THEN LPAD(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)), 2, '0')
              ELSE UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)))
            END
          ) = $3
        )
        AND o.is_deleted = FALSE
        AND s.is_deleted = FALSE
      ORDER BY o.sem_number, o.subject_code, asf.division
    `,
    [getAcademicYearVariants(accadmicYear), session, branchCode, coordinatorId]
  );

  console.log(`[getOfferedSubjectsByYearSession] Query filter: accadmicYear=${accadmicYear}, session=${session}, branchCode=${branchCode}, coordinatorId=${coordinatorId} → Found ${result.rows.length} offerings`);
  if (result.rows.length > 0) {
    console.log(`  Offerings: ${result.rows.map(r => `ID:${r.offering_id} Code:${r.subject_code} Batch:${r.batch_id || 'NULL'} Coord:${r.faculty_coordinator_name}`).join(', ')}`);
  }

  return result.rows;
};

const getFacultyAssignedSubjects = async (facultyId) => {
    const query = `
        SELECT
      os.id          AS offering_id,
            s.name         AS subject_name,
            s.subject_code,
            s.syllabus_url,
            s.syllabus_file_name,
            os.accadmic_year,
            os.session,
            os.sem_number,
            os.include_pso,
            asf.role       AS teaching_role,
            asf.division,
            asf.total_lectures,
            COALESCE(b.branch_code, fc.branch_code) AS branch_code
        FROM assigned_subject_faculty asf
        JOIN offered_subjects os ON asf.offering_id = os.id
        JOIN subject s           ON os.subject_code  = s.subject_code
        LEFT JOIN batch b        ON b.id = os.batch_id
        LEFT JOIN faculty fc     ON fc.id = os.faculty_corrdinator_id
        WHERE asf.faculty_id = $1
          AND asf.is_deleted  = FALSE
          AND os.is_deleted   = FALSE
        ORDER BY os.accadmic_year DESC, os.sem_number ASC
    `;
    const { rows } = await pool.query(query, [facultyId]);
    return rows;
};

const getAssignmentsByOfferingId = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        asf.id AS assignment_id,
        asf.offering_id,
        asf.faculty_id,
        f.name AS faculty_name,
        f.email AS faculty_email,
        asf.role,
        asf.division,
        asf.total_lectures,
        os.accadmic_year,
        os.session,
        os.sem_number,
        os.subject_code,
        s.name AS subject_name
      FROM assigned_subject_faculty asf
      JOIN offered_subjects os ON os.id = asf.offering_id AND os.is_deleted = FALSE
      JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
      JOIN faculty f ON f.id = asf.faculty_id AND f.is_deleted = FALSE
      WHERE asf.offering_id = $1
        AND asf.is_deleted = FALSE
      ORDER BY
        CASE LOWER(asf.role)
          WHEN 'coordinator' THEN 1
          WHEN 'assistant' THEN 2
          WHEN 'lab assistant' THEN 3
          ELSE 4
        END,
        asf.division,
        f.name
    `,
    [offeringId]
  );

  return result.rows;
};

const getOfferingCoordinatorIdByOfferingId = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT faculty_corrdinator_id
      FROM offered_subjects
      WHERE id = $1
        AND is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );

  return result.rows[0]?.faculty_corrdinator_id || null;
};

const getStudentBatchMap = async (client, enrollmentNos) => {
  if (!enrollmentNos.length) {
    return [];
  }

  const enrollmentKeys = enrollmentNos.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);

  const result = await client.query(
    `
      SELECT s.enrollment_no, s.batch_id, b.branch_code
      FROM student s
      LEFT JOIN batch b ON b.id = s.batch_id
      WHERE LOWER(TRIM(s.enrollment_no)) = ANY($1::VARCHAR[])
        AND s.is_deleted = FALSE
    `,
    [enrollmentKeys]
  );

  return result.rows;
};

const getOfferingsByYearSessionAndSubjects = async (client, accadmicYear, session, subjectCodes) => {
  if (!subjectCodes.length) {
    return [];
  }

  const subjectCodeKeys = subjectCodes.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);

  const result = await client.query(
    `
      WITH branch_aliases(alias, branch_code) AS (
        VALUES
          ('AI', '52'),
          ('AUTO', '02'),
          ('BIO', '03'),
          ('CHEM', '05'),
          ('CIVIL', '06'),
          ('CV', '06'),
          ('CE', '07'),
          ('ELE', '09'),
          ('EC', '11'),
          ('ENV', '13'),
          ('IT', '16'),
          ('IC', '17'),
          ('MECH', '19'),
          ('PLASTIC', '23'),
          ('RUBBER', '26'),
          ('TEXTILE', '29')
      )
      SELECT DISTINCT ON (os.subject_code, owner_branch_code)
        os.id AS offering_id,
        os.subject_code,
        os.accadmic_year,
        os.session,
        os.sem_number,
        owner_branch_code AS coordinator_branch_code
      FROM offered_subjects os
      LEFT JOIN batch b ON b.id = os.batch_id AND b.is_deleted = FALSE
      LEFT JOIN faculty fc ON fc.id = os.faculty_corrdinator_id AND fc.is_deleted = FALSE
      LEFT JOIN branch hb_coord ON hb_coord.hod_id = fc.id AND hb_coord.is_deleted = FALSE
      LEFT JOIN branch_aliases owner_alias
        ON owner_alias.alias = UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)))
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          owner_alias.branch_code,
          CASE
            WHEN TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)) ~ '^[0-9]+$'
              THEN LPAD(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)), 2, '0')
            ELSE UPPER(TRIM(COALESCE(b.branch_code, fc.branch_code, hb_coord.branch_code)))
          END
        ) AS owner_branch_code
      ) owner
      WHERE os.accadmic_year = ANY($1::VARCHAR[])
        AND LOWER(os.session) = LOWER($2)
        AND UPPER(TRIM(os.subject_code)) = ANY($3::VARCHAR[])
        AND os.is_deleted = FALSE
        AND owner_branch_code IS NOT NULL
        AND owner_branch_code <> ''
      ORDER BY os.subject_code, owner_branch_code, os.id DESC
    `,
    [getAcademicYearVariants(accadmicYear), session, subjectCodeKeys]
  );

  return result.rows;
};

const bulkSyncStudentOfferingSubjects = async (client, rows) => {
  if (!rows.length) {
    return 0;
  }

  const enrollmentNos = [...new Set(rows.map((row) => row.enrollment_no))];
  const offeringIds = [...new Set(rows.map((row) => row.offering_id))];

  await client.query(
    `
      UPDATE student_offering_subject
      SET is_deleted = TRUE
      WHERE enrollment_no = ANY($1::VARCHAR[])
        AND offering_id = ANY($2::INT[])
        AND is_deleted = FALSE
    `,
    [enrollmentNos, offeringIds]
  );

  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 2;
    values.push(row.enrollment_no, row.offering_id);
    return `($${base + 1}, $${base + 2}, CURRENT_TIMESTAMP, FALSE)`;
  });

  const query = `
    INSERT INTO student_offering_subject (enrollment_no, offering_id, created_at, is_deleted)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (enrollment_no, offering_id)
    DO UPDATE SET
      is_deleted = FALSE,
      created_at = EXCLUDED.created_at
  `;

  await client.query(query, values);
  return rows.length;
};

const syncStudentOfferingSubjectsByOffering = async (client, offeringId) => {
  await client.query(
    `
      UPDATE student_offering_subject
      SET is_deleted = TRUE
      WHERE offering_id = $1
        AND is_deleted = FALSE
    `,
    [offeringId]
  );
};

const getCurrentSubjectsForStudent = async (enrollmentNo) => {
    const query = `
      WITH mapped_offerings AS (
        SELECT
          sos.enrollment_no,
          sos.offering_id,
          os.accadmic_year,
          os.session,
          os.sem_number
        FROM student_offering_subject sos
        JOIN offered_subjects os ON os.id = sos.offering_id
        WHERE sos.enrollment_no = $1
          AND sos.is_deleted = FALSE
          AND os.is_deleted = FALSE
      ),
      current_offering_window AS (
        SELECT
          accadmic_year,
          session,
          sem_number
        FROM mapped_offerings
        ORDER BY
          accadmic_year DESC,
          CASE WHEN LOWER(session) = 'even' THEN 2 ELSE 1 END DESC,
          sem_number DESC
        LIMIT 1
      )
      SELECT
        mo.enrollment_no,
        os.id AS offering_id,
        os.accadmic_year,
        os.session,
        os.sem_number,
        os.subject_code,
        sub.name AS subject_name,
        os.number_of_lectures,
        os.faculty_corrdinator_id,
        fc.name AS faculty_coordinator_name
      FROM mapped_offerings mo
      JOIN current_offering_window cow
        ON mo.accadmic_year = cow.accadmic_year
       AND mo.session = cow.session
       AND mo.sem_number = cow.sem_number
      JOIN offered_subjects os ON os.id = mo.offering_id AND os.is_deleted = FALSE
      JOIN subject sub ON sub.subject_code = os.subject_code AND sub.is_deleted = FALSE
      JOIN student s ON s.enrollment_no = mo.enrollment_no AND s.is_deleted = FALSE
      LEFT JOIN batch b ON b.id = s.batch_id
      LEFT JOIN branch br ON br.branch_code = b.branch_code
      LEFT JOIN faculty fc ON fc.id = os.faculty_corrdinator_id
      ORDER BY os.subject_code ASC
    `;

    const { rows } = await pool.query(query, [enrollmentNo]);
    return rows;
  };

const getAllSubjectsForStudent = async (enrollmentNo) => {
  const query = `
    SELECT
      os.id AS offering_id,
      os.accadmic_year,
      os.session,
      os.sem_number,
      os.subject_code,
      s.name AS subject_name,
      os.number_of_lectures,
      os.faculty_corrdinator_id,
      fc.name AS faculty_coordinator_name
    FROM student_offering_subject sos
    JOIN offered_subjects os ON os.id = sos.offering_id AND os.is_deleted = FALSE
    JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
    LEFT JOIN faculty fc ON fc.id = os.faculty_corrdinator_id
    WHERE sos.enrollment_no = $1
      AND sos.is_deleted = FALSE
    ORDER BY os.accadmic_year DESC, os.sem_number DESC, os.subject_code ASC
  `;

  const { rows } = await pool.query(query, [enrollmentNo]);
  return rows;
};

module.exports = {
  createSubjectRow,
  updateSubjectRow,
  updateSubjectSyllabusRow,
  syncSubjectTeachingBranches,
  getEligibleFacultiesForOffering,
  isFacultyEligibleForOffering,
  normalizeBranchCode,
  getAcademicYearVariants,
  getOfferingFacultyRequestContext,
  getFacultyAssignmentRequestsForHod,
  createFacultyAssignmentRequestRow,
  getFacultyAssignmentRequestById,
  approveFacultyAssignmentRequestRow,
  createOfferedSubjectRow,
  mapBatchStudentsToOffering,
  backfillOfferingStudentsFromBatch,
  updateOfferedSubjectRow,
  createAssignedSubjectFacultyRow,
  updateAssignedSubjectFacultyRow,
  getFacultyBranchCodeById,
  getOfferedSubjectsByYearSession,
  getFacultyAssignedSubjects,
  getAssignmentsByOfferingId,
  getOfferingCoordinatorIdByOfferingId,
  syncStudentOfferingSubjectsByOffering,
  getStudentBatchMap,
  getOfferingsByYearSessionAndSubjects,
  bulkSyncStudentOfferingSubjects,
  getCurrentSubjectsForStudent,
  getAllSubjectsForStudent
};
