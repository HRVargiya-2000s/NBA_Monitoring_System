const redisClient = require('../config/redis');

const blacklistUser = async (userId) => {
    if (!redisClient.isReady) return;

    const expiryTime = process.env.JWT_EXPIRES_IN || '24h';
    await redisClient.set(`blacklist:${userId}`, 'true', {
        EX: parseInt(expiryTime) * 60 * 60, 
    });
};

// Check if user is blacklisted
const isUserBlacklisted = async (userId) => {
    if (!redisClient.isReady) return false;

    const result = await redisClient.get(`blacklist:${userId}`);
    return result === 'true'; // Returns true if blacklisted
};

module.exports = { blacklistUser, isUserBlacklisted };
