import { ProtocolAdapterService } from '../domain/services/ProtocolAdapterService';
import { ServerProtocol } from '../domain/models/Server';

/**
 * Demo script to test STDIO adapter functionality
 */
async function runStdioAdapterDemo() {
  console.log('🚀 Starting STDIO Adapter Demo...\n');

  const service = new ProtocolAdapterService();

  try {
    // Create a mock STDIO server configuration
    const serverConfig = {
      id: 'demo-server',
      protocol: ServerProtocol.STDIO,
      stdio: {
        command: 'node',
        args: ['-e', `
          // Mock MCP server that responds to JSON-RPC requests
          process.stdin.on('data', (data) => {
            try {
              const request = JSON.parse(data.toString().trim());
              let response;
              
              switch (request.method) {
                case 'tools/list':
                  response = {
                    result: {
                      tools: [
                        { name: 'echo', description: 'Echo back the input' },
                        { name: 'uppercase', description: 'Convert text to uppercase' }
                      ]
                    },
                    id: request.id
                  };
                  break;
                  
                case 'tools/call':
                  if (request.params?.name === 'echo') {
                    response = {
                      result: { output: 'Echo: ' + (request.params?.arguments?.text || 'Hello World') },
                      id: request.id
                    };
                  } else if (request.params?.name === 'uppercase') {
                    response = {
                      result: { output: (request.params?.arguments?.text || 'hello').toUpperCase() },
                      id: request.id
                    };
                  } else {
                    response = {
                      error: { code: -32601, message: 'Tool not found' },
                      id: request.id
                    };
                  }
                  break;
                  
                default:
                  response = {
                    error: { code: -32601, message: 'Method not found' },
                    id: request.id
                  };
              }
              
              console.log(JSON.stringify(response));
            } catch (error) {
              console.log(JSON.stringify({
                error: { code: -32700, message: 'Parse error' },
                id: null
              }));
            }
          });
        `],
        env: { DEMO_MODE: 'true' }
      }
    };

    console.log('📝 Creating STDIO adapter...');
    const adapter = await service.createAdapter(serverConfig);
    console.log(`✅ Adapter created with ID: ${adapter.id}`);
    console.log(`📊 Status: ${adapter.status}`);
    console.log(`🔧 Protocol: ${adapter.protocol}\n`);

    // Test health check
    console.log('🏥 Checking adapter health...');
    const health = await service.getAdapterHealth(adapter.id);
    console.log(`💚 Health Status: ${health.status}`);
    console.log(`⏰ Last Check: ${health.lastCheck.toISOString()}\n`);

    // Test tools/list request
    console.log('📋 Requesting available tools...');
    const toolsResponse = await service.sendRequest(adapter.id, {
      method: 'tools/list',
      id: 'req-1'
    });
    console.log('🔧 Available tools:', JSON.stringify(toolsResponse.result?.tools, null, 2));

    // Test echo tool
    console.log('\n🔊 Testing echo tool...');
    const echoResponse = await service.sendRequest(adapter.id, {
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { text: 'Hello from STDIO adapter!' }
      },
      id: 'req-2'
    });
    console.log('📤 Echo result:', echoResponse.result?.output);

    // Test uppercase tool
    console.log('\n🔠 Testing uppercase tool...');
    const uppercaseResponse = await service.sendRequest(adapter.id, {
      method: 'tools/call',
      params: {
        name: 'uppercase',
        arguments: { text: 'hello world' }
      },
      id: 'req-3'
    });
    console.log('📤 Uppercase result:', uppercaseResponse.result?.output);

    // Test error handling
    console.log('\n❌ Testing error handling...');
    const errorResponse = await service.sendRequest(adapter.id, {
      method: 'tools/call',
      params: {
        name: 'nonexistent',
        arguments: {}
      },
      id: 'req-4'
    });
    console.log('🚫 Error response:', errorResponse.error?.message);

    // Test streaming (should work the same as regular request for STDIO)
    console.log('\n🌊 Testing streaming request...');
    const streamGenerator = service.streamRequest(adapter.id, {
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { text: 'Streaming test' }
      },
      id: 'req-5'
    });

    for await (const item of streamGenerator) {
      console.log('📡 Stream item:', item.data.result?.output, '(done:', item.done, ')');
    }

    // Get active adapters
    console.log('\n📊 Getting active adapters...');
    const activeAdapters = await service.getActiveAdapters();
    console.log(`🔢 Active adapters count: ${activeAdapters.length}`);

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await service.closeAdapter(adapter.id);
    console.log('✅ Adapter closed');

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await service.shutdown();
    console.log('🔚 Service shutdown complete');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runStdioAdapterDemo().catch(console.error);
}

export { runStdioAdapterDemo };