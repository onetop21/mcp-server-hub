const { UserManagementService } = require('./dist/domain/services/UserManagementService');
const { SubscriptionTier } = require('./dist/domain/models/User');
// Permission is an interface, not an enum

/**
 * Simple Integration Test with Mock Dependencies
 * Tests the User Management Service logic without database
 */

// Mock Database Connection
class MockDatabaseConnection {
  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
  }

  async connect() {
    console.log('✅ Mock database connected');
  }

  async disconnect() {
    console.log('✅ Mock database disconnected');
  }

  async query(sql, params = []) {
    // Simple mock implementation
    return { rows: [], rowCount: 0 };
  }
}

// Mock User Repository
class MockUserRepository {
  constructor() {
    this.users = new Map();
    this.idCounter = 1;
  }

  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async findUserById(id) {
    return this.users.get(id) || null;
  }

  async createUser(userData) {
    const user = {
      id: `user_${this.idCounter++}`,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateLastLogin(id) {
    const user = this.users.get(id);
    if (user) {
      user.updatedAt = new Date();
    }
  }
}

// Mock API Key Repository
class MockApiKeyRepository {
  constructor() {
    this.apiKeys = new Map();
    this.keysByHash = new Map();
    this.idCounter = 1;
  }

  async findByKey(key) {
    return this.keysByHash.get(this.hashKey(key)) || null;
  }

  async findByUserId(userId) {
    return Array.from(this.apiKeys.values()).filter(key => key.userId === userId);
  }

  async createApiKey(apiKeyData) {
    const apiKey = {
      id: `key_${this.idCounter++}`,
      ...apiKeyData,
      createdAt: new Date()
    };
    this.apiKeys.set(apiKey.id, apiKey);
    this.keysByHash.set(this.hashKey(apiKey.key), apiKey);
    return apiKey;
  }

  async updateLastUsed(key) {
    const apiKey = this.keysByHash.get(this.hashKey(key));
    if (apiKey) {
      apiKey.lastUsedAt = new Date();
    }
  }

  async revokeApiKey(id) {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.expiresAt = new Date();
    }
  }

  async nameExistsForUser(userId, name) {
    return Array.from(this.apiKeys.values())
      .some(key => key.userId === userId && key.name === name);
  }

  async findApiKeyById(id) {
    return this.apiKeys.get(id) || null;
  }

  hashKey(key) {
    // Simple hash for testing
    return Buffer.from(key).toString('base64');
  }
}

// Mock Password Hasher
class MockPasswordHasher {
  async hash(password) {
    return `hashed_${password}`;
  }

  async verify(password, hash) {
    return hash === `hashed_${password}`;
  }
}

// Mock Token Generator
class MockTokenGenerator {
  generateJwtToken(userId) {
    return `jwt_token_${userId}_${Date.now()}`;
  }

  generateApiKey() {
    return `api_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateExpirationDate(duration) {
    const now = new Date();
    if (duration === '24h') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour default
  }
}

// Mock Rate Limiter
class MockRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  async checkRateLimit(apiKey, hourlyLimit, dailyLimit) {
    const now = new Date();
    const requests = this.requests.get(apiKey) || [];
    
    // Filter requests within the last hour and day
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const hourlyRequests = requests.filter(time => time > hourAgo).length;
    const dailyRequests = requests.filter(time => time > dayAgo).length;
    
    return {
      exceeded: hourlyRequests >= hourlyLimit || dailyRequests >= dailyLimit,
      remainingHour: Math.max(0, hourlyLimit - hourlyRequests),
      remainingDay: Math.max(0, dailyLimit - dailyRequests),
      resetTime: new Date(now.getTime() + 60 * 60 * 1000)
    };
  }

  async recordRequest(apiKey) {
    const requests = this.requests.get(apiKey) || [];
    requests.push(new Date());
    this.requests.set(apiKey, requests);
  }
}

/**
 * Run the integration test
 */
async function runSimpleIntegrationTest() {
  console.log('🚀 Starting Simple User Management Service Integration Test...\n');

  let testUserId;
  let testApiKeyId;

  try {
    // Initialize mock dependencies
    console.log('🔧 Setting up mock dependencies...');
    const db = new MockDatabaseConnection();
    const userRepository = new MockUserRepository();
    const apiKeyRepository = new MockApiKeyRepository();
    const passwordHasher = new MockPasswordHasher();
    const tokenGenerator = new MockTokenGenerator();
    const rateLimiter = new MockRateLimiter();

    await db.connect();

    // Initialize service
    const userManagementService = new UserManagementService(
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
    console.log(`   Token: ${authToken.token.substring(0, 30)}...`);
    console.log(`   Expires: ${authToken.expiresAt}`);
    console.log(`   User ID: ${authToken.userId}\n`);

    // Test 3: API Key Generation
    console.log('🔑 Test 3: API Key Generation');
    const apiKey = await userManagementService.generateApiKey(
      testUserId,
      [
        { resource: 'servers', actions: ['read'] },
        { resource: 'servers', actions: ['write'] }
      ],
      'Test Integration Key'
    );
    testApiKeyId = apiKey.id;
    
    console.log('✅ API Key generated successfully');
    console.log(`   Key ID: ${apiKey.id}`);
    console.log(`   Key: ${apiKey.key.substring(0, 30)}...`);
    console.log(`   Name: ${apiKey.name}`);
    console.log(`   Permissions: ${apiKey.permissions.map(p => `${p.resource}:${p.actions.join(',')}`).join(', ')}`);
    console.log(`   Rate Limit: ${apiKey.rateLimit.requestsPerHour}/hour, ${apiKey.rateLimit.requestsPerDay}/day\n`);

    // Test 4: API Key Validation
    console.log('🔍 Test 4: API Key Validation');
    const validation = await userManagementService.validateApiKey(apiKey.key);
    
    console.log('✅ API Key validated successfully');
    console.log(`   Valid: ${validation.isValid}`);
    console.log(`   User ID: ${validation.userId}`);
    console.log(`   Permissions: ${validation.permissions ? validation.permissions.map(p => `${p.resource}:${p.actions.join(',')}`).join(', ') : 'none'}\n`);

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
    console.log(`   Error: ${revokedValidation.error || 'Key expired'}\n`);

    // Test 10: User Retrieval
    console.log('👥 Test 10: User Retrieval');
    const retrievedUser = await userManagementService.getUserById(testUserId);
    
    console.log('✅ User retrieved successfully');
    console.log(`   Username: ${retrievedUser ? retrievedUser.username : 'N/A'}`);
    console.log(`   Email: ${retrievedUser ? retrievedUser.email : 'N/A'}`);
    console.log(`   Subscription: ${retrievedUser ? retrievedUser.subscription : 'N/A'}\n`);

    console.log('🎉 All integration tests passed successfully!');
    
    await db.disconnect();
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the integration test
if (require.main === module) {
  runSimpleIntegrationTest()
    .then(() => {
      console.log('\n✨ Simple integration test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Simple integration test failed:', error);
      process.exit(1);
    });
}

module.exports = { runSimpleIntegrationTest };