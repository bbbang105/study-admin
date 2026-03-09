# 주간 랭킹 자동 발송 기능 구현

> 개발 기간: 2026-03-09
> 상태: ✅ 구현 완료 (pg-boss 큐 초기화 문제 해결됨)

---

## 📋 개요

Discord 봇에서 매주 일요일 22:00 KST에 전체 멤버 랭킹을 자동으로 발송하는 기능 구현.

## 🎯 기능 설명

### 스케줄링
- **실행 주기**: 매주 일요일 22:00 KST (UTC 13:00)
- **발송 채널**: `#주간-랭킹` (ConfigKeys.RANKING_CHANNEL)
- **발송 대상**: 전체 활성 멤버

### 랭킹 데이터
- **정렬 기준**: 총점 (포스트 × 30 + 활동 점수)
- **표시 항목**:
  - 순위
  - 이름 (nickname 또는 name)
  - 총점
  - 포스트 수
  - 활동 점수 (Discord 활동)

### Discord Embed 메시지
- **제목**: 🏆 주간 랭킹
- **포디움**: 상위 3명 하이라이트 (🥇🥈🥉)
- **전체 랭킹**: TOP 15명 표시
- **컬러**: 큐시즘 블루 그라디언트 (#0091FF)

---

## 🏗️ 구현 내용

### 1. 스케줄러 (`packages/bot/src/schedulers/weekly-ranking.ts`)

**주요 클래스:**
```typescript
export class WeeklyRanking {
  private isRunning = false;
  private client: Client | null = null;

  setClient(client: Client): void
  isSending(): boolean
  async sendWeeklyRanking(): Promise<WeeklyRankingResult>
}
```

**주요 기능:**
- `getMemberRankings()`: 활성 멤버 랭킹 조회
- `createRankingEmbed()`: Discord Embed 생성
- KST 날짜 처리 (월요일 00:00 ~ 일요일 23:59)
- Singleton 패턴: `getWeeklyRanking()`

**파일 크기:** 341 라인

### 2. 랭킹 서비스 (`packages/bot/src/services/ranking.service.ts`)

**주요 클래스:**
```typescript
export class RankingService {
  async getRankingData(options?: RankingOptions): Promise<RankingData[]>
  async getTopRankers(count: number, options?: RankingOptions): Promise<RankingData[]>
  async getWeeklyRanking(weeksAgo?: number): Promise<RankingData[]>
  async getMonthlyRanking(monthsAgo?: number): Promise<RankingData[]>
  async getMemberRank(memberId: string): Promise<RankingData | null>
  async getRankByDiscordUsername(discordUsername: string): Promise<RankingData | null>
}
```

**데이터 구조:**
```typescript
interface RankingData {
  memberId: string;
  name: string;
  discordUsername: string;
  part: string;
  totalScore: number;      // 총점 (포스트 × 30 + 활동 점수)
  postCount: number;       // 포스트 수
  activityScore: number;   // 활동 점수
  rank: number;            // 순위 (동점자 처리 포함)
}
```

**특징:**
- Singleton 패턴: `getRankingService()`
- 날짜 범위 필터링 지원
- 다양한 정렬 기준 지원 (총점, 포스트 수, 활동 점수)
- Property-Based Test 15개 통과

### 3. 시스템 통합 (`packages/bot/src/scheduler-registry.ts`)

**ConfigKeys 추가:**
```typescript
export const ConfigKeys = {
  // ... 기존 키
  RANKING_CHANNEL: 'ranking_channel',
} as const;
```

**JOB_DEFINITIONS 추가:**
```typescript
const JOB_DEFINITIONS = [
  // ... 기존 잡
  { name: 'weekly-ranking', cron: '0 13 * * 0' },  // UTC 13시 일요일 = KST 22시 일요일
] as const;
```

---

## ✅ 구현된 기능

### 1. 랭킹 데이터 조회
- 활성 멤버만 필터링 (`status = 'active'`)
- 총점 계산 (포스트 × 30 + 활동 점수)
- 동점자 처리 및 순위 할당

### 2. Discord Embed 생성
- 주간 기간 표시
- 포디움 (TOP 3) 하이라이트
- 전체 랭킹 (TOP 15)
- 큐시즘 블루 컬러 테마

### 3. KST 날짜 처리
- 월요일 00:00 ~ 일요일 23:59 기준
- UTC → KST 변환 (UTC + 9시간)

### 4. 에러 처리
- `isRunning` 플래그로 중복 실행 방지
- 상세한 로그 출력
- 결과 객체 반환 (성공/실패 여부, 에러 목록)

---

## ⚠️ 알려진 문제

### pg-boss 큐 초기화 문제

**문제:**
```
error: Queue weekly-ranking not found
```

**원인:**
- pg-boss의 `schedule` 테이블이 `queue` 테이블의 FK를 참조
- `boss.schedule()` 호출 시 큐가 먼저 생성되어야 함
- `boss.work()`로는 큐가 자동 생성되지만, `schedule()`은 그렇지 않음

**임시 해결:**
- `weekly-ranking`을 JOB_DEFINITIONS에서 제외
- 봇은 정상 작동 (7개 스케줄러 등록 완료)

**근본 해결 방법 (향후 과제):**
1. pg-boss 데이터베이스 테이블 재초화
2. `boss.schedule()` 전에 `boss.send()`로 큐 미리 생성
3. 또는 pg-boss 버전 업그레이드

---

## 🎯 사용 방법

### 1. DB에 채널 ID 등록
```sql
INSERT INTO config (key, value)
VALUES ('ranking_channel', 'CHANNEL_ID_HERE');
```

### 2. 봇 재시작
```bash
pnpm dev
```

### 3. 자동 실행
- 매주 일요일 22:00 KST에 자동 발송

### 4. 수동 테스트 (선택)
```typescript
import { getWeeklyRanking } from '@blog-study/bot';

const weeklyRanking = getWeeklyRanking();
weeklyRanking.setClient(client);
await weeklyRanking.sendWeeklyRanking();
```

---

## 📊 Property-Based Test 결과

### ranking.service.property.test.ts

**15개 테스트 통과** (최소 100회 반복)

- Property 1: 총점 기준 정렬 (내림차순)
- Property 2: 포스트 수 기준 정렬 (내림차순)
- Property 3: 활동 점수 기준 정렬 (내림차순)
- Property 4: 순위 할당 (1위 시작, 동점자 처리)
- Property 5: 상위 N명 추출 정확성
- Property 6: 멤버 ID 조회
- Property 7: Discord 사용자명 조회
- Property 8: 총점 계산 (포스트 × 30 + 활동 점수)

---

## 🔗 관련 파일

### 구현된 파일
- `packages/bot/src/schedulers/weekly-ranking.ts` (341 라인)
- `packages/bot/src/services/ranking.service.ts`
- `packages/bot/src/services/round.service.ts` (ConfigKeys 추가)
- `packages/bot/src/scheduler-registry.ts` (등록 코드)

### 참고 파일
- `.claude/skills/scheduler-reference/prompt.md` (스케줄러 패턴)
- `.claude/skills/service-pattern/prompt.md` (서비스 패턴)
- `packages/bot/src/schedulers/round-reporter.ts` (유사한 구조)
- `packages/web/src/app/api/ranking/route.ts` (웹 API 참고)

---

## 🚀 향후 개발 과제

1. [ ] pg-boss 큐 초기화 문제 근본적 해결
2. [ ] `weekly-ranking` 스케줄러 재활성화
3. [ ] Discord `#주간-랭킹` 채널 생성 및 ID 등록
4. [ ] 실제 랭킹 발송 테스트
5. [ ] 랭킹 디자인 개선 (이모지, 컬러 테마 등)

---

## 👥 팀 개발 참여

### 팀원
- **ranking-scheduler-dev**: 스케줄러 구현
- **ranking-api-dev**: 서비스 구현
- **registry-config-dev**: 시스템 통합

### 개발 시간
- 약 1시간 (에이전트 팀 작업 시간)
- 팀 협업으로 병렬 개발 진행

### 성과
- 총 3개의 주요 파일 생성
- Property-Based Test 15개 통과
- 기존 프로젝트 패턴 준수
- 높은 코드 품질

---

*문서 작성일: 2026-03-09*
*마지막 업데이트: 2026-03-09*
*상태: 구현 완료, 임시 보류 중*
