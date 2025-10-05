"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceRepository = void 0;
/**
 * Marketplace Repository
 *
 * In-memory implementation for now
 * Can be replaced with PostgreSQL later
 */
class MarketplaceRepository {
    constructor(db) {
        this.db = db;
        this.servers = new Map();
        // Initialize with some default servers
        this.initializeDefaults();
    }
    initializeDefaults() {
        // GitHub MCP
        this.servers.set('github-mcp', {
            id: 'github-mcp',
            name: 'GitHub MCP',
            description: 'GitHub integration server for issues, PRs, and repositories',
            longDescription: 'Complete GitHub integration providing tools for creating issues, searching repositories, managing pull requests, and more.',
            protocol: 'stdio',
            command: 'mcp-server-github',
            args: [],
            requiredEnv: ['GITHUB_TOKEN'],
            optionalEnv: ['GITHUB_ORG'],
            envDescriptions: {
                GITHUB_TOKEN: 'GitHub Personal Access Token (generate at github.com/settings/tokens)',
                GITHUB_ORG: 'Default organization name (optional)'
            },
            tags: ['github', 'development', 'scm', 'issues'],
            installInstructions: 'npm install -g @modelcontextprotocol/server-github',
            documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
            installCount: 0,
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // Slack MCP
        this.servers.set('slack-mcp', {
            id: 'slack-mcp',
            name: 'Slack MCP',
            description: 'Slack integration for messages, channels, and users',
            longDescription: 'Send messages, create channels, and manage Slack workspace',
            protocol: 'stdio',
            command: 'mcp-server-slack',
            args: [],
            requiredEnv: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
            envDescriptions: {
                SLACK_BOT_TOKEN: 'Slack Bot User OAuth Token',
                SLACK_TEAM_ID: 'Your Slack Team ID'
            },
            tags: ['slack', 'communication', 'collaboration'],
            installInstructions: 'npm install -g @modelcontextprotocol/server-slack',
            installCount: 0,
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    async list(tags, search) {
        let servers = Array.from(this.servers.values());
        if (tags && tags.length > 0) {
            servers = servers.filter(server => tags.some(tag => server.tags.includes(tag)));
        }
        if (search) {
            const searchLower = search.toLowerCase();
            servers = servers.filter(server => server.name.toLowerCase().includes(searchLower) ||
                server.description.toLowerCase().includes(searchLower) ||
                server.tags.some(tag => tag.toLowerCase().includes(searchLower)));
        }
        return servers;
    }
    async findById(id) {
        return this.servers.get(id) || null;
    }
    async create(data, createdBy) {
        if (this.servers.has(data.id)) {
            throw new Error(`Marketplace server '${data.id}' already exists`);
        }
        const server = Object.assign(Object.assign({}, data), { installCount: 0, createdBy, createdAt: new Date(), updatedAt: new Date() });
        this.servers.set(server.id, server);
        return server;
    }
    async update(id, updates) {
        const server = this.servers.get(id);
        if (!server) {
            throw new Error(`Marketplace server '${id}' not found`);
        }
        const updated = Object.assign(Object.assign(Object.assign({}, server), updates), { updatedAt: new Date() });
        this.servers.set(id, updated);
        return updated;
    }
    async delete(id) {
        if (!this.servers.has(id)) {
            throw new Error(`Marketplace server '${id}' not found`);
        }
        this.servers.delete(id);
    }
    async incrementInstallCount(id) {
        const server = this.servers.get(id);
        if (server) {
            server.installCount++;
            server.updatedAt = new Date();
            this.servers.set(id, server);
        }
    }
}
exports.MarketplaceRepository = MarketplaceRepository;
