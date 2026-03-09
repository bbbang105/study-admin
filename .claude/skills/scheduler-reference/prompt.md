# Scheduler Reference

pg-boss 기반 스케줄러 구현 참고 - 현재 프로젝트 패턴 기반

## 사용 방법
새로운 스케줄러 구현 시 참고

## 기본 패턴

```typescript
/**
 * 스케줄러 클래스 템플릿
 */
export class MyScheduler {
  private isRunning = false;

  /**
   * 실행 중인지 확인
   */
  isChecking(): boolean {
    return this.isRunning;
  }

  /**
   * 작업 실행
   */
  async run(): Promise<Result> {
    if (this.isRunning) {
      console.log('[MyScheduler] Already in progress, skipping');
      return {
        timestamp: new Date(),
        errors: ['Already in progress'],
      };
    }

    this.isRunning = true;

    try {
      // 작업 로직 구현
      console.log('[MyScheduler] Running...');

      return {
        timestamp: new Date(),
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[MyScheduler] Error: ${errorMsg}`);

      return {
        timestamp: new Date(),
        errors: [errorMsg],
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton 인스턴스
let instance: MyScheduler | null = null;

export function getMyScheduler(): MyScheduler {
  if (!instance) {
    instance = new MyScheduler();
  }
  return instance;
}

export function resetMyScheduler(): void {
  instance = null;
}
```

## scheduler-registry.ts에 등록

```typescript
import { getMyScheduler } from './schedulers/my-scheduler';

export async function registerAllJobs(boss: PgBoss, client: Client): Promise<void> {
  const myScheduler = getMyScheduler();

  // 1. Cron 잡 등록 (매일 09:00)
  await boss.schedule('my-job', '0 9 * * *');
  console.log('  📅 Scheduled: my-job (0 9 * * *)');

  // 2. 워커 등록
  await boss.work('my-job', { batchSize: 1 }, async () => {
    await myScheduler.run();
  });

  console.log(`✅ All jobs registered`);
}
```

## Discord 클라이언트가 필요한 경우

```typescript
export class MyScheduler {
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  async run(): Promise<Result> {
    if (!this.client) {
      console.error('[MyScheduler] Discord client not set');
      return {
        timestamp: new Date(),
        errors: ['Discord client not set'],
      };
    }

    // client 사용
    const channel = await this.client.channels.fetch('CHANNEL_ID');
    // ...
  }
}

// 등록 시
const myScheduler = getMyScheduler();
myScheduler.setClient(client);
```

## Cron 표현식 예시

| 표현식 | 설명 |
|---------|------|
| `*/5 * * * *` | 5분마다 |
| `0 9 * * *` | 매일 09:00 |
| `0 0 * * 2` | 매주 화요일 00:00 |
| `0 23 * * *` | 매일 23:00 (KST 익일 08:00) |
| `0 0 1 * *` | 매월 1일 00:00 |

## pg-boss 설정

```typescript
import { PgBoss } from 'pg-boss';

// 시작
const boss = new PgBoss(connectionString);
boss.on('error', (error: Error) => console.error('[pg-boss] Error:', error));
await boss.start();

// Cron 잡 등록
await boss.schedule('job-name', 'cron-expression');

// 워커 등록
await boss.work('job-name', { batchSize: 1 }, async () => {
  // 작업 실행
});

// 종료
await boss.stop({ graceful: true, timeout: 30000 });
```

## 결과 인터페이스

```typescript
interface Result {
  timestamp: Date;
  success?: boolean;
  errors: string[];
  // 기타 필요한 필드
}
```

## 프로젝트 예시 참고

- `rss-poller.ts` - RSS 폴링 (5분)
- `attendance-checker.ts` - 출석 체크 (주간)
- `fine-reminder.ts` - 벌금 리마인더 (일일)
- `round-reporter.ts` - 회차 리포트 (주간)
- `curation-crawler.ts` - 큐레이션 크롤링 (일일)

## 주의사항

1. **동시 실행 방지**: `isRunning` 플래그로 중복 실행 방지
2. **에러 처리**: 모든 에러를 catch하고 결과 객체에 포함
3. **로그**: 진행 상황을 console.log로 출력
4. **Singleton**: 한 인스턴스만 사용 (`getXxx()` 함수)
5. **테스트용 reset**: `resetXxx()` 함수 제공
