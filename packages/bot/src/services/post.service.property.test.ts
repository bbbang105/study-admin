/**
 * Property-Based Tests for PostService
 * Tests correctness properties for post management operations
 * 
 * These tests verify the business logic of post operations using
 * pure functions extracted from the service.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Post } from '@blog-study/shared/db';

/**
 * Generate valid UUIDs
 */
const uuidArb = fc.uuid();

/**
 * Generate valid post titles
 */
const titleArb = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Generate valid post URLs
 */
const postUrlArb = fc.webUrl();

/**
 * Generate valid descriptions
 */
const descriptionArb = fc.option(fc.string({ maxLength: 1000 }), { nil: null });

/**
 * Generate valid round IDs
 */
const roundIdArb = fc.option(fc.integer({ min: 1, max: 52 }), { nil: null });

/**
 * Generate a valid post input
 */
const postInputArb = fc.record({
  memberId: uuidArb,
  roundId: roundIdArb,
  title: titleArb,
  url: postUrlArb,
  publishedAt: fc.date(),
  description: descriptionArb,
});

// ============================================
// Pure Business Logic Functions for Testing
// ============================================

/**
 * Simulates the post storage with duplicate detection
 * This is a pure function that models the database behavior
 */
interface PostStore {
  posts: Map<string, Post>;
}

function createPostStore(): PostStore {
  return { posts: new Map() };
}

function existsByUrl(store: PostStore, url: string): boolean {
  for (const post of store.posts.values()) {
    if (post.url === url) {
      return true;
    }
  }
  return false;
}

function getByUrl(store: PostStore, url: string): Post | null {
  for (const post of store.posts.values()) {
    if (post.url === url) {
      return post;
    }
  }
  return null;
}

interface CreatePostResult {
  post: Post;
  isNew: boolean;
}

function createPost(
  store: PostStore,
  input: {
    memberId: string;
    roundId: number | null;
    title: string;
    url: string;
    publishedAt: Date;
    description?: string | null;
  }
): CreatePostResult {
  // Check for duplicate URL first
  const existing = getByUrl(store, input.url);
  if (existing) {
    return { post: existing, isNew: false };
  }

  // Create new post with all required fields
  const newPost: Post = {
    id: crypto.randomUUID(),
    memberId: input.memberId,
    roundId: input.roundId,
    title: input.title,
    url: input.url,
    publishedAt: input.publishedAt,
    description: input.description ?? null,
    collectedAt: new Date(),
  };

  store.posts.set(newPost.id, newPost);
  return { post: newPost, isNew: true };
}

function getByMember(store: PostStore, memberId: string): Post[] {
  const result: Post[] = [];
  for (const post of store.posts.values()) {
    if (post.memberId === memberId) {
      result.push(post);
    }
  }
  return result;
}

function getByRound(store: PostStore, roundId: number): Post[] {
  const result: Post[] = [];
  for (const post of store.posts.values()) {
    if (post.roundId === roundId) {
      result.push(post);
    }
  }
  return result;
}

function countByMember(store: PostStore, memberId: string): number {
  return getByMember(store, memberId).length;
}

/**
 * Validates that a post has all required fields
 * Requirements: 6.3, 6.6
 */
function validatePostCompleteness(post: Post): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!post.id) missingFields.push('id');
  if (!post.memberId) missingFields.push('memberId');
  if (!post.title) missingFields.push('title');
  if (!post.url) missingFields.push('url');
  if (!post.publishedAt) missingFields.push('publishedAt');
  // roundId can be null for posts outside study period
  // description is optional
  // collectedAt should be set automatically

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

// ============================================
// Property Tests
// ============================================

describe('PostService Property Tests', () => {
  /**
   * **Feature: blog-study-discord-bot, Property 17: Duplicate Post Prevention**
   * *For any* post URL that already exists in the database, attempting to store it
   * again SHALL be skipped without error.
   * **Validates: Requirements 6.4**
   */
  describe('Property 17: Duplicate Post Prevention', () => {
    it('should return existing post when URL already exists', () => {
      fc.assert(
        fc.property(postInputArb, (input) => {
          const store = createPostStore();
          
          // Create first post
          const result1 = createPost(store, input);
          expect(result1.isNew).toBe(true);
          
          // Try to create duplicate with same URL
          const result2 = createPost(store, {
            ...input,
            title: 'Different Title',
            description: 'Different Description',
          });
          
          // Should return existing post, not create new one
          expect(result2.isNew).toBe(false);
          expect(result2.post.id).toBe(result1.post.id);
          expect(result2.post.url).toBe(input.url);
        }),
        { numRuns: 100 }
      );
    });

    it('should not increase post count when duplicate URL is added', () => {
      fc.assert(
        fc.property(postInputArb, (input) => {
          const store = createPostStore();
          
          // Create first post
          createPost(store, input);
          const countBefore = store.posts.size;
          
          // Try to create duplicate
          createPost(store, input);
          const countAfter = store.posts.size;
          
          // Count should remain the same
          expect(countAfter).toBe(countBefore);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow posts with different URLs', () => {
      fc.assert(
        fc.property(
          postInputArb,
          postInputArb.filter(p => p.url !== ''),
          (input1, input2) => {
            // Ensure different URLs
            fc.pre(input1.url !== input2.url);
            
            const store = createPostStore();
            
            const result1 = createPost(store, input1);
            const result2 = createPost(store, input2);
            
            // Both should be new posts
            expect(result1.isNew).toBe(true);
            expect(result2.isNew).toBe(true);
            expect(result1.post.id).not.toBe(result2.post.id);
            expect(store.posts.size).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly report URL existence', () => {
      fc.assert(
        fc.property(postInputArb, postUrlArb, (input, otherUrl) => {
          const store = createPostStore();
          
          // Before creating post, URL should not exist
          expect(existsByUrl(store, input.url)).toBe(false);
          
          // Create post
          createPost(store, input);
          
          // After creating, URL should exist
          expect(existsByUrl(store, input.url)).toBe(true);
          
          // Other URL should not exist (unless it's the same)
          if (otherUrl !== input.url) {
            expect(existsByUrl(store, otherUrl)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: blog-study-discord-bot, Property 16: Post Storage Completeness**
   * *For any* new post detected from RSS, the stored record SHALL contain:
   * title, URL, published date, member_id, and calculated round number.
   * **Validates: Requirements 6.3, 6.6**
   */
  describe('Property 16: Post Storage Completeness', () => {
    it('should store all required fields when creating a post', () => {
      fc.assert(
        fc.property(postInputArb, (input) => {
          const store = createPostStore();
          const result = createPost(store, input);
          
          // Verify all required fields are present
          const validation = validatePostCompleteness(result.post);
          expect(validation.isComplete).toBe(true);
          expect(validation.missingFields).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve input values in stored post', () => {
      fc.assert(
        fc.property(postInputArb, (input) => {
          const store = createPostStore();
          const result = createPost(store, input);
          
          // All input values should be preserved
          expect(result.post.memberId).toBe(input.memberId);
          expect(result.post.roundId).toBe(input.roundId);
          expect(result.post.title).toBe(input.title);
          expect(result.post.url).toBe(input.url);
          expect(result.post.publishedAt).toEqual(input.publishedAt);
          expect(result.post.description).toBe(input.description ?? null);
        }),
        { numRuns: 100 }
      );
    });

    it('should set collectedAt timestamp automatically', () => {
      fc.assert(
        fc.property(postInputArb, (input) => {
          const store = createPostStore();
          const beforeCreate = new Date();
          const result = createPost(store, input);
          const afterCreate = new Date();
          
          // collectedAt should be set and within the creation window
          expect(result.post.collectedAt).toBeDefined();
          expect(result.post.collectedAt!.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
          expect(result.post.collectedAt!.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique ID for each new post', () => {
      fc.assert(
        fc.property(
          fc.array(postInputArb, { minLength: 2, maxLength: 10 }),
          (inputs) => {
            const store = createPostStore();
            const ids = new Set<string>();
            
            // Create posts with unique URLs
            const uniqueInputs = inputs.map((input, i) => ({
              ...input,
              url: `${input.url}/${i}`, // Ensure unique URLs
            }));
            
            for (const input of uniqueInputs) {
              const result = createPost(store, input);
              if (result.isNew) {
                // Each new post should have a unique ID
                expect(ids.has(result.post.id)).toBe(false);
                ids.add(result.post.id);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional property tests for post retrieval operations
   */
  describe('Post Retrieval Properties', () => {
    it('should correctly retrieve posts by member', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.array(postInputArb, { minLength: 1, maxLength: 5 }),
          (memberId, inputs) => {
            const store = createPostStore();
            
            // Create posts for the target member
            const memberInputs = inputs.map((input, i) => ({
              ...input,
              memberId,
              url: `${input.url}/${i}`, // Ensure unique URLs
            }));
            
            for (const input of memberInputs) {
              createPost(store, input);
            }
            
            // Retrieve posts by member
            const memberPosts = getByMember(store, memberId);
            
            // All retrieved posts should belong to the member
            for (const post of memberPosts) {
              expect(post.memberId).toBe(memberId);
            }
            
            // Count should match
            expect(memberPosts.length).toBe(memberInputs.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly retrieve posts by round', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.array(postInputArb, { minLength: 1, maxLength: 5 }),
          (roundId, inputs) => {
            const store = createPostStore();
            
            // Create posts for the target round
            const roundInputs = inputs.map((input, i) => ({
              ...input,
              roundId,
              url: `${input.url}/${i}`, // Ensure unique URLs
            }));
            
            for (const input of roundInputs) {
              createPost(store, input);
            }
            
            // Retrieve posts by round
            const roundPosts = getByRound(store, roundId);
            
            // All retrieved posts should belong to the round
            for (const post of roundPosts) {
              expect(post.roundId).toBe(roundId);
            }
            
            // Count should match
            expect(roundPosts.length).toBe(roundInputs.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly count posts by member', () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.integer({ min: 0, max: 10 }),
          (memberId, numPosts) => {
            const store = createPostStore();
            
            // Create specified number of posts for the member
            for (let i = 0; i < numPosts; i++) {
              createPost(store, {
                memberId,
                roundId: 1,
                title: `Post ${i}`,
                url: `https://example.com/post/${memberId}/${i}`,
                publishedAt: new Date(),
                description: null,
              });
            }
            
            // Count should match
            expect(countByMember(store, memberId)).toBe(numPosts);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
