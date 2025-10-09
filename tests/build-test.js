const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running build test...');

try {
  // TypeScript 컴파일 테스트
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful');

  // 빌드 테스트
  console.log('🔨 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful');

  // 빌드 결과 확인
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log('📁 Built files:', files);
  }

  console.log('🎉 All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}




