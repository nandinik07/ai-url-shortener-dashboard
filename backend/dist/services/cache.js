"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
const redis_1 = require("redis");
// In-Memory Cache Fallback
class MemoryCacheService {
    cache = new Map();
    async initialize() {
        console.log("Cache: In-Memory Cache initialized.");
    }
    async close() { }
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
        this.cache.set(key, { value, expiresAt });
    }
    async del(key) {
        this.cache.delete(key);
    }
}
// Redis Cache Implementation
class RedisCacheService {
    client;
    constructor() {
        this.client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || "redis://localhost:6379"
        });
        this.client.on("error", (err) => {
            // Quietly log error, initialization handles fallback
        });
    }
    async initialize() {
        try {
            await this.client.connect();
            console.log("Cache: Redis Cache initialized successfully.");
        }
        catch (err) {
            throw new Error(`Redis connection failed: ${err.message}`);
        }
    }
    async close() {
        if (this.client.isOpen) {
            await this.client.disconnect();
        }
    }
    async get(key) {
        try {
            return await this.client.get(key);
        }
        catch (err) {
            console.error("Cache Redis Get Error:", err);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            if (ttlSeconds) {
                await this.client.set(key, value, { EX: ttlSeconds });
            }
            else {
                await this.client.set(key, value);
            }
        }
        catch (err) {
            console.error("Cache Redis Set Error:", err);
        }
    }
    async del(key) {
        try {
            await this.client.del(key);
        }
        catch (err) {
            console.error("Cache Redis Del Error:", err);
        }
    }
}
let cache;
if (process.env.USE_MEMORY_CACHE === "true" || process.env.NODE_ENV === "test") {
    exports.cache = cache = new MemoryCacheService();
}
else {
    console.log("Cache: Attempting to connect to Redis...");
    const redisService = new RedisCacheService();
    exports.cache = cache = redisService;
    // Intercept initialize to fallback to Memory Cache on failure
    const originalInit = cache.initialize.bind(cache);
    cache.initialize = async () => {
        try {
            await originalInit();
        }
        catch (err) {
            console.warn("Cache: Redis connection failed. Falling back to In-Memory cache. Error:", err.message);
            exports.cache = cache = new MemoryCacheService();
            await cache.initialize();
        }
    };
}
