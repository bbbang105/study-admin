# Service Pattern Reference

DB 서비스 계층 구현 참고 - 현재 프로젝트 패턴 기반

## 사용 방법
새로운 서비스 구현 시 참고

## 기본 패턴

```typescript
import { eq } from 'drizzle-orm';
import { getDb, myTable, type NewMyTable, type MyTable } from '@blog-study/shared/db';

/**
 * 서비스 클래스 템플릿
 */
export class MyService {
  private db = getDb();

  /**
   * 생성
   */
  async create(input: CreateInput): Promise<MyTable> {
    const newItem: NewMyTable = {
      // 필드 매핑
    };

    const [created] = await this.db.insert(myTable).values(newItem).returning();
    return created!;
  }

  /**
   * ID로 조회
   */
  async getById(id: string): Promise<MyTable | null> {
    const [item] = await this.db
      .select()
      .from(myTable)
      .where(eq(myTable.id, id))
      .limit(1);

    return item || null;
  }

  /**
   * 전체 조회
   */
  async getAll(): Promise<MyTable[]> {
    return this.db.select().from(myTable);
  }

  /**
   * 업데이트
   */
  async update(id: string, data: Partial<UpdateInput>): Promise<MyTable> {
    const [updated] = await this.db
      .update(myTable)
      .set(data)
      .where(eq(myTable.id, id))
      .returning();

    return updated!;
  }

  /**
   * 삭제
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(myTable).where(eq(myTable.id, id));
  }
}

// Singleton 인스턴스
let instance: MyService | null = null;

export function getMyService(): MyService {
  if (!instance) {
    instance = new MyService();
  }
  return instance;
}

export function resetMyService(): void {
  instance = null;
}
```

## 에러 처리 패턴

```typescript
/**
 * 에러 코드 정의
 */
export const MyErrorCodes = {
  NOT_FOUND: 'E0001',
  INVALID_INPUT: 'E0002',
  DUPLICATE: 'E0003',
} as const;

/**
 * 커스텀 에러 클래스
 */
export class MyError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'MyError';
  }
}

// 사용 예시
async getById(id: string): Promise<MyTable | null> {
  const [item] = await this.db
    .select()
    .from(myTable)
    .where(eq(myTable.id, id))
    .limit(1);

  if (!item) {
    throw new MyError(
      MyErrorCodes.NOT_FOUND,
      '항목을 찾을 수 없습니다.'
    );
  }

  return item;
}
```

## 복잡한 쿼리 패턴

```typescript
/**
 * 조인 조회
 */
async getWithMember(id: string): Promise<ItemWithMember | null> {
  const result = await this.db
    .select({
      item: myTable,
      memberName: members.name,
      memberDiscordId: members.discordId,
    })
    .from(myTable)
    .innerJoin(members, eq(myTable.memberId, members.id))
    .where(eq(myTable.id, id))
    .limit(1);

  if (!result[0]) return null;

  return {
    ...result[0].item,
    memberName: result[0].memberName,
    memberDiscordId: result[0].memberDiscordId,
  };
}

/**
 * 집계 쿼리
 */
async getStats(): Promise<Stats> {
  const result = await this.db
    .select({
      total: sql<number>`COUNT(*)`,
      sum: sql<number>`COALESCE(SUM(${myTable.amount}), 0)`,
    })
    .from(myTable);

  return {
    total: Number(result[0]?.total ?? 0),
    sum: Number(result[0]?.sum ?? 0),
  };
}

/**
 * 그룹화
 */
async groupByMember(): Promise<Array<{ memberId: string; count: number }>> {
  return this.db
    .select({
      memberId: myTable.memberId,
      count: sql<number>`COUNT(*)`,
    })
    .from(myTable)
    .groupBy(myTable.memberId);
}
```

## 트랜잭션 패턴

```typescript
import { db } from '@blog-study/shared/db';

async createWithRelated(input: CreateInput): Promise<Result> {
  return db.transaction(async (tx) => {
    // 1. 메인 항목 생성
    const [item] = await tx
      .insert(myTable)
      .values({ /* ... */ })
      .returning();

    // 2. 연관 항목 생성
    await tx
      .insert(relatedTable)
      .values({ /* ... */ });

    return item;
  });
}
```

## Property-Based Test 패턴

```typescript
import { describe, it } from 'vitest';
import { fc } from 'fast-check';

describe('MyService Property Tests', () => {
  it('Property 1: create generates valid ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        async (name) => {
          const service = getMyService();
          const result = await service.create({ name });

          return !!result.id;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## 프로젝트 예시 참고

- `score.service.ts` - 활동 점수 (일일 상한 체크, CTE)
- `post.service.ts` - 블로그 포스트 (중복 체크)
- `attendance.service.ts` - 출석 관리 (상태 전환)
- `fine.service.ts` - 벌금 관리 (납부/면제)
- `notification.service.ts` - 알림 발송

## 주의사항

1. **Singleton**: 한 인스턴스만 사용 (`getXxx()` 함수)
2. **DB 연결**: `getDb()` 사용 (Transaction Pooler)
3. **타입 안전성**: Drizzle ORM 타입 활용
4. **에러 처리**: 커스텀 에러 클래스로 사용자 메시지 제공
5. **테스트**: Property-Based Test 작성 (최소 100회)
