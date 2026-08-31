const isFaculty = (req, res, next) => {
  const role = String(req.user?.role || "");

  const facultyRoles = ["faculty", "ASSISTANT", "HOD", "ASSOCIATE", "ADMIN"];

  if (!facultyRoles.includes(role)) {
    return res.status(403).json({ error: "Faculty access required" });
  }

  next();
};

module.exports = isFaculty;
