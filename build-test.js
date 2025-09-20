#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔨 Build Test for MCP Hub Router');
console.log('================================');

try {
  // Check if TypeScript is available
  console.log('📋 Checking TypeScript...');
  const tscVersion = execSync('npx tsc --version', { encoding: 'utf8' });
  console.log('✅ TypeScript:', tscVersion.trim());

  // Check source files
  console.log('\n📁 Checking source files...');
  const requiredFiles = [
    'src/index.ts',
    'src/domain/models/User.ts',
    'src/infrastructure/di/container.ts',
    'src/infrastructure/di/types.ts'
  ];

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - MISSING`);
    }
  });

  // Try to compile
  console.log('\n🔨 Attempting TypeScript compilation...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful!');

  console.log('\n🎉 Build test completed successfully!');
  console.log('\nNext steps:');
  console.log('  npm run build    # Full build');
  console.log('  npm test         # Run tests');
  console.log('  npm run dev      # Development mode');

} catch (error) {
  console.error('\n❌ Build test failed:');
  console.error(error.message);
  
  if (error.stdout) {
    console.error('\nSTDOUT:', error.stdout.toString());
  }
  if (error.stderr) {
    console.error('\nSTDERR:', error.stderr.toString());
  }
  
  process.exit(1);
}