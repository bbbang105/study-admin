import { describe, expect, it } from 'vitest';
import {
  buildCurationItemEmbeddingText,
  buildMemberPreferenceText,
  buildPostEmbeddingText,
  sha256Text,
} from './embedding-text';

describe('embedding text helpers', () => {
  it('builds stable curation item text', () => {
    expect(
      buildCurationItemEmbeddingText({
        title: 'React Server Components 성능 최적화',
        description: 'Streaming과 cache 전략 정리',
        tags: ['React', 'Performance'],
        sourceName: 'Frontend Weekly',
      })
    ).toBe(
      'Title: React Server Components 성능 최적화\nDescription: Streaming과 cache 전략 정리\nTags: React, Performance\nSource: Frontend Weekly'
    );
  });

  it('builds stable member preference text', () => {
    expect(
      buildMemberPreferenceText({
        part: 'Backend',
        bio: 'API와 DB 성능을 좋아합니다.',
        interests: ['React', '성능 최적화'],
      })
    ).toBe('Backend 개발자. 관심사: React, 성능 최적화. 소개: API와 DB 성능을 좋아합니다.');
  });

  it('hashes text deterministically', () => {
    expect(sha256Text('same')).toBe(sha256Text('same'));
    expect(sha256Text('same')).not.toBe(sha256Text('different'));
  });

  it('builds stable post text with author context', () => {
    expect(
      buildPostEmbeddingText({
        title: 'React 성능 최적화',
        description: 'memo와 서버 컴포넌트 이야기',
        authorPart: 'frontend',
        authorInterests: ['React', 'Next.js'],
        roundNumber: 4,
      })
    ).toContain('Author interests: React, Next.js');
  });
});
