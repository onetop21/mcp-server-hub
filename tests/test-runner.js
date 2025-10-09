const { execSync } = require('child_process');

console.log('🧪 Running test suite...');

try {
  // 단위 테스트 실행
  console.log('🔬 Running unit tests...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ Unit tests passed');

  // 통합 테스트 실행
  console.log('🔗 Running integration tests...');
  execSync('node tests/integration-test.js', { stdio: 'inherit' });
  console.log('✅ Integration tests passed');

  // 빌드 테스트 실행
  console.log('📦 Running build tests...');
  execSync('node tests/build-test.js', { stdio: 'inherit' });
  console.log('✅ Build tests passed');

  console.log('🎉 All tests completed successfully!');
} catch (error) {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
}




