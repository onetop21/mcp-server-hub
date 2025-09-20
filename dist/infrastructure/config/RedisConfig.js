"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisConfigManager = void 0;
class RedisConfigManager {
    static getConfig() {
        if (!this.config) {
            this.config = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0', 10),
                connectTimeout: 10000,
                lazyConnect: true,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
            };
        }
        return this.config;
    }
    static setConfig(config) {
        this.config = config;
    }
    static reset() {
        this.config = null;
    }
}
exports.RedisConfigManager = RedisConfigManager;
RedisConfigManager.config = null;
