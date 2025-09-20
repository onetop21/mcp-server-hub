import { DIContainer, TYPES } from '../';

describe('DI Container', () => {
  beforeEach(() => {
    DIContainer.reset();
  });

  test('should create a singleton container instance', () => {
    const container1 = DIContainer.getInstance();
    const container2 = DIContainer.getInstance();
    
    expect(container1).toBe(container2);
  });

  test('should bind and retrieve services', () => {
    const container = DIContainer.getInstance();
    const testSymbol = Symbol('TestService');
    const testService = { name: 'test' };
    
    container.bind(testSymbol, testService);
    
    expect(container.isBound(testSymbol)).toBe(true);
    expect(container.get(testSymbol)).toBe(testService);
  });

  test('should define all required service types', () => {
    expect(TYPES.UserManagementService).toBeDefined();
    expect(TYPES.ServerRegistryService).toBeDefined();
    expect(TYPES.ProtocolAdapterService).toBeDefined();
    expect(TYPES.RouterService).toBeDefined();
    expect(TYPES.EndpointService).toBeDefined();
  });
});