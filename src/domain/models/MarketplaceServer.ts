/**
 * Marketplace Server Model
 * 
 * Represents a template server that users can install from the marketplace
 * Admins register these templates, users instantiate them with their own credentials
 */

export interface MarketplaceServer {
  id: string;  // e.g., "github-mcp"
  name: string;  // e.g., "GitHub MCP"
  description: string;  // Short description
  longDescription?: string;  // Detailed description
  protocol: 'stdio' | 'sse' | 'http';
  command: string;  // For stdio: executable name
  args?: string[];  // Command arguments
  requiredEnv: string[];  // Required environment variables
  optionalEnv?: string[];  // Optional environment variables
  envDescriptions: Record<string, string>;  // Help text for each env var
  tags: string[];  // ["github", "development", "scm"]
  installInstructions?: string;  // How to install (npm install, etc)
  documentation?: string;  // URL to documentation
  installCount: number;  // How many users installed this
  rating?: number;  // Average rating (future feature)
  createdBy: string;  // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceServerCreate {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  protocol: 'stdio' | 'sse' | 'http';
  command: string;
  args?: string[];
  requiredEnv: string[];
  optionalEnv?: string[];
  envDescriptions: Record<string, string>;
  tags: string[];
  installInstructions?: string;
  documentation?: string;
}

export interface MarketplaceServerUpdate {
  name?: string;
  description?: string;
  longDescription?: string;
  tags?: string[];
  documentation?: string;
  envDescriptions?: Record<string, string>;
}

