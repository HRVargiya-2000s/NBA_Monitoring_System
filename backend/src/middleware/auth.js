const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const { pool } = require('../config/db');
const { isUserBlacklisted } = require('../utils/userBlacklist');

const VALID_ROLES = ['student', 'faculty', 'ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN'];

const authenticate = async (req, res, next) => {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const token = cookieToken || bearerToken;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        // decoded will look like: { id: '22BECEG123', email: 'student@example.com', role: 'student' }

        if (!decoded.role || !VALID_ROLES.includes(decoded.role)) {
            return res.status(403).json({ error: "Unauthorized: Invalid Role" });
        }

        // Check Redis first (The Fast Gate)
        const isRevoked = await isUserBlacklisted(decoded.id);
        if (isRevoked) return res.status(401).json({ error: "Session revoked. Please login again." });

        //check if token is in blocklist
        if (redisClient.isReady) {
            const isBlocked = await redisClient.get(`token:${token}`);
            if (isBlocked) return res.status(401).json({ error: "Session expired. Please login again." });
        }

        const activeUserResult = decoded.role === 'student'
            ? await pool.query(
                `SELECT 1 FROM student WHERE enrollment_no = $1 AND is_deleted = FALSE LIMIT 1`,
                [decoded.id]
            )
            : await pool.query(
                `SELECT 1 FROM faculty WHERE id::text = $1::text AND is_deleted = FALSE LIMIT 1`,
                [decoded.id]
            );

        if (activeUserResult.rowCount === 0) {
            return res.status(401).json({ error: "Session expired. Please login again." });
        }
        
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

module.exports = authenticate;
