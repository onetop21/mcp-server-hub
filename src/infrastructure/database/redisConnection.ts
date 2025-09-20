import { RedisConfig } from '../config/RedisConfig';

// Conditional import to avoid loading Redis when not needed
let createClient: any;
let RedisClientType: any;

try {
  const redis = require('redis');
  createClient = redis.createClient;
  RedisClientType = redis.RedisClientType;
} catch (error) {
  console.warn('Redis module not available:', error);
}

export class RedisConnection {
  private client: any | null = null;
  private config: RedisConfig;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    this.config = config;
    
    if (!createClient) {
      throw new Error('Redis client not available - please install redis package');
    }
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const url = this.config.password
        ? `redis://:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.db || 0}`
        : `redis://${this.config.host}:${this.config.port}/${this.config.db || 0}`;

      this.client = createClient({
        url,
        socket: {
          connectTimeout: this.config.connectTimeout || 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Too many retries');
            }
            return Math.min(retries * 50, 500);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get the Redis client
   */
  getClient(): any {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Ping Redis to check connection
   */
  async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return await this.client.ping();
  }
}