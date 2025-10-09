import 'reflect-metadata';
import { createApp } from './infrastructure/api/app';
import { createContainer } from './infrastructure/di/container';

/**
 * MCP Hub Router Entry Point
 */
async function main() {
  try {
    console.log('Starting MCP Hub Router...');
    console.log('main() function started');
    console.log('About to initialize DI container...');
    console.log('Environment variables:', {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER
    });
    console.log('About to call createContainer()...');
    console.log('createContainer function:', typeof createContainer);

    // Initialize DI container
    console.log('Creating DI container...');
    console.log('About to call createContainer()');
    const container = await createContainer();
    console.log('createContainer() completed');
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
