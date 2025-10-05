"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioProcessManager = void 0;
const events_1 = require("events");
const StdioAdapter_1 = require("./StdioAdapter");
/**
 * STDIO Process Manager
 *
 * Manages multiple STDIO adapters and their lifecycle
 */
class StdioProcessManager extends events_1.EventEmitter {
    constructor(options = {}) {
        var _a, _b, _c;
        super();
        this.adapters = new Map();
        this.options = {
            maxProcesses: (_a = options.maxProcesses) !== null && _a !== void 0 ? _a : 100,
            defaultAdapterOptions: (_b = options.defaultAdapterOptions) !== null && _b !== void 0 ? _b : {},
            cleanupInterval: (_c = options.cleanupInterval) !== null && _c !== void 0 ? _c : 60000 // 1 minute
        };
        this.startCleanupTimer();
    }
    /**
     * Create a new STDIO adapter
     */
    async createAdapter(serverId, config, options) {
        if (this.adapters.size >= this.options.maxProcesses) {
            throw new Error(`Maximum number of processes reached: ${this.options.maxProcesses}`);
        }
        const adapterId = this.generateAdapterId(serverId);
        const adapterOptions = Object.assign(Object.assign({}, this.options.defaultAdapterOptions), options);
        const adapter = new StdioAdapter_1.StdioAdapter(adapterId, serverId, config, adapterOptions);
        // Set up event listeners
        this.setupAdapterEventListeners(adapter);
        // Store the adapter
        this.adapters.set(adapterId, adapter);
        // Start the adapter
        await adapter.start();
        this.emit('adapterCreated', { adapterId, serverId });
        return adapter;
    }
    /**
     * Get an existing adapter by ID
     */
    getAdapter(adapterId) {
        return this.adapters.get(adapterId);
    }
    /**
     * Get all adapters for a specific server
     */
    getAdaptersByServer(serverId) {
        return Array.from(this.adapters.values()).filter(adapter => adapter.serverId === serverId);
    }
    /**
     * Get all active adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    /**
     * Remove and stop an adapter
     */
    async removeAdapter(adapterId) {
        const adapter = this.adapters.get(adapterId);
        if (!adapter) {
            return;
        }
        await adapter.stop();
        this.adapters.delete(adapterId);
        this.emit('adapterRemoved', { adapterId, serverId: adapter.serverId });
    }
    /**
     * Remove all adapters for a specific server
     */
    async removeAdaptersByServer(serverId) {
        const adapters = this.getAdaptersByServer(serverId);
        await Promise.all(adapters.map(adapter => this.removeAdapter(adapter.id)));
    }
    /**
     * Restart an adapter
     */
    async restartAdapter(adapterId) {
        const adapter = this.adapters.get(adapterId);
        if (!adapter) {
            throw new Error(`Adapter not found: ${adapterId}`);
        }
        await adapter.restart();
        this.emit('adapterRestarted', { adapterId, serverId: adapter.serverId });
    }
    /**
     * Get health status of all adapters
     */
    getHealthStatus() {
        const healthMap = new Map();
        for (const [adapterId, adapter] of this.adapters) {
            healthMap.set(adapterId, adapter.getHealth());
        }
        return healthMap;
    }
    /**
     * Get health status of a specific adapter
     */
    getAdapterHealth(adapterId) {
        const adapter = this.adapters.get(adapterId);
        return adapter === null || adapter === void 0 ? void 0 : adapter.getHealth();
    }
    /**
     * Get process statistics
     */
    getStatistics() {
        const adapters = Array.from(this.adapters.values());
        const states = adapters.map(adapter => adapter.getProcessState().status);
        return {
            totalAdapters: adapters.length,
            runningAdapters: states.filter(status => status === 'running').length,
            errorAdapters: states.filter(status => status === 'error').length,
            stoppedAdapters: states.filter(status => status === 'stopped').length,
            memoryUsage: process.memoryUsage()
        };
    }
    /**
     * Cleanup stopped or errored adapters
     */
    async cleanup() {
        const adaptersToRemove = [];
        for (const [adapterId, adapter] of this.adapters) {
            const state = adapter.getProcessState();
            const health = adapter.getHealth();
            // Remove adapters that have been stopped for too long or have too many restart attempts
            if (state.status === 'stopped' ||
                (state.status === 'error' && state.restartCount >= 3) ||
                health.status === 'unhealthy') {
                const timeSinceLastActivity = state.lastActivity
                    ? Date.now() - state.lastActivity.getTime()
                    : Infinity;
                // Remove if inactive for more than 5 minutes
                if (timeSinceLastActivity > 5 * 60 * 1000) {
                    adaptersToRemove.push(adapterId);
                }
            }
        }
        // Remove identified adapters
        for (const adapterId of adaptersToRemove) {
            await this.removeAdapter(adapterId);
        }
        if (adaptersToRemove.length > 0) {
            this.emit('cleanup', { removedAdapters: adaptersToRemove });
        }
    }
    /**
     * Shutdown all adapters and cleanup
     */
    async shutdown() {
        this.stopCleanupTimer();
        // Stop all adapters
        const shutdownPromises = Array.from(this.adapters.keys()).map(adapterId => this.removeAdapter(adapterId));
        await Promise.all(shutdownPromises);
        this.emit('shutdown');
    }
    /**
     * Generate a unique adapter ID
     */
    generateAdapterId(serverId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `stdio_${serverId}_${timestamp}_${random}`;
    }
    /**
     * Set up event listeners for an adapter
     */
    setupAdapterEventListeners(adapter) {
        adapter.on('started', (adapterId) => {
            this.emit('adapterStarted', { adapterId, serverId: adapter.serverId });
        });
        adapter.on('stopped', (adapterId) => {
            this.emit('adapterStopped', { adapterId, serverId: adapter.serverId });
        });
        adapter.on('error', (error) => {
            this.emit('adapterError', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                error
            });
        });
        adapter.on('exit', (exitInfo) => {
            this.emit('adapterExit', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                exitInfo
            });
        });
        adapter.on('healthCheck', (health) => {
            this.emit('adapterHealthCheck', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                health
            });
        });
        adapter.on('message', (message) => {
            this.emit('adapterMessage', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                message
            });
        });
        adapter.on('stderr', (message) => {
            this.emit('adapterStderr', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                message
            });
        });
        adapter.on('parseError', (parseError) => {
            this.emit('adapterParseError', {
                adapterId: adapter.id,
                serverId: adapter.serverId,
                parseError
            });
        });
    }
    /**
     * Start the cleanup timer
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup().catch(error => {
                this.emit('error', error);
            });
        }, this.options.cleanupInterval);
    }
    /**
     * Stop the cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
}
exports.StdioProcessManager = StdioProcessManager;
