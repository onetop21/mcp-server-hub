const { UserManagementService } = require('./dist/domain/services/UserManagementService');
const { UserRepository } = require('./dist/infrastructure/repositories/UserRepository');
const { ApiKeyRepository } = require('./dist/infrastructure/repositories/ApiKeyRepository');
const { PasswordHasher } = require('./dist/infrastructure/utils/PasswordHasher');
const { TokenGenerator } = require('./dist/infrastructure/utils/TokenGenerator');
const { RateLimiter } = require('./dist/infrastructure/utils/RateLimiter');
const { DatabaseConnection } = require('./dist/infrastructure/database/connection');
const { SubscriptionTier } = require('./dist/domain/models/User');
const { Permission } = require('./dist/domain/models/ApiKey');

/**
 * Integration Test for User Management Service
 * Tests the complete flow from user registration to API key management
 */
async function runIntegrationTest() {
  console.log('🚀 Starting User Management Service Integration Test...\n');

  let db;
  let userManagementService;
  let testUserId;
  let testApiKeyId;

  try {
    // Initialize database connection
    console.log('📊 Initializing database connection...');
    db = new DatabaseConnection();
    await db.connect();
    console.log('✅ Database connected successfully\n');

    // Initialize repositories and utilities
    console.log('🔧 Setting up repositories and utilities...');
    const userRepository = new UserRepository(db);
    const apiKeyRepository = new ApiKeyRepository(db);
    const passwordHasher = new PasswordHasher();
    const tokenGenerator = new TokenGenerator();
    const rateLimiter = new RateLimiter();

    // Initialize service
    userManagementService = new UserManagementService(
      userRepository,
      apiKeyRepository,
      passwordHasher,
      tokenGenerator,
      rateLimiter
    );
    console.log('✅ Services initialized successfully\n');

    // Test 1: User Registration
    console.log('👤 Test 1: User Registration');
    const userData = {
      email: `test-${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'TestPassword123!',
      subscription: SubscriptionTier.FREE
    };

    const createdUser = await userManagementService.createUser(userData);
    testUserId = createdUser.id;
    
    console.log(`✅ User created successfully: ${createdUser.username} (${createdUser.email})`);
    console.log(`   User ID: ${createdUser.id}`);
    console.log(`   Subscription: ${createdUser.subscription}\n`);

    // Test 2: User Authentication
    console.log('🔐 Test 2: User Authentication');
    const authToken = await userManagementService.authenticateUser({
      email: userData.email,
      password: userData.password
    });
    
    console.log('✅ User authenticated successfully');
    console.log(`   Token: ${authToken.token.substring(0, 20)}...`);
    console.log(`   Expires: ${authToken.expiresAt}`);
    console.log(`   User ID: ${authToken.userId}\n`);

    // Test 3: API Key Generation
    console.log('🔑 Test 3: API Key Generation');
    const apiKey = await userManagementService.generateApiKey(
      testUserId,
      [Permission.READ_SERVERS, Permission.WRITE_SERVERS],
      'Test Integration Key'
    );
    testApiKeyId = apiKey.id;
    
    console.log('✅ API Key generated successfully');
    console.log(`   Key ID: ${apiKey.id}`);
    console.log(`   Key: ${apiKey.key.substring(0, 20)}...`);
    console.log(`   Name: ${apiKey.name}`);
    console.log(`   Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`   Rate Limit: ${apiKey.rateLimit.requestsPerHour}/hour, ${apiKey.rateLimit.requestsPerDay}/day\n`);

    // Test 4: API Key Validation
    console.log('🔍 Test 4: API Key Validation');
    const validation = await userManagementService.validateApiKey(apiKey.key);
    
    console.log('✅ API Key validated successfully');
    console.log(`   Valid: ${validation.isValid}`);
    console.log(`   User ID: ${validation.userId}`);
    console.log(`   Permissions: ${validation.permissions?.join(', ')}\n`);

    // Test 5: Rate Limit Check
    console.log('⏱️  Test 5: Rate Limit Check');
    const rateLimitStatus = await userManagementService.checkRateLimit(apiKey.key);
    
    console.log('✅ Rate limit checked successfully');
    console.log(`   Exceeded: ${rateLimitStatus.exceeded}`);
    console.log(`   Remaining (hour): ${rateLimitStatus.remainingHour}`);
    console.log(`   Remaining (day): ${rateLimitStatus.remainingDay}`);
    console.log(`   Reset time: ${rateLimitStatus.resetTime}\n`);

    // Test 6: Get User API Keys
    console.log('📋 Test 6: Get User API Keys');
    const userApiKeys = await userManagementService.getUserApiKeys(testUserId);
    
    console.log('✅ User API keys retrieved successfully');
    console.log(`   Total keys: ${userApiKeys.length}`);
    userApiKeys.forEach((key, index) => {
      console.log(`   Key ${index + 1}: ${key.name} (${key.id})`);
    });
    console.log('');

    // Test 7: Duplicate Registration Prevention
    console.log('🚫 Test 7: Duplicate Registration Prevention');
    try {
      await userManagementService.createUser({
        email: userData.email, // Same email
        username: 'differentuser',
        password: 'TestPassword123!',
        subscription: SubscriptionTier.FREE
      });
      console.log('❌ Should have failed - duplicate email allowed');
    } catch (error) {
      console.log('✅ Duplicate email registration prevented');
      console.log(`   Error: ${error.message}\n`);
    }

    // Test 8: Invalid Authentication
    console.log('🔒 Test 8: Invalid Authentication');
    try {
      await userManagementService.authenticateUser({
        email: userData.email,
        password: 'WrongPassword123!'
      });
      console.log('❌ Should have failed - invalid password allowed');
    } catch (error) {
      console.log('✅ Invalid authentication prevented');
      console.log(`   Error: ${error.message}\n`);
    }

    // Test 9: API Key Revocation
    console.log('🗑️  Test 9: API Key Revocation');
    await userManagementService.revokeApiKey(testApiKeyId);
    
    // Try to validate revoked key
    const revokedValidation = await userManagementService.validateApiKey(apiKey.key);
    
    console.log('✅ API Key revoked successfully');
    console.log(`   Revoked key valid: ${revokedValidation.isValid}`);
    console.log(`   Error: ${revokedValidation.error}\n`);

    // Test 10: User Retrieval
    console.log('👥 Test 10: User Retrieval');
    const retrievedUser = await userManagementService.getUserById(testUserId);
    
    console.log('✅ User retrieved successfully');
    console.log(`   Username: ${retrievedUser?.username}`);
    console.log(`   Email: ${retrievedUser?.email}`);
    console.log(`   Subscription: ${retrievedUser?.subscription}\n`);

    console.log('🎉 All integration tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (db) {
      console.log('\n🧹 Cleaning up...');
      
      // Clean up test data
      if (testUserId) {
        try {
          await db.query('DELETE FROM api_keys WHERE user_id = $1', [testUserId]);
          await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
          console.log('✅ Test data cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️  Cleanup warning:', cleanupError.message);
        }
      }
      
      await db.disconnect();
      console.log('✅ Database disconnected');
    }
  }
}

// Run the integration test
if (require.main === module) {
  runIntegrationTest()
    .then(() => {
      console.log('\n✨ Integration test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTest };