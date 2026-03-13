import { withAdminAuth } from '@/lib/admin';
import { successResponse } from '@/lib/api-error';

/**
 * GET /api/admin/bot-operations
 * Get list of all available bot operations with metadata
 */
export const GET = withAdminAuth(async () => {
  const operations = [
    {
      id: 'rss-poll',
      name: 'RSS 폴링',
      description: '5분마다 모든 활성 멤버의 RSS 피드를 확인하여 새 게시글을 수집합니다',
      category: 'polling',
      schedule: '5분마다',
      running: false, // TODO: Implement running status check from pg-boss
    },
    {
      id: 'attendance-check',
      name: '출석 체크',
      description: '매주 화요일 00:00에 유예 기간이 끝난 미체출 멤버를 결석으로 표시합니다',
      category: 'attendance',
      schedule: '화요일 00:00',
      running: false,
    },
    {
      id: 'fine-reminder',
      name: '벌금 알림',
      description: '미납 벌금이 있는 멤버에게 매일 리마인드 DM을 발송합니다',
      category: 'fine',
      schedule: '매일 10:00',
      running: false,
    },
    {
      id: 'round-report',
      name: '회차 리포트',
      description: '회차 종료 시 전체 멤버의 출석 현황과 MVP를 포함한 리포트를 발송합니다',
      category: 'round',
      schedule: '화요일 00:05',
      running: false,
    },
    {
      id: 'round-start',
      name: '회차 시작 알림',
      description: '새로운 회차가 시작될 때 알림을 발송하고 회차를 전환합니다',
      category: 'round',
      schedule: '월요일 00:00',
      running: false,
    },
    {
      id: 'curation-crawl',
      name: '큐레이션 크롤링',
      description: '외부 소스(VELO PORT, conf.tube 등)에서 기술 컨텐츠를 크롤링합니다',
      category: 'curation',
      schedule: '매일 23:00',
      running: false,
    },
    {
      id: 'curation-share',
      name: '큐레이션 공유',
      description: '크롤링한 컨텐츠 중 하나를 선택하여 디스코드 채널에 공유합니다',
      category: 'curation',
      schedule: '매일 10:00',
      running: false,
    },
    {
      id: 'weekly-ranking',
      name: '주간 랭킹',
      description: '매주 일요일 22:00에 전체 멤버의 활동 점수 랭킹을 발송합니다',
      category: 'ranking',
      schedule: '일요일 22:00',
      running: false,
    },
  ];

  return successResponse({ operations });
});
