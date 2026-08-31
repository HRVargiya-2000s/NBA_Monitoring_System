const isAdmin = (req, res, next) => {
    // req.user is populated by your existing 'authenticate' middleware
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access Denied: Admins only." });
    }
    next();
};

module.exports = isAdmin;