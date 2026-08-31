const redisClient = require('../config/redis');
const crypto = require('crypto');

const windowSize = Number(process.env.WINDOW_SIZE || 60 * 60); // default 1 hour in seconds
const maxRequests = Number(process.env.MAX_REQUESTS || 100); // default 100 requests per hour

const rateLimiter = async (req, res, next) => {
    try{
        if (process.env.NODE_ENV !== 'production') {
            const localIps = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
            if (localIps.has(req.ip)) {
                return next();
            }
        }

        if (!redisClient.isReady) {
            return next();
        }

        const key = `IP:${req.ip}`;
        // redisClient.del(ip); //for testing
        
        const currentTime = Date.now()/1000;
        const windowTime = currentTime-windowSize; //before this time othe values are expired
        

        //here z means orderd set
        await redisClient.zRemRangeByScore(key, 0, windowTime); // this remove all the scores from 0 to windowTime

        const numberOfRequest = await redisClient.zCard(key); //total number of requests if key is not exists then it will return 0

        if(numberOfRequest>=maxRequests) return res.status(429).json({ error: "Too many requests. Try again in an hour." });

        // Use crypto for a guaranteed unique member value
        const uniqueValue = `${currentTime}:${crypto.randomUUID()}`;

        await redisClient.zAdd(key, [{score: currentTime, value: uniqueValue }]); //use crpyto library insted of math.random()
        
        //key TTL increase
        await redisClient.expire(key, windowSize);

        return next();

    }
    catch(err){
        console.warn('Rate limiter unavailable. Continuing without rate limit:', err.message);
        return next();
    }
}
module.exports = rateLimiter;
