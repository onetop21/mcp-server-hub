import 'reflect-metadata';
import { createApp } from './infrastructure/api/app';
import { createContainer } from './infrastructure/di/container';

/**
 * MCP Hub Router Entry Point
 */
async function main() {
  try {
    console.log('Starting MCP Hub Router...');

    // Initialize DI container
    const container = createContainer();
    console.log('✓ DI Container initialized');

    // Create Express app
    const app = createApp(container);
    console.log('✓ Express app created');

    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`✓ Server listening on port ${port}`);
      console.log(`  Health: http://localhost:${port}/health`);
      console.log(`  API: http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
