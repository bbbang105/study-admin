import { redirect } from 'next/navigation';
import { count, eq, isNull } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { LandingClient } from '@/components/landing/landing-client';

const { members, posts, rounds } = sharedDb;

// Cache the landing page for 60s — stats are not real-time critical
export const revalidate = 60;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Auth error falls through to landing page (safe default for public page)
  if (!error && user) {
    redirect('/dashboard');
  }

  const database = db();

  const [memberResult, postResult, roundResult] = await Promise.all([
    database.select({ value: count() }).from(members).where(eq(members.status, 'active')),
    database.select({ value: count() }).from(posts).where(isNull(posts.deletedAt)),
    database
      .select({ roundNumber: rounds.roundNumber })
      .from(rounds)
      .where(eq(rounds.isCurrent, true)),
  ]);

  return (
    <LandingClient
      stats={{
        members: memberResult[0]?.value ?? 0,
        posts: postResult[0]?.value ?? 0,
        round: roundResult[0]?.roundNumber ?? 0,
      }}
    />
  );
}
