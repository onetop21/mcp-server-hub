/**
 * Structured Logging System
 * Task 18: Logging and Debugging System
 * 
 * Simple but effective logging with user isolation and filtering
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  serverId?: string;
  requestId?: string;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private format: 'json' | 'text' = 'json';
  private filters: Map<string, (entry: LogEntry) => boolean> = new Map();

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setFormat(format: 'json' | 'text'): void {
    this.format = format;
  }

  addFilter(name: string, filter: (entry: LogEntry) => boolean): void {
    this.filters.set(name, filter);
  }

  removeFilter(name: string): void {
    this.filters.delete(name);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, { ...context, error });
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Check if level is enabled
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      userId: context?.userId,
      serverId: context?.serverId,
      requestId: context?.requestId,
      error: context?.error
    };

    // Apply filters
    for (const filter of this.filters.values()) {
      if (!filter(entry)) {
        return;
      }
    }

    // Output log
    this.output(entry);
  }

  private isLevelEnabled(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  private output(entry: LogEntry): void {
    if (this.format === 'json') {
      console.log(JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        ...entry.context,
        userId: entry.userId,
        serverId: entry.serverId,
        requestId: entry.requestId,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined
      }));
    } else {
      const timestamp = entry.timestamp.toISOString();
      const level = entry.level.toUpperCase().padEnd(5);
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      console.log(`[${timestamp}] ${level} ${entry.message}${contextStr}`);
      if (entry.error) {
        console.error(entry.error);
      }
    }
  }

  /**
   * Create a child logger with fixed context
   */
  child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, any>
  ) {}

  debug(message: string, context?: Record<string, any>): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, any>): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

