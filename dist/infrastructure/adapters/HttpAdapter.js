"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpAdapter = void 0;
const events_1 = require("events");
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * HTTP Protocol Adapter for MCP servers
 *
 * Manages HTTP connections to MCP servers with connection pooling and retry logic
 */
class HttpAdapter extends events_1.EventEmitter {
    constructor(id, serverId, config, options = {}) {
        var _a, _b, _c, _d, _e;
        super();
        this.id = id;
        this.serverId = serverId;
        this.config = config;
        this.connectionPool = new Map();
        this.activeRequests = new Set();
        this.options = {
            requestTimeout: (_a = options.requestTimeout) !== null && _a !== void 0 ? _a : 30000,
            healthCheckInterval: (_b = options.healthCheckInterval) !== null && _b !== void 0 ? _b : 30000,
            maxConcurrentRequests: (_c = options.maxConcurrentRequests) !== null && _c !== void 0 ? _c : 10,
            retryAttempts: (_d = options.retryAttempts) !== null && _d !== void 0 ? _d : 3,
            retryDelay: (_e = options.retryDelay) !== null && _e !== void 0 ? _e : 1000
        };
        this.connectionState = {
            status: 'ready',
            requestCount: 0,
            errorCount: 0
        };
        // Initialize connection pool
        this.initializeConnectionPool();
        // Start health check monitoring
        this.startHealthCheck();
    }
    /**
     * Initialize the adapter (HTTP adapters are typically stateless)
     */
    async initialize() {
        try {
            // Perform a health check to verify the server is reachable
            await this.performHealthCheck();
            this.connectionState.status = 'ready';
            this.connectionState.lastActivity = new Date();
            this.emit('initialized', this.id);
        }
        catch (error) {
            this.connectionState.status = 'error';
            this.connectionState.error = error instanceof Error ? error.message : String(error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Cleanup the adapter
     */
    async cleanup() {
        this.stopHealthCheck();
        // Wait for active requests to complete
        const maxWaitTime = 5000; // 5 seconds
        const startTime = Date.now();
        while (this.activeRequests.size > 0 && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Clear connection pool
        this.connectionPool.clear();
        this.activeRequests.clear();
        this.emit('cleanup', this.id);
    }
    /**
     * Send a request to the MCP server via HTTP
     */
    async sendRequest(request) {
        var _a;
        if (this.connectionState.status === 'error') {
            throw new Error(`Adapter in error state: ${this.connectionState.error}`);
        }
        if (this.activeRequests.size >= this.options.maxConcurrentRequests) {
            throw new Error('Max concurrent requests reached');
        }
        const requestId = String((_a = request.id) !== null && _a !== void 0 ? _a : this.generateRequestId());
        this.activeRequests.add(requestId);
        try {
            const response = await this.executeRequestWithRetry(Object.assign(Object.assign({}, request), { id: requestId }));
            this.connectionState.requestCount++;
            this.connectionState.lastActivity = new Date();
            return response;
        }
        catch (error) {
            this.connectionState.errorCount++;
            this.connectionState.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
        finally {
            this.activeRequests.delete(requestId);
        }
    }
    /**
     * Send a streaming request to the MCP server
     */
    streamRequest(request) {
        var _a;
        return __asyncGenerator(this, arguments, function* streamRequest_1() {
            var _b, e_1, _c, _d;
            if (this.connectionState.status === 'error') {
                throw new Error(`Adapter in error state: ${this.connectionState.error}`);
            }
            const requestId = String((_a = request.id) !== null && _a !== void 0 ? _a : this.generateRequestId());
            this.activeRequests.add(requestId);
            try {
                const url = new URL('/stream', this.config.baseUrl);
                const headers = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'text/event-stream' }, this.config.headers);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout);
                try {
                    const response = yield __await((0, node_fetch_1.default)(url.toString(), {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(Object.assign(Object.assign({}, request), { id: requestId })),
                        signal: controller.signal
                    }));
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
                    }
                    if (!response.body) {
                        throw new Error('No response body for streaming request');
                    }
                    let buffer = '';
                    try {
                        // Handle Node.js readable stream
                        for (var _e = true, _f = __asyncValues(response.body), _g; _g = yield __await(_f.next()), _b = _g.done, !_b;) {
                            _d = _g.value;
                            _e = false;
                            try {
                                const chunk = _d;
                                buffer += chunk.toString();
                                // Process complete lines
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                                for (const line of lines) {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine) {
                                        const data = this.parseStreamData(trimmedLine);
                                        if (data) {
                                            yield yield __await(data);
                                            if (data.done) {
                                                return yield __await(void 0);
                                            }
                                        }
                                    }
                                }
                            }
                            finally {
                                _e = true;
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_e && !_b && (_c = _f.return)) yield __await(_c.call(_f));
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    // Process any remaining data in buffer
                    if (buffer.trim()) {
                        const data = this.parseStreamData(buffer.trim());
                        if (data) {
                            yield yield __await(data);
                        }
                    }
                    this.connectionState.requestCount++;
                    this.connectionState.lastActivity = new Date();
                }
                catch (error) {
                    clearTimeout(timeoutId);
                    this.connectionState.errorCount++;
                    this.connectionState.error = error instanceof Error ? error.message : String(error);
                    throw error;
                }
            }
            finally {
                this.activeRequests.delete(requestId);
            }
        });
    }
    /**
     * Get adapter health status
     */
    getHealth() {
        const now = new Date();
        let status = 'unknown';
        if (this.connectionState.status === 'ready') {
            const errorRate = this.connectionState.requestCount > 0
                ? this.connectionState.errorCount / this.connectionState.requestCount
                : 0;
            status = errorRate < 0.1 ? 'healthy' : 'unhealthy'; // Less than 10% error rate
        }
        else {
            status = 'unhealthy';
        }
        return {
            adapterId: this.id,
            status,
            lastCheck: now,
            error: this.connectionState.error
        };
    }
    /**
     * Get current connection state
     */
    getConnectionState() {
        return Object.assign({}, this.connectionState);
    }
    /**
     * Get connection pool statistics
     */
    getConnectionPoolStats() {
        const totalConnections = this.connectionPool.size;
        const activeConnections = Array.from(this.connectionPool.values())
            .filter(entry => entry.inUse).length;
        return {
            totalConnections,
            activeConnections,
            availableConnections: totalConnections - activeConnections
        };
    }
    /**
     * Execute request with retry logic
     */
    async executeRequestWithRetry(request) {
        let lastError = null;
        for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
            try {
                return await this.executeHttpRequest(request);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on the last attempt
                if (attempt === this.options.retryAttempts) {
                    break;
                }
                // Don't retry on client errors (4xx)
                if (lastError.message.includes('4')) {
                    break;
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * Math.pow(2, attempt)));
            }
        }
        throw lastError;
    }
    /**
     * Execute a single HTTP request
     */
    async executeHttpRequest(request) {
        const url = new URL('/request', this.config.baseUrl);
        const headers = Object.assign({ 'Content-Type': 'application/json' }, this.config.headers);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout);
        try {
            const response = await (0, node_fetch_1.default)(url.toString(), {
                method: 'POST',
                headers,
                body: JSON.stringify(request),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
            }
            const responseData = await response.json();
            return responseData;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * Parse streaming data from SSE format
     */
    parseStreamData(line) {
        try {
            // Handle SSE format: "data: {...}"
            if (line.startsWith('data: ')) {
                const jsonData = line.substring(6);
                const parsed = JSON.parse(jsonData);
                return {
                    data: parsed.result || parsed,
                    done: parsed.done || false
                };
            }
            // Handle plain JSON
            const parsed = JSON.parse(line);
            return {
                data: parsed.result || parsed,
                done: parsed.done || false
            };
        }
        catch (error) {
            this.emit('parseError', { line, error });
            return null;
        }
    }
    /**
     * Perform health check
     */
    async performHealthCheck() {
        const healthRequest = {
            method: 'ping',
            id: 'health_check'
        };
        try {
            await this.executeHttpRequest(healthRequest);
        }
        catch (error) {
            // If ping fails, try a basic request to see if server is responsive
            const basicRequest = {
                method: 'tools/list',
                id: 'health_check_tools'
            };
            await this.executeHttpRequest(basicRequest);
        }
    }
    /**
     * Initialize connection pool
     */
    initializeConnectionPool() {
        // HTTP adapters typically don't need persistent connections
        // but we can track connection metadata for monitoring
        const poolEntry = {
            id: this.generateConnectionId(),
            inUse: false,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            requestCount: 0
        };
        this.connectionPool.set(poolEntry.id, poolEntry);
    }
    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate a unique connection ID
     */
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Start health check monitoring
     */
    startHealthCheck() {
        this.healthCheckTimer = setInterval(async () => {
            try {
                await this.performHealthCheck();
                this.connectionState.status = 'ready';
                this.connectionState.error = undefined;
                const health = this.getHealth();
                this.emit('healthCheck', health);
            }
            catch (error) {
                this.connectionState.status = 'error';
                this.connectionState.error = error instanceof Error ? error.message : String(error);
                const health = this.getHealth();
                this.emit('healthCheck', health);
                // Don't emit error for health check failures to avoid unhandled errors
            }
        }, this.options.healthCheckInterval);
    }
    /**
     * Stop health check monitoring
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
    }
}
exports.HttpAdapter = HttpAdapter;
