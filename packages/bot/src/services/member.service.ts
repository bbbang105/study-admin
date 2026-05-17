/**
 * Member Service
 * 스터디 참가자 관리 서비스
 * Requirements: 1.1, 2.1, 3.2, 3.6
 */

import { asc, eq } from 'drizzle-orm';
import {
  getDb,
  type Member,
  memberBlogs,
  members,
  MemberStatus,
  type MemberStatusType,
  type NewMember,
} from '@blog-study/shared/db';
import { validateBlogUrl } from '@blog-study/shared/utils';

/**
 * Error codes for member operations
 */
export const MemberErrorCodes = {
  INVALID_URL: 'E1001',
  USER_NOT_FOUND: 'E1002',
  ALREADY_REGISTERED: 'E1003',
  DORMANT_ALREADY_USED: 'E1004',
  NOT_DORMANT: 'E1005',
  ALREADY_DORMANT: 'E1006',
} as const;

/**
 * Custom error class for member operations
 */
export class MemberError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'MemberError';
  }
}

/**
 * Input for registering a new member
 */
export interface RegisterMemberInput {
  discordId: string;
  discordUsername: string;
  name: string;
  part: string;
  blogUrl: string;
  rssUrl?: string;
}


/**
 * Member service for managing study participants
 */
export class MemberService {
  private db = getDb();

  /**
   * Register a new member
   * Requirements: 1.1 - Valid URL registration creates active member
   * @throws MemberError if URL is invalid or user is already registered
   */
  async register(input: RegisterMemberInput): Promise<Member> {
    // Validate blog URL
    const urlValidation = validateBlogUrl(input.blogUrl);
    if (!urlValidation.isValid) {
      throw new MemberError(
        MemberErrorCodes.INVALID_URL,
        urlValidation.error || '올바른 URL 형식이 아닙니다.',
        `Invalid blog URL: ${input.blogUrl}`
      );
    }

    // Check if user is already registered
    const existing = await this.getByDiscordId(input.discordId);
    if (existing) {
      throw new MemberError(
        MemberErrorCodes.ALREADY_REGISTERED,
        '이미 등록된 사용자입니다.',
        `User ${input.discordId} is already registered`
      );
    }

    // Create new member with active status
    const newMember: NewMember = {
      discordId: input.discordId,
      discordUsername: input.discordUsername,
      name: input.name,
      nickname: input.name,
      part: input.part,
      status: MemberStatus.ACTIVE,
      dormantUsed: false,
      onboardingCompleted: false,
    };

    const [created] = await this.db.insert(members).values(newMember).returning();

    // Register the member's first blog
    await this.db.insert(memberBlogs).values({
      memberId: created!.id,
      blogUrl: urlValidation.normalizedUrl || input.blogUrl,
      rssUrl: input.rssUrl || null,
      sortOrder: 0,
    });

    return created!;
  }

  /**
   * Withdraw a member from the study
   * Requirements: 2.1 - Withdrawal changes status to withdrawn, preserves data
   * @throws MemberError if user is not found
   */
  async withdraw(discordId: string): Promise<Member> {
    const member = await this.getByDiscordId(discordId);
    if (!member) {
      throw new MemberError(
        MemberErrorCodes.USER_NOT_FOUND,
        '등록되지 않은 사용자입니다.',
        `User ${discordId} not found`
      );
    }

    const [updated] = await this.db
      .update(members)
      .set({
        status: MemberStatus.WITHDRAWN,
        updatedAt: new Date(),
      })
      .where(eq(members.discordId, discordId))
      .returning();

    return updated!;
  }

  /**
   * Set a member to dormant status
   * Requirements: 3.2 - Set dormant status and record start round
   * @throws MemberError if user not found or dormant already used
   */
  async setDormant(discordId: string, currentRoundNumber: number): Promise<Member> {
    const member = await this.getByDiscordId(discordId);
    if (!member) {
      throw new MemberError(
        MemberErrorCodes.USER_NOT_FOUND,
        '등록되지 않은 사용자입니다.',
        `User ${discordId} not found`
      );
    }

    // Check if dormant was already used
    if (member.dormantUsed) {
      throw new MemberError(
        MemberErrorCodes.DORMANT_ALREADY_USED,
        '휴면은 1회만 사용할 수 있습니다.',
        `User ${discordId} has already used dormant privilege`
      );
    }

    // Check if already dormant
    if (member.status === MemberStatus.DORMANT) {
      throw new MemberError(
        MemberErrorCodes.ALREADY_DORMANT,
        '이미 휴면 상태입니다.',
        `User ${discordId} is already dormant`
      );
    }

    const [updated] = await this.db
      .update(members)
      .set({
        status: MemberStatus.DORMANT,
        dormantStartRound: currentRoundNumber,
        dormantUsed: true,
        updatedAt: new Date(),
      })
      .where(eq(members.discordId, discordId))
      .returning();

    return updated!;
  }

  /**
   * Unset dormant status (return to active)
   * Requirements: 3.6 - Unset dormant changes status back to active
   * @throws MemberError if user not found or not dormant
   */
  async unsetDormant(discordId: string): Promise<Member> {
    const member = await this.getByDiscordId(discordId);
    if (!member) {
      throw new MemberError(
        MemberErrorCodes.USER_NOT_FOUND,
        '등록되지 않은 사용자입니다.',
        `User ${discordId} not found`
      );
    }

    if (member.status !== MemberStatus.DORMANT) {
      throw new MemberError(
        MemberErrorCodes.NOT_DORMANT,
        '휴면 상태가 아닙니다.',
        `User ${discordId} is not dormant`
      );
    }

    const [updated] = await this.db
      .update(members)
      .set({
        status: MemberStatus.ACTIVE,
        updatedAt: new Date(),
      })
      .where(eq(members.discordId, discordId))
      .returning();

    return updated!;
  }

  /**
   * Get a member by Discord ID
   */
  async getByDiscordId(discordId: string): Promise<Member | null> {
    const [member] = await this.db
      .select()
      .from(members)
      .where(eq(members.discordId, discordId))
      .limit(1);

    return member || null;
  }

  /**
   * Get all active members
   */
  async getAllActive(): Promise<Member[]> {
    return this.db
      .select()
      .from(members)
      .where(eq(members.status, MemberStatus.ACTIVE));
  }

  /**
   * Get all members by status
   */
  async getAllByStatus(status: MemberStatusType): Promise<Member[]> {
    return this.db
      .select()
      .from(members)
      .where(eq(members.status, status));
  }

  /**
   * Get all members (regardless of status)
   */
  async getAll(): Promise<Member[]> {
    return this.db.select().from(members);
  }

  /**
   * Get member by ID
   */
  async getById(id: string): Promise<Member | null> {
    const [member] = await this.db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    return member || null;
  }

  /**
   * Update the RSS URL of the member's primary (lowest sortOrder) blog
   */
  async updateRssUrl(discordId: string, rssUrl: string): Promise<Member> {
    const member = await this.getByDiscordId(discordId);
    if (!member) {
      throw new MemberError(
        MemberErrorCodes.USER_NOT_FOUND,
        '등록되지 않은 사용자입니다.',
        `User ${discordId} not found`
      );
    }

    const [primaryBlog] = await this.db
      .select()
      .from(memberBlogs)
      .where(eq(memberBlogs.memberId, member.id))
      .orderBy(asc(memberBlogs.sortOrder))
      .limit(1);

    if (!primaryBlog) {
      throw new MemberError(
        MemberErrorCodes.USER_NOT_FOUND,
        '등록된 블로그가 없습니다.',
        `Member ${member.id} has no blog`
      );
    }

    await this.db
      .update(memberBlogs)
      .set({ rssUrl, updatedAt: new Date() })
      .where(eq(memberBlogs.id, primaryBlog.id));

    return member;
  }

  /**
   * Check if dormant period has expired (4 rounds = 8 weeks)
   * Returns true if member should be auto-activated
   */
  shouldAutoActivate(member: Member, currentRoundNumber: number): boolean {
    if (member.status !== MemberStatus.DORMANT) {
      return false;
    }
    if (member.dormantStartRound === null) {
      return false;
    }
    // Dormant lasts for 4 rounds
    return currentRoundNumber >= member.dormantStartRound + 4;
  }

  /**
   * Auto-activate dormant members whose period has expired
   */
  async autoActivateExpiredDormant(currentRoundNumber: number): Promise<Member[]> {
    const dormantMembers = await this.getAllByStatus(MemberStatus.DORMANT);
    const activated: Member[] = [];

    for (const member of dormantMembers) {
      if (this.shouldAutoActivate(member, currentRoundNumber)) {
        const updated = await this.unsetDormant(member.discordId);
        activated.push(updated);
      }
    }

    return activated;
  }
}

// Singleton instance
let memberServiceInstance: MemberService | null = null;

/**
 * Get the MemberService singleton instance
 */
export function getMemberService(): MemberService {
  if (!memberServiceInstance) {
    memberServiceInstance = new MemberService();
  }
  return memberServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetMemberService(): void {
  memberServiceInstance = null;
}
