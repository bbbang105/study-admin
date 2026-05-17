/**
 * member_blogs 마이그레이션 — Phase 2 (CONTRACT, 파괴적)
 *
 * ❗ 신코드(member_blogs 사용)가 운영에 완전히 배포·검증된 뒤에만 실행.
 *    구버전 코드가 살아있는 상태에서 실행하면 members.blog_url 참조 쿼리가
 *    전부 깨진다.
 *
 * 1. (안전 가드) member_blogs 테이블이 없으면 중단 — expand 먼저 실행 요구
 * 2. 멱등 재백필 — expand 이후 구코드가 추가한 멤버를 누락 없이 보정
 * 3. members.blog_url/rss_url/rss_consent 컬럼 제거
 *
 * 재실행 안전 (구컬럼 이미 없으면 스킵).
 *
 * Usage: pnpm --filter @blog-study/shared migrate:member-blogs:contract
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../../.env.local') });
config({ path: resolve(__dirname, '../../../../.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    await sql.begin(async (tx) => {
      // 1. member_blogs 존재 확인 (expand 선행 강제)
      const tblCheck = (await tx.unsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'member_blogs'
        ) AS exists
      `)) as unknown as Array<{ exists: boolean }>;
      if (!tblCheck[0]?.exists) {
        throw new Error('member_blogs 테이블이 없습니다. 먼저 expand 를 실행하세요.');
      }

      // 2. 구컬럼이 아직 있으면: 멱등 재백필 후 컬럼 제거
      const colCheck = (await tx.unsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'members' AND column_name = 'blog_url'
        ) AS exists
      `)) as unknown as Array<{ exists: boolean }>;
      const hasBlogUrl = colCheck[0]?.exists ?? false;

      if (!hasBlogUrl) {
        console.log('ℹ️  members.blog_url 컬럼 없음 — 이미 contract 완료. 스킵');
        return;
      }

      // expand~contract 사이 구코드가 추가한 멤버 보정 (멱등)
      const inserted = (await tx.unsafe(`
        INSERT INTO "member_blogs" ("member_id", "blog_url", "rss_url", "rss_consent", "sort_order")
        SELECT m."id", m."blog_url", m."rss_url", COALESCE(m."rss_consent", true), 0
        FROM "members" m
        WHERE m."blog_url" IS NOT NULL
          AND m."blog_url" <> ''
          AND NOT EXISTS (
            SELECT 1 FROM "member_blogs" mb WHERE mb."member_id" = m."id"
          )
      `)) as unknown as { count: number };
      console.log(`✅ 재백필 보정: ${inserted.count}개 신규 멤버 블로그 행 생성`);

      // 3. 구컬럼 제거 (파괴적)
      await tx.unsafe(`ALTER TABLE "members" DROP COLUMN IF EXISTS "blog_url"`);
      await tx.unsafe(`ALTER TABLE "members" DROP COLUMN IF EXISTS "rss_url"`);
      await tx.unsafe(`ALTER TABLE "members" DROP COLUMN IF EXISTS "rss_consent"`);
      console.log('✅ members.blog_url/rss_url/rss_consent 컬럼 제거 완료');
    });

    const countRows = (await sql.unsafe(
      `SELECT COUNT(*) AS count FROM "member_blogs"`
    )) as unknown as Array<{ count: string }>;
    console.log(`🎉 CONTRACT 완료 — member_blogs 총 ${countRows[0]?.count ?? '0'}행`);
    process.exit(0);
  } catch (error) {
    console.error('❌ CONTRACT 실패 (롤백됨):', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
