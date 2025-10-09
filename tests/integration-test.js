const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔗 Running integration test...');

try {
  // 환경 변수 설정
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'mcp_hub_router_test';
  process.env.DB_USER = 'postgres';
  process.env.DB_PASSWORD = 'password';

  // 데이터베이스 연결 테스트
  console.log('🗄️ Testing database connection...');
  execSync('npm run db:test', { stdio: 'inherit' });
  console.log('✅ Database connection successful');

  // API 엔드포인트 테스트
  console.log('🌐 Testing API endpoints...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ API tests successful');

  console.log('🎉 Integration test completed!');
} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  process.exit(1);
}




