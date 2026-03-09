# pg-boss 큐 초기화 문제 해결 가이드

> 발생일: 2026-03-09
> 상태: ✅ 해결됨
> 관련: 주간 랭킹 스케줄러 구현

---

## 📋 문제 개요

**에러 메시지:**
```
error: Queue weekly-ranking not found
detail: Key (name)=(weekly-ranking) is not present in table "queue"
```

**발생 상황:**
- 새로운 스케줄러(`weekly-ranking`)를 pg-boss에 등록하려 할 때
- `boss.schedule()` 호출 시 큐가 존재하지 않는다는 에러 발생

---

## 🔍 문제 원인 분석

### pg-boss의 큐 생성 메커니즘

pg-boss에서는 큐가 생성되는 두 가지 방법이 있습니다:

1. **`boss.work()` 호출 시**: 워커를 등록하면 자동으로 큐가 생성됨
2. **`boss.send()` 호출 시**: 잡을 전송할 때 큐가 자동 생성됨

하지만 **`boss.schedule()`은 큐를 자동 생성하지 않습니다!**

### 데이터베이스 제약조건

```sql
-- pg-boss 테이블 구조
schedule (name) → queue (name) FK 참조
```

- `schedule` 테이블의 `name` 컬럼이 `queue` 테이블의 `name`을 외래 키로 참조
- 따라서 스케줄을 등록하려면 먼저 큐가 존재해야 함

---

## 🛠️ 시도한 해결 방법들

### 방법 1: `boss.work()` 후 `boss.schedule()` 순서 변경 ❌

**접근법:**
```typescript
// 먼저 워커 등록 (큐 생성)
await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
  await weeklyRanking.sendWeeklyRanking();
});

// 그 후 스케줄 등록
await boss.schedule('weekly-ranking', '0 13 * * 0');
```

**결과:** 실패
```
Queue weekly-ranking not found
```

**원인:** `boss.work()`가 큐를 생성하는 데 시간이 걸림 (비동기)

---

### 방법 2: 대기 시간 추가 ❌

**접근법:**
```typescript
await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
  await weeklyRanking.sendWeeklyRanking();
});

// 큐 생성 대기
await new Promise(resolve => setTimeout(resolve, 500));

await boss.schedule('weekly-ranking', '0 13 * * 0');
```

**결과:** 실패
```
Queue weekly-ranking not found
```

**원인:** 500ms 대기로는 부족, 큐 생성이 더 오래 걸림

---

### 방법 3: `boss.send()`로 더미 잡 전송 ❌

**접근법:**
```typescript
// 더미 잡을 보내 큐 생성
await boss.send('weekly-ranking', { __dummy: true }, { startAfter: 999999999999 });

await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
  await weeklyRanking.sendWeeklyRanking();
});
```

**결과:** 실패
```
Error: Queue weekly-ranking does not exist
```

**원인:** `boss.send()` 자체도 큐가 존재해야 함

---

### 방법 4: pg-boss 설정 변경 ❌

**접근법:**
```typescript
boss = new PgBoss(connectionString, {
  _uuid: 'v1',
});
```

**결과:** 실패
```
Queue weekly-ranking does not exist
```

**원인:** 설정 변경만으로는 큐 자동 생성 해결 안 됨

---

## ✅ 최종 해결 방법

### `boss.createQueue()` 내부 API 사용

**접근법:**
```typescript
// 내부 API로 큐 명시적 생성
// @ts-ignore - internal API for queue creation
await boss.createQueue('weekly-ranking');

// 워커 등록
await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
  await weeklyRanking.sendWeeklyRanking();
});

// 스케줄 등록
await boss.schedule('weekly-ranking', '0 13 * * 0');
```

**결과:** ✅ 성공!
```
📅 Scheduled: weekly-ranking (0 13 * * 0)
✅ All 8 scheduled jobs registered
```

---

## 📝 구현 코드

### `scheduler-registry.ts`

```typescript
export async function registerAllJobs(boss: PgBoss, client: Client): Promise<void> {
  // ... 기존 코드 ...

  // Create weekly-ranking queue explicitly using pg-boss internal API
  // @ts-ignore - internal API for queue creation
  await boss.createQueue('weekly-ranking');

  await boss.work('weekly-ranking', { batchSize: 1 }, async () => {
    await weeklyRanking.sendWeeklyRanking();
  });

  // Wait for queues to be created in the database
  await new Promise(resolve => setTimeout(resolve, 500));

  // THEN schedule all cron jobs (after queues are created)
  for (const job of JOB_DEFINITIONS) {
    await boss.schedule(job.name, job.cron);
    console.log(`  📅 Scheduled: ${job.name} (${job.cron})`);
  }

  console.log(`✅ All ${JOB_DEFINITIONS.length} scheduled jobs registered`);
}
```

### `job-queue.ts` 수정

```typescript
export async function startJobQueue(connectionString: string): Promise<PgBoss> {
  boss = new PgBoss(connectionString, {
    _uuid: 'v1',
  });

  boss.on('error', (error: Error) => console.error('[pg-boss] Error:', error));
  await boss.start();
  console.log('[pg-boss] Started');

  // Wait for pg-boss to initialize tables
  await new Promise(resolve => setTimeout(resolve, 1000));

  return boss;
}
```

---

## 🎯 핵심 교훈

1. **`boss.schedule()`은 큐를 자동 생성하지 않음**
   - 스케줄 등록 전에 큐가 반드시 존재해야 함

2. **`boss.work()`의 큐 생성은 비동기임**
   - 즉시 생성되지 않을 수 있어 대기 필요

3. **내부 API `boss.createQueue()` 사용**
   - `@ts-ignore`와 함께 사용하여 큐 명시적 생성
   - 가장 확실한 해결책

4. **순서가 중요함**
   - `createQueue()` → `work()` → `schedule()` 순서 준수

---

## 📚 관련 문서

- [pg-boss 공식 문서](https://github.com/timgit/pg-boss)
- `docs/plans/26-03-09-weekly-ranking-implementation.md` - 주간 랭킹 구현 플랜
- `packages/bot/src/scheduler-registry.ts` - 스케줄러 레지스트리
- `packages/bot/src/job-queue.ts` - pg-boss 잡 큐

---

## 🔄 다른 스케줄러 추가 시 참고사항

새로운 스케줄러를 추가할 때 동일한 문제를 방지하려면:

1. **`boss.createQueue()`로 큐 먼저 생성**
2. **`boss.work()`로 워커 등록**
3. **`boss.schedule()`로 스케줄 등록**

이 순서를 지키면 "Queue not found" 에러를 방지할 수 있습니다.

---

*문서 작성일: 2026-03-09*
*마지막 업데이트: 2026-03-09*
*상태: 해결됨*
