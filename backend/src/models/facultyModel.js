const { pool } = require("../config/db");

const getAssignedClassesForFaculty = async (facultyId) => {
  const query = `
    SELECT
      asf.id AS assignment_id,
      os.id AS offering_id,
      os.subject_code,
      s.name AS subject_name,
      br.branch_code,
      br.name AS branch_name,
      os.sem_number AS semester,
      asf.division,
      b.id AS batch_id,
      NULL::VARCHAR AS batch_name,
      os.accadmic_year AS academic_year,
      os.session,
      asf.faculty_id,
      asf.role AS faculty_role,
      asf.total_lectures
    FROM assigned_subject_faculty asf
    JOIN offered_subjects os
      ON os.id = asf.offering_id
     AND os.is_deleted = FALSE
    JOIN subject s
      ON s.subject_code = os.subject_code
     AND s.is_deleted = FALSE
    JOIN faculty f
      ON f.id = asf.faculty_id
     AND f.is_deleted = FALSE
    LEFT JOIN batch b
      ON b.id = os.batch_id
     AND b.is_deleted = FALSE
    LEFT JOIN branch br
      ON br.branch_code = COALESCE(b.branch_code, f.branch_code)
     AND br.is_deleted = FALSE
    WHERE asf.faculty_id = $1
      AND asf.is_deleted = FALSE
    ORDER BY
      os.accadmic_year DESC,
      os.sem_number ASC,
      s.name ASC,
      asf.division ASC
  `;

  const result = await pool.query(query, [facultyId]);
  return result.rows;
};

module.exports = {
  getAssignedClassesForFaculty,
};
