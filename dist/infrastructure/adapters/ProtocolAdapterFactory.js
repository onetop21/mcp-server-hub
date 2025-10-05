"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolAdapterFactory = exports.AdapterStatus = void 0;
const events_1 = require("events");
const Server_1 = require("../../domain/models/Server");
const StdioAdapter_1 = require("./StdioAdapter");
const SseAdapter_1 = require("./SseAdapter");
const HttpAdapter_1 = require("./HttpAdapter");
var AdapterStatus;
(function (AdapterStatus) {
    AdapterStatus["INITIALIZING"] = "initializing";
    AdapterStatus["CONNECTED"] = "connected";
    AdapterStatus["DISCONNECTED"] = "disconnected";
    AdapterStatus["ERROR"] = "error";
    AdapterStatus["RECONNECTING"] = "reconnecting";
})(AdapterStatus = exports.AdapterStatus || (exports.AdapterStatus = {}));
/**
 * Enhanced Factory for creating and managing protocol adapters with lifecycle management
 */
class ProtocolAdapterFactory extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.adapters = new Map();
        this.isShuttingDown = false;
        this.options = {
            stdio: options.stdio || {},
            sse: options.sse || {},
            http: options.http || {},
            healthCheckInterval: options.healthCheckInterval || 30000,
            maxConcurrentAdapters: options.maxConcurrentAdapters || 100,
            enableAutoRestart: options.enableAutoRestart !== false
        };
        // Start health monitoring
        this.startHealthMonitoring();
        // Handle process shutdown gracefully (only in production)
        if (process.env.NODE_ENV !== 'test') {
            process.on('SIGTERM', () => this.gracefulShutdown());
            process.on('SIGINT', () => this.gracefulShutdown());
        }
    }
    /**
     * Create a protocol adapter for a server with enhanced lifecycle management
     */
    async createAdapter(serverId, serverConfig) {
        if (this.isShuttingDown) {
            throw new Error('Factory is shutting down, cannot create new adapters');
        }
        if (this.adapters.size >= this.options.maxConcurrentAdapters) {
            throw new Error(`Maximum concurrent adapters limit reached: ${this.options.maxConcurrentAdapters}`);
        }
        const adapterId = this.generateAdapterId(serverId);
        const protocol = this.determineProtocol(serverConfig);
        // Create adapter instance with initial metadata
        const adapterInstance = {
            id: adapterId,
            serverId,
            protocol,
            adapter: null,
            status: AdapterStatus.INITIALIZING,
            createdAt: new Date(),
            metadata: {
                requestCount: 0,
                errorCount: 0,
                uptime: 0,
                restartCount: 0
            }
        };
        this.adapters.set(adapterId, adapterInstance);
        this.emitLifecycleEvent(adapterInstance, AdapterStatus.INITIALIZING);
        try {
            let adapter;
            switch (protocol) {
                case Server_1.ServerProtocol.STDIO:
                    if (!serverConfig.stdio || !serverConfig.stdio.command || serverConfig.stdio.command.trim() === '') {
                        throw new Error('STDIO configuration is required for STDIO protocol');
                    }
                    adapter = new StdioAdapter_1.StdioAdapter(adapterId, serverId, serverConfig.stdio, this.options.stdio);
                    this.setupAdapterEventListeners(adapter, adapterInstance);
                    await adapter.start();
                    break;
                case Server_1.ServerProtocol.SSE:
                    if (!serverConfig.sse || !serverConfig.sse.url || serverConfig.sse.url.trim() === '') {
                        throw new Error('SSE configuration is required for SSE protocol');
                    }
                    adapter = new SseAdapter_1.SseAdapter(adapterId, serverId, serverConfig.sse, this.options.sse);
                    this.setupAdapterEventListeners(adapter, adapterInstance);
                    await adapter.connect();
                    break;
                case Server_1.ServerProtocol.HTTP:
                    if (!serverConfig.http || !serverConfig.http.baseUrl || serverConfig.http.baseUrl.trim() === '') {
                        throw new Error('HTTP configuration is required for HTTP protocol');
                    }
                    adapter = new HttpAdapter_1.HttpAdapter(adapterId, serverId, serverConfig.http, this.options.http);
                    this.setupAdapterEventListeners(adapter, adapterInstance);
                    await adapter.initialize();
                    break;
                default:
                    throw new Error(`Unsupported protocol: ${protocol}`);
            }
            adapterInstance.adapter = adapter;
            adapterInstance.status = AdapterStatus.CONNECTED;
            this.emitLifecycleEvent(adapterInstance, AdapterStatus.CONNECTED);
            return adapterInstance;
        }
        catch (error) {
            adapterInstance.status = AdapterStatus.ERROR;
            adapterInstance.metadata.lastError = error instanceof Error ? error.message : String(error);
            this.emitLifecycleEvent(adapterInstance, AdapterStatus.ERROR, error instanceof Error ? error.message : String(error));
            // Remove failed adapter from registry
            this.adapters.delete(adapterId);
            throw error;
        }
    }
    /**
     * Get an existing adapter by ID
     */
    getAdapter(adapterId) {
        return this.adapters.get(adapterId);
    }
    /**
     * Get all adapters for a server
     */
    getAdaptersByServer(serverId) {
        return Array.from(this.adapters.values())
            .filter(instance => instance.serverId === serverId);
    }
    /**
     * Get all active adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    /**
     * Remove and cleanup an adapter
     */
    async removeAdapter(adapterId) {
        const instance = this.adapters.get(adapterId);
        if (!instance) {
            return;
        }
        // Cleanup based on adapter type
        switch (instance.protocol) {
            case Server_1.ServerProtocol.STDIO:
                await instance.adapter.stop();
                break;
            case Server_1.ServerProtocol.SSE:
                await instance.adapter.disconnect();
                break;
            case Server_1.ServerProtocol.HTTP:
                await instance.adapter.cleanup();
                break;
        }
        this.adapters.delete(adapterId);
    }
    /**
     * Remove all adapters for a server
     */
    async removeAdaptersByServer(serverId) {
        const serverAdapters = this.getAdaptersByServer(serverId);
        await Promise.all(serverAdapters.map(instance => this.removeAdapter(instance.id)));
    }
    /**
     * Cleanup all adapters
     */
    async cleanup() {
        const adapterIds = Array.from(this.adapters.keys());
        await Promise.all(adapterIds.map(id => this.removeAdapter(id)));
    }
    /**
     * Get enhanced adapter health status with metadata
     */
    getAdapterHealth(adapterId) {
        const instance = this.adapters.get(adapterId);
        if (!instance) {
            return {
                adapterId,
                status: 'unknown',
                lastCheck: new Date(),
                error: 'Adapter not found'
            };
        }
        let baseHealth;
        try {
            switch (instance.protocol) {
                case Server_1.ServerProtocol.STDIO:
                    baseHealth = instance.adapter.getHealth();
                    break;
                case Server_1.ServerProtocol.SSE:
                    baseHealth = instance.adapter.getHealth();
                    break;
                case Server_1.ServerProtocol.HTTP:
                    baseHealth = instance.adapter.getHealth();
                    break;
                default:
                    baseHealth = {
                        adapterId,
                        status: 'unknown',
                        lastCheck: new Date(),
                        error: 'Unknown protocol'
                    };
            }
        }
        catch (error) {
            baseHealth = {
                adapterId,
                status: 'unhealthy',
                lastCheck: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
        // Enhance with factory-level metadata
        return Object.assign(Object.assign({}, baseHealth), { metadata: Object.assign(Object.assign({}, instance.metadata), { uptime: Date.now() - instance.createdAt.getTime() }) });
    }
    /**
     * Send a request through an adapter with usage tracking
     */
    async sendRequest(adapterId, request) {
        const instance = this.adapters.get(adapterId);
        if (!instance) {
            throw new Error(`Adapter not found: ${adapterId}`);
        }
        if (instance.status !== AdapterStatus.CONNECTED) {
            throw new Error(`Adapter not connected: ${instance.status}`);
        }
        try {
            instance.metadata.requestCount++;
            instance.lastUsedAt = new Date();
            let result;
            switch (instance.protocol) {
                case Server_1.ServerProtocol.STDIO:
                    result = await instance.adapter.sendRequest(request);
                    break;
                case Server_1.ServerProtocol.SSE:
                    result = await instance.adapter.sendRequest(request);
                    break;
                case Server_1.ServerProtocol.HTTP:
                    result = await instance.adapter.sendRequest(request);
                    break;
                default:
                    throw new Error(`Unsupported protocol: ${instance.protocol}`);
            }
            return result;
        }
        catch (error) {
            instance.metadata.errorCount++;
            instance.metadata.lastError = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    /**
     * Send a streaming request through an adapter with usage tracking
     */
    streamRequest(adapterId, request) {
        return __asyncGenerator(this, arguments, function* streamRequest_1() {
            const instance = this.adapters.get(adapterId);
            if (!instance) {
                throw new Error(`Adapter not found: ${adapterId}`);
            }
            if (instance.status !== AdapterStatus.CONNECTED) {
                throw new Error(`Adapter not connected: ${instance.status}`);
            }
            try {
                instance.metadata.requestCount++;
                instance.lastUsedAt = new Date();
                switch (instance.protocol) {
                    case Server_1.ServerProtocol.STDIO:
                        yield __await(yield* __asyncDelegator(__asyncValues(instance.adapter.streamRequest(request))));
                        break;
                    case Server_1.ServerProtocol.SSE:
                        yield __await(yield* __asyncDelegator(__asyncValues(instance.adapter.streamRequest(request))));
                        break;
                    case Server_1.ServerProtocol.HTTP:
                        yield __await(yield* __asyncDelegator(__asyncValues(instance.adapter.streamRequest(request))));
                        break;
                    default:
                        throw new Error(`Unsupported protocol: ${instance.protocol}`);
                }
            }
            catch (error) {
                instance.metadata.errorCount++;
                instance.metadata.lastError = error instanceof Error ? error.message : String(error);
                throw error;
            }
        });
    }
    /**
     * Determine protocol from server configuration
     */
    determineProtocol(config) {
        if (config.stdio !== undefined) {
            return Server_1.ServerProtocol.STDIO;
        }
        else if (config.sse !== undefined) {
            return Server_1.ServerProtocol.SSE;
        }
        else if (config.http !== undefined) {
            return Server_1.ServerProtocol.HTTP;
        }
        else {
            throw new Error('No valid protocol configuration found');
        }
    }
    /**
     * Get comprehensive adapter statistics
     */
    getAdapterStatistics() {
        const stats = {
            totalAdapters: this.adapters.size,
            adaptersByProtocol: {},
            adaptersByStatus: {},
            totalRequests: 0,
            totalErrors: 0,
            averageUptime: 0
        };
        let totalUptime = 0;
        for (const instance of this.adapters.values()) {
            // Count by protocol
            stats.adaptersByProtocol[instance.protocol] = (stats.adaptersByProtocol[instance.protocol] || 0) + 1;
            // Count by status
            stats.adaptersByStatus[instance.status] = (stats.adaptersByStatus[instance.status] || 0) + 1;
            // Aggregate metrics
            stats.totalRequests += instance.metadata.requestCount;
            stats.totalErrors += instance.metadata.errorCount;
            // Calculate uptime
            const uptime = Date.now() - instance.createdAt.getTime();
            totalUptime += uptime;
        }
        stats.averageUptime = this.adapters.size > 0 ? totalUptime / this.adapters.size : 0;
        return stats;
    }
    /**
     * Restart an adapter
     */
    async restartAdapter(adapterId) {
        const instance = this.adapters.get(adapterId);
        if (!instance) {
            throw new Error(`Adapter not found: ${adapterId}`);
        }
        instance.status = AdapterStatus.RECONNECTING;
        instance.metadata.restartCount++;
        this.emitLifecycleEvent(instance, AdapterStatus.RECONNECTING);
        try {
            // Stop the current adapter
            await this.stopAdapter(instance);
            // Restart based on protocol
            switch (instance.protocol) {
                case Server_1.ServerProtocol.STDIO:
                    await instance.adapter.start();
                    break;
                case Server_1.ServerProtocol.SSE:
                    await instance.adapter.connect();
                    break;
                case Server_1.ServerProtocol.HTTP:
                    await instance.adapter.initialize();
                    break;
            }
            instance.status = AdapterStatus.CONNECTED;
            this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
        }
        catch (error) {
            instance.status = AdapterStatus.ERROR;
            instance.metadata.lastError = error instanceof Error ? error.message : String(error);
            this.emitLifecycleEvent(instance, AdapterStatus.ERROR, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    /**
     * Graceful shutdown of all adapters
     */
    async gracefulShutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        this.stopHealthMonitoring();
        const shutdownPromises = Array.from(this.adapters.values()).map(async (instance) => {
            try {
                await this.stopAdapter(instance);
            }
            catch (error) {
                // Log error but don't throw to allow other adapters to shutdown
                this.emit('error', { adapterId: instance.id, error });
            }
        });
        await Promise.allSettled(shutdownPromises);
        this.adapters.clear();
        this.emit('shutdown');
    }
    /**
     * Setup event listeners for an adapter
     */
    setupAdapterEventListeners(adapter, instance) {
        // Common event handlers for all adapter types
        adapter.on('error', (error) => {
            instance.status = AdapterStatus.ERROR;
            instance.metadata.errorCount++;
            instance.metadata.lastError = error.message;
            this.emitLifecycleEvent(instance, AdapterStatus.ERROR, error.message);
            // Auto-restart if enabled
            if (this.options.enableAutoRestart && instance.metadata.restartCount < 3) {
                setTimeout(() => {
                    this.restartAdapter(instance.id).catch(err => this.emit('error', { adapterId: instance.id, error: err }));
                }, 5000);
            }
        });
        // Protocol-specific event handlers
        if (adapter instanceof StdioAdapter_1.StdioAdapter) {
            adapter.on('started', () => {
                instance.status = AdapterStatus.CONNECTED;
                this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
            });
            adapter.on('stopped', () => {
                instance.status = AdapterStatus.DISCONNECTED;
                this.emitLifecycleEvent(instance, AdapterStatus.DISCONNECTED);
            });
        }
        else if (adapter instanceof SseAdapter_1.SseAdapter) {
            adapter.on('connected', () => {
                instance.status = AdapterStatus.CONNECTED;
                this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
            });
            adapter.on('disconnected', () => {
                instance.status = AdapterStatus.DISCONNECTED;
                this.emitLifecycleEvent(instance, AdapterStatus.DISCONNECTED);
            });
        }
        else if (adapter instanceof HttpAdapter_1.HttpAdapter) {
            adapter.on('initialized', () => {
                instance.status = AdapterStatus.CONNECTED;
                this.emitLifecycleEvent(instance, AdapterStatus.CONNECTED);
            });
        }
    }
    /**
     * Stop an individual adapter
     */
    async stopAdapter(instance) {
        switch (instance.protocol) {
            case Server_1.ServerProtocol.STDIO:
                await instance.adapter.stop();
                break;
            case Server_1.ServerProtocol.SSE:
                await instance.adapter.disconnect();
                break;
            case Server_1.ServerProtocol.HTTP:
                await instance.adapter.cleanup();
                break;
        }
    }
    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks();
        }, this.options.healthCheckInterval);
    }
    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
    }
    /**
     * Perform health checks on all adapters
     */
    performHealthChecks() {
        for (const instance of this.adapters.values()) {
            try {
                const health = this.getAdapterHealth(instance.id);
                // Update metadata based on health
                instance.metadata.uptime = Date.now() - instance.createdAt.getTime();
                // Emit health check event
                this.emit('healthCheck', {
                    adapterId: instance.id,
                    serverId: instance.serverId,
                    health
                });
                // Handle unhealthy adapters
                if (health.status === 'unhealthy' &&
                    instance.status === AdapterStatus.CONNECTED &&
                    this.options.enableAutoRestart) {
                    this.restartAdapter(instance.id).catch(error => this.emit('error', { adapterId: instance.id, error }));
                }
            }
            catch (error) {
                this.emit('error', { adapterId: instance.id, error });
            }
        }
    }
    /**
     * Emit lifecycle event
     */
    emitLifecycleEvent(instance, status, error) {
        const event = {
            adapterId: instance.id,
            serverId: instance.serverId,
            protocol: instance.protocol,
            status,
            timestamp: new Date(),
            error
        };
        this.emit('lifecycleEvent', event);
    }
    /**
     * Generate a unique adapter ID
     */
    generateAdapterId(serverId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `adapter_${serverId}_${timestamp}_${random}`;
    }
}
exports.ProtocolAdapterFactory = ProtocolAdapterFactory;
