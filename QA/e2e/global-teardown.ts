import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 글로벌 정리: 테스트 완료 후 정리 작업 수행 중...');

  // 테스트 완료 후 정리 작업 (필요한 경우 추가)
  // 예: 테스트 데이터베이스 정리, 임시 파일 삭제 등

  console.log('✅ 글로벌 정리가 완료되었습니다.');
}

export default globalTeardown;
