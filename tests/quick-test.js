const { execSync } = require('child_process');

console.log('⚡ Running quick test...');

try {
  // 빠른 컴파일 체크
  console.log('🔍 Quick TypeScript check...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript check passed');

  // 빠른 린트 체크
  console.log('🧹 Quick lint check...');
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ Lint check passed');

  console.log('🎉 Quick test completed!');
} catch (error) {
  console.error('❌ Quick test failed:', error.message);
  process.exit(1);
}




