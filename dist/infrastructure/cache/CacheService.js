"use strict";
/**
 * Cache Service
 * Task 23: Performance Optimization and Caching
 *
 * Simple in-memory cache with TTL support
 * Can be extended to use Redis in production
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheService = exports.CacheService = void 0;
class CacheService {
    constructor() {
        this.cache = new Map();
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value, options = {}) {
        const ttl = options.ttl || 300000; // Default 5 minutes
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });
    }
    /**
     * Delete value from cache
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get or set pattern
     */
    async getOrSet(key, factory, options = {}) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await factory();
        this.set(key, value, options);
        return value;
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
        if (keysToDelete.length > 0) {
            console.log(`Cache cleanup: ${keysToDelete.length} expired entries removed`);
        }
    }
    /**
     * Cleanup on shutdown
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
exports.CacheService = CacheService;
// Singleton instance
let cacheServiceInstance = null;
function getCacheService() {
    if (!cacheServiceInstance) {
        cacheServiceInstance = new CacheService();
    }
    return cacheServiceInstance;
}
exports.getCacheService = getCacheService;
