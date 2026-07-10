import { createClient, RedisClientType } from "redis";

export interface CacheService {
  initialize(): Promise<void>;
  close(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// In-Memory Cache Fallback
class MemoryCacheService implements CacheService {
  private cache: Map<string, { value: string; expiresAt: number | null }> = new Map();

  async initialize(): Promise<void> {
    console.log("Cache: In-Memory Cache initialized.");
  }

  async close(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

// Redis Cache Implementation
class RedisCacheService implements CacheService {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379"
    });

    this.client.on("error", (err) => {
      // Quietly log error, initialization handles fallback
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      console.log("Cache: Redis Cache initialized successfully.");
    } catch (err: any) {
      throw new Error(`Redis connection failed: ${err.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      console.error("Cache Redis Get Error:", err);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, { EX: ttlSeconds });
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.error("Cache Redis Set Error:", err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error("Cache Redis Del Error:", err);
    }
  }
}

let cache: CacheService;

if (process.env.USE_MEMORY_CACHE === "true" || process.env.NODE_ENV === "test") {
  cache = new MemoryCacheService();
} else {
  console.log("Cache: Attempting to connect to Redis...");
  const redisService = new RedisCacheService();
  cache = redisService;

  // Intercept initialize to fallback to Memory Cache on failure
  const originalInit = cache.initialize.bind(cache);
  cache.initialize = async (): Promise<void> => {
    try {
      await originalInit();
    } catch (err: any) {
      console.warn("Cache: Redis connection failed. Falling back to In-Memory cache. Error:", err.message);
      cache = new MemoryCacheService();
      await cache.initialize();
    }
  };
}

export { cache };
