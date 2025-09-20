import { ProtocolAdapterService } from '../ProtocolAdapterService';
import { ServerConfig, ServerProtocol } from '../../models/Server';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process for integration tests
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

class MockChildProcess extends EventEmitter {
  public pid = 12345;
  public killed = false;
  public stdin = {
    write: jest.fn()
  };
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();

  kill(signal?: string) {
    this.killed = true;
    this.emit('exit', 0, signal);
  }
}

describe('ProtocolAdapterService Integration Tests', () => {
  let service: ProtocolAdapterService;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);
    
    service = new ProtocolAdapterService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('STDIO Protocol Integration', () => {
    const serverConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
      id: 'test-server-1',
      protocol: ServerProtocol.STDIO,
      stdio: {
        command: 'node',
        args: ['test-mcp-server.js'],
        env: { MCP_SERVER_ENV: 'test' }
      }
    };

    it('should create STDIO adapter and handle full request/response cycle', async () => {
      // Create adapter
      const adapter = await service.createAdapter(serverConfig);
      
      expect(adapter.id).toBeDefined();
      expect(adapter.protocol).toBe(ServerProtocol.STDIO);
      expect(adapter.status).toBe('connected');
      expect(adapter.serverId).toBe('test-server-1');

      // Verify process was spawned correctly
      expect(mockSpawn).toHaveBeenCalledWith('node', ['test-mcp-server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({ MCP_SERVER_ENV: 'test' })
      });

      // Test request/response
      const request = {
        method: 'tools/list',
        params: {},
        id: 'req-1'
      };

      const responsePromise = service.sendRequest(adapter.id, request);

      // Simulate MCP server response
      setTimeout(() => {
        const response = {
          result: {
            tools: [
              { name: 'test-tool', description: 'A test tool' }
            ]
          },
          id: 'req-1'
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 50);

      const response = await responsePromise;

      expect(response.result.tools).toHaveLength(1);
      expect(response.result.tools[0].name).toBe('test-tool');
      expect(response.id).toBe('req-1');

      // Verify request was sent correctly
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify(request) + '\n'
      );
    });

    it('should handle multiple concurrent requests', async () => {
      const adapter = await service.createAdapter(serverConfig);

      // Send multiple requests concurrently
      const requests = [
        { method: 'tools/list', id: 'req-1' },
        { method: 'tools/call', params: { name: 'test-tool' }, id: 'req-2' },
        { method: 'resources/list', id: 'req-3' }
      ];

      const responsePromises = requests.map(req => 
        service.sendRequest(adapter.id, req)
      );

      // Simulate responses in different order
      setTimeout(() => {
        // Respond to req-2 first
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          result: { output: 'tool result' },
          id: 'req-2'
        }) + '\n'));

        // Then req-1
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          result: { tools: [] },
          id: 'req-1'
        }) + '\n'));

        // Finally req-3
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          result: { resources: [] },
          id: 'req-3'
        }) + '\n'));
      }, 50);

      const responses = await Promise.all(responsePromises);

      expect(responses[0].id).toBe('req-1');
      expect(responses[1].id).toBe('req-2');
      expect(responses[2].id).toBe('req-3');
      expect(responses[1].result.output).toBe('tool result');
    });

    it('should handle streaming requests', async () => {
      const adapter = await service.createAdapter(serverConfig);

      const request = {
        method: 'tools/call',
        params: { name: 'streaming-tool' },
        id: 'stream-req-1'
      };

      const streamGenerator = service.streamRequest(adapter.id, request);

      // Simulate response
      setTimeout(() => {
        const response = {
          result: { output: 'streaming data' },
          id: 'stream-req-1'
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 50);

      const results = [];
      for await (const item of streamGenerator) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].data.result.output).toBe('streaming data');
      expect(results[0].done).toBe(true);
    });

    it('should handle adapter health checks', async () => {
      const adapter = await service.createAdapter(serverConfig);

      const health = await service.getAdapterHealth(adapter.id);

      expect(health.adapterId).toBe(adapter.id);
      expect(health.status).toBe('healthy');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should handle adapter errors gracefully', async () => {
      const adapter = await service.createAdapter(serverConfig);

      // Simulate process error
      const error = new Error('Process crashed');
      mockProcess.emit('error', error);

      // Wait a bit for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      const health = await service.getAdapterHealth(adapter.id);
      expect(health.status).toBe('unhealthy');
    });

    it('should close adapters properly', async () => {
      const adapter = await service.createAdapter(serverConfig);

      const killSpy = jest.spyOn(mockProcess, 'kill');

      await service.closeAdapter(adapter.id);

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');

      // Adapter should no longer be available
      await expect(service.getAdapterHealth(adapter.id))
        .rejects.toThrow('Adapter not found');
    });

    it('should handle JSON-RPC error responses', async () => {
      const adapter = await service.createAdapter(serverConfig);

      const request = {
        method: 'invalid/method',
        id: 'error-req-1'
      };

      const responsePromise = service.sendRequest(adapter.id, request);

      // Simulate error response
      setTimeout(() => {
        const errorResponse = {
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method: 'invalid/method' }
          },
          id: 'error-req-1'
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(errorResponse) + '\n'));
      }, 50);

      const response = await responsePromise;

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toBe('Method not found');
      expect(response.id).toBe('error-req-1');
    });

    it('should handle malformed JSON from server', async () => {
      const adapter = await service.createAdapter(serverConfig);

      // Set up error event listener
      const errorEvents: any[] = [];
      const stdioManager = (service as any).stdioManager;
      stdioManager.on('adapterParseError', (event: any) => {
        errorEvents.push(event);
      });

      // Send malformed JSON
      mockProcess.stdout.emit('data', Buffer.from('{ invalid json }\n'));

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].parseError.line).toBe('{ invalid json }');
      expect(errorEvents[0].parseError.error).toBeInstanceOf(Error);
    });

    it('should handle process restart scenarios', async () => {
      const adapter = await service.createAdapter(serverConfig);

      // Create new mock process for restart
      const newMockProcess = new MockChildProcess();
      newMockProcess.pid = 54321;
      mockSpawn.mockReturnValueOnce(newMockProcess as any);

      // Simulate unexpected process exit (should trigger restart)
      mockProcess.emit('exit', 1, null);

      // Wait for restart
      await new Promise(resolve => setTimeout(resolve, 150));

      // Adapter should still be available and healthy after restart
      const health = await service.getAdapterHealth(adapter.id);
      expect(health.status).toBe('healthy');
    });

    it('should manage multiple adapters for different servers', async () => {
      const server1Config = { ...serverConfig, id: 'server-1' };
      const server2Config = { 
        ...serverConfig, 
        id: 'server-2',
        stdio: { command: 'python', args: ['server2.py'] }
      };

      // Create new mock processes for each server
      const mockProcess2 = new MockChildProcess();
      mockProcess2.pid = 67890;
      mockSpawn
        .mockReturnValueOnce(mockProcess as any)  // First call for server-1
        .mockReturnValueOnce(mockProcess2 as any); // Second call for server-2

      const adapter1 = await service.createAdapter(server1Config);
      const adapter2 = await service.createAdapter(server2Config);

      expect(adapter1.serverId).toBe('server-1');
      expect(adapter2.serverId).toBe('server-2');

      // Both adapters should be active
      const activeAdapters = await service.getActiveAdapters();
      expect(activeAdapters).toHaveLength(2);

      // Test requests to both adapters
      const req1Promise = service.sendRequest(adapter1.id, { method: 'test1', id: 'req1' });
      const req2Promise = service.sendRequest(adapter2.id, { method: 'test2', id: 'req2' });

      // Simulate responses
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify({
          result: { server: 'server-1' },
          id: 'req1'
        }) + '\n'));

        mockProcess2.stdout.emit('data', Buffer.from(JSON.stringify({
          result: { server: 'server-2' },
          id: 'req2'
        }) + '\n'));
      }, 50);

      const [response1, response2] = await Promise.all([req1Promise, req2Promise]);

      expect(response1.result.server).toBe('server-1');
      expect(response2.result.server).toBe('server-2');
    });
  });

  describe('Unsupported Protocols', () => {
    it('should throw error for SSE protocol', async () => {
      const sseConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
        id: 'sse-server',
        protocol: ServerProtocol.SSE,
        sse: {
          url: 'http://localhost:3000/sse',
          headers: { 'Authorization': 'Bearer token' }
        }
      };

      await expect(service.createAdapter(sseConfig))
        .rejects.toThrow('SSE adapter not yet implemented');
    });

    it('should throw error for HTTP protocol', async () => {
      const httpConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
        id: 'http-server',
        protocol: ServerProtocol.HTTP,
        http: {
          baseUrl: 'http://localhost:3000',
          headers: { 'Content-Type': 'application/json' }
        }
      };

      await expect(service.createAdapter(httpConfig))
        .rejects.toThrow('HTTP adapter not yet implemented');
    });
  });

  describe('Error Handling', () => {
    const serverConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
      id: 'test-server',
      protocol: ServerProtocol.STDIO,
      stdio: {
        command: 'node',
        args: ['test-server.js']
      }
    };

    it('should handle missing STDIO configuration', async () => {
      const invalidConfig = {
        id: 'invalid-server',
        protocol: ServerProtocol.STDIO
        // Missing stdio config
      } as any;

      await expect(service.createAdapter(invalidConfig))
        .rejects.toThrow('STDIO configuration is required for STDIO protocol');
    });

    it('should handle requests to non-existent adapters', async () => {
      await expect(service.sendRequest('non-existent', { method: 'test' }))
        .rejects.toThrow('Adapter not found: non-existent');
    });

    it('should handle health checks for non-existent adapters', async () => {
      await expect(service.getAdapterHealth('non-existent'))
        .rejects.toThrow('Adapter not found: non-existent');
    });

    it('should handle process spawn failures', async () => {
      // Mock spawn to throw error
      mockSpawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(service.createAdapter(serverConfig))
        .rejects.toThrow('Failed to spawn process');
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown all adapters on service shutdown', async () => {
      const baseConfig: ServerConfig & { id: string; protocol: ServerProtocol } = {
        id: 'test-server',
        protocol: ServerProtocol.STDIO,
        stdio: {
          command: 'node',
          args: ['test-server.js']
        }
      };
      
      const config1 = { ...baseConfig, id: 'server-1' };
      const config2 = { ...baseConfig, id: 'server-2' };

      const mockProcess2 = new MockChildProcess();
      mockSpawn
        .mockReturnValueOnce(mockProcess as any)
        .mockReturnValueOnce(mockProcess2 as any);

      await service.createAdapter(config1);
      await service.createAdapter(config2);

      const killSpy1 = jest.spyOn(mockProcess, 'kill');
      const killSpy2 = jest.spyOn(mockProcess2, 'kill');

      await service.shutdown();

      expect(killSpy1).toHaveBeenCalled();
      expect(killSpy2).toHaveBeenCalled();

      const activeAdapters = await service.getActiveAdapters();
      expect(activeAdapters).toHaveLength(0);
    });
  });
});