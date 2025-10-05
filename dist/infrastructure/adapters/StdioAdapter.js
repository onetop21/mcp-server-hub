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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioAdapter = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
/**
 * STDIO Protocol Adapter for MCP servers
 *
 * Manages STDIO-based MCP server processes and handles JSON-RPC communication
 */
class StdioAdapter extends events_1.EventEmitter {
    constructor(id, serverId, config, options = {}) {
        var _a, _b, _c, _d;
        super();
        this.id = id;
        this.serverId = serverId;
        this.config = config;
        this.pendingRequests = new Map();
        this.messageBuffer = '';
        this.options = {
            maxRestarts: (_a = options.maxRestarts) !== null && _a !== void 0 ? _a : 3,
            restartDelay: (_b = options.restartDelay) !== null && _b !== void 0 ? _b : 1000,
            healthCheckInterval: (_c = options.healthCheckInterval) !== null && _c !== void 0 ? _c : 30000,
            requestTimeout: (_d = options.requestTimeout) !== null && _d !== void 0 ? _d : 30000
        };
        this.processState = {
            status: 'stopped',
            restartCount: 0
        };
        // Start health check monitoring
        this.startHealthCheck();
    }
    /**
     * Start the STDIO process
     */
    async start() {
        if (this.processState.status === 'running' || this.processState.status === 'starting') {
            return;
        }
        this.processState.status = 'starting';
        this.processState.startTime = new Date();
        try {
            await this.spawnProcess();
            this.processState.status = 'running';
            this.processState.lastActivity = new Date();
            this.emit('started', this.id);
        }
        catch (error) {
            this.processState.status = 'error';
            this.processState.error = error instanceof Error ? error.message : String(error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Stop the STDIO process
     */
    async stop() {
        this.stopHealthCheck();
        if (this.process) {
            this.processState.status = 'stopped';
            // Reject all pending requests
            for (const [id, request] of this.pendingRequests) {
                clearTimeout(request.timeout);
                request.reject(new Error('Adapter stopped'));
            }
            this.pendingRequests.clear();
            // Gracefully terminate the process
            this.process.kill('SIGTERM');
            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
            this.process = undefined;
            this.emit('stopped', this.id);
        }
    }
    /**
     * Send a request to the MCP server
     */
    async sendRequest(request) {
        var _a;
        if (this.processState.status !== 'running') {
            throw new Error(`Adapter not running: ${this.processState.status}`);
        }
        if (!this.process || !this.process.stdin) {
            throw new Error('Process not available');
        }
        const requestId = (_a = request.id) !== null && _a !== void 0 ? _a : this.generateRequestId();
        const message = JSON.stringify(Object.assign(Object.assign({}, request), { id: requestId })) + '\n';
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${requestId}`));
            }, this.options.requestTimeout);
            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            try {
                this.process.stdin.write(message);
                this.processState.lastActivity = new Date();
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }
    /**
     * Send a streaming request (not typically supported by STDIO, but included for interface compatibility)
     */
    streamRequest(request) {
        return __asyncGenerator(this, arguments, function* streamRequest_1() {
            // STDIO doesn't typically support streaming, so we send a regular request
            // and yield the response as a single stream item
            try {
                const response = yield __await(this.sendRequest(request));
                yield yield __await({ data: response, done: true });
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Get adapter health status
     */
    getHealth() {
        const now = new Date();
        let status = 'unknown';
        if (this.processState.status === 'running' && this.process) {
            const timeSinceActivity = this.processState.lastActivity
                ? now.getTime() - this.processState.lastActivity.getTime()
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
            error: this.processState.error
        };
    }
    /**
     * Get current process state
     */
    getProcessState() {
        return Object.assign({}, this.processState);
    }
    /**
     * Restart the process
     */
    async restart() {
        if (this.processState.restartCount >= this.options.maxRestarts) {
            throw new Error(`Max restart attempts reached: ${this.options.maxRestarts}`);
        }
        this.processState.status = 'restarting';
        this.processState.restartCount++;
        await this.stop();
        // Wait for restart delay
        await new Promise(resolve => setTimeout(resolve, this.options.restartDelay));
        await this.start();
    }
    /**
     * Spawn the STDIO process
     */
    async spawnProcess() {
        return new Promise((resolve, reject) => {
            var _a, _b;
            try {
                this.process = (0, child_process_1.spawn)(this.config.command, this.config.args || [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: Object.assign(Object.assign({}, process.env), this.config.env)
                });
                this.processState.pid = this.process.pid;
                // Handle process events
                this.process.on('error', (error) => {
                    this.processState.status = 'error';
                    this.processState.error = error.message;
                    this.emit('error', error);
                    reject(error);
                });
                this.process.on('exit', (code, signal) => {
                    this.processState.status = 'stopped';
                    this.emit('exit', { code, signal });
                    // Auto-restart if not intentionally stopped and within restart limits
                    if (code !== 0 && this.processState.restartCount < this.options.maxRestarts) {
                        setTimeout(() => {
                            this.restart().catch(error => this.emit('error', error));
                        }, this.options.restartDelay);
                    }
                });
                // Handle stdout messages
                (_a = this.process.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (data) => {
                    this.handleStdoutData(data);
                });
                // Handle stderr for logging
                (_b = this.process.stderr) === null || _b === void 0 ? void 0 : _b.on('data', (data) => {
                    const message = data.toString();
                    this.emit('stderr', message);
                });
                // Process started successfully
                setTimeout(() => {
                    if (this.process && this.processState.status === 'starting') {
                        resolve();
                    }
                }, 100); // Give process a moment to start
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Handle stdout data from the process
     */
    handleStdoutData(data) {
        this.messageBuffer += data.toString();
        // Process complete JSON messages (separated by newlines)
        const lines = this.messageBuffer.split('\n');
        this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line.trim());
                    this.handleMessage(message);
                }
                catch (error) {
                    this.emit('parseError', { line, error });
                }
            }
        }
    }
    /**
     * Handle parsed JSON message from the process
     */
    handleMessage(message) {
        this.processState.lastActivity = new Date();
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
    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Start health check monitoring
     */
    startHealthCheck() {
        this.healthCheckTimer = setInterval(() => {
            const health = this.getHealth();
            this.emit('healthCheck', health);
            // Auto-restart if unhealthy and within restart limits
            if (health.status === 'unhealthy' &&
                this.processState.status === 'running' &&
                this.processState.restartCount < this.options.maxRestarts) {
                this.restart().catch(error => this.emit('error', error));
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
exports.StdioAdapter = StdioAdapter;
