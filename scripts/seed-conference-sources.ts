/**
 * 컨퍼런스 소스 시드 스크립트
 *
 * Usage:
 *   cd packages/shared
 *   export $(grep DATABASE_URL /Users/hansangho/Desktop/study-admin/.env.local | head -1 | xargs)
 *   npx tsx ../../scripts/seed-conference-sources.ts
 */
import { getDb } from '../packages/shared/src/db/index.js';
import { curationSources } from '../packages/shared/src/db/schema.js';

const CONFERENCE_SOURCES = [
  {
    name: 'Dev-Event (brave-people)',
    url: 'https://github.com/brave-people/Dev-Event',
    rssUrl: 'https://github.com/brave-people/Dev-Event/releases.atom',
    category: 'conference',
    tags: ['커리어 성장'],
    isActive: true,
  },
  {
    name: 'dev.events Korea',
    url: 'https://dev.events/AS/KR',
    rssUrl: 'https://dev.events/rss.xml',
    category: 'conference',
    tags: ['커리어 성장'],
    isActive: true,
  },
  {
    name: 'FECONF',
    url: 'https://feconf.kr',
    rssUrl: null,
    category: 'conference',
    tags: ['프론트엔드'],
    isActive: true,
  },
  {
    name: 'if(kakao)',
    url: 'https://if.kakao.com',
    rssUrl: null,
    category: 'conference',
    tags: ['풀스택'],
    isActive: true,
  },
  {
    name: 'Naver DEVIEW',
    url: 'https://deview.kr',
    rssUrl: null,
    category: 'conference',
    tags: ['풀스택'],
    isActive: true,
  },
  {
    name: 'AWS Summit Korea',
    url: 'https://aws.amazon.com/ko/events/summits/korea/',
    rssUrl: null,
    category: 'conference',
    tags: ['클라우드', 'DevOps'],
    isActive: true,
  },
  {
    name: 'GDG DevFest Korea',
    url: 'https://festa.dev',
    rssUrl: null,
    category: 'conference',
    tags: ['풀스택'],
    isActive: true,
  },
  {
    name: 'Toss SLASH',
    url: 'https://toss.im/slash',
    rssUrl: null,
    category: 'conference',
    tags: ['프론트엔드', '백엔드'],
    isActive: true,
  },
] as const;

async function main() {
  const database = getDb();

  for (const source of CONFERENCE_SOURCES) {
    try {
      await database
        .insert(curationSources)
        .values(source)
        .onConflictDoNothing({ target: curationSources.url });
      console.log(`✓ ${source.name}`);
    } catch (err) {
      console.error(`✗ ${source.name}:`, err);
    }
  }

  console.log('\nDone! Conference sources seeded.');
  process.exit(0);
}

main();
