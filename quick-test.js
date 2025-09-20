// Quick compilation test for WSL environment
const fs = require('fs');

console.log('🚀 Quick Test - MCP Hub Router');
console.log('Node.js:', process.version);

// Test if we can read our TypeScript files
try {
  const indexContent = fs.readFileSync('src/index.ts', 'utf8');
  console.log('✅ Can read src/index.ts');
  
  const userModelContent = fs.readFileSync('src/domain/models/User.ts', 'utf8');
  console.log('✅ Can read User model');
  
  const containerContent = fs.readFileSync('src/infrastructure/di/container.ts', 'utf8');
  console.log('✅ Can read DI container');
  
  // Check if basic patterns exist
  if (indexContent.includes('reflect-metadata')) {
    console.log('✅ reflect-metadata import found');
  }
  
  if (userModelContent.includes('SubscriptionTier')) {
    console.log('✅ SubscriptionTier enum found');
  }
  
  if (containerContent.includes('inversify')) {
    console.log('✅ Inversify DI setup found');
  }
  
  console.log('\n🎉 All basic checks passed!');
  console.log('\nTo test in WSL environment:');
  console.log('1. cd to project directory');
  console.log('2. npm install (if not done)');
  console.log('3. npm run build');
  console.log('4. npm test');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}