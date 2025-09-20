const { PasswordHasher } = require('./dist/infrastructure/utils/PasswordHasher');
const { TokenGenerator } = require('./dist/infrastructure/utils/TokenGenerator');
const { RateLimiter } = require('./dist/infrastructure/utils/RateLimiter');

async function runTests() {
  console.log('🧪 Running User Management Service Tests...\n');

  // Test PasswordHasher
  console.log('1. Testing PasswordHasher...');
  try {
    const hasher = new PasswordHasher();
    const password = 'TestPassword123!';
    
    const hash = await hasher.hash(password);
    const isValid = await hasher.verify(password, hash);
    const isInvalid = await hasher.verify('wrongpassword', hash);
    
    console.log('   ✅ Password hashing works');
    console.log('   ✅ Password verification works');
    console.log('   ✅ Invalid password rejected');
    
    if (!hash || hash === password) throw new Error('Hash should be different from password');
    if (!isValid) throw new Error('Valid password should verify');
    if (isInvalid) throw new Error('Invalid password should not verify');
    
  } catch (error) {
    console.log('   ❌ PasswordHasher test failed:', error.message);
    return false;
  }

  // Test TokenGenerator
  console.log('\n2. Testing TokenGenerator...');
  try {
    const tokenGen = new TokenGenerator('test-secret');
    const userId = 'user-123';
    
    const token = tokenGen.generateJwtToken(userId);
    const decoded = tokenGen.verifyJwtToken(token);
    const apiKey = tokenGen.generateApiKey();
    const expDate = tokenGen.calculateExpirationDate('24h');
    
    console.log('   ✅ JWT token generation works');
    console.log('   ✅ JWT token verification works');
    console.log('   ✅ API key generation works');
    console.log('   ✅ Expiration date calculation works');
    
    if (!token || typeof token !== 'string') throw new Error('Token should be a string');
    if (!decoded || decoded.userId !== userId) throw new Error('Decoded token should contain userId');
    if (!apiKey || !apiKey.startsWith('mcp_')) throw new Error('API key should start with mcp_');
    if (!expDate || expDate <= new Date()) throw new Error('Expiration date should be in the future');
    
  } catch (error) {
    console.log('   ❌ TokenGenerator test failed:', error.message);
    return false;
  }

  // Test RateLimiter
  console.log('\n3. Testing RateLimiter...');
  try {
    const rateLimiter = new RateLimiter();
    const apiKey = 'test-api-key';
    
    // Test initial state
    const status1 = await rateLimiter.checkRateLimit(apiKey, 10, 100);
    
    // Record some requests
    await rateLimiter.recordRequest(apiKey);
    await rateLimiter.recordRequest(apiKey);
    
    const status2 = await rateLimiter.checkRateLimit(apiKey, 10, 100);
    
    // Test limit exceeded
    for (let i = 0; i < 10; i++) {
      await rateLimiter.recordRequest(apiKey);
    }
    
    const status3 = await rateLimiter.checkRateLimit(apiKey, 10, 100);
    
    console.log('   ✅ Initial rate limit check works');
    console.log('   ✅ Request recording works');
    console.log('   ✅ Rate limit exceeded detection works');
    
    if (status1.exceeded) throw new Error('Initial status should not be exceeded');
    if (status2.remaining !== 8) throw new Error('Remaining should be 8 after 2 requests');
    if (!status3.exceeded) throw new Error('Should be exceeded after 12 requests');
    
    rateLimiter.destroy();
    
  } catch (error) {
    console.log('   ❌ RateLimiter test failed:', error.message);
    return false;
  }

  console.log('\n✅ All User Management Service utility tests passed!');
  return true;
}

// Run tests
runTests().then(success => {
  if (success) {
    console.log('\n🎉 Test suite completed successfully!');
    process.exit(0);
  } else {
    console.log('\n💥 Test suite failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test runner error:', error);
  process.exit(1);
});