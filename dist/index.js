"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.Application = void 0;
require("reflect-metadata");
const container_1 = require("./infrastructure/di/container");
// Application entry point
class Application {
    constructor() {
        this.container = container_1.container;
    }
    async start() {
        console.log('MCP Hub Router starting...');
        // Initialize DI container and services
        await this.container.initialize();
        // TODO: Initialize HTTP server in future tasks
        // await this.startHttpServer();
        console.log('MCP Hub Router started successfully');
    }
    async stop() {
        console.log('MCP Hub Router stopping...');
        // Cleanup resources
        await this.container.cleanup();
        // TODO: Stop HTTP server in future tasks
        // await this.stopHttpServer();
        console.log('MCP Hub Router stopped');
    }
}
exports.Application = Application;
// Start application if this file is run directly
if (require.main === module) {
    const app = new Application();
    app.start().catch((error) => {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
    // Graceful shutdown
    process.on('SIGINT', async () => {
        await app.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await app.stop();
        process.exit(0);
    });
}
var container_2 = require("./infrastructure/di/container");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return container_2.container; } });
__exportStar(require("./domain/models"), exports);
__exportStar(require("./domain/services"), exports);
