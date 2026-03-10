# Bot 기능 검토 결과 및 수정 계획

> 검토 일자: 2026-03-10
> 검토 범위: Discord Bot 전체 기능 (스케줄러, 이벤트 핸들러, 서비스)

---

## 개요

6개 핵심 기능 영역(RSS 수집, 출석/벌금, 회차 관리, 큐레이션, 주간 랭킹, 디스코드 이벤트)을 전체 검토했습니다. 전체적으로 아키텍처는 잘 설계되어 있으나, **치명적인 연결 누락과 버그**가 다수 발견되었습니다.

---

## 🔴 P0: 즉시 수정 필요 (치명적)

### 1. DM Handler 미등록
- **위치**: `packages/bot/src/index.ts:24`
- **문제**: `setupDMHandler(client)` 호출이 없음
- **영향**: 벌금 납부 확인 DM이 작동하지 않음. 사용자가 "납부완료"라고 답장해도 반응 없음
- **해결**:
  ```typescript
  // index.ts에 추가
  import { setupDMHandler } from './handlers/dm-handler';

  async function main(): Promise<void> {
    // ...
    setupEventHandlers(client);
    setupActivityHandler(client);
    setupDMHandler(client);  // ← 추가
  }
  ```

### 2. MessageContent Intent 비활성화
- **위치**: `packages/bot/src/bot.ts:12-14`
- **문제**: `GatewayIntentBits.MessageContent`가 주석 처리됨
- **영향**: DM 메시지 내용을 읽을 수 없음. 납부 확인 키워드 인식 불가
- **해결**:
  1. Discord Developer Portal에서 Message Content Intent 활성화
  2. 주석 제거

### 3. 출석 상태 업데이트 누락
- **위치**: `packages/bot/src/scheduler-registry.ts:65-96`
- **문제**: RSS 콜백에서 새 글 생성 후 출석 상태(`SUBMITTED` 또는 `LATE`) 업데이트 없음
- **영향**: 글을 작성해도 출석 처리가 안 됨
- **해결**:
  ```typescript
  // scheduler-registry.ts RSS 콜백에 추가
  if (result.isNew && currentRound) {
    const attendanceService = getAttendanceService();

    // 회차 기간 내 제출 여부 판단
    const isLate = item.pubDate > new Date(currentRound.endDate);

    if (isLate) {
      await attendanceService.markLate(member.id, currentRound.id);
      // 지각 벌금 부과 로직 추가 필요
    } else {
      await attendanceService.markSubmitted(member.id, currentRound.id);
    }
  }
  ```

### 4. 결석/지각 벌금 콜백 미설정
- **위치**: `packages/bot/src/scheduler-registry.ts`
- **문제**:
  - `attendanceChecker.setOnAbsentCallback()` 호출 없음
  - 지각 벌금 부과 로직 누락
- **영향**: 결석/지석 시 자동 벌금 부과가 안 됨
- **해결**:
  ```typescript
  // scheduler-registry.ts에 추가
  const fineService = getFineService();

  // 결석 콜백
  attendanceChecker.setOnAbsentCallback(async (attendance, round) => {
    const fine = await fineService.create(attendance.memberId, round.id, 'absent');
    const member = await getMemberById(attendance.memberId);
    if (member) {
      await sendFineNotification(client, member.discordId, fine.id, fine.amount, 'absent', round.roundNumber);
    }
  });

  // 지각 처리는 RSS 콜백에서 (위 3번 참고)
  ```

### 5. 주간 랭킹 날짜 필터 누락
- **위치**: `packages/bot/src/services/ranking.service.ts`
- **문제**: 활동 점수 집계 시 날짜 필터가 없음. 전체 기간 점수 반영
- **영향**: "주간" 랭킹이 아닌 "전체" 랭킹이 됨
- **해결**:
  ```typescript
  // ranking.service.ts에 날짜 필터 추가
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // activity_scores 조회에 날짜 조건 추가
  where: and(
    eq(activityScores.memberId, memberId),
    gte(activityScores.date, weekAgo)
  )
  ```

### 6. 회차 시작 알림 버그
- **위치**: `packages/bot/src/schedulers/round-reporter.ts:215-313`
- **문제**: 봇이 회차 시작일 00:00에 실행되지 않으면 영구적으로 알림 누락
- **영향**: 매주 월요일 00:00 크론 실행 실패 시 알림 발송 안 됨
- **해결**: 회차 시작일 여부와 관계없이 매주 발송하도록 로직 수정

### 7. 회차 종료 후 isCurrent 플래그 미갱신
- **위치**: `packages/bot/src/schedulers/round-reporter.ts`
- **문제**: 회차 리포트 발송 후 다음 회차의 `isCurrent`를 true로 설정하는 로직 없음
- **영향**: 회차 종료 후에도 이전 회차가 "current"로 표시됨
- **해결**:
  ```typescript
  // sendRoundReport() 후에 추가
  await roundService.setCurrentRound(nextRound.id);
  ```

---

## 🟡 P1: 조기 수정 필요

### 8. 큐레이션 봇 크롤러 데이터 품질
- **위치**: `packages/bot/src/scheduler-registry.ts:158-167`
- **문제**:
  - `relevanceScore`를 0으로 저장
  - `category`를 빈 문자열로 저장
  - `description`, `thumbnailUrl` 미추출
- **영향**: 스케줄러로 크롤링된 데이터는 품질이 낮음
- **해결**: 웹 API 크롤링 로직(`packages/web/src/app/api/admin/curation/crawl/route.ts`)을 봇으로 이식

### 9. pendingConfirmations 메모리 저장
- **위치**: `packages/bot/src/handlers/dm-handler.ts:18`
- **문제**: 인메모리 Map 사용으로 봇 재시작 시 데이터 소실
- **영향**: 재시작 전 대기 중인 벌금 확인 내역 소실
- **해결**: DB에 pending 상태 저장 (fines 테이블에 컬럼 추가)

### 10. Fine Reminder 3일 간격 로직
- **위치**: `packages/bot/src/schedulers/fine-reminder.ts:85-92`
- **문제**: 매일 10:00에 실행되므로 4일째 10:00에도 `daysSinceCreation = 3`으로 계산됨
- **영향**: 3일마다 한 번이 아니라 3일째부터 매일 리마인드 발송 가능
- **해결**: 마지막 리마인드 시간을 저장하거나 별도 테이블로 관리

### 11. 시간대 일관성
- **위치**: 전체
- **문제**: UTC/KST 혼재
- **영향**: 리포트 발송 시점이 어긋날 수 있음
- **해결**: 전체 시스템을 KST로 통일

### 12. RSS 피드 pubDate 누락 처리
- **위치**: `packages/bot/src/services/rss.service.ts:327`
- **문제**: `pubDate`가 없으면 현재 시간을 사용
- **영향**: 오래된 글이 최신으로 처리될 수 있음
- **해결**: pubDate가 없으면 해당 아이템을 건너뛰거나 별도 로깅

---

## 🟢 P2: 장기 개선

### 13. 그레이스 기간 종료 체크의 side effect
- **위치**: `packages/bot/src/services/round.service.ts:329`
- **문제**: `graceEndDate` 객체를 직접 수정하여 side effect 발생
- **해결**: 새로운 Date 객체 생성

### 14. 이벤트 핸들러 중복 등록 방지
- **위치**: `packages/bot/src/bot.ts`
- **문제**: Activity Handler와 DM Handler가 둘 다 `Events.MessageCreate`를 수신
- **해결**: 통합 핸들러로 내부 분기

### 15. 테스트 커버리지
- **문제**: 핸들러, 스케줄러 테스트 부족
- **해결**: 단위 테스트 및 통합 테스트 작성

---

## 수정 우선순위

### 1단계: 기능 복구 (즉시)
1. DM Handler 등록
2. MessageContent Intent 활성화
3. 출석 상태 업데이트 추가
4. 결석/지각 벌금 콜백 설정

### 2단계: 데이터 정확성 (조기)
5. 주간 랭킹 날짜 필터
6. 회차 시작 알림 버그 수정
7. 회차 종료 후 isCurrent 플래그 갱신

### 3단계: 품질 개선 (차기)
8. 큐레이션 봇 크롤러 데이터 품질
9. pendingConfirmations 영속화
10. Fine Reminder 로직 개선

---

## 테스트 체크리스트

### 수정 후 테스트 항목:
- [ ] 벌금 납부 DM으로 벌금 상태 변경되는지
- [ ] 화요일 00:00에 결석자가 자동 판정되는지
- [ ] 결석/지석 벌금이 자동 부과되는지
- [ ] 글 작성 후 출석 상태가 업데이트되는지
- [ ] 주간 랭킹이 최근 7일 점수만 반영하는지
- [ ] 회차 시작 알림이 매주 월요일 00:00에 발송되는지
- [ ] 회차 종료 후 다음 회차가 current로 표시되는지

---

## 관련 파일

| 파일 | 경로 |
|------|------|
| Bot Entry Point | `/home/choiho/study-admin/packages/bot/src/index.ts` |
| Bot Client Setup | `/home/choiho/study-admin/packages/bot/src/bot.ts` |
| Scheduler Registry | `/home/choiho/study-admin/packages/bot/src/scheduler-registry.ts` |
| DM Handler | `/home/choiho/study-admin/packages/bot/src/handlers/dm-handler.ts` |
| Activity Handler | `/home/choiho/study-admin/packages/bot/src/handlers/activity-handler.ts` |
| Ranking Service | `/home/choiho/study-admin/packages/bot/src/services/ranking.service.ts` |
| Round Reporter | `/home/choiho/study-admin/packages/bot/src/schedulers/round-reporter.ts` |
| Fine Reminder | `/home/choiho/study-admin/packages/bot/src/schedulers/fine-reminder.ts` |
