# MCP Hub Router

Multi-tenant MCP server hub with protocol adapters and routing capabilities.

## WSL Development Environment Setup

This project is configured to work in WSL (Windows Subsystem for Linux) environment.

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- WSL environment

### Installation

```bash
# Install dependencies
npm install

# Verify setup
node verify-setup.js
```

### Development Commands

```bash
# Build the project
npm run build

# Run type checking only
npm run build:check

# Run in development mode
npm run dev

# Run tests
npm test

# Start production server
npm start
```

### Project Structure

```
src/
├── domain/
│   ├── models/          # Domain models (User, Server, ApiKey, etc.)
│   └── services/        # Service interfaces
├── infrastructure/
│   └── di/             # Dependency injection container
└── index.ts            # Application entry point
```

### 🎯 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Start server
npm run dev
```

Server will start on `http://localhost:3000`

👉 [Quick Start Guide](./docs/Quick-Start.md) | [API Reference](./docs/API-Reference.md)

## Key Features

- **Individual Server Management**: Each user runs their own MCP servers with personal credentials
- **Multi-Project Reusability**: One server setup, use across multiple projects
- **Protocol Adapters**: STDIO, SSE, and HTTP protocol support
- **Stateless Design**: Simple, predictable, and maintainable architecture
- **API Management**: API key generation and rate limiting
- **Server Registry**: Personal MCP server registration and management
- **Namespace Routing**: Organized tool routing with namespace support

### Development Status

✅ **Tasks 1-10 Complete**: Core functionality implemented
- TypeScript project initialization
- Core domain models (User, Server, ApiKey, Endpoint)
- Service interfaces and implementations
- Database schema and repositories
- User management and authentication
- Usage tracking and rate limiting
- Server registry and metadata management
- Server groups and endpoint management
- Protocol adapters (STDIO, SSE, HTTP)
- Tool routing and namespace system

✅ **Task 11 Modified**: Simplified architecture (Load balancing deferred)
- Load balancing code implemented but **disabled by default** for simplicity
- Focus on individual user servers with personal credentials
- Stateless MCP server design for easy maintenance
- Load balancing can be enabled in future for scale-out scenarios
- See `docs/Architecture-Simplified.md` for details

### Architecture Philosophy

**Simplicity First:** MCP Hub Router prioritizes simplicity and maintainability over complex features.

- 👤 **Individual Servers**: Each user runs their own MCP servers
- 🔑 **Personal Credentials**: Servers use user's own API keys/tokens
- ♻️ **Multi-Project Reuse**: One server → multiple projects
- 📦 **Stateless Design**: No caching, predictable behavior
- 🚀 **Future-Proof**: Can enable advanced features when needed

See `docs/Architecture-Simplified.md` for detailed reasoning.

🎉 **Completed Tasks**:
- Task 1-11: Core infrastructure ✅
- Task 12: User Management API ✅
- Task 13: Server Management API ✅
- Task 14: MCP protocol endpoints ✅
- Task 15: Marketplace API ✅
- Task 16: Health/Monitoring API ✅
- Task 17: Dynamic Configuration Management ✅
- Task 18: Logging & Debugging System ✅
- Task 19: Backup & Restore System ✅
- Task 20: Web Dashboard Planning ✅

**📊 Progress: 20/24 Tasks Complete (83%)**

✅ Task 1-20: Core features complete
⏳ Task 21: API Documentation (Swagger/OpenAPI)
⏳ Task 22: Integration Tests
⏳ Task 23: Performance Optimization
⏳ Task 24: Production Deployment

**Status: Beta Ready! 🚀**

### WSL-Specific Notes

- All commands should be run within the WSL environment
- File paths use Unix-style separators
- Node.js and npm should be installed within WSL, not Windows

### Troubleshooting

If you encounter issues:

1. Ensure you're running commands in WSL, not Windows PowerShell
2. Check Node.js version: `node --version`
3. Verify dependencies: `npm list`
4. Run setup verification: `node verify-setup.js`