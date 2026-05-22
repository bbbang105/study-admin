import { createHash } from 'node:crypto';

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanExcerpt(value: string | null | undefined, maxLength: number): string {
  const cleaned = clean(value).replace(/<[^>]*>/g, ' ');
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trim()}...` : cleaned;
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildCurationItemEmbeddingText(input: {
  title: string;
  description?: string | null;
  tags?: string[] | null;
  sourceName?: string | null;
}): string {
  const lines = [`Title: ${clean(input.title)}`];
  const description = clean(input.description);
  const tags = input.tags?.map(clean).filter(Boolean) ?? [];
  const sourceName = clean(input.sourceName);

  if (description) lines.push(`Description: ${description}`);
  if (tags.length > 0) lines.push(`Tags: ${tags.join(', ')}`);
  if (sourceName) lines.push(`Source: ${sourceName}`);

  return lines.join('\n');
}

export function buildPostEmbeddingText(input: {
  title: string;
  description?: string | null;
  authorPart?: string | null;
  authorBio?: string | null;
  authorInterests?: string[] | null;
  authorNickname?: string | null;
  roundNumber?: number | null;
}): string {
  const lines = [`Title: ${clean(input.title)}`];
  const description = cleanExcerpt(input.description, 1000);
  const authorPart = clean(input.authorPart);
  const authorBio = cleanExcerpt(input.authorBio, 300);
  const authorNickname = clean(input.authorNickname);
  const authorInterests = input.authorInterests?.map(clean).filter(Boolean) ?? [];

  if (description) lines.push(`Description: ${description}`);
  if (authorPart) lines.push(`Author part: ${authorPart}`);
  if (authorNickname) lines.push(`Author: ${authorNickname}`);
  if (authorInterests.length > 0) lines.push(`Author interests: ${authorInterests.join(', ')}`);
  if (authorBio) lines.push(`Author bio: ${authorBio}`);
  if (input.roundNumber !== null && input.roundNumber !== undefined) {
    lines.push(`Round: ${input.roundNumber}`);
  }

  return lines.join('\n');
}

export function buildMemberPreferenceText(input: {
  part: string;
  bio?: string | null;
  interests?: string[] | null;
}): string {
  const part = clean(input.part);
  const bio = clean(input.bio);
  const interests = input.interests?.map(clean).filter(Boolean) ?? [];

  const segments = [`${part || '스터디'} 개발자.`];
  if (interests.length > 0) segments.push(`관심사: ${interests.join(', ')}.`);
  if (bio) segments.push(`소개: ${bio}`);

  return segments.join(' ');
}
