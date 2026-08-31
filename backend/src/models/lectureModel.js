const createLecturePlan = (db, offering_id, description) => {
    const query = `
        INSERT INTO lecture_plan (offering_id, description, is_deleted)
        VALUES ($1, $2, FALSE)
        RETURNING id, offering_id, description, created_at
    `;
    return db.query(query, [offering_id, description || null]);
};

const updateLecturePlan = (db, lecture_plan_id, description) => {
    const query = `
        UPDATE lecture_plan
        SET description = COALESCE($2, description)
        WHERE id = $1
          AND is_deleted = FALSE
        RETURNING id, offering_id, description, created_at
    `;
    return db.query(query, [lecture_plan_id, description || null]);
};

const deleteLecturePlan = (db, lecture_plan_id) => {
    const query = `
        UPDATE lecture_plan
        SET is_deleted = TRUE
        WHERE id = $1
          AND is_deleted = FALSE
        RETURNING id
    `;
    return db.query(query, [lecture_plan_id]);
};

const getLecturePlansByOfferingID = (db, offering_id) => {
    const query = `
        SELECT id, offering_id, description, created_at
        FROM lecture_plan
        WHERE offering_id = $1
          AND is_deleted = FALSE
        ORDER BY created_at DESC, id DESC
    `;
    return db.query(query, [offering_id]);
};

const createLecture = (db, lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status) => {
    const query = `
        INSERT INTO taken_lecture (lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status, is_deleted)
        VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        RETURNING id, lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status, created_at
    `;
    return db.query(query, [lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status]);
};

const getLecturesByFacultyID = (db, faculty_id) => {
    const query = `
        SELECT tl.id, tl.lecture_plan_id, tl.date_of_lecture, tl.division, tl.duration_minutes, lp.description AS topic
        FROM taken_lecture tl
        JOIN lecture_plan lp ON tl.lecture_plan_id = lp.id
        WHERE tl.faculty_id = $1
                    AND tl.is_deleted = FALSE
                    AND lp.is_deleted = FALSE
                ORDER BY tl.date_of_lecture DESC, tl.id DESC
    `;
    return db.query(query, [faculty_id]);
};

const getLecturesForFacutlyByDivision = (db, faculty_id, division) => {
    const query = `
        SELECT tl.id, tl.lecture_plan_id, tl.date_of_lecture, tl.division, tl.duration_minutes, lp.description AS topic
        FROM taken_lecture tl
        JOIN lecture_plan lp ON tl.lecture_plan_id = lp.id
        WHERE tl.faculty_id = $1 AND tl.division = $2
                    AND tl.is_deleted = FALSE
                    AND lp.is_deleted = FALSE
                ORDER BY tl.date_of_lecture DESC, tl.id DESC
    `;
    return db.query(query, [faculty_id, division]);
};

const getLecturesByStatus = (db, status) => {
    const query = `
        SELECT tl.id, tl.lecture_plan_id, tl.date_of_lecture, tl.division, tl.duration_minutes, lp.description AS topic
        FROM taken_lecture tl
        JOIN lecture_plan lp ON tl.lecture_plan_id = lp.id
        WHERE tl.status = $1
          AND tl.is_deleted = FALSE
          AND lp.is_deleted = FALSE
        ORDER BY tl.date_of_lecture DESC, tl.id DESC
    `;
    return db.query(query, [status]);
};

module.exports = {
    createLecturePlan,
    updateLecturePlan,
    deleteLecturePlan,
    getLecturePlansByOfferingID,
    createLecture,
    getLecturesByFacultyID,
    getLecturesForFacutlyByDivision,
    getLecturesByStatus
};