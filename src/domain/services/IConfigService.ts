/**
 * Configuration Service Interface
 * Task 17: Dynamic Configuration Management
 * 
 * Provides runtime configuration management without restart
 */

export interface IConfigService {
  /**
   * Get configuration value by key
   */
  get<T = any>(key: string, defaultValue?: T): T;

  /**
   * Set configuration value
   * Updates in-memory config and optionally persists to database
   */
  set(key: string, value: any, persist?: boolean): Promise<void>;

  /**
   * Get all configuration
   */
  getAll(): Record<string, any>;

  /**
   * Reload configuration from database
   */
  reload(): Promise<void>;

  /**
   * Watch for configuration changes
   */
  watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void;

  /**
   * Validate configuration
   */
  validate(config: Record<string, any>): Promise<{ valid: boolean; errors: string[] }>;
}

export interface ConfigEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export const CONFIG_KEYS = {
  // Rate Limiting
  RATE_LIMIT_ENABLED: 'rate_limit.enabled',
  RATE_LIMIT_WINDOW_MS: 'rate_limit.window_ms',
  RATE_LIMIT_MAX_REQUESTS: 'rate_limit.max_requests',

  // Server Defaults
  SERVER_DEFAULT_TIMEOUT: 'server.default_timeout',
  SERVER_HEALTH_CHECK_INTERVAL: 'server.health_check_interval',
  SERVER_MAX_RETRIES: 'server.max_retries',

  // Load Balancing
  LOAD_BALANCING_ENABLED: 'load_balancing.enabled',
  LOAD_BALANCING_STRATEGY: 'load_balancing.strategy',

  // Logging
  LOG_LEVEL: 'logging.level',
  LOG_FORMAT: 'logging.format',

  // Features
  MARKETPLACE_ENABLED: 'features.marketplace_enabled',
  GROUP_MANAGEMENT_ENABLED: 'features.group_management_enabled',
  BACKUP_ENABLED: 'features.backup_enabled',
} as const;

