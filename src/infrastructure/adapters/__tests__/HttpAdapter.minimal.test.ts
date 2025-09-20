import { HttpAdapter } from '../HttpAdapter';
import { HttpConfig } from '../../../domain/models/Server';

// Create a completely isolated test
describe('HttpAdapter - Minimal Test', () => {
  it('should create adapter with basic properties', () => {
    const config: HttpConfig = {
      baseUrl: 'https://example.com/api'
    };

    const adapter = new HttpAdapter('test-id', 'server-id', config);
    
    expect(adapter.id).toBe('test-id');
    expect(adapter.serverId).toBe('server-id');
    
    const state = adapter.getConnectionState();
    expect(state.status).toBeDefined();
    expect(state.requestCount).toBe(0);
    expect(state.errorCount).toBe(0);
    
    const health = adapter.getHealth();
    expect(health.adapterId).toBe('test-id');
    expect(health.status).toBeDefined();
    
    const poolStats = adapter.getConnectionPoolStats();
    expect(poolStats.totalConnections).toBe(1);
    expect(poolStats.activeConnections).toBe(0);
    expect(poolStats.availableConnections).toBe(1);
  });
});