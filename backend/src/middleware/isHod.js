const isHod = (req, res, next) => {
  const role = String(req.user?.role || "");

  if (role !== "HOD") {
    return res.status(403).json({ error: "Forbidden: HOD access required" });
  }

  next();
};

module.exports = isHod;
