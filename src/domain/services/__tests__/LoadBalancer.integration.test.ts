import { LoadBalancerService } from '../LoadBalancerService';
import { RouterService } from '../RouterService';
import { LoadBalancingStrategy, CircuitBreakerState } from '../ILoadBalancerService';
import { RegisteredServer, ServerStatus, ServerProtocol } from '../../models/Server';
import { ToolCallResult } from '../IRouterService';

/**
 * Integration tests for Load Balancer with Router Service
 * Tests real-world scenarios including circuit breakers and failover
 */
describe('LoadBalancer Integration Tests', () => {
  let loadBalancer: LoadBalancerService;
  let mockServers: RegisteredServer[];

  beforeEach(() => {
    loadBalancer = new LoadBalancerService();

    mockServers = [
      {
        id: 'primary-server',
        userId: 'user-1',
        name: 'Primary Server',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'primary', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'backup-server-1',
        userId: 'user-1',
        name: 'Backup Server 1',
        protocol: ServerProtocol.HTTP,
        config: { http: { baseUrl: 'http://backup1' } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'backup-server-2',
        userId: 'user-1',
        name: 'Backup Server 2',
        protocol: ServerProtocol.SSE,
        config: { sse: { url: 'http://backup2' } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('Failover Scenarios', () => {
    it('should automatically failover when primary server fails', async () => {
      // First request goes to primary (round-robin starts at first server)
      let server = await loadBalancer.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'test-group' }
      );
      expect(server!.id).toBe('primary-server');

      // Simulate primary server failures
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('primary-server');
      }

      // Next request should skip primary server (circuit open)
      server = await loadBalancer.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'test-group' }
      );
      expect(server!.id).not.toBe('primary-server');
      expect(['backup-server-1', 'backup-server-2']).toContain(server!.id);
    });

    it('should handle cascading failures gracefully', async () => {
      // Fail primary server
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('primary-server');
      }

      // Fail first backup
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('backup-server-1');
      }

      // Should still have backup-server-2 available
      const server = await loadBalancer.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'test-group' }
      );

      expect(server!.id).toBe('backup-server-2');
    });

    it('should return null when all servers are unavailable', async () => {
      // Fail all servers
      for (const srv of mockServers) {
        for (let i = 0; i < 5; i++) {
          await loadBalancer.recordFailure(srv.id);
        }
      }

      // Should return null
      const server = await loadBalancer.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'test-group' }
      );

      expect(server).toBeNull();
    });
  });

  describe('Load Distribution Under Failures', () => {
    it('should redistribute load when a server fails', async () => {
      const selections: string[] = [];

      // Make initial requests (all servers available)
      for (let i = 0; i < 6; i++) {
        const server = await loadBalancer.selectServer(
          mockServers,
          LoadBalancingStrategy.ROUND_ROBIN,
          { groupId: 'test-group' }
        );
        selections.push(server!.id);
      }

      // Each server should get 2 requests
      let counts = selections.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(counts['primary-server']).toBe(2);
      expect(counts['backup-server-1']).toBe(2);
      expect(counts['backup-server-2']).toBe(2);

      // Fail primary server
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('primary-server');
      }

      selections.length = 0; // Clear array

      // Make more requests
      for (let i = 0; i < 6; i++) {
        const server = await loadBalancer.selectServer(
          mockServers,
          LoadBalancingStrategy.ROUND_ROBIN,
          { groupId: 'test-group' }
        );
        selections.push(server!.id);
      }

      // Load should be distributed only between backup servers
      counts = selections.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(counts['primary-server']).toBeUndefined();
      expect(counts['backup-server-1']).toBe(3);
      expect(counts['backup-server-2']).toBe(3);
    });
  });

  describe('Circuit Breaker Recovery', () => {
    it('should allow recovery after circuit breaker timeout', async () => {
      const serverId = 'primary-server';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure(serverId);
      }

      // Verify circuit is open
      let status = await loadBalancer.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.OPEN);

      // Server should be filtered out
      let server = await loadBalancer.selectServer(
        [mockServers[0]], // Only primary server
        LoadBalancingStrategy.ROUND_ROBIN
      );
      expect(server).toBeNull();

      // Manually transition to half-open (simulate timeout)
      status.state = CircuitBreakerState.HALF_OPEN;
      status.nextAttemptTime = undefined;

      // Server should be available in half-open state
      server = await loadBalancer.selectServer(
        [mockServers[0]],
        LoadBalancingStrategy.ROUND_ROBIN
      );
      expect(server!.id).toBe('primary-server');

      // Successful requests should close the circuit
      await loadBalancer.recordSuccess(serverId);
      await loadBalancer.recordSuccess(serverId);

      status = await loadBalancer.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('Connection Tracking', () => {
    it('should track active connections correctly', async () => {
      const serverId = 'primary-server';

      // Simulate multiple concurrent requests
      await loadBalancer.incrementConnections(serverId);
      await loadBalancer.incrementConnections(serverId);
      await loadBalancer.incrementConnections(serverId);

      expect(await loadBalancer.getConnectionCount(serverId)).toBe(3);

      // Complete some requests
      await loadBalancer.decrementConnections(serverId);
      expect(await loadBalancer.getConnectionCount(serverId)).toBe(2);

      await loadBalancer.decrementConnections(serverId);
      expect(await loadBalancer.getConnectionCount(serverId)).toBe(1);

      await loadBalancer.decrementConnections(serverId);
      expect(await loadBalancer.getConnectionCount(serverId)).toBe(0);
    });

    it('should use connection count for least connections strategy', async () => {
      // Add different connection counts to servers
      await loadBalancer.incrementConnections('primary-server');
      await loadBalancer.incrementConnections('primary-server');
      await loadBalancer.incrementConnections('primary-server');

      await loadBalancer.incrementConnections('backup-server-1');
      await loadBalancer.incrementConnections('backup-server-1');

      await loadBalancer.incrementConnections('backup-server-2');

      // Should select backup-server-2 (1 connection)
      const server = await loadBalancer.selectServer(
        mockServers,
        LoadBalancingStrategy.LEAST_CONNECTIONS
      );

      expect(server!.id).toBe('backup-server-2');
    });
  });

  describe('Weighted Load Balancing with Failures', () => {
    it('should maintain weight ratios even with some failures', async () => {
      // Set weights
      await loadBalancer.setServerWeights('test-group', [
        { serverId: 'primary-server', weight: 60 },
        { serverId: 'backup-server-1', weight: 30 },
        { serverId: 'backup-server-2', weight: 10 }
      ]);

      // Fail primary server
      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('primary-server');
      }

      const selections: string[] = [];

      // Make many selections
      for (let i = 0; i < 100; i++) {
        const server = await loadBalancer.selectServer(
          mockServers,
          LoadBalancingStrategy.WEIGHTED,
          { groupId: 'test-group' }
        );
        if (server) {
          selections.push(server.id);
        }
      }

      // Count selections
      const counts = selections.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Primary should get no requests (circuit open)
      expect(counts['primary-server']).toBeUndefined();

      // backup-server-1 should get roughly 75% (30/40)
      // backup-server-2 should get roughly 25% (10/40)
      expect(counts['backup-server-1']).toBeGreaterThan(60);
      expect(counts['backup-server-2']).toBeGreaterThan(15);
      expect(counts['backup-server-2']).toBeLessThan(35);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should provide comprehensive health status', async () => {
      // Create different failure scenarios
      await loadBalancer.recordFailure('primary-server');
      await loadBalancer.recordFailure('primary-server');

      for (let i = 0; i < 5; i++) {
        await loadBalancer.recordFailure('backup-server-1');
      }

      // Get all statuses
      const statuses = await loadBalancer.getAllCircuitBreakerStatus();

      // Find specific server statuses
      const primaryStatus = statuses.find(s => s.serverId === 'primary-server');
      const backup1Status = statuses.find(s => s.serverId === 'backup-server-1');

      expect(primaryStatus!.state).toBe(CircuitBreakerState.CLOSED);
      expect(primaryStatus!.failureCount).toBe(2);

      expect(backup1Status!.state).toBe(CircuitBreakerState.OPEN);
      expect(backup1Status!.failureCount).toBe(5);
    });
  });
});

