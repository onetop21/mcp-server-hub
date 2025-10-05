"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStdioAdapterDemo = void 0;
const ProtocolAdapterService_1 = require("../domain/services/ProtocolAdapterService");
const Server_1 = require("../domain/models/Server");
/**
 * Demo script to test STDIO adapter functionality
 */
async function runStdioAdapterDemo() {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g, _h;
    console.log('🚀 Starting STDIO Adapter Demo...\n');
    const service = new ProtocolAdapterService_1.ProtocolAdapterService();
    try {
        // Create a mock STDIO server configuration
        const serverConfig = {
            id: 'demo-server',
            protocol: Server_1.ServerProtocol.STDIO,
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
        console.log('🔧 Available tools:', JSON.stringify((_d = toolsResponse.result) === null || _d === void 0 ? void 0 : _d.tools, null, 2));
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
        console.log('📤 Echo result:', (_e = echoResponse.result) === null || _e === void 0 ? void 0 : _e.output);
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
        console.log('📤 Uppercase result:', (_f = uppercaseResponse.result) === null || _f === void 0 ? void 0 : _f.output);
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
        console.log('🚫 Error response:', (_g = errorResponse.error) === null || _g === void 0 ? void 0 : _g.message);
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
        try {
            for (var _j = true, streamGenerator_1 = __asyncValues(streamGenerator), streamGenerator_1_1; streamGenerator_1_1 = await streamGenerator_1.next(), _a = streamGenerator_1_1.done, !_a;) {
                _c = streamGenerator_1_1.value;
                _j = false;
                try {
                    const item = _c;
                    console.log('📡 Stream item:', (_h = item.data.result) === null || _h === void 0 ? void 0 : _h.output, '(done:', item.done, ')');
                }
                finally {
                    _j = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_j && !_a && (_b = streamGenerator_1.return)) await _b.call(streamGenerator_1);
            }
            finally { if (e_1) throw e_1.error; }
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
    }
    catch (error) {
        console.error('❌ Demo failed:', error);
    }
    finally {
        await service.shutdown();
        console.log('🔚 Service shutdown complete');
    }
}
exports.runStdioAdapterDemo = runStdioAdapterDemo;
// Run the demo if this file is executed directly
if (require.main === module) {
    runStdioAdapterDemo().catch(console.error);
}
