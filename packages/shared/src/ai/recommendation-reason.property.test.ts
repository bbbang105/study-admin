import { describe, expect, it } from 'vitest';
import {
  buildPostRecommendationReason,
  buildRecommendationReason,
  findMatchedKeywords,
} from './recommendation-reason';

describe('recommendation reasons', () => {
  it('extracts matched keywords from title, description, and tags', () => {
    expect(
      findMatchedKeywords({
        interests: ['React', '성능 최적화', 'Database'],
        tags: ['Frontend'],
        title: 'React 성능 최적화 가이드',
        description: 'Next.js 캐시 전략',
      })
    ).toEqual(['React', '성능 최적화']);
  });

  it('builds a concise summary from matched keywords', () => {
    const reason = buildRecommendationReason({
      interests: ['React', '성능 최적화'],
      title: 'React 성능 최적화 가이드',
      sourceName: 'Frontend Weekly',
      semanticScore: 0.8,
      freshnessScore: 0.7,
      relevanceScore: 70,
    });

    expect(reason?.summary).toBe('React, 성능 최적화 관심사에 잘 맞아요.');
    expect(reason?.matchedKeywords).toEqual(['React', '성능 최적화']);
    expect(reason?.semanticScore).toBe(0.8);
  });

  it('builds post recommendation reason with score fields', () => {
    const reason = buildPostRecommendationReason({
      interests: ['React'],
      title: 'React 서버 컴포넌트 정리',
      authorPart: 'frontend',
      currentMemberPart: 'frontend',
      semanticScore: 0.75,
      freshnessScore: 0.4,
      popularityScore: 0.2,
      authorAffinityScore: 1,
    });

    expect(reason?.summary).toBe('React 관심사와 가까워요.');
    expect(reason?.authorAffinityScore).toBe(1);
  });

  it('does not match short ascii interests inside longer words', () => {
    expect(
      findMatchedKeywords({
        interests: ['AI'],
        title: '브라우저 렌더링 파이프라인',
        description: '매일메일을 참고해 HTML 파서와 DOM 생성 과정을 정리합니다.',
      })
    ).toEqual([]);

    expect(
      findMatchedKeywords({
        interests: ['AI'],
        title: '생성형 AI가 뭐에요?',
      })
    ).toEqual(['AI']);
  });
});
