"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
/**
 * In-memory rate limiter implementation
 * In production, this would use Redis for distributed rate limiting
 */
class RateLimiter {
    constructor() {
        this.storage = new Map();
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    /**
     * Check rate limit for an API key
     */
    async checkRateLimit(apiKey, hourlyLimit, dailyLimit) {
        const now = new Date();
        const data = this.getOrCreateRateLimitData(apiKey, now);
        // Clean up old entries
        this.cleanupOldEntries(data, now);
        // Count requests in the last hour and day
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const hourlyRequests = data.requests.filter(time => time > hourAgo).length;
        const dailyRequests = data.requests.filter(time => time > dayAgo).length;
        const hourlyExceeded = hourlyRequests >= hourlyLimit;
        const dailyExceeded = dailyRequests >= dailyLimit;
        const exceeded = hourlyExceeded || dailyExceeded;
        // Calculate reset time (next hour or next day, whichever is more restrictive)
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const resetTime = hourlyExceeded ? nextHour : nextDay;
        // Calculate remaining requests
        const hourlyRemaining = Math.max(0, hourlyLimit - hourlyRequests);
        const dailyRemaining = Math.max(0, dailyLimit - dailyRequests);
        const remaining = Math.min(hourlyRemaining, dailyRemaining);
        return {
            remaining,
            resetTime,
            exceeded,
        };
    }
    /**
     * Record a request for rate limiting
     */
    async recordRequest(apiKey) {
        const now = new Date();
        const data = this.getOrCreateRateLimitData(apiKey, now);
        data.requests.push(now);
        data.lastAccess = now;
    }
    /**
     * Get or create rate limit data for an API key
     */
    getOrCreateRateLimitData(apiKey, now) {
        let data = this.storage.get(apiKey);
        if (!data) {
            data = {
                requests: [],
                lastAccess: now,
            };
            this.storage.set(apiKey, data);
        }
        return data;
    }
    /**
     * Clean up old request entries
     */
    cleanupOldEntries(data, now) {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        data.requests = data.requests.filter(time => time > dayAgo);
    }
    /**
     * Clean up expired API key data
     */
    cleanup() {
        const now = new Date();
        const expiredThreshold = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
        for (const [apiKey, data] of this.storage.entries()) {
            if (data.lastAccess < expiredThreshold) {
                this.storage.delete(apiKey);
            }
        }
    }
    /**
     * Clear all rate limit data (useful for testing)
     */
    clear() {
        this.storage.clear();
    }
    /**
     * Destroy the rate limiter and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.storage.clear();
    }
}
exports.RateLimiter = RateLimiter;
