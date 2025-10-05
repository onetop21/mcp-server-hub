"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOL_ADAPTER_SERVICE = exports.ProtocolAdapterService = void 0;
const inversify_1 = require("inversify");
const ProtocolAdapterFactory_1 = require("../../infrastructure/adapters/ProtocolAdapterFactory");
/**
 * Enhanced Protocol Adapter Service Implementation
 *
 * Manages different protocol adapters (STDIO, SSE, HTTP) for MCP servers using the factory pattern
 */
let ProtocolAdapterService = class ProtocolAdapterService {
    constructor() {
        this.adapterMapping = new Map(); // serverId -> adapterId
        this.factory = new ProtocolAdapterFactory_1.ProtocolAdapterFactory({
            stdio: {
                maxRestarts: 3,
                restartDelay: 2000,
                healthCheckInterval: 30000,
                requestTimeout: 30000
            },
            sse: {
                maxReconnects: 5,
                reconnectDelay: 2000,
                healthCheckInterval: 30000,
                requestTimeout: 30000
            },
            http: {
                maxConcurrentRequests: 10,
                requestTimeout: 30000,
                healthCheckInterval: 30000
            },
            healthCheckInterval: 30000,
            maxConcurrentAdapters: 100,
            enableAutoRestart: true
        });
        // Set up event listeners for the factory
        this.setupFactoryEventListeners();
    }
    /**
     * Create a protocol adapter for a server using the enhanced factory
     */
    async createAdapter(serverConfig) {
        const { id: serverId } = serverConfig;
        try {
            const adapterInstance = await this.factory.createAdapter(serverId, serverConfig);
            // Store mapping for easy lookup
            this.adapterMapping.set(serverId, adapterInstance.id);
            // Convert factory instance to service interface
            const protocolAdapter = {
                id: adapterInstance.id,
                serverId: adapterInstance.serverId,
                protocol: adapterInstance.protocol,
                status: this.mapAdapterStatus(adapterInstance.status),
                createdAt: adapterInstance.createdAt,
                lastUsedAt: adapterInstance.lastUsedAt
            };
            return protocolAdapter;
        }
        catch (error) {
            throw new Error(`Failed to create adapter for server ${serverId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Send a request through an adapter using the factory
     */
    async sendRequest(adapterId, request) {
        try {
            return await this.factory.sendRequest(adapterId, request);
        }
        catch (error) {
            throw new Error(`Failed to send request through adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Send a streaming request through an adapter using the factory
     */
    streamRequest(adapterId, request) {
        return __asyncGenerator(this, arguments, function* streamRequest_1() {
            try {
                yield __await(yield* __asyncDelegator(__asyncValues(this.factory.streamRequest(adapterId, request))));
            }
            catch (error) {
                throw new Error(`Failed to stream request through adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    /**
     * Close and cleanup an adapter using the factory
     */
    async closeAdapter(adapterId) {
        try {
            await this.factory.removeAdapter(adapterId);
            // Remove from mapping
            for (const [serverId, mappedAdapterId] of this.adapterMapping.entries()) {
                if (mappedAdapterId === adapterId) {
                    this.adapterMapping.delete(serverId);
                    break;
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to close adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get adapter health status using the factory
     */
    async getAdapterHealth(adapterId) {
        try {
            const health = this.factory.getAdapterHealth(adapterId);
            // Remove metadata from the response to match interface
            const _a = health, { metadata } = _a, baseHealth = __rest(_a, ["metadata"]);
            return baseHealth;
        }
        catch (error) {
            throw new Error(`Failed to get adapter health for ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get all active adapters using the factory
     */
    async getActiveAdapters() {
        const factoryAdapters = this.factory.getAllAdapters();
        return factoryAdapters.map(instance => ({
            id: instance.id,
            serverId: instance.serverId,
            protocol: instance.protocol,
            status: this.mapAdapterStatus(instance.status),
            createdAt: instance.createdAt,
            lastUsedAt: instance.lastUsedAt
        }));
    }
    /**
     * Shutdown all adapters using the factory
     */
    async shutdown() {
        await this.factory.gracefulShutdown();
        this.adapterMapping.clear();
    }
    /**
     * Get adapter by server ID
     */
    getAdapterByServerId(serverId) {
        const adapterId = this.adapterMapping.get(serverId);
        if (!adapterId) {
            return undefined;
        }
        const instance = this.factory.getAdapter(adapterId);
        if (!instance) {
            return undefined;
        }
        return {
            id: instance.id,
            serverId: instance.serverId,
            protocol: instance.protocol,
            status: this.mapAdapterStatus(instance.status),
            createdAt: instance.createdAt,
            lastUsedAt: instance.lastUsedAt
        };
    }
    /**
     * Restart an adapter
     */
    async restartAdapter(adapterId) {
        try {
            await this.factory.restartAdapter(adapterId);
        }
        catch (error) {
            throw new Error(`Failed to restart adapter ${adapterId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get factory statistics
     */
    getStatistics() {
        return this.factory.getAdapterStatistics();
    }
    /**
     * Map factory adapter status to service interface status
     */
    mapAdapterStatus(factoryStatus) {
        switch (factoryStatus) {
            case ProtocolAdapterFactory_1.AdapterStatus.CONNECTED:
                return 'connected';
            case ProtocolAdapterFactory_1.AdapterStatus.DISCONNECTED:
            case ProtocolAdapterFactory_1.AdapterStatus.INITIALIZING:
                return 'disconnected';
            case ProtocolAdapterFactory_1.AdapterStatus.ERROR:
            case ProtocolAdapterFactory_1.AdapterStatus.RECONNECTING:
                return 'error';
            default:
                return 'error';
        }
    }
    /**
     * Set up event listeners for the factory
     */
    setupFactoryEventListeners() {
        this.factory.on('lifecycleEvent', (event) => {
            // Emit service-level events based on factory events
            // This allows the service to maintain its own event interface
            // while leveraging the factory's enhanced capabilities
        });
        this.factory.on('healthCheck', (event) => {
            // Handle health check events from factory
            // Could be used for service-level monitoring and alerting
        });
        this.factory.on('error', (event) => {
            // Handle factory-level errors
            // Could be logged or forwarded to service consumers
        });
        this.factory.on('shutdown', () => {
            // Handle factory shutdown
            // Clean up service-level resources if needed
        });
    }
};
ProtocolAdapterService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], ProtocolAdapterService);
exports.ProtocolAdapterService = ProtocolAdapterService;
exports.PROTOCOL_ADAPTER_SERVICE = Symbol.for('ProtocolAdapterService');
