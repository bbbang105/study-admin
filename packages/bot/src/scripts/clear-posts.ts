import { loadBotEnv } from '@blog-study/shared';
import { getDb, posts } from '@blog-study/shared/db';
import { count } from 'drizzle-orm';

async function main() {
  loadBotEnv();
  const db = getDb();

  const [before] = await db.select({ count: count() }).from(posts);
  console.log(`삭제 전: ${before?.count ?? 0}개`);

  await db.delete(posts);

  const [after] = await db.select({ count: count() }).from(posts);
  console.log(`삭제 후: ${after?.count ?? 0}개`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
