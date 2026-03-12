/**
 * Post Service
 * 블로그 글 관리 서비스
 * Requirements: 6.3, 6.4, 6.6
 */

import { eq, and, count } from 'drizzle-orm';
import {
  getDb,
  posts,
  type Post,
  type NewPost,
} from '@blog-study/shared/db';

/**
 * Error codes for post operations
 */
export const PostErrorCodes = {
  POST_NOT_FOUND: 'E3001',
  DUPLICATE_URL: 'E3002',
  INVALID_POST_DATA: 'E3003',
  MEMBER_NOT_FOUND: 'E3004',
} as const;

/**
 * Custom error class for post operations
 */
export class PostError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'PostError';
  }
}

/**
 * Input for creating a new post
 * Requirements: 6.3 - Post storage completeness
 */
export interface CreatePostInput {
  memberId: string;
  roundId: number | null;
  title: string;
  url: string;
  publishedAt: Date;
  description?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Result of creating a post
 */
export interface CreatePostResult {
  post: Post;
  isNew: boolean;
}

/**
 * Post service for managing blog posts
 */
export class PostService {
  private db = getDb();

  /**
   * Create a new post
   * Requirements: 6.3 - Store post with all required fields
   * Requirements: 6.4 - Skip duplicate URLs
   * Requirements: 6.6 - Include round number based on published date
   * 
   * @returns CreatePostResult with isNew=false if duplicate
   */
  async create(input: CreatePostInput): Promise<CreatePostResult> {
    // Check for duplicate URL first
    const existing = await this.getByUrl(input.url);
    if (existing) {
      return { post: existing, isNew: false };
    }

    // Create new post with all required fields
    const newPost: NewPost = {
      memberId: input.memberId,
      roundId: input.roundId,
      title: input.title,
      url: input.url,
      publishedAt: input.publishedAt,
      description: input.description ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
    };

    const [created] = await this.db.insert(posts).values(newPost).returning();
    return { post: created!, isNew: true };
  }

  /**
   * Check if a post with the given URL already exists
   * Requirements: 6.4 - Duplicate post prevention
   */
  async existsByUrl(url: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.url, url));
    
    return (result[0]?.count ?? 0) > 0;
  }

  /**
   * Get a post by URL
   */
  async getByUrl(url: string): Promise<Post | null> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.url, url))
      .limit(1);

    return post || null;
  }

  /**
   * Get all posts by a member
   */
  async getByMember(memberId: string): Promise<Post[]> {
    return this.db
      .select()
      .from(posts)
      .where(eq(posts.memberId, memberId));
  }

  /**
   * Get all posts for a specific round
   */
  async getByRound(roundId: number): Promise<Post[]> {
    return this.db
      .select()
      .from(posts)
      .where(eq(posts.roundId, roundId));
  }

  /**
   * Get posts by member and round
   */
  async getByMemberAndRound(memberId: string, roundId: number): Promise<Post[]> {
    return this.db
      .select()
      .from(posts)
      .where(and(eq(posts.memberId, memberId), eq(posts.roundId, roundId)));
  }

  /**
   * Count posts by a member
   */
  async countByMember(memberId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.memberId, memberId));
    
    return result[0]?.count ?? 0;
  }

  /**
   * Get post by ID
   */
  async getById(id: string): Promise<Post | null> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    return post || null;
  }

  /**
   * Get all posts
   */
  async getAll(): Promise<Post[]> {
    return this.db.select().from(posts);
  }
}

// Singleton instance
let postServiceInstance: PostService | null = null;

/**
 * Get the PostService singleton instance
 */
export function getPostService(): PostService {
  if (!postServiceInstance) {
    postServiceInstance = new PostService();
  }
  return postServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetPostService(): void {
  postServiceInstance = null;
}
