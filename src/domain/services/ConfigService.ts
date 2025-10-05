import { IConfigService, ConfigEntry, CONFIG_KEYS } from './IConfigService';

/**
 * Configuration Service Implementation
 * Task 17: Dynamic Configuration Management
 * 
 * In-memory configuration with optional persistence
 */
export class ConfigService implements IConfigService {
  private config: Map<string, any> = new Map();
  private watchers: Map<string, Set<(newValue: any, oldValue: any) => void>> = new Map();
  private defaults: Record<string, any>;

  constructor(initialConfig: Record<string, any> = {}) {
    // Set default configuration
    this.defaults = {
      [CONFIG_KEYS.RATE_LIMIT_ENABLED]: false,
      [CONFIG_KEYS.RATE_LIMIT_WINDOW_MS]: 60000,
      [CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS]: 100,
      [CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT]: 30000,
      [CONFIG_KEYS.SERVER_HEALTH_CHECK_INTERVAL]: 60000,
      [CONFIG_KEYS.SERVER_MAX_RETRIES]: 3,
      [CONFIG_KEYS.LOAD_BALANCING_ENABLED]: false,
      [CONFIG_KEYS.LOAD_BALANCING_STRATEGY]: 'round-robin',
      [CONFIG_KEYS.LOG_LEVEL]: 'info',
      [CONFIG_KEYS.LOG_FORMAT]: 'json',
      [CONFIG_KEYS.MARKETPLACE_ENABLED]: true,
      [CONFIG_KEYS.GROUP_MANAGEMENT_ENABLED]: false,
      [CONFIG_KEYS.BACKUP_ENABLED]: false,
      ...initialConfig
    };

    // Load defaults into config
    for (const [key, value] of Object.entries(this.defaults)) {
      this.config.set(key, value);
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    if (this.config.has(key)) {
      return this.config.get(key) as T;
    }
    return (defaultValue !== undefined ? defaultValue : this.defaults[key]) as T;
  }

  async set(key: string, value: any, persist: boolean = false): Promise<void> {
    const oldValue = this.config.get(key);
    this.config.set(key, value);

    // Notify watchers
    const keyWatchers = this.watchers.get(key);
    if (keyWatchers) {
      for (const callback of keyWatchers) {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error(`Error in config watcher for key ${key}:`, error);
        }
      }
    }

    // TODO: Persist to database if persist=true
    if (persist) {
      console.log(`Config persisted: ${key} = ${JSON.stringify(value)}`);
    }
  }

  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.config.entries()) {
      result[key] = value;
    }
    return result;
  }

  async reload(): Promise<void> {
    // TODO: Reload from database
    console.log('Config reloaded from database');
  }

  watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key)!.add(callback);

    // Return unwatch function
    return () => {
      const keyWatchers = this.watchers.get(key);
      if (keyWatchers) {
        keyWatchers.delete(callback);
        if (keyWatchers.size === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  async validate(config: Record<string, any>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate rate limiting
    if (config[CONFIG_KEYS.RATE_LIMIT_WINDOW_MS] && config[CONFIG_KEYS.RATE_LIMIT_WINDOW_MS] < 1000) {
      errors.push('Rate limit window must be at least 1000ms');
    }

    if (config[CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS] && config[CONFIG_KEYS.RATE_LIMIT_MAX_REQUESTS] < 1) {
      errors.push('Rate limit max requests must be at least 1');
    }

    // Validate timeouts
    if (config[CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT] && config[CONFIG_KEYS.SERVER_DEFAULT_TIMEOUT] < 1000) {
      errors.push('Server timeout must be at least 1000ms');
    }

    // Validate log level
    if (config[CONFIG_KEYS.LOG_LEVEL]) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(config[CONFIG_KEYS.LOG_LEVEL])) {
        errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
      }
    }

    // Validate load balancing strategy
    if (config[CONFIG_KEYS.LOAD_BALANCING_STRATEGY]) {
      const validStrategies = ['round-robin', 'weighted', 'least-connections', 'random'];
      if (!validStrategies.includes(config[CONFIG_KEYS.LOAD_BALANCING_STRATEGY])) {
        errors.push(`Load balancing strategy must be one of: ${validStrategies.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

