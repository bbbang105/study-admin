import type { Post } from '../db/schema';

/**
 * Serializable Post type for JSON storage/transfer
 * Converts Date objects to ISO strings
 */
export interface SerializedPost {
  id: string;
  memberId: string;
  roundId: number | null;
  title: string;
  url: string;
  publishedAt: string; // ISO 8601 string
  description: string | null;
  thumbnailUrl: string | null;
  commentCount: number | null;
  collectedAt: string | null; // ISO 8601 string
  deletedAt: string | null; // ISO 8601 string
}

/**
 * Serialize a Post object to JSON-safe format
 * Converts Date objects to ISO strings for JSON storage
 */
export function serializePost(post: Post): SerializedPost {
  return {
    id: post.id,
    memberId: post.memberId,
    roundId: post.roundId,
    title: post.title,
    url: post.url,
    publishedAt: post.publishedAt.toISOString(),
    description: post.description,
    thumbnailUrl: post.thumbnailUrl,
    commentCount: post.commentCount,
    collectedAt: post.collectedAt?.toISOString() ?? null,
    deletedAt: post.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Deserialize a JSON Post back to Post object
 * Converts ISO strings back to Date objects
 */
export function deserializePost(serialized: SerializedPost): Post {
  return {
    id: serialized.id,
    memberId: serialized.memberId,
    roundId: serialized.roundId,
    title: serialized.title,
    url: serialized.url,
    publishedAt: new Date(serialized.publishedAt),
    description: serialized.description,
    thumbnailUrl: serialized.thumbnailUrl,
    commentCount: serialized.commentCount ?? 0,
    collectedAt: serialized.collectedAt ? new Date(serialized.collectedAt) : null,
    deletedAt: serialized.deletedAt ? new Date(serialized.deletedAt) : null,
  };
}

/**
 * Serialize Post to JSON string
 */
export function postToJson(post: Post): string {
  return JSON.stringify(serializePost(post));
}

/**
 * Deserialize Post from JSON string
 */
export function postFromJson(json: string): Post {
  const parsed = JSON.parse(json) as SerializedPost;
  return deserializePost(parsed);
}

/**
 * Check if two Post objects are equivalent
 * Compares all fields including Date objects by value
 */
export function postsAreEqual(a: Post, b: Post): boolean {
  return (
    a.id === b.id &&
    a.memberId === b.memberId &&
    a.roundId === b.roundId &&
    a.title === b.title &&
    a.url === b.url &&
    a.publishedAt.getTime() === b.publishedAt.getTime() &&
    a.description === b.description &&
    a.thumbnailUrl === b.thumbnailUrl &&
    (a.collectedAt === null && b.collectedAt === null ||
      (a.collectedAt !== null && b.collectedAt !== null &&
        a.collectedAt.getTime() === b.collectedAt.getTime()))
  );
}
