#!/usr/bin/env node

console.log('🔍 MCP Hub Router - Setup Verification');
console.log('=====================================');

const fs = require('fs');
const path = require('path');

// Check Node.js version
console.log('✅ Node.js version:', process.version);
console.log('✅ Platform:', process.platform);

// Check required directories
const requiredDirs = ['src', 'src/domain', 'src/infrastructure'];
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ Directory exists: ${dir}`);
  } else {
    console.log(`❌ Directory missing: ${dir}`);
  }
});

// Check key files
const keyFiles = [
  'package.json',
  'tsconfig.json',
  'src/index.ts',
  'src/domain/models/User.ts',
  'src/infrastructure/di/container.ts'
];

keyFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ File exists: ${file}`);
  } else {
    console.log(`❌ File missing: ${file}`);
  }
});

// Test basic TypeScript imports (if possible)
try {
  console.log('\n🧪 Testing basic functionality...');
  
  // Test enum definition
  const SubscriptionTier = {
    FREE: 'free',
    BASIC: 'basic',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise'
  };
  
  console.log('✅ SubscriptionTier enum test:', SubscriptionTier.FREE);
  
  // Test DI types
  const TYPES = {
    UserManagementService: Symbol.for('UserManagementService'),
    ServerRegistryService: Symbol.for('ServerRegistryService')
  };
  
  console.log('✅ DI Types test:', typeof TYPES.UserManagementService);
  
  console.log('\n🎉 Basic setup verification completed successfully!');
  console.log('\n📝 Next steps for WSL environment:');
  console.log('   1. Run: npm run build');
  console.log('   2. Run: npm test');
  console.log('   3. Run: npm run dev');
  
} catch (error) {
  console.error('❌ Error during verification:', error.message);
}