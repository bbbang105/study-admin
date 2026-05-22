import { calculateFreshnessScore, normalizeRelevanceScore } from './recommendation-score';

export interface RecommendationReason {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  relevanceScore: number | null;
}

export interface PostRecommendationReason {
  summary: string;
  reasons: string[];
  matchedKeywords: string[];
  semanticScore: number | null;
  freshnessScore: number | null;
  popularityScore: number | null;
  authorAffinityScore: number | null;
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAsciiKeyword(value: string): boolean {
  return /^[a-z0-9+#.]+$/i.test(value);
}

function includesKeyword(haystack: string, keyword: string): boolean {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) return false;

  if (isAsciiKeyword(normalizedKeyword)) {
    const pattern = new RegExp(
      `(^|[^a-z0-9+#.])${escapeRegExp(normalizedKeyword)}(?=$|[^a-z0-9+#.])`,
      'i'
    );
    return pattern.test(haystack);
  }

  return haystack.includes(normalizedKeyword);
}

export function findMatchedKeywords(input: {
  interests?: string[] | null;
  tags?: string[] | null;
  title?: string | null;
  description?: string | null;
}): string[] {
  const haystack = [input.title, input.description, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const seen = new Set<string>();
  const matches: string[] = [];

  for (const interest of input.interests ?? []) {
    const trimmed = interest.trim();
    if (!trimmed) continue;

    const key = normalizeKeyword(trimmed);
    if (seen.has(key)) continue;

    if (includesKeyword(haystack, trimmed)) {
      seen.add(key);
      matches.push(trimmed);
    }
  }

  return matches.slice(0, 3);
}

export function buildRecommendationReason(input: {
  interests?: string[] | null;
  tags?: string[] | null;
  title?: string | null;
  description?: string | null;
  sourceName?: string | null;
  publishedAt?: Date | string | null;
  semanticScore?: number | null;
  freshnessScore?: number | null;
  relevanceScore?: number | null;
}): RecommendationReason | null {
  const matchedKeywords = findMatchedKeywords(input);
  const freshnessScore = input.freshnessScore ?? calculateFreshnessScore(input.publishedAt ?? null);
  const relevanceScore = normalizeRelevanceScore(input.relevanceScore);
  const semanticScore = input.semanticScore ?? null;
  const reasons: string[] = [];

  if (matchedKeywords.length > 0) {
    reasons.push(`관심사 ${matchedKeywords.join(', ')}와 연결돼요.`);
  }
  if (semanticScore !== null && semanticScore >= 0.6) {
    reasons.push('프로필 관심사와 의미적으로 가까운 글이에요.');
  }
  if (freshnessScore >= 0.6) {
    reasons.push('최근 올라온 글이에요.');
  }
  if (relevanceScore >= 0.6) {
    reasons.push('스터디 키워드 관련도가 높은 글이에요.');
  }
  if (input.sourceName) {
    reasons.push(`${input.sourceName}에서 가져온 글이에요.`);
  }

  if (reasons.length === 0) return null;

  const summary =
    matchedKeywords.length > 0 ? `${matchedKeywords.join(', ')} 관심사에 잘 맞아요.` : reasons[0]!;

  return {
    summary,
    reasons: reasons.slice(0, 3),
    matchedKeywords,
    semanticScore,
    freshnessScore,
    relevanceScore,
  };
}

export function buildPostRecommendationReason(input: {
  interests?: string[] | null;
  title?: string | null;
  description?: string | null;
  authorPart?: string | null;
  currentMemberPart?: string | null;
  publishedAt?: Date | string | null;
  semanticScore?: number | null;
  freshnessScore?: number | null;
  popularityScore?: number | null;
  authorAffinityScore?: number | null;
}): PostRecommendationReason | null {
  const matchedKeywords = findMatchedKeywords(input);
  const freshnessScore = input.freshnessScore ?? calculateFreshnessScore(input.publishedAt ?? null);
  const semanticScore = input.semanticScore ?? null;
  const popularityScore = input.popularityScore ?? null;
  const authorAffinityScore = input.authorAffinityScore ?? null;
  const reasons: string[] = [];

  if (matchedKeywords.length > 0) {
    reasons.push(`관심사 ${matchedKeywords.join(', ')}와 연결돼요.`);
  }
  if (semanticScore !== null && semanticScore >= 0.6) {
    reasons.push('프로필 관심사와 의미적으로 가까운 글이에요.');
  }
  if (
    authorAffinityScore !== null &&
    authorAffinityScore >= 0.9 &&
    input.authorPart &&
    input.currentMemberPart &&
    input.authorPart === input.currentMemberPart
  ) {
    reasons.push(`같은 ${input.authorPart} 파트의 글이에요.`);
  }
  if (freshnessScore >= 0.6) {
    reasons.push('최근 올라온 글이에요.');
  }
  if (popularityScore !== null && popularityScore >= 0.3) {
    reasons.push('조회, 댓글, 리액션 반응이 있는 글이에요.');
  }

  if (reasons.length === 0 && semanticScore !== null) {
    reasons.push('내 프로필과 비교해 추천된 글이에요.');
  }
  if (reasons.length === 0) return null;

  const summary =
    matchedKeywords.length > 0
      ? `${matchedKeywords.join(', ')} 관심사와 가까워요.`
      : semanticScore !== null
        ? `관심도 ${Math.round(Math.max(0, Math.min(1, semanticScore)) * 100)}%로 추천됐어요.`
        : reasons[0]!;

  return {
    summary,
    reasons: reasons.slice(0, 3),
    matchedKeywords,
    semanticScore,
    freshnessScore,
    popularityScore,
    authorAffinityScore,
  };
}
