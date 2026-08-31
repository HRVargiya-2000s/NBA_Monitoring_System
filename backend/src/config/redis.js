let client;

try {
    const { createClient } = require('redis');

    const redisOptions = {
        socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT || 6379)
        }
    };

    if (process.env.REDIS_URL) {
        redisOptions.url = process.env.REDIS_URL;
    }

    if (process.env.REDIS_USERNAME) {
        redisOptions.username = process.env.REDIS_USERNAME;
    }

    if (process.env.REDIS_PASSWORD) {
        redisOptions.password = process.env.REDIS_PASSWORD;
    }

    client = createClient(redisOptions);
} catch (error) {
    console.warn('Redis package is not installed. Using in-memory no-op fallback.');

    const noop = async () => null;
    client = {
        isReady: false,
        connect: noop,
        quit: noop,
        get: async () => null,
        set: noop,
        del: noop,
        ttl: async () => -1,
        zRemRangeByScore: noop,
        zCard: async () => 0,
        zAdd: noop,
        expire: noop
    };
}

module.exports = client;