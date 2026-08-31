const { pool } = require("../config/db");
const {
    createLecturePlan,
    updateLecturePlan,
    deleteLecturePlan,
    getLecturePlansByOfferingID,
    createLecture,
    getLecturesByFacultyID,
    getLecturesForFacutlyByDivision,
    getLecturesByStatus
} = require("../models/lectureModel.js");

const createNewLecturePlan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { offering_id, description } = req.body || {};
        const offeringId = Number.parseInt(offering_id, 10);

        if (!offeringId || Number.isNaN(offeringId)) {
            return res.status(400).json({ message: "Valid offering_id is required" });
        }

        const result = await createLecturePlan(client, offeringId, description);
        return res.status(201).json({ message: "Lecture plan created successfully", lecture_plan: result.rows[0] });
    } catch (error) {
        console.error("Error creating lecture plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const updateLecturePlanById = async (req, res) => {
    const client = await pool.connect();
    try {
        const lecturePlanId = Number.parseInt(req.params.lecture_plan_id, 10);
        const { description } = req.body || {};

        if (!lecturePlanId || Number.isNaN(lecturePlanId)) {
            return res.status(400).json({ message: "Invalid lecture_plan_id" });
        }

        const result = await updateLecturePlan(client, lecturePlanId, description);
        if (!result.rows.length) {
            return res.status(404).json({ message: "Lecture plan not found" });
        }

        return res.status(200).json({ message: "Lecture plan updated successfully", lecture_plan: result.rows[0] });
    } catch (error) {
        console.error("Error updating lecture plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const deleteLecturePlanById = async (req, res) => {
    const client = await pool.connect();
    try {
        const lecturePlanId = Number.parseInt(req.params.lecture_plan_id, 10);
        if (!lecturePlanId || Number.isNaN(lecturePlanId)) {
            return res.status(400).json({ message: "Invalid lecture_plan_id" });
        }

        const result = await deleteLecturePlan(client, lecturePlanId);
        if (!result.rows.length) {
            return res.status(404).json({ message: "Lecture plan not found" });
        }

        return res.status(200).json({ message: "Lecture plan deleted successfully" });
    } catch (error) {
        console.error("Error deleting lecture plan:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const getLecturePlansForOffering = async (req, res) => {
    const client = await pool.connect();
    try {
        const offeringId = Number.parseInt(req.params.offering_id, 10);
        if (!offeringId || Number.isNaN(offeringId)) {
            return res.status(400).json({ message: "Invalid offering_id" });
        }

        const result = await getLecturePlansByOfferingID(client, offeringId);
        return res.status(200).json({ lecture_plans: result.rows });
    } catch (error) {
        console.error("Error fetching lecture plans:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const createNewLecture = async (req, res) => {
    const client = await pool.connect();
    try {
        const { lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status } = req.body || {};
        if (!lecture_plan_id || !date_of_lecture || !division || !faculty_id || !duration_minutes || !status) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const result = await createLecture(client, lecture_plan_id, date_of_lecture, division, faculty_id, duration_minutes, status);
        res.status(201).json({ message: "Lecture created successfully", lecture: result.rows[0] });
    } catch (error) {
        console.error("Error creating lecture:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

const getLecturesForFaculty = async (req, res) => {
    const client = await pool.connect();
    try {
        const faculty_id = parseInt(req.params.faculty_id);
        if (isNaN(faculty_id)) {
            return res.status(400).json({ message: "Invalid faculty ID" });
        }

        if (req.query.status) {
            const result = await getLecturesByStatus(client, req.query.status);
            return res.status(200).json(result.rows);
        }
        if (req.query.division) {
            const result = await getLecturesForFacutlyByDivision(client, faculty_id, req.query.division);
            return res.status(200).json(result.rows);
        }

        const result = await getLecturesByFacultyID(client, faculty_id);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching lectures:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

module.exports = {
    createNewLecturePlan,
    updateLecturePlanById,
    deleteLecturePlanById,
    getLecturePlansForOffering,
    createNewLecture,
    getLecturesForFaculty
};