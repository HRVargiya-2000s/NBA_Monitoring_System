DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faculty_type') THEN
        CREATE TYPE faculty_type AS ENUM ('ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_type_enum') THEN
        CREATE TYPE exam_type_enum AS ENUM ('internal', 'external', 'mid_sem', 'viva');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outcome_type_enum') THEN
        CREATE TYPE outcome_type_enum AS ENUM ('PO', 'PSO');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'overall_attainment_type_enum') THEN
        CREATE TYPE overall_attainment_type_enum AS ENUM ('internal', 'external', 'total');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attainment_component_enum') THEN
        CREATE TYPE attainment_component_enum AS ENUM ('mid_sem', 'internal', 'external', 'viva');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_type_enum') THEN
        CREATE TYPE person_type_enum AS ENUM ('student', 'faculty');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type_enum') THEN
        CREATE TYPE subject_type_enum AS ENUM ('DISCIPLINARY', 'MULTIDISCIPLINARY');
    END IF;
END $$;

-- ===========================
-- CORE ACADEMIC STRUCTURE
-- ===========================

CREATE TABLE IF NOT EXISTS address (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    line_1                VARCHAR(255) NOT NULL,
    line_2                VARCHAR(255),
    district              VARCHAR(100),
    city                  VARCHAR(100),
    pincode               VARCHAR(15),
    state                 VARCHAR(100),
    country               VARCHAR(100),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS branch (
    branch_code           VARCHAR(20) PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    logo_url              TEXT,
    hod_id                INT,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS course (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    duration_years        INT NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

-- Seed active LDCE branches. Existing branch rows outside this official list
-- are kept for references but hidden from active lists.
UPDATE branch
SET is_deleted = TRUE
WHERE branch_code NOT IN ('52', '02', '03', '05', '06', '07', '09', '11', '13', '16', '17', '19', '23', '26', '29', 'SH');

INSERT INTO branch (branch_code, name, logo_url, hod_id, created_at, is_deleted)
VALUES
    ('52', 'Artificial Intelligence', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('02', 'Automobile Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('03', 'Biomedical Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('05', 'Chemical Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('06', 'Civil Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('07', 'Computer Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('09', 'Electrical Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('11', 'Electronics and Communication Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('13', 'Environmental Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('16', 'Information Technology', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('17', 'Instrumentation and Control Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('19', 'Mechanical Engineering', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('23', 'Plastic Technology', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('26', 'Rubber Technology', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('29', 'Textile Technology', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE),
    ('SH', 'Science & Humanities', NULL, NULL, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE)
ON CONFLICT (branch_code)
DO UPDATE SET
    name = EXCLUDED.name,
    logo_url = COALESCE(branch.logo_url, EXCLUDED.logo_url),
    is_deleted = FALSE;

-- Seed active courses. BE is 4 years; ME and MCA are 2 years.
UPDATE course
SET is_deleted = TRUE
WHERE LOWER(TRIM(name)) NOT IN ('be', 'me', 'mca');

UPDATE course
SET duration_years = CASE LOWER(TRIM(name))
    WHEN 'be' THEN 4
    WHEN 'me' THEN 2
    WHEN 'mca' THEN 2
    ELSE duration_years
END,
created_at = COALESCE(created_at, EXTRACT(EPOCH FROM NOW())::BIGINT),
is_deleted = FALSE
WHERE LOWER(TRIM(name)) IN ('be', 'me', 'mca');

INSERT INTO course (name, duration_years, created_at, is_deleted)
SELECT seed.name, seed.duration_years, EXTRACT(EPOCH FROM NOW())::BIGINT, FALSE
FROM (VALUES
    ('BE', 4),
    ('ME', 2),
    ('MCA', 2)
) AS seed(name, duration_years)
WHERE NOT EXISTS (
    SELECT 1
    FROM course c
    WHERE LOWER(TRIM(c.name)) = LOWER(seed.name)
);

WITH ranked_courses AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name))
            ORDER BY id ASC
        ) AS row_rank
    FROM course
    WHERE LOWER(TRIM(name)) IN ('be', 'me', 'mca')
      AND is_deleted = FALSE
)
UPDATE course c
SET is_deleted = TRUE
FROM ranked_courses r
WHERE c.id = r.id
  AND r.row_rank > 1;

CREATE TABLE IF NOT EXISTS faculty (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    type                  faculty_type NOT NULL,
    branch_code           VARCHAR(20) REFERENCES branch(branch_code),
    mobile_no             VARCHAR(15),
    email                 VARCHAR(100),
    password              VARCHAR(255) NOT NULL,
    college_email         VARCHAR(100),
    current_address_id    INT REFERENCES address(id),
    permanent_address_id  INT REFERENCES address(id),
    profile_url           TEXT,
    years_of_experience   INT,
    joining_date          DATE,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_branch_hod'
    ) THEN
        ALTER TABLE branch
        ADD CONSTRAINT fk_branch_hod FOREIGN KEY (hod_id) REFERENCES faculty(id);
    END IF;
END $$;

-- Keep only one active faculty account per email. Existing duplicate active
-- rows are soft-deleted so dashboard/list counts stay accurate.
WITH ranked_faculty AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(email))
            ORDER BY id ASC
        ) AS row_rank
    FROM faculty
    WHERE is_deleted = FALSE
      AND email IS NOT NULL
      AND TRIM(email) <> ''
)
UPDATE faculty f
SET is_deleted = TRUE
FROM ranked_faculty r
WHERE f.id = r.id
  AND r.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_faculty_active_email_unique
ON faculty (LOWER(TRIM(email)))
WHERE is_deleted = FALSE
  AND email IS NOT NULL
  AND TRIM(email) <> '';

CREATE TABLE IF NOT EXISTS batch (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_code           VARCHAR(20) REFERENCES branch(branch_code),
    course_id             INT REFERENCES course(id),
    enrolled_year         INT NOT NULL,
    passing_year          INT,
    batch_no              VARCHAR(20),
    number_of_students    INT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);
ALTER TABLE batch ADD COLUMN IF NOT EXISTS batch_no VARCHAR(20);
UPDATE batch b
SET passing_year = b.enrolled_year + c.duration_years
FROM course c
WHERE b.course_id = c.id
  AND b.enrolled_year IS NOT NULL
  AND c.duration_years IS NOT NULL
  AND (b.passing_year IS NULL OR b.passing_year <> b.enrolled_year + c.duration_years);
UPDATE batch
SET batch_no = enrolled_year::TEXT || '-' || passing_year::TEXT
WHERE enrolled_year IS NOT NULL
  AND passing_year IS NOT NULL
  AND (batch_no IS NULL OR batch_no <> enrolled_year::TEXT || '-' || passing_year::TEXT);

CREATE TABLE IF NOT EXISTS student (
    enrollment_no         VARCHAR(20) PRIMARY KEY,
    batch_id              INT REFERENCES batch(id),
    name                  VARCHAR(100) NOT NULL,
    current_division      VARCHAR(5) NOT NULL,
    mobile_no             VARCHAR(15),
    email                 VARCHAR(100),
    password              VARCHAR(255) NOT NULL,
    college_email         VARCHAR(100),
    current_address_id    INT REFERENCES address(id),
    permanent_address_id  INT REFERENCES address(id),
    profile_url           TEXT,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS parent (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enrollment_no         VARCHAR(20) REFERENCES student(enrollment_no),
    email                 VARCHAR(100),
    password              VARCHAR(255) NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS subject (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_code          VARCHAR(20) UNIQUE NOT NULL,
    name                  VARCHAR(150) NOT NULL,
    syllabus_url          TEXT,
    syllabus_file_name    VARCHAR(255),
    syllabus_text         TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);
ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_file_name VARCHAR(255);
ALTER TABLE subject ADD COLUMN IF NOT EXISTS syllabus_text TEXT;

CREATE TABLE IF NOT EXISTS subject_teaching_branch (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_code          VARCHAR(20) NOT NULL REFERENCES subject(subject_code),
    branch_code           VARCHAR(20) NOT NULL REFERENCES branch(branch_code),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_teaching_branch_active
    ON subject_teaching_branch (subject_code, branch_code)
    WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS faculty_experience (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_id            INT NOT NULL REFERENCES faculty(id),
    starting_month_year   VARCHAR(50) NOT NULL,
    ending_month_year     VARCHAR(50),
    description           TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS education_details (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_type           person_type_enum NOT NULL,
    student_enrollment_no VARCHAR(20) REFERENCES student(enrollment_no),
    faculty_id            INT REFERENCES faculty(id),
    institute_name        VARCHAR(200) NOT NULL,
    passing_year          VARCHAR(4) NOT NULL,
    remarks               TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS offered_subjects (
    id                      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sem_number              INT NOT NULL,
    faculty_corrdinator_id  INT NOT NULL REFERENCES faculty(id),
    accadmic_year           VARCHAR(9) NOT NULL,
    session                 VARCHAR(10) NOT NULL,
    subject_code            VARCHAR(20) NOT NULL REFERENCES subject(subject_code),
    batch_id                INT REFERENCES batch(id),
    number_of_lectures      INT,
    include_pso             BOOLEAN DEFAULT TRUE,
    subject_type            subject_type_enum DEFAULT 'DISCIPLINARY',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted              BOOLEAN DEFAULT FALSE
);
alter table offered_subjects add column if not exists batch_id INT REFERENCES batch(id);
alter table offered_subjects add column if not exists include_pso BOOLEAN DEFAULT TRUE;
alter table offered_subjects add column if not exists subject_type subject_type_enum DEFAULT 'DISCIPLINARY';
alter table offered_subjects drop constraint if exists offered_subjects_batch_id_sem_number_subject_code_accadmic_year_key;
alter table offered_subjects drop constraint if exists offered_subjects_sem_number_subject_code_accadmic_year_key;
drop index if exists offered_subjects_sem_number_subject_code_accadmic_year_key;
create unique index if not exists uq_offered_subjects_hod_scope
    on offered_subjects (sem_number, subject_code, accadmic_year, session, faculty_corrdinator_id, batch_id)
    where is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS assigned_subject_faculty (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    faculty_id            INT NOT NULL REFERENCES faculty(id),
    role                  VARCHAR(50) NOT NULL, -- e.g., 'coordinator', 'assistant'
    division              VARCHAR(5) NOT NULL,
    total_lectures        INT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE,
    UNIQUE (offering_id, faculty_id, division)
);

CREATE TABLE IF NOT EXISTS faculty_assignment_request (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    requesting_hod_id     INT NOT NULL REFERENCES faculty(id),
    target_branch_code    VARCHAR(20) NOT NULL REFERENCES branch(branch_code),
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assigned_faculty_id   INT REFERENCES faculty(id),
    handled_by_hod_id     INT REFERENCES faculty(id),
    role                  VARCHAR(50),
    division              VARCHAR(5),
    total_lectures        INT,
    note                  TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_assignment_request_pending
    ON faculty_assignment_request (offering_id, target_branch_code, division)
    WHERE is_deleted = FALSE AND status = 'PENDING';

CREATE TABLE IF NOT EXISTS student_offering_subject (
    enrollment_no         VARCHAR(20) NOT NULL REFERENCES student(enrollment_no),
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (enrollment_no, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_student_offering_subject_offering
    ON student_offering_subject (offering_id)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_student_offering_subject_student
    ON student_offering_subject (enrollment_no)
    WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS lecture_plan (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT REFERENCES offered_subjects(id),
    description           TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS nba_generation_cache (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    syllabus_hash         VARCHAR(64) NOT NULL,
    subject_name          VARCHAR(200),
    target_lectures       INT,
    generated_payload     JSONB NOT NULL,
    model_used            VARCHAR(100),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (offering_id, syllabus_hash)
);

CREATE INDEX IF NOT EXISTS idx_nba_generation_cache_offering
    ON nba_generation_cache (offering_id);

CREATE INDEX IF NOT EXISTS idx_nba_generation_cache_updated
    ON nba_generation_cache (updated_at DESC);

alter table lecture_plan drop column if exists division;
alter table lecture_plan drop column if exists faculty_id;
alter table lecture_plan drop column if exists batch_id;
alter table lecture_plan drop column if exists sem_number;
alter table lecture_plan drop column if exists subject_id;

CREATE TABLE IF NOT EXISTS taken_lecture (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lecture_plan_id     INT REFERENCES lecture_plan(id),
    date_of_lecture     DATE NOT NULL,
    division            VARCHAR(5) NOT NULL,
    faculty_id          INT REFERENCES faculty(id),
    duration_minutes    INT,
    status              VARCHAR(20) NOT NULL, -- e.g., 'completed', 'planned'
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS marked_attendance (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lecture_id            INT REFERENCES taken_lecture(id),
    enrollment_no         VARCHAR(20) REFERENCES student(enrollment_no),
    status                attendance_status NOT NULL DEFAULT 'ABSENT',
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE,
    UNIQUE (lecture_id, enrollment_no)
);
alter table marked_attendance drop column if exists lecture_id;
alter table marked_attendance add column if not exists lecture_id INT REFERENCES taken_lecture(id);

CREATE TABLE IF NOT EXISTS attendance_session (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id         INT NOT NULL REFERENCES assigned_subject_faculty(id),
    lecture_id            INT NOT NULL REFERENCES taken_lecture(id),
    faculty_id            INT NOT NULL REFERENCES faculty(id),
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    division              VARCHAR(5) NOT NULL,
    status                VARCHAR(20) NOT NULL,
    started_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at              TIMESTAMP,
    duration_minutes      INT NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE,
    CONSTRAINT attendance_session_status_check
        CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_active_faculty
    ON attendance_session (faculty_id)
    WHERE is_deleted = FALSE AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_attendance_session_faculty_status
    ON attendance_session (faculty_id, status)
    WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS placement (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enrollment_no         VARCHAR(20) REFERENCES student(enrollment_no),
    company_name          VARCHAR(150) NOT NULL,
    package_ctc           NUMERIC(10,2),
    placed_date           DATE,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted            BOOLEAN DEFAULT FALSE
);

-- ===========================
-- EXAM & CO STRUCTURE
-- ===========================

CREATE TABLE IF NOT EXISTS exam (
    exam_id               INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_type             exam_type_enum NOT NULL,
    academic_year         VARCHAR(9) NOT NULL,
    session               VARCHAR(10) NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS paper (
    paper_id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id               INT REFERENCES exam(exam_id),
    offering_id           INT REFERENCES offered_subjects(id),
    exam_date             DATE NOT NULL,
    max_marks             INT NOT NULL,
    total_students        INT NOT NULL,
    paper_url             TEXT,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS marks (
    paper_id              INT REFERENCES paper(paper_id),
    enrollment_no         VARCHAR(20) REFERENCES student(enrollment_no),
    obtained_marks        INT NOT NULL,
    total_marks           INT NOT NULL,
    offering_id           INT REFERENCES offered_subjects(id),
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (paper_id, enrollment_no)
);

CREATE TABLE IF NOT EXISTS course_outcome (
    co_id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    co_description        TEXT NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS co_wise_target_value (
    paper_id     INT REFERENCES paper(paper_id),
    offering_id  INT REFERENCES offered_subjects(id),
    co_number    INT NOT NULL,
    target_value INT NOT NULL,
    total_marks  INT NOT NULL,
    PRIMARY KEY (paper_id, co_number)
);

CREATE TABLE IF NOT EXISTS co_marks (
    paper_id              INT REFERENCES paper(paper_id),
    offering_id           INT REFERENCES offered_subjects(id),
    enrollment_no         VARCHAR(20) REFERENCES student(enrollment_no),
    co_number             INT NOT NULL,
    obtained_marks        INT NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (paper_id, enrollment_no, co_number)
);

CREATE TABLE IF NOT EXISTS attainment_criteria (
    offering_id           INT REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    target_marks          INT NOT NULL,
    target_percentage     NUMERIC(5,2) NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (offering_id, co_number)
);

CREATE TABLE IF NOT EXISTS co_attainment_report (
    report_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paper_id              INT REFERENCES paper(paper_id),
    offering_id           INT REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    co_attainment_level   NUMERIC(5,2) NOT NULL DEFAULT 0,
    component             attainment_component_enum,
    percentage            NUMERIC(5,2) DEFAULT 0,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS overall_co_attainment_report (
    report_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offering_id           INT REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    overall_internal      NUMERIC(5,2) DEFAULT 0,
    overall_external      NUMERIC(5,2) DEFAULT 0,
    overall_total         NUMERIC(5,2) DEFAULT 0,
    created_at            BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    is_deleted            BOOLEAN DEFAULT FALSE
);
alter table overall_co_attainment_report drop column if exists paper_id;
alter table overall_co_attainment_report drop column if exists type;
alter table overall_co_attainment_report drop column if exists co_attainment_level;
alter table overall_co_attainment_report drop column if exists academic_year;
alter table overall_co_attainment_report drop column if exists session;
alter table overall_co_attainment_report add column if not exists co_number INT;
create unique index if not exists uq_overall_co_attainment_report_offering_co
    on overall_co_attainment_report (offering_id, co_number)
    where is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS program_outcome (
    po_number             INT NOT NULL,
    title                 TEXT,
    description           TEXT,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (po_number)
);

CREATE TABLE IF NOT EXISTS program_outcome_competency (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number             INT NOT NULL REFERENCES program_outcome(po_number),
    competency_number     VARCHAR(20) NOT NULL,
    competency_text       TEXT NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    UNIQUE (po_number, competency_number)
);

CREATE TABLE IF NOT EXISTS program_outcome_indicator (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number             INT NOT NULL,
    competency_number     VARCHAR(20) NOT NULL,
    indicator_number      VARCHAR(20) NOT NULL,
    indicator_text        TEXT NOT NULL,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    UNIQUE (po_number, competency_number, indicator_number),
    CONSTRAINT fk_program_outcome_indicator_competency
        FOREIGN KEY (po_number, competency_number)
        REFERENCES program_outcome_competency (po_number, competency_number)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS program_specific_outcome (
    branch_code           VARCHAR(20) REFERENCES branch(branch_code),
    pso_number            INT NOT NULL,
    title                 TEXT,
    description           TEXT,
    created_at            BIGINT NOT NULL,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (branch_code, pso_number)
);

-- Migration safety for existing schemas
ALTER TABLE program_outcome DROP COLUMN IF EXISTS offering_id;
ALTER TABLE program_outcome ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE program_specific_outcome DROP CONSTRAINT IF EXISTS program_specific_outcome_pkey;
ALTER TABLE program_specific_outcome DROP COLUMN IF EXISTS offering_id;
ALTER TABLE program_specific_outcome ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20) REFERENCES branch(branch_code);
ALTER TABLE program_specific_outcome ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE program_specific_outcome ADD PRIMARY KEY (branch_code, pso_number);

CREATE TABLE IF NOT EXISTS co_po_pso_strength_mapping (
    offering_id           INT NOT NULL REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    outcome_type          outcome_type_enum NOT NULL,
    outcome_code          INT NOT NULL,
    strength              INT NOT NULL,
    justification          TEXT,
    created_at            BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (offering_id, co_number, outcome_type, outcome_code)
);
alter table co_po_pso_strength_mapping add column if not exists justification TEXT;

CREATE TABLE IF NOT EXISTS co_po_pso_attainment_report (
    offering_id           INT REFERENCES offered_subjects(id),
    co_number             INT NOT NULL,
    outcome_type          outcome_type_enum NOT NULL,
    outcome_code          INT NOT NULL,
    attainment_level      NUMERIC(5,2) NOT NULL,
    created_at            BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (offering_id, co_number, outcome_type, outcome_code)
);

CREATE TABLE IF NOT EXISTS co_po_pso_attainment_average (
    offering_id           INT REFERENCES offered_subjects(id),
    outcome_type          outcome_type_enum NOT NULL,
    outcome_code          INT NOT NULL,
    average_attainment_level NUMERIC(5,2) NOT NULL,
    created_at            BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    is_deleted            BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (offering_id, outcome_type, outcome_code)
);
alter table co_po_pso_attainment_average drop column if exists co_number;
alter table co_po_pso_attainment_average drop constraint if exists co_po_pso_attainment_average_pkey;
alter table co_po_pso_attainment_average
    add constraint co_po_pso_attainment_average_pkey
    primary key (offering_id, outcome_type, outcome_code);
