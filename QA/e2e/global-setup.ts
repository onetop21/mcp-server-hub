import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // 서비스가 준비될 때까지 대기
  console.log('🚀 글로벌 설정: 서비스 시작 대기 중...');

  // 백엔드 서버가 준비될 때까지 대기
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        console.log('✅ 백엔드 서버가 준비되었습니다.');
        break;
      }
    } catch (error) {
      // 연결 실패는 정상 (서버가 아직 시작되지 않았을 수 있음)
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    retries--;
  }

  if (retries === 0) {
    console.warn('⚠️ 백엔드 서버가 준비되지 않았습니다. 테스트를 계속 진행합니다...');
  }

  // 프론트엔드 서버가 준비될 때까지 대기
  retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        console.log('✅ 프론트엔드 서버가 준비되었습니다.');
        break;
      }
    } catch (error) {
      // 연결 실패는 정상
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    retries--;
  }

  if (retries === 0) {
    console.warn('⚠️ 프론트엔드 서버가 준비되지 않았습니다. 테스트를 계속 진행합니다...');
  }
}

export default globalSetup;
