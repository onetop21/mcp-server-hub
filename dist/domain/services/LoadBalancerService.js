"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOAD_BALANCER_SERVICE = exports.LoadBalancerService = void 0;
const inversify_1 = require("inversify");
const Server_1 = require("../models/Server");
const ILoadBalancerService_1 = require("./ILoadBalancerService");
/**
 * Load balancer service implementation with circuit breaker pattern
 */
let LoadBalancerService = class LoadBalancerService {
    constructor() {
        this.circuitBreakerConfig = {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            halfOpenMaxAttempts: 3
        };
        // In-memory state (in production, should use Redis)
        this.roundRobinCounters = new Map();
        this.serverWeights = new Map();
        this.circuitBreakers = new Map();
        this.connectionCounts = new Map();
    }
    /**
     * Select a server from available servers using the specified strategy
     */
    async selectServer(servers, strategy, context) {
        if (servers.length === 0) {
            return null;
        }
        // Filter out inactive servers and servers with open circuit breakers
        const availableServers = await this.filterAvailableServers(servers);
        if (availableServers.length === 0) {
            return null;
        }
        let selectedServer = null;
        switch (strategy) {
            case ILoadBalancerService_1.LoadBalancingStrategy.ROUND_ROBIN:
                selectedServer = await this.selectRoundRobin(availableServers, context);
                break;
            case ILoadBalancerService_1.LoadBalancingStrategy.WEIGHTED:
                selectedServer = await this.selectWeighted(availableServers, context);
                break;
            case ILoadBalancerService_1.LoadBalancingStrategy.LEAST_CONNECTIONS:
                selectedServer = await this.selectLeastConnections(availableServers);
                break;
            case ILoadBalancerService_1.LoadBalancingStrategy.RANDOM:
            default:
                selectedServer = this.selectRandom(availableServers);
                break;
        }
        return selectedServer;
    }
    /**
     * Set server weights for weighted load balancing
     */
    async setServerWeights(groupId, weights) {
        // Validate weights
        for (const weight of weights) {
            if (weight.weight < 1 || weight.weight > 100) {
                throw new Error(`Invalid weight ${weight.weight} for server ${weight.serverId}. Weight must be between 1 and 100.`);
            }
        }
        this.serverWeights.set(groupId, weights);
    }
    /**
     * Get server weights for a group
     */
    async getServerWeights(groupId) {
        return this.serverWeights.get(groupId) || [];
    }
    /**
     * Record a successful request to a server
     */
    async recordSuccess(serverId) {
        const status = this.getOrCreateCircuitBreakerStatus(serverId);
        if (status.state === ILoadBalancerService_1.CircuitBreakerState.HALF_OPEN) {
            status.successCount++;
            // If enough successes, close the circuit
            if (status.successCount >= this.circuitBreakerConfig.successThreshold) {
                status.state = ILoadBalancerService_1.CircuitBreakerState.CLOSED;
                status.failureCount = 0;
                status.successCount = 0;
                status.lastFailureTime = undefined;
                status.nextAttemptTime = undefined;
            }
        }
        else if (status.state === ILoadBalancerService_1.CircuitBreakerState.CLOSED) {
            // Reset failure count on success in closed state
            if (status.failureCount > 0) {
                status.failureCount = Math.max(0, status.failureCount - 1);
            }
        }
        this.circuitBreakers.set(serverId, status);
    }
    /**
     * Record a failed request to a server
     */
    async recordFailure(serverId) {
        const status = this.getOrCreateCircuitBreakerStatus(serverId);
        status.failureCount++;
        status.lastFailureTime = new Date();
        if (status.state === ILoadBalancerService_1.CircuitBreakerState.CLOSED) {
            // If failure threshold reached, open the circuit
            if (status.failureCount >= this.circuitBreakerConfig.failureThreshold) {
                status.state = ILoadBalancerService_1.CircuitBreakerState.OPEN;
                status.nextAttemptTime = new Date(Date.now() + this.circuitBreakerConfig.timeout);
                console.warn(`Circuit breaker opened for server ${serverId} after ${status.failureCount} failures`);
            }
        }
        else if (status.state === ILoadBalancerService_1.CircuitBreakerState.HALF_OPEN) {
            // If failure in half-open, go back to open
            status.state = ILoadBalancerService_1.CircuitBreakerState.OPEN;
            status.successCount = 0;
            status.nextAttemptTime = new Date(Date.now() + this.circuitBreakerConfig.timeout);
            console.warn(`Circuit breaker reopened for server ${serverId} after failure in half-open state`);
        }
        this.circuitBreakers.set(serverId, status);
    }
    /**
     * Get circuit breaker status for a server
     */
    async getCircuitBreakerStatus(serverId) {
        const status = this.getOrCreateCircuitBreakerStatus(serverId);
        // Check if we should transition from OPEN to HALF_OPEN
        if (status.state === ILoadBalancerService_1.CircuitBreakerState.OPEN && status.nextAttemptTime) {
            if (new Date() >= status.nextAttemptTime) {
                status.state = ILoadBalancerService_1.CircuitBreakerState.HALF_OPEN;
                status.successCount = 0;
                console.info(`Circuit breaker for server ${serverId} transitioned to HALF_OPEN`);
            }
        }
        return status;
    }
    /**
     * Get circuit breaker status for all servers
     */
    async getAllCircuitBreakerStatus() {
        const statuses = [];
        for (const [serverId, status] of this.circuitBreakers.entries()) {
            // Update state if needed
            await this.getCircuitBreakerStatus(serverId);
            statuses.push(this.circuitBreakers.get(serverId));
        }
        return statuses;
    }
    /**
     * Manually reset circuit breaker for a server
     */
    async resetCircuitBreaker(serverId) {
        const status = this.getOrCreateCircuitBreakerStatus(serverId);
        status.state = ILoadBalancerService_1.CircuitBreakerState.CLOSED;
        status.failureCount = 0;
        status.successCount = 0;
        status.lastFailureTime = undefined;
        status.nextAttemptTime = undefined;
        this.circuitBreakers.set(serverId, status);
        console.info(`Circuit breaker manually reset for server ${serverId}`);
    }
    /**
     * Get active connection count for a server
     */
    async getConnectionCount(serverId) {
        return this.connectionCounts.get(serverId) || 0;
    }
    /**
     * Increment connection count for a server
     */
    async incrementConnections(serverId) {
        const count = this.connectionCounts.get(serverId) || 0;
        this.connectionCounts.set(serverId, count + 1);
    }
    /**
     * Decrement connection count for a server
     */
    async decrementConnections(serverId) {
        const count = this.connectionCounts.get(serverId) || 0;
        this.connectionCounts.set(serverId, Math.max(0, count - 1));
    }
    /**
     * Filter servers to only include available ones (active and circuit not open)
     */
    async filterAvailableServers(servers) {
        const availableServers = [];
        for (const server of servers) {
            // Skip inactive servers
            if (server.status !== Server_1.ServerStatus.ACTIVE) {
                continue;
            }
            // Check circuit breaker status
            const circuitStatus = await this.getCircuitBreakerStatus(server.id);
            // Allow CLOSED and HALF_OPEN, but not OPEN
            if (circuitStatus.state !== ILoadBalancerService_1.CircuitBreakerState.OPEN) {
                availableServers.push(server);
            }
        }
        return availableServers;
    }
    /**
     * Select server using round-robin strategy
     */
    async selectRoundRobin(servers, context) {
        if (servers.length === 0)
            return null;
        // Use groupId as key for round-robin counter, or 'default' if no group
        const key = (context === null || context === void 0 ? void 0 : context.groupId) || 'default';
        const currentIndex = this.roundRobinCounters.get(key) || 0;
        // Get the next server
        const selectedServer = servers[currentIndex % servers.length];
        // Update counter
        this.roundRobinCounters.set(key, (currentIndex + 1) % servers.length);
        return selectedServer;
    }
    /**
     * Select server using weighted strategy
     */
    async selectWeighted(servers, context) {
        var _a;
        if (servers.length === 0)
            return null;
        // Get weights for this group
        const weights = (context === null || context === void 0 ? void 0 : context.groupId)
            ? await this.getServerWeights(context.groupId)
            : [];
        // If no weights configured, fall back to equal weighting
        if (weights.length === 0) {
            return this.selectRandom(servers);
        }
        // Build weighted list
        const weightMap = new Map(weights.map(w => [w.serverId, w.weight]));
        const weightedServers = [];
        for (const server of servers) {
            const weight = weightMap.get(server.id) || 1;
            weightedServers.push({ server, weight });
        }
        // Calculate total weight
        const totalWeight = weightedServers.reduce((sum, item) => sum + item.weight, 0);
        // Random selection based on weights
        let random = Math.random() * totalWeight;
        for (const item of weightedServers) {
            random -= item.weight;
            if (random <= 0) {
                return item.server;
            }
        }
        // Fallback (shouldn't reach here)
        return ((_a = weightedServers[0]) === null || _a === void 0 ? void 0 : _a.server) || null;
    }
    /**
     * Select server with least connections
     */
    async selectLeastConnections(servers) {
        if (servers.length === 0)
            return null;
        let minConnections = Infinity;
        let selectedServer = null;
        for (const server of servers) {
            const connections = await this.getConnectionCount(server.id);
            if (connections < minConnections) {
                minConnections = connections;
                selectedServer = server;
            }
        }
        return selectedServer;
    }
    /**
     * Select server randomly
     */
    selectRandom(servers) {
        if (servers.length === 0)
            return null;
        const randomIndex = Math.floor(Math.random() * servers.length);
        return servers[randomIndex];
    }
    /**
     * Get or create circuit breaker status for a server
     */
    getOrCreateCircuitBreakerStatus(serverId) {
        let status = this.circuitBreakers.get(serverId);
        if (!status) {
            status = {
                serverId,
                state: ILoadBalancerService_1.CircuitBreakerState.CLOSED,
                failureCount: 0,
                successCount: 0
            };
            this.circuitBreakers.set(serverId, status);
        }
        return status;
    }
};
LoadBalancerService = __decorate([
    (0, inversify_1.injectable)()
], LoadBalancerService);
exports.LoadBalancerService = LoadBalancerService;
exports.LOAD_BALANCER_SERVICE = Symbol.for('LoadBalancerService');
