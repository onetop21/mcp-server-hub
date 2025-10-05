# Changelog

## [Unreleased] - Architecture Simplification

### 🎯 Major Design Decision: Simplification

**Context**: After Task 11 implementation, we reassessed the architecture based on real-world MCP usage patterns.

**Decision**: Simplify to individual server architecture
- Most MCP servers require personal credentials (API keys, tokens)
- Servers cannot be shared between users
- Load balancing adds unnecessary complexity for 90% of use cases

### Changed

#### Architecture
- **Simplified RouterService**: Removed mandatory LoadBalancer dependency
  - LoadBalancer is now optional (can be enabled in future)
  - Default behavior: Select first available server
  - Assumes stateless MCP servers
  - Prioritizes simplicity over advanced features

#### Core Philosophy
- 👤 **Individual Servers**: Each user runs their own MCP servers
- 🔑 **Personal Credentials**: Servers use user's own API keys/tokens
- ♻️ **Multi-Project Reuse**: One server setup → use across multiple projects
- 📦 **Stateless Design**: No caching, predictable behavior
- 🚀 **Future-Proof**: Advanced features can be enabled when needed

### Preserved (For Future Use)

All load balancing code is **preserved but disabled by default**:
- ✅ LoadBalancerService implementation (350+ lines)
- ✅ 4 load balancing strategies (Round Robin, Weighted, Least Connections, Random)
- ✅ Circuit breaker pattern (CLOSED, OPEN, HALF_OPEN states)
- ✅ 17 unit tests + 9 integration tests (all passing)
- ✅ Comprehensive documentation (`docs/LoadBalancing.md`)

Can be activated when:
- Team/organization shared servers are needed
- Scale-out scenarios require load distribution
- High availability is critical

### Added

#### Documentation
- **`docs/Architecture-Simplified.md`**: Detailed reasoning for simplification
  - Individual vs shared server patterns
  - Performance trade-offs
  - Future expansion paths
  - Real-world usage scenarios

#### Updated Documentation
- **`README.md`**: Reflects simplified architecture philosophy
- **`docs/LoadBalancing.md`**: Added "currently disabled" notice
- **`.kiro/specs/mcp-hub-router/tasks.md`**: Updated Task 11 status

### Technical Details

#### Before (Complex)
```typescript
// Mandatory load balancer with full features
const loadBalancerService = new LoadBalancerService();
const routerService = new RouterService(
  serverRepository,
  endpointRepository,
  serverGroupRepository,
  protocolAdapterService,
  loadBalancerService  // Required
);
```

#### After (Simplified)
```typescript
// Load balancer is optional
const routerService = new RouterService(
  serverRepository,
  endpointRepository,
  serverGroupRepository,
  protocolAdapterService
  // No load balancer by default
);

// Simple server selection
return activeServers[0];  // First server
```

### Benefits

1. **Reduced Complexity**
   - Easier to understand and maintain
   - Fewer moving parts
   - Faster development velocity

2. **Matches Real Usage**
   - 90% of MCP servers: personal credentials
   - Each user runs their own instances
   - No need for load balancing in most cases

3. **Future Flexibility**
   - Code is preserved, not deleted
   - Can be enabled with minimal changes
   - Clear path for future expansion

### Migration Notes

For users/developers:
- No breaking changes
- Existing functionality works as before
- LoadBalancer features available but not active
- To enable: see `docs/LoadBalancing.md#향후-활성화-방법`

### Testing

All tests pass after simplification:
- ✅ RouterService: 26/26 tests passing
- ✅ LoadBalancerService: 17/17 unit tests passing
- ✅ LoadBalancer Integration: 9/9 tests passing
- ✅ TypeScript compilation: No errors

---

## Previous Tasks (1-10)

### Completed
- ✅ Task 1: Project foundation and core interfaces
- ✅ Task 2: Database schema and repositories
- ✅ Task 3: User management service
- ✅ Task 4: Usage tracking and rate limiting
- ✅ Task 5: Server registry and metadata management
- ✅ Task 6: Server groups and endpoint management
- ✅ Task 7: STDIO protocol adapter
- ✅ Task 8: SSE and HTTP protocol adapters
- ✅ Task 9: Protocol adapter integration
- ✅ Task 10: Tool routing and namespace system
- ✅ Task 11: Load balancing implementation → **Simplified**

### Next
- 🔄 Task 12: Routing rules engine (will also be simplified)
- 🔄 Task 13: API Gateway and HTTP endpoints
- 🔄 Task 14: MCP protocol endpoints
- 🔄 Task 15: Marketplace service (optional)

---

## Philosophy

> "Perfection is achieved, not when there is nothing more to add, 
> but when there is nothing left to take away."
> — Antoine de Saint-Exupéry

We chose simplicity and pragmatism over theoretical completeness.

