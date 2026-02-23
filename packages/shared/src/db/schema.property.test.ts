import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Post } from './schema';
import {
  serializePost,
  deserializePost,
  postToJson,
  postFromJson,
  postsAreEqual,
} from '../utils/serialization';

/**
 * **Feature: blog-study-discord-bot, Property 32: Post Data Round-Trip**
 *
 * *For any* valid Post object, serializing to JSON and deserializing back
 * SHALL produce an equivalent object with all fields preserved.
 *
 * **Validates: Requirements 12.3, 12.4**
 */
describe('Property 32: Post Data Round-Trip', () => {
  // Arbitrary for generating valid UUIDs
  const uuidArb = fc.uuid();

  // Arbitrary for generating valid Post objects
  const postArb: fc.Arbitrary<Post> = fc.record({
    id: uuidArb,
    memberId: uuidArb,
    roundId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
    title: fc.string({ minLength: 1, maxLength: 500 }),
    url: fc.webUrl(),
    publishedAt: fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    }),
    description: fc.option(fc.string({ maxLength: 5000 }), { nil: null }),
    collectedAt: fc.option(
      fc.date({
        min: new Date('2020-01-01'),
        max: new Date('2030-12-31'),
      }),
      { nil: null }
    ),
  });

  it('should preserve all fields after serialize/deserialize round-trip', () => {
    fc.assert(
      fc.property(postArb, (post) => {
        // Serialize then deserialize
        const serialized = serializePost(post);
        const deserialized = deserializePost(serialized);

        // All fields should be preserved
        expect(postsAreEqual(post, deserialized)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all fields after JSON string round-trip', () => {
    fc.assert(
      fc.property(postArb, (post) => {
        // Convert to JSON string and back
        const json = postToJson(post);
        const restored = postFromJson(json);

        // All fields should be preserved
        expect(postsAreEqual(post, restored)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce valid JSON that can be parsed', () => {
    fc.assert(
      fc.property(postArb, (post) => {
        const json = postToJson(post);

        // Should be valid JSON
        expect(() => JSON.parse(json)).not.toThrow();

        // Parsed JSON should have all required fields
        const parsed = JSON.parse(json);
        expect(parsed).toHaveProperty('id');
        expect(parsed).toHaveProperty('memberId');
        expect(parsed).toHaveProperty('roundId');
        expect(parsed).toHaveProperty('title');
        expect(parsed).toHaveProperty('url');
        expect(parsed).toHaveProperty('publishedAt');
        expect(parsed).toHaveProperty('description');
        expect(parsed).toHaveProperty('collectedAt');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve date precision in round-trip', () => {
    fc.assert(
      fc.property(postArb, (post) => {
        const restored = postFromJson(postToJson(post));

        // publishedAt should have same timestamp
        expect(restored.publishedAt.getTime()).toBe(post.publishedAt.getTime());

        // collectedAt should have same timestamp (if not null)
        if (post.collectedAt !== null) {
          expect(restored.collectedAt).not.toBeNull();
          expect(restored.collectedAt!.getTime()).toBe(post.collectedAt.getTime());
        } else {
          expect(restored.collectedAt).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });
});
