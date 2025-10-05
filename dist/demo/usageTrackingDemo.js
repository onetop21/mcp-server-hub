"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUsageTrackingDemo = void 0;
const PermissionService_1 = require("../domain/services/PermissionService");
const RateLimiter_1 = require("../infrastructure/utils/RateLimiter");
const IPermissionService_1 = require("../domain/services/IPermissionService");
/**
 * Demo script to showcase usage tracking and permission management features
 */
async function runUsageTrackingDemo() {
    console.log('=== MCP Hub Router - Usage Tracking & Permission Management Demo ===\n');
    // Initialize services
    const permissionService = new PermissionService_1.PermissionService();
    const rateLimiter = new RateLimiter_1.RateLimiter();
    console.log('1. Permission Management Demo');
    console.log('-----------------------------');
    // Create sample permissions
    const userPermissions = [
        {
            resource: `${IPermissionService_1.ResourceType.SERVER}:user123:*`,
            actions: [IPermissionService_1.ActionType.READ, IPermissionService_1.ActionType.WRITE]
        },
        {
            resource: `${IPermissionService_1.ResourceType.TOOL}:*`,
            actions: [IPermissionService_1.ActionType.EXECUTE]
        },
        {
            resource: `${IPermissionService_1.ResourceType.GROUP}:user123:group1`,
            actions: [IPermissionService_1.ActionType.MANAGE]
        }
    ];
    console.log('User permissions:', JSON.stringify(userPermissions, null, 2));
    // Test permission checks
    const testCases = [
        { resource: 'server:user123:server1', action: 'read', expected: true },
        { resource: 'server:user123:server2', action: 'write', expected: true },
        { resource: 'server:user456:server1', action: 'read', expected: false },
        { resource: 'tool:any-tool', action: 'execute', expected: true },
        { resource: 'group:user123:group1', action: 'manage', expected: true },
        { resource: 'group:user123:group2', action: 'manage', expected: false },
    ];
    console.log('\nPermission test results:');
    for (const testCase of testCases) {
        const result = permissionService.hasPermission(userPermissions, testCase.resource, testCase.action);
        const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testCase.resource}:${testCase.action} = ${result}`);
    }
    console.log('\n2. Rate Limiting Demo');
    console.log('---------------------');
    const apiKey = 'demo-api-key';
    const hourlyLimit = 5;
    const dailyLimit = 20;
    console.log(`API Key: ${apiKey}`);
    console.log(`Limits: ${hourlyLimit}/hour, ${dailyLimit}/day\n`);
    // Simulate API requests
    for (let i = 1; i <= 7; i++) {
        const status = await rateLimiter.checkRateLimit(apiKey, hourlyLimit, dailyLimit);
        if (!status.exceeded) {
            await rateLimiter.recordRequest(apiKey);
            console.log(`Request ${i}: ✅ Allowed (${status.remaining} remaining)`);
        }
        else {
            console.log(`Request ${i}: ❌ Rate limited (resets at ${status.resetTime.toISOString()})`);
        }
    }
    console.log('\n3. Default Permission Creation Demo');
    console.log('-----------------------------------');
    const userId = 'user456';
    const defaultPermissions = permissionService.createDefaultPermissions(userId);
    console.log(`Default permissions for user ${userId}:`);
    defaultPermissions.forEach((permission, index) => {
        console.log(`${index + 1}. ${permission.resource}: [${permission.actions.join(', ')}]`);
    });
    console.log('\n4. Permission Validation Demo');
    console.log('-----------------------------');
    const validPermission = {
        resource: 'server:123',
        actions: ['read', 'write']
    };
    const invalidPermissions = [
        { resource: '', actions: ['read'] },
        { resource: 'server:123', actions: [] },
        { resource: 'server:123', actions: ['read', ''] }, // Invalid: empty action
    ];
    console.log(`Valid permission: ${permissionService.validatePermission(validPermission) ? '✅' : '❌'}`);
    invalidPermissions.forEach((permission, index) => {
        const isValid = permissionService.validatePermission(permission);
        console.log(`Invalid permission ${index + 1}: ${isValid ? '❌ Should be invalid' : '✅ Correctly rejected'}`);
    });
    console.log('\n5. Permission Merging Demo');
    console.log('--------------------------');
    const permissionSet1 = [
        { resource: 'server:123', actions: ['read'] },
        { resource: 'group:456', actions: ['write'] }
    ];
    const permissionSet2 = [
        { resource: 'server:123', actions: ['write', 'delete'] },
        { resource: 'tool:789', actions: ['execute'] }
    ];
    const merged = permissionService.mergePermissions([permissionSet1, permissionSet2]);
    console.log('Merged permissions:');
    merged.forEach((permission, index) => {
        console.log(`${index + 1}. ${permission.resource}: [${permission.actions.join(', ')}]`);
    });
    // Cleanup
    rateLimiter.destroy();
    console.log('\n=== Demo completed successfully! ===');
}
exports.runUsageTrackingDemo = runUsageTrackingDemo;
// Run the demo if this file is executed directly
if (require.main === module) {
    runUsageTrackingDemo().catch(console.error);
}
