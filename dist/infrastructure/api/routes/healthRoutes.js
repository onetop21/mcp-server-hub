"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
/**
 * Health Check Routes
 *
 * - GET /health - System health check
 * - GET /health/ready - Readiness probe
 * - GET /health/live - Liveness probe
 */
function healthRoutes(container) {
    const router = (0, express_1.Router)();
    /**
     * Basic health check
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0'
        });
    });
    /**
     * Kubernetes readiness probe
     */
    router.get('/health/ready', (req, res) => {
        // TODO: Check if all dependencies are ready (DB, Redis, etc)
        res.json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    });
    /**
     * Kubernetes liveness probe
     */
    router.get('/health/live', (req, res) => {
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString()
        });
    });
    return router;
}
exports.healthRoutes = healthRoutes;
