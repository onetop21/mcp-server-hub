const { execSync } = require('child_process');

console.log('🔧 Running setup verification...');

try {
  // Node.js 버전 확인
  console.log('📋 Checking Node.js version...');
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js version: ${nodeVersion}`);

  // npm 버전 확인
  console.log('📦 Checking npm version...');
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm version: ${npmVersion}`);

  // 의존성 설치 확인
  console.log('📚 Checking dependencies...');
  execSync('npm list --depth=0', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');

  // 환경 변수 확인
  console.log('🌍 Checking environment variables...');
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.log('💡 Create a .env file based on env.template');
  } else {
    console.log('✅ Environment variables configured');
  }

  console.log('🎉 Setup verification completed!');
} catch (error) {
  console.error('❌ Setup verification failed:', error.message);
  process.exit(1);
}




