import { RegisteredServer } from '../models/Server';

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED = 'weighted',
  LEAST_CONNECTIONS = 'least_connections',
  RANDOM = 'random'
}

/**
 * Server weight configuration for weighted load balancing
 */
export interface ServerWeight {
  serverId: string;
  weight: number; // Higher weight = more traffic (1-100)
}

/**
 * Circuit breaker state for a server
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close circuit from half-open
  timeout: number;               // Time in ms before trying half-open from open
  halfOpenMaxAttempts: number;   // Max attempts in half-open state
}

/**
 * Circuit breaker status for a server
 */
export interface CircuitBreakerStatus {
  serverId: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

/**
 * Load balancer service interface
 */
export interface ILoadBalancerService {
  /**
   * Select a server from available servers using the specified strategy
   */
  selectServer(
    servers: RegisteredServer[], 
    strategy: LoadBalancingStrategy,
    context?: LoadBalancingContext
  ): Promise<RegisteredServer | null>;

  /**
   * Set server weights for weighted load balancing
   */
  setServerWeights(groupId: string, weights: ServerWeight[]): Promise<void>;

  /**
   * Get server weights for a group
   */
  getServerWeights(groupId: string): Promise<ServerWeight[]>;

  /**
   * Record a successful request to a server
   */
  recordSuccess(serverId: string): Promise<void>;

  /**
   * Record a failed request to a server
   */
  recordFailure(serverId: string): Promise<void>;

  /**
   * Get circuit breaker status for a server
   */
  getCircuitBreakerStatus(serverId: string): Promise<CircuitBreakerStatus>;

  /**
   * Get circuit breaker status for all servers
   */
  getAllCircuitBreakerStatus(): Promise<CircuitBreakerStatus[]>;

  /**
   * Manually reset circuit breaker for a server
   */
  resetCircuitBreaker(serverId: string): Promise<void>;

  /**
   * Get active connection count for a server
   */
  getConnectionCount(serverId: string): Promise<number>;

  /**
   * Increment connection count for a server
   */
  incrementConnections(serverId: string): Promise<void>;

  /**
   * Decrement connection count for a server
   */
  decrementConnections(serverId: string): Promise<void>;
}

/**
 * Context for load balancing decisions
 */
export interface LoadBalancingContext {
  groupId?: string;
  toolName?: string;
  clientId?: string;
}

export const LOAD_BALANCER_SERVICE = Symbol.for('LoadBalancerService');

