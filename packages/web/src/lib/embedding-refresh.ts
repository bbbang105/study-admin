import { after } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';
const BOT_API_SECRET = process.env.BOT_API_SECRET;

async function postToBot(path: string, body: unknown): Promise<void> {
  if (!BOT_API_SECRET) return;

  const response = await fetch(`${BOT_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BOT_API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Bot embedding refresh failed: HTTP ${response.status}`);
  }
}

export function scheduleMemberPreferenceEmbeddingRefresh(memberId: string): void {
  after(async () => {
    try {
      await postToBot('/api/internal/embedding/member-preference', { memberId });
    } catch (error) {
      console.error('[embedding-refresh] 멤버 취향 임베딩 갱신 실패:', error);
    }
  });
}

export function scheduleCurationItemEmbeddingRefresh(itemIds: string[]): void {
  const uniqueItemIds = [...new Set(itemIds)].slice(0, 100);
  if (uniqueItemIds.length === 0) return;

  after(async () => {
    for (const itemId of uniqueItemIds) {
      try {
        await postToBot('/api/internal/embedding/curation-item', { itemId });
      } catch (error) {
        console.error('[embedding-refresh] 큐레이션 아이템 임베딩 갱신 실패:', itemId, error);
      }
    }
  });
}

export function schedulePostEmbeddingRefresh(postIds: string[]): void {
  const uniquePostIds = [...new Set(postIds)].slice(0, 100);
  if (uniquePostIds.length === 0) return;

  after(async () => {
    for (const postId of uniquePostIds) {
      try {
        await postToBot('/api/internal/embedding/post', { postId });
      } catch (error) {
        console.error('[embedding-refresh] 포스트 임베딩 갱신 실패:', postId, error);
      }
    }
  });
}
