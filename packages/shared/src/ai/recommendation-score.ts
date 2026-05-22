export const RECOMMENDATION_SCORE_WEIGHTS = {
  semantic: 0.65,
  freshness: 0.2,
  relevance: 0.15,
} as const;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeRelevanceScore(score: number | null | undefined): number {
  return clamp01((score ?? 0) / 100);
}

export function calculateFreshnessScore(
  publishedAt: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (!publishedAt) return 0;

  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return 0;

  const ageDays = Math.max(0, (now.getTime() - published.getTime()) / 86_400_000);
  return clamp01(Math.exp(-ageDays / 14));
}

export function calculateRecommendationScore(input: {
  semanticScore: number;
  freshnessScore: number;
  relevanceScore: number;
}): number {
  return (
    clamp01(input.semanticScore) * RECOMMENDATION_SCORE_WEIGHTS.semantic +
    clamp01(input.freshnessScore) * RECOMMENDATION_SCORE_WEIGHTS.freshness +
    clamp01(input.relevanceScore) * RECOMMENDATION_SCORE_WEIGHTS.relevance
  );
}
