import 'reflect-metadata';
import { container } from './infrastructure/di/container';

// Application entry point
export class Application {
  private container = container;

  public async start(): Promise<void> {
    console.log('MCP Hub Router starting...');
    
    // Initialize DI container and services
    await this.container.initialize();
    
    // TODO: Initialize HTTP server in future tasks
    // await this.startHttpServer();
    
    console.log('MCP Hub Router started successfully');
  }

  public async stop(): Promise<void> {
    console.log('MCP Hub Router stopping...');
    
    // Cleanup resources
    await this.container.cleanup();
    
    // TODO: Stop HTTP server in future tasks
    // await this.stopHttpServer();
    
    console.log('MCP Hub Router stopped');
  }
}

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

export { container } from './infrastructure/di/container';
export * from './domain/models';
export * from './domain/services';