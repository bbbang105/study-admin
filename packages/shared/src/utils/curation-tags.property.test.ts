import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { INTEREST_OPTIONS } from '../config/interest-options';
import { inferCurationTags } from './curation-tags';

describe('curation tag inference', () => {
  it('normalizes raw tags to shared interest options', () => {
    expect(
      inferCurationTags({
        title: 'Weekly roundup',
        rawTags: ['frontend', 'next.js', 'postgresql', 'RAG'],
      })
    ).toEqual(expect.arrayContaining(['프론트엔드', '데이터베이스', 'LLM']));
  });

  it('infers tags from title and description when feed categories are missing', () => {
    expect(
      inferCurationTags({
        title: 'Building RAG with pgvector and OpenAI embeddings',
        description: 'A production guide for PostgreSQL vector search.',
        rawTags: [],
      })
    ).toEqual(expect.arrayContaining(['LLM', '데이터베이스']));
  });

  it('returns only allowed shared interest tags', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.array(fc.string(), { maxLength: 20 }),
        (title, description, rawTags) => {
          const tags = inferCurationTags({ title, description, rawTags });
          for (const tag of tags) {
            expect(INTEREST_OPTIONS).toContain(tag);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deduplicates and respects maxTags', () => {
    const tags = inferCurationTags({
      title: 'React Next.js frontend UI',
      rawTags: ['프론트엔드', 'frontend', 'react', 'next.js'],
      maxTags: 1,
    });

    expect(tags).toEqual(['프론트엔드']);
  });
});
