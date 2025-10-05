import { LoadBalancerService } from '../LoadBalancerService';
import { LoadBalancingStrategy, CircuitBreakerState, ServerWeight } from '../ILoadBalancerService';
import { RegisteredServer, ServerStatus, ServerProtocol } from '../../models/Server';

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;
  let mockServers: RegisteredServer[];

  beforeEach(() => {
    service = new LoadBalancerService();
    
    // Create mock servers
    mockServers = [
      {
        id: 'server-1',
        userId: 'user-1',
        name: 'Server 1',
        protocol: ServerProtocol.STDIO,
        config: { stdio: { command: 'test', args: [] } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'server-2',
        userId: 'user-1',
        name: 'Server 2',
        protocol: ServerProtocol.HTTP,
        config: { http: { baseUrl: 'http://test' } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'server-3',
        userId: 'user-1',
        name: 'Server 3',
        protocol: ServerProtocol.SSE,
        config: { sse: { url: 'http://test' } },
        status: ServerStatus.ACTIVE,
        lastHealthCheck: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('Round Robin Load Balancing', () => {
    it('should distribute requests evenly across servers', async () => {
      const selections: string[] = [];
      
      // Make multiple selections
      for (let i = 0; i < 9; i++) {
        const server = await service.selectServer(
          mockServers,
          LoadBalancingStrategy.ROUND_ROBIN,
          { groupId: 'test-group' }
        );
        
        expect(server).not.toBeNull();
        selections.push(server!.id);
      }

      // Count selections for each server
      const counts = selections.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Each server should be selected 3 times (9 requests / 3 servers)
      expect(counts['server-1']).toBe(3);
      expect(counts['server-2']).toBe(3);
      expect(counts['server-3']).toBe(3);
    });

    it('should maintain separate counters for different groups', async () => {
      // Select from group 1
      const server1 = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'group-1' }
      );
      
      // Select from group 2
      const server2 = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN,
        { groupId: 'group-2' }
      );

      // Both should start from the first server
      expect(server1!.id).toBe('server-1');
      expect(server2!.id).toBe('server-1');
    });
  });

  describe('Weighted Load Balancing', () => {
    it('should respect server weights', async () => {
      const weights: ServerWeight[] = [
        { serverId: 'server-1', weight: 50 },
        { serverId: 'server-2', weight: 30 },
        { serverId: 'server-3', weight: 20 }
      ];

      await service.setServerWeights('test-group', weights);

      const selections: string[] = [];
      
      // Make many selections to get statistical distribution
      for (let i = 0; i < 100; i++) {
        const server = await service.selectServer(
          mockServers,
          LoadBalancingStrategy.WEIGHTED,
          { groupId: 'test-group' }
        );
        
        expect(server).not.toBeNull();
        selections.push(server!.id);
      }

      // Count selections
      const counts = selections.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Server 1 should get roughly 50% of requests
      expect(counts['server-1']).toBeGreaterThan(40);
      expect(counts['server-1']).toBeLessThan(60);

      // Server 2 should get roughly 30% of requests
      expect(counts['server-2']).toBeGreaterThan(20);
      expect(counts['server-2']).toBeLessThan(40);
    });

    it('should reject invalid weights', async () => {
      const invalidWeights: ServerWeight[] = [
        { serverId: 'server-1', weight: 0 },
        { serverId: 'server-2', weight: 101 }
      ];

      await expect(
        service.setServerWeights('test-group', invalidWeights)
      ).rejects.toThrow('Invalid weight');
    });
  });

  describe('Least Connections Load Balancing', () => {
    it('should select server with fewest connections', async () => {
      // Add connections to servers
      await service.incrementConnections('server-1');
      await service.incrementConnections('server-1');
      await service.incrementConnections('server-2');

      const server = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.LEAST_CONNECTIONS
      );

      // Server 3 has 0 connections
      expect(server!.id).toBe('server-3');
    });

    it('should handle connection counting correctly', async () => {
      const serverId = 'server-1';

      await service.incrementConnections(serverId);
      await service.incrementConnections(serverId);
      expect(await service.getConnectionCount(serverId)).toBe(2);

      await service.decrementConnections(serverId);
      expect(await service.getConnectionCount(serverId)).toBe(1);

      await service.decrementConnections(serverId);
      expect(await service.getConnectionCount(serverId)).toBe(0);

      // Should not go below 0
      await service.decrementConnections(serverId);
      expect(await service.getConnectionCount(serverId)).toBe(0);
    });
  });

  describe('Random Load Balancing', () => {
    it('should select a server randomly', async () => {
      const server = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.RANDOM
      );

      expect(server).not.toBeNull();
      expect(mockServers.some(s => s.id === server!.id)).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const serverId = 'server-1';

      // Initially closed
      let status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.CLOSED);

      // Record failures until threshold
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      // Circuit should be open
      status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.OPEN);
      expect(status.failureCount).toBe(5);
    });

    it('should filter out servers with open circuit breakers', async () => {
      const serverId = 'server-1';

      // Open the circuit for server-1
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      // Try to select a server
      const server = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN
      );

      // Should not select server-1
      expect(server!.id).not.toBe('server-1');
    });

    it('should transition to half-open after timeout', async () => {
      const serverId = 'server-1';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      let status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.OPEN);

      // Manually set next attempt time to past (simulate timeout)
      status.nextAttemptTime = new Date(Date.now() - 1000);

      // Get status again - should transition to half-open
      status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should close circuit after success threshold in half-open state', async () => {
      const serverId = 'server-1';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      // Manually transition to half-open
      const status = await service.getCircuitBreakerStatus(serverId);
      status.state = CircuitBreakerState.HALF_OPEN;
      status.successCount = 0;

      // Record successes
      await service.recordSuccess(serverId);
      await service.recordSuccess(serverId);

      // Circuit should be closed
      const finalStatus = await service.getCircuitBreakerStatus(serverId);
      expect(finalStatus.state).toBe(CircuitBreakerState.CLOSED);
      expect(finalStatus.failureCount).toBe(0);
    });

    it('should reopen circuit on failure in half-open state', async () => {
      const serverId = 'server-1';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      // Manually transition to half-open
      let status = await service.getCircuitBreakerStatus(serverId);
      status.state = CircuitBreakerState.HALF_OPEN;

      // Record a failure
      await service.recordFailure(serverId);

      // Circuit should be open again
      status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should allow manual circuit breaker reset', async () => {
      const serverId = 'server-1';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(serverId);
      }

      let status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.OPEN);

      // Manual reset
      await service.resetCircuitBreaker(serverId);

      status = await service.getCircuitBreakerStatus(serverId);
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('Server Filtering', () => {
    it('should filter out inactive servers', async () => {
      mockServers[0].status = ServerStatus.INACTIVE;
      mockServers[1].status = ServerStatus.ERROR;

      const server = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN
      );

      // Should only select server-3
      expect(server!.id).toBe('server-3');
    });

    it('should return null when no servers are available', async () => {
      const inactiveServers = mockServers.map(s => ({
        ...s,
        status: ServerStatus.INACTIVE
      }));

      const server = await service.selectServer(
        inactiveServers,
        LoadBalancingStrategy.ROUND_ROBIN
      );

      expect(server).toBeNull();
    });

    it('should return null when all circuits are open', async () => {
      // Open circuits for all servers
      for (const server of mockServers) {
        for (let i = 0; i < 5; i++) {
          await service.recordFailure(server.id);
        }
      }

      const server = await service.selectServer(
        mockServers,
        LoadBalancingStrategy.ROUND_ROBIN
      );

      expect(server).toBeNull();
    });
  });

  describe('Get All Circuit Breaker Status', () => {
    it('should return status for all servers', async () => {
      // Create some failures
      await service.recordFailure('server-1');
      await service.recordFailure('server-2');

      const allStatus = await service.getAllCircuitBreakerStatus();

      expect(allStatus.length).toBeGreaterThan(0);
      expect(allStatus.some(s => s.serverId === 'server-1')).toBe(true);
    });
  });
});

