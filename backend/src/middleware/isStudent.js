const STUDENT_ROLES = new Set(['student']);

const isStudent = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!STUDENT_ROLES.has(req.user.role)) {
        return res.status(403).json({ error: "Student access required" });
    }

    next();
};

module.exports = isStudent;
