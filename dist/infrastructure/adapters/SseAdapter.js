"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
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
exports.SseAdapter = void 0;
const events_1 = require("events");
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * SSE (Server-Sent Events) Protocol Adapter for MCP servers
 *
 * Manages SSE connections to MCP servers and handles streaming communication
 */
class SseAdapter extends events_1.EventEmitter {
    constructor(id, serverId, config, options = {}) {
        var _a, _b, _c, _d, _e;
        super();
        this.id = id;
        this.serverId = serverId;
        this.config = config;
        this.pendingRequests = new Map();
        this.options = {
            maxReconnects: (_a = options.maxReconnects) !== null && _a !== void 0 ? _a : 5,
            reconnectDelay: (_b = options.reconnectDelay) !== null && _b !== void 0 ? _b : 2000,
            healthCheckInterval: (_c = options.healthCheckInterval) !== null && _c !== void 0 ? _c : 30000,
            requestTimeout: (_d = options.requestTimeout) !== null && _d !== void 0 ? _d : 30000,
            connectionTimeout: (_e = options.connectionTimeout) !== null && _e !== void 0 ? _e : 10000
        };
        this.connectionState = {
            status: 'disconnected',
            reconnectCount: 0
        };
        // Start health check monitoring
        this.startHealthCheck();
    }
    /**
     * Connect to the SSE endpoint
     */
    async connect() {
        if (this.connectionState.status === 'connected' || this.connectionState.status === 'connecting') {
            return;
        }
        this.connectionState.status = 'connecting';
        try {
            await this.createConnection();
            this.connectionState.status = 'connected';
            this.connectionState.connectedAt = new Date();
            this.connectionState.lastActivity = new Date();
            this.emit('connected', this.id);
        }
        catch (error) {
            this.connectionState.status = 'error';
            this.connectionState.error = error instanceof Error ? error.message : String(error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Disconnect from the SSE endpoint
     */
    async disconnect() {
        this.stopHealthCheck();
        this.stopReconnectTimer();
        if (this.eventSource) {
            this.connectionState.status = 'disconnected';
            // Reject all pending requests
            for (const [id, request] of this.pendingRequests) {
                clearTimeout(request.timeout);
                request.reject(new Error('Adapter disconnected'));
            }
            this.pendingRequests.clear();
            this.eventSource.close();
            this.eventSource = undefined;
            this.emit('disconnected', this.id);
        }
    }
    /**
     * Send a request to the MCP server via SSE
     */
    async sendRequest(request) {
        var _a;
        if (this.connectionState.status !== 'connected') {
            throw new Error(`Adapter not connected: ${this.connectionState.status}`);
        }
        const requestId = (_a = request.id) !== null && _a !== void 0 ? _a : this.generateRequestId();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${requestId}`));
            }, this.options.requestTimeout);
            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            try {
                // For SSE, we typically send requests via a separate HTTP endpoint
                // or through a WebSocket-like mechanism. Here we'll use fetch to send the request
                this.sendHttpRequest(Object.assign(Object.assign({}, request), { id: requestId }))
                    .then(() => {
                    this.connectionState.lastActivity = new Date();
                })
                    .catch((error) => {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    reject(error);
                });
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }
    /**
     * Send a streaming request to the MCP server
     */
    streamRequest(request) {
        var _a;
        return __asyncGenerator(this, arguments, function* streamRequest_1() {
            if (this.connectionState.status !== 'connected') {
                throw new Error(`Adapter not connected: ${this.connectionState.status}`);
            }
            const requestId = (_a = request.id) !== null && _a !== void 0 ? _a : this.generateRequestId();
            let streamEnded = false;
            const streamData = [];
            let streamError = null;
            // Set up a temporary listener for this stream
            const streamListener = (data) => {
                if (data.id === requestId) {
                    if (data.error) {
                        streamError = new Error(data.error.message || 'Stream error');
                        streamEnded = true;
                    }
                    else if (data.done) {
                        streamData.push({ data: data.result, done: true });
                        streamEnded = true;
                    }
                    else {
                        streamData.push({ data: data.result, done: false });
                    }
                }
            };
            this.on('streamData', streamListener);
            try {
                // Send the streaming request
                yield __await(this.sendHttpRequest(Object.assign(Object.assign({}, request), { id: requestId })));
                this.connectionState.lastActivity = new Date();
                // Yield stream data as it arrives
                while (!streamEnded) {
                    if (streamError) {
                        throw streamError;
                    }
                    while (streamData.length > 0) {
                        const data = streamData.shift();
                        yield yield __await(data);
                        if (data.done) {
                            streamEnded = true;
                            break;
                        }
                    }
                    // Wait a bit before checking again
                    yield __await(new Promise(resolve => setTimeout(resolve, 10)));
                }
            }
            finally {
                this.off('streamData', streamListener);
            }
        });
    }
    /**
     * Get adapter health status
     */
    getHealth() {
        const now = new Date();
        let status = 'unknown';
        if (this.connectionState.status === 'connected' && this.eventSource) {
            const timeSinceActivity = this.connectionState.lastActivity
                ? now.getTime() - this.connectionState.lastActivity.getTime()
                : Infinity;
            status = timeSinceActivity < this.options.healthCheckInterval * 2 ? 'healthy' : 'unhealthy';
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
     * Reconnect to the SSE endpoint
     */
    async reconnect() {
        if (this.connectionState.reconnectCount >= this.options.maxReconnects) {
            throw new Error(`Max reconnect attempts reached: ${this.options.maxReconnects}`);
        }
        this.connectionState.status = 'reconnecting';
        this.connectionState.reconnectCount++;
        await this.disconnect();
        // Wait for reconnect delay
        await new Promise(resolve => setTimeout(resolve, this.options.reconnectDelay));
        await this.connect();
    }
    /**
     * Create the SSE connection
     */
    async createConnection() {
        return new Promise((resolve, reject) => {
            try {
                // Create EventSource with headers if supported
                const url = new URL(this.config.url);
                // Note: EventSource doesn't support custom headers in browsers
                // For Node.js, we might need to use a different SSE client library
                this.eventSource = new EventSource(url.toString());
                // Set up connection timeout
                const connectionTimeout = setTimeout(() => {
                    var _a;
                    if (this.connectionState.status === 'connecting') {
                        (_a = this.eventSource) === null || _a === void 0 ? void 0 : _a.close();
                        reject(new Error('Connection timeout'));
                    }
                }, this.options.connectionTimeout);
                // Handle connection events
                this.eventSource.onopen = () => {
                    clearTimeout(connectionTimeout);
                    resolve();
                };
                this.eventSource.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    this.connectionState.status = 'error';
                    this.connectionState.error = 'SSE connection error';
                    this.emit('error', error);
                    // Auto-reconnect if within limits
                    if (this.connectionState.reconnectCount < this.options.maxReconnects) {
                        this.scheduleReconnect();
                    }
                };
                // Handle incoming messages
                this.eventSource.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                // Handle custom event types for streaming
                this.eventSource.addEventListener('stream', (event) => {
                    this.handleStreamMessage(event.data);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Send HTTP request for SSE communication
     */
    async sendHttpRequest(request) {
        const url = new URL(this.config.url);
        // Typically, SSE servers have a companion HTTP endpoint for sending requests
        url.pathname = url.pathname.replace('/sse', '/request') || '/request';
        const headers = Object.assign({ 'Content-Type': 'application/json' }, this.config.headers);
        const response = await (0, node_fetch_1.default)(url.toString(), {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }
    }
    /**
     * Handle regular SSE message
     */
    handleMessage(data) {
        this.connectionState.lastActivity = new Date();
        try {
            const message = JSON.parse(data);
            // Handle response to a pending request
            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                const request = this.pendingRequests.get(message.id);
                clearTimeout(request.timeout);
                this.pendingRequests.delete(message.id);
                request.resolve(message);
                return;
            }
            // Handle notifications or other messages
            this.emit('message', message);
        }
        catch (error) {
            this.emit('parseError', { data, error });
        }
    }
    /**
     * Handle streaming SSE message
     */
    handleStreamMessage(data) {
        this.connectionState.lastActivity = new Date();
        try {
            const message = JSON.parse(data);
            this.emit('streamData', message);
        }
        catch (error) {
            this.emit('parseError', { data, error });
        }
    }
    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Schedule a reconnection attempt
     */
    scheduleReconnect() {
        this.stopReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.reconnect().catch(error => this.emit('error', error));
        }, this.options.reconnectDelay);
    }
    /**
     * Stop the reconnect timer
     */
    stopReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }
    /**
     * Start health check monitoring
     */
    startHealthCheck() {
        this.healthCheckTimer = setInterval(() => {
            const health = this.getHealth();
            this.emit('healthCheck', health);
            // Auto-reconnect if unhealthy and within reconnect limits
            if (health.status === 'unhealthy' &&
                this.connectionState.status === 'connected' &&
                this.connectionState.reconnectCount < this.options.maxReconnects) {
                this.reconnect().catch(error => this.emit('error', error));
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
exports.SseAdapter = SseAdapter;
