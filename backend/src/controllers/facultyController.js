const { getAssignedClassesForFaculty } = require("../models/facultyModel");

const getAssignedClasses = async (req, res) => {
  try {
    const facultyId = Number.parseInt(req.user?.id, 10);

    if (!facultyId || Number.isNaN(facultyId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const items = await getAssignedClassesForFaculty(facultyId);

    return res.status(200).json({
      message: "Assigned classes fetched successfully",
      items,
    });
  } catch (error) {
    console.error("Error fetching assigned classes:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getAssignedClasses,
};
