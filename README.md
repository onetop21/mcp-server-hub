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

### Key Features

- **Multi-tenant Architecture**: Support for multiple users and organizations
- **Protocol Adapters**: STDIO, SSE, and HTTP protocol support
- **Dynamic Routing**: Intelligent request routing and load balancing
- **API Management**: API key generation and rate limiting
- **Server Registry**: MCP server registration and management

### Development Status

✅ **Task 1 Complete**: Project foundation and core interfaces
- TypeScript project initialization
- Core domain models (User, Server, ApiKey, Endpoint)
- Service interfaces (UserManagement, ServerRegistry, ProtocolAdapter, Router, Endpoint)
- Dependency injection container setup

🔄 **Next Tasks**:
- Database schema and repositories
- Protocol adapters implementation
- API endpoints
- Authentication and authorization

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