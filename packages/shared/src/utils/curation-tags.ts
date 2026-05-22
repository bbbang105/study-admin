import { INTEREST_OPTIONS, type InterestOption } from '../config/interest-options';

export interface InferCurationTagsInput {
  title: string;
  description?: string | null;
  rawTags?: Array<string | null | undefined> | null;
  maxTags?: number;
}

const TAG_ALIASES: Record<InterestOption, string[]> = {
  프론트엔드: [
    'frontend',
    'front-end',
    'front end',
    'react',
    'nextjs',
    'next.js',
    'vue',
    'svelte',
    'typescript',
    'javascript',
    'css',
    'html',
    'web ui',
  ],
  백엔드: [
    'backend',
    'back-end',
    'back end',
    'api',
    'server',
    'spring',
    'nodejs',
    'node.js',
    'nestjs',
    'express',
    'java',
    'kotlin',
    'go',
    'golang',
  ],
  풀스택: ['fullstack', 'full-stack', 'full stack'],
  모바일: ['mobile', 'ios', 'android', 'swift', 'kotlin multiplatform', 'react native', 'flutter'],
  DevOps: ['devops', 'ci/cd', 'cicd', 'docker', 'kubernetes', 'k8s', 'terraform', 'github actions'],
  클라우드: ['cloud', 'aws', 'gcp', 'azure', 'serverless', 'lambda', 'cloudflare', 'vercel'],
  '데이터 엔지니어링': ['data engineering', 'etl', 'elt', 'airflow', 'spark', 'kafka', 'pipeline'],
  보안: ['security', 'auth', 'authentication', 'authorization', 'oauth', 'xss', 'csrf', 'owasp'],
  '시스템 설계': ['system design', 'architecture', 'distributed system', 'scalability', 'scale'],
  데이터베이스: ['database', 'db', 'postgres', 'postgresql', 'mysql', 'redis', 'sql', 'pgvector'],
  테스팅: ['test', 'testing', 'vitest', 'jest', 'playwright', 'qa', 'e2e', 'unit test'],
  AI: [
    'ai',
    'artificial intelligence',
    'machine learning',
    'ml',
    'deep learning',
    '인공지능',
    '머신러닝',
    '딥러닝',
  ],
  LLM: [
    'llm',
    'large language model',
    'rag',
    'embedding',
    'embeddings',
    'vector search',
    'openai',
    'claude',
    'prompt',
  ],
  '데이터 사이언스': [
    'data science',
    'analytics',
    'analysis',
    'visualization',
    'pandas',
    'notebook',
  ],
  Web3: ['web3', 'blockchain', 'crypto', 'ethereum', 'smart contract', 'nft'],
  'UX/UI': ['ux', 'ui', 'user experience', 'interface', 'usability'],
  '프로덕트 매니지먼트': ['product management', 'product manager', 'pm', 'roadmap', 'metrics'],
  '서비스 기획': ['service planning', 'planning', 'requirements', 'specification'],
  브랜딩: ['branding', 'brand', 'identity'],
  '디자인 시스템': ['design system', 'component library', 'tokens', 'storybook'],
  '커리어 성장': ['career', 'growth', 'interview', 'resume', 'mentoring'],
  '사이드 프로젝트': ['side project', 'indie hacking', 'solo project'],
  스타트업: ['startup', 'founder', 'vc', 'fundraising', 'mvp'],
  오픈소스: ['open source', 'opensource', 'oss', 'github'],
  '기술 블로그': ['tech blog', 'technical writing', 'developer blog'],
  독서: ['book', 'reading'],
  글쓰기: ['writing', 'essay', 'blogging'],
  생산성: ['productivity', 'workflow', 'automation'],
  자기계발: ['self improvement', 'personal growth'],
  인문학: ['humanities', 'philosophy', 'history'],
  심리학: ['psychology', 'mental model'],
  '경제/재테크': ['finance', 'investment', 'economy', 'money'],
  '건강/운동': ['health', 'fitness', 'exercise'],
  여행: ['travel'],
  '일상 기록': ['daily', 'life', 'journal'],
};

const DIRECT_TAG_MATCHES = new Map(
  INTEREST_OPTIONS.flatMap((tag) => [
    [normalizeForMatch(tag), tag],
    ...TAG_ALIASES[tag].map((alias) => [normalizeForMatch(alias), tag] as const),
  ])
);

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[._-]+/g, ' ')
    .replace(/[^\p{L}\p{N}#+/ ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesToken(text: string, needle: string): boolean {
  if (!needle) return false;
  if (/^[a-z0-9#+/ ]+$/i.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9#+/])${escaped}(?=$|[^a-z0-9#+/])`, 'i').test(text);
  }
  return text.includes(needle);
}

function addTag(tags: InterestOption[], tag: InterestOption): void {
  if (!tags.includes(tag)) tags.push(tag);
}

export function inferCurationTags(input: InferCurationTagsInput): InterestOption[] {
  const maxTags = Math.max(1, input.maxTags ?? 8);
  const inferred: InterestOption[] = [];

  for (const rawTag of input.rawTags ?? []) {
    const normalized = normalizeForMatch(rawTag ?? '');
    if (!normalized) continue;
    const matched = DIRECT_TAG_MATCHES.get(normalized);
    if (matched) addTag(inferred, matched);
  }

  const searchableText = normalizeForMatch(
    [input.title, input.description, ...(input.rawTags ?? [])].filter(Boolean).join(' ')
  );

  for (const tag of INTEREST_OPTIONS) {
    if (inferred.length >= maxTags) break;
    if (includesToken(searchableText, normalizeForMatch(tag))) {
      addTag(inferred, tag);
      continue;
    }
    if (TAG_ALIASES[tag].some((alias) => includesToken(searchableText, normalizeForMatch(alias)))) {
      addTag(inferred, tag);
    }
  }

  return inferred.slice(0, maxTags);
}
