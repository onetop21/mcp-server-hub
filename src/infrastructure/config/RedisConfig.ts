export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export class RedisConfigManager {
  private static config: RedisConfig | null = null;

  public static getConfig(): RedisConfig {
    if (!this.config) {
      this.config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        connectTimeout: 10000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      };
    }
    return this.config;
  }

  public static setConfig(config: RedisConfig): void {
    this.config = config;
  }

  public static reset(): void {
    this.config = null;
  }
}