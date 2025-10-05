"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOAD_BALANCER_SERVICE = exports.CircuitBreakerState = exports.LoadBalancingStrategy = void 0;
/**
 * Load balancing strategies
 */
var LoadBalancingStrategy;
(function (LoadBalancingStrategy) {
    LoadBalancingStrategy["ROUND_ROBIN"] = "round_robin";
    LoadBalancingStrategy["WEIGHTED"] = "weighted";
    LoadBalancingStrategy["LEAST_CONNECTIONS"] = "least_connections";
    LoadBalancingStrategy["RANDOM"] = "random";
})(LoadBalancingStrategy = exports.LoadBalancingStrategy || (exports.LoadBalancingStrategy = {}));
/**
 * Circuit breaker state for a server
 */
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "closed";
    CircuitBreakerState["OPEN"] = "open";
    CircuitBreakerState["HALF_OPEN"] = "half_open"; // Testing if recovered
})(CircuitBreakerState = exports.CircuitBreakerState || (exports.CircuitBreakerState = {}));
exports.LOAD_BALANCER_SERVICE = Symbol.for('LoadBalancerService');
