"use strict";
/**
 * Structured Logging System
 * Task 18: Logging and Debugging System
 *
 * Simple but effective logging with user isolation and filtering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.ChildLogger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class Logger {
    constructor() {
        this.level = LogLevel.INFO;
        this.format = 'json';
        this.filters = new Map();
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLevel(level) {
        this.level = level;
    }
    setFormat(format) {
        this.format = format;
    }
    addFilter(name, filter) {
        this.filters.set(name, filter);
    }
    removeFilter(name) {
        this.filters.delete(name);
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, Object.assign(Object.assign({}, context), { error }));
    }
    log(level, message, context) {
        // Check if level is enabled
        if (!this.isLevelEnabled(level)) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            context,
            userId: context === null || context === void 0 ? void 0 : context.userId,
            serverId: context === null || context === void 0 ? void 0 : context.serverId,
            requestId: context === null || context === void 0 ? void 0 : context.requestId,
            error: context === null || context === void 0 ? void 0 : context.error
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
    isLevelEnabled(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentIndex = levels.indexOf(this.level);
        const requestedIndex = levels.indexOf(level);
        return requestedIndex >= currentIndex;
    }
    output(entry) {
        if (this.format === 'json') {
            console.log(JSON.stringify(Object.assign(Object.assign({ timestamp: entry.timestamp.toISOString(), level: entry.level, message: entry.message }, entry.context), { userId: entry.userId, serverId: entry.serverId, requestId: entry.requestId, error: entry.error ? {
                    message: entry.error.message,
                    stack: entry.error.stack
                } : undefined })));
        }
        else {
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
    child(context) {
        return new ChildLogger(this, context);
    }
}
exports.Logger = Logger;
class ChildLogger {
    constructor(parent, context) {
        this.parent = parent;
        this.context = context;
    }
    debug(message, context) {
        this.parent.debug(message, Object.assign(Object.assign({}, this.context), context));
    }
    info(message, context) {
        this.parent.info(message, Object.assign(Object.assign({}, this.context), context));
    }
    warn(message, context) {
        this.parent.warn(message, Object.assign(Object.assign({}, this.context), context));
    }
    error(message, error, context) {
        this.parent.error(message, error, Object.assign(Object.assign({}, this.context), context));
    }
}
exports.ChildLogger = ChildLogger;
// Export singleton instance
exports.logger = Logger.getInstance();
