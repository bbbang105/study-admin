import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { isAdminDiscordId } from '@/lib/admin';

const { members } = sharedDb;

export interface BoardAuthResult {
  memberId: string;
  discordId: string;
  isAdmin: boolean;
}

/**
 * 게시판용 인증: Supabase Auth → Discord ID → member 조회 → admin 체크
 * 인증 실패 시 null 반환
 */
export async function getBoardAuth(): Promise<BoardAuthResult | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const discordIdentity = user.identities?.find(i => i.provider === 'discord');
  const discordId = discordIdentity?.id;
  if (!discordId) return null;

  const database = getDb();
  const [member] = await database
    .select({ id: members.id })
    .from(members)
    .where(eq(members.discordId, discordId))
    .limit(1);
  if (!member) return null;

  const isAdmin = await isAdminDiscordId(discordId);

  return { memberId: member.id, discordId, isAdmin };
}
