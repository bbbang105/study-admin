/**
 * 태그별 고유 색상 매핑
 *
 * 규칙:
 *   라이트: bg-{color}-100 text-{color}-700
 *   다크:   dark:bg-{color}-500/25 dark:text-{color}-300
 *   선택:   bg-{color}-500 text-white dark:bg-{color}-600
 *
 * 모든 태그에 채도 있는 파스텔 색상 사용 (무채색 금지)
 */

export interface TagColorStyle {
  /** 기본 배경 + 텍스트 (라이트/다크) */
  base: string;
  /** 선택됨 배경 (라이트/다크) */
  selected: string;
}

const TAG_COLOR_MAP: Record<string, TagColorStyle> = {
  // ── 개발 (11개) ──
  '프론트엔드':       { base: 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300',         selected: 'bg-blue-500 text-white dark:bg-blue-600' },
  '백엔드':          { base: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',   selected: 'bg-indigo-500 text-white dark:bg-indigo-600' },
  '풀스택':          { base: 'bg-sky-100 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300',               selected: 'bg-sky-500 text-white dark:bg-sky-600' },
  '모바일':          { base: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-300',           selected: 'bg-cyan-500 text-white dark:bg-cyan-600' },
  'DevOps':         { base: 'bg-blue-200 text-blue-800 dark:bg-blue-400/25 dark:text-blue-200',           selected: 'bg-blue-600 text-white dark:bg-blue-700' },
  '클라우드':        { base: 'bg-sky-200 text-sky-800 dark:bg-sky-400/25 dark:text-sky-200',               selected: 'bg-sky-600 text-white dark:bg-sky-700' },
  '데이터 엔지니어링': { base: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-400/25 dark:text-indigo-200',   selected: 'bg-indigo-600 text-white dark:bg-indigo-700' },
  '보안':            { base: 'bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300',               selected: 'bg-red-500 text-white dark:bg-red-600' },
  '시스템 설계':      { base: 'bg-teal-100 text-teal-700 dark:bg-teal-500/25 dark:text-teal-300',           selected: 'bg-teal-500 text-white dark:bg-teal-600' },
  '데이터베이스':     { base: 'bg-cyan-200 text-cyan-800 dark:bg-cyan-400/25 dark:text-cyan-200',           selected: 'bg-cyan-600 text-white dark:bg-cyan-700' },
  '테스팅':          { base: 'bg-teal-200 text-teal-800 dark:bg-teal-400/25 dark:text-teal-200',           selected: 'bg-teal-600 text-white dark:bg-teal-700' },

  // ── AI/트렌드 (4개) ──
  'AI':              { base: 'bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300',   selected: 'bg-violet-500 text-white dark:bg-violet-600' },
  'LLM':             { base: 'bg-purple-100 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300',   selected: 'bg-purple-500 text-white dark:bg-purple-600' },
  '데이터 사이언스':  { base: 'bg-violet-200 text-violet-800 dark:bg-violet-400/25 dark:text-violet-200',   selected: 'bg-violet-600 text-white dark:bg-violet-700' },
  'Web3':            { base: 'bg-purple-200 text-purple-800 dark:bg-purple-400/25 dark:text-purple-200',   selected: 'bg-purple-600 text-white dark:bg-purple-700' },

  // ── 디자인/기획 (5개) ──
  'UX/UI':                { base: 'bg-pink-100 text-pink-700 dark:bg-pink-500/25 dark:text-pink-300',           selected: 'bg-pink-500 text-white dark:bg-pink-600' },
  '프로덕트 매니지먼트':   { base: 'bg-rose-100 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300',           selected: 'bg-rose-500 text-white dark:bg-rose-600' },
  '서비스 기획':          { base: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/25 dark:text-fuchsia-300', selected: 'bg-fuchsia-500 text-white dark:bg-fuchsia-600' },
  '브랜딩':              { base: 'bg-pink-200 text-pink-800 dark:bg-pink-400/25 dark:text-pink-200',             selected: 'bg-pink-600 text-white dark:bg-pink-700' },
  '디자인 시스템':        { base: 'bg-rose-200 text-rose-800 dark:bg-rose-400/25 dark:text-rose-200',             selected: 'bg-rose-600 text-white dark:bg-rose-700' },

  // ── 커리어/성장 (5개) ──
  '커리어 성장':      { base: 'bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',       selected: 'bg-amber-500 text-white dark:bg-amber-600' },
  '사이드 프로젝트':   { base: 'bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300',   selected: 'bg-orange-500 text-white dark:bg-orange-600' },
  '스타트업':         { base: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/25 dark:text-yellow-300',   selected: 'bg-yellow-500 text-white dark:bg-yellow-600' },
  '오픈소스':         { base: 'bg-amber-200 text-amber-800 dark:bg-amber-400/25 dark:text-amber-200',       selected: 'bg-amber-600 text-white dark:bg-amber-700' },
  '기술 블로그':      { base: 'bg-orange-200 text-orange-800 dark:bg-orange-400/25 dark:text-orange-200',    selected: 'bg-orange-600 text-white dark:bg-orange-700' },

  // ── 인문/일상 (10개) ──
  '독서':            { base: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300', selected: 'bg-emerald-500 text-white dark:bg-emerald-600' },
  '글쓰기':          { base: 'bg-green-100 text-green-700 dark:bg-green-500/25 dark:text-green-300',         selected: 'bg-green-500 text-white dark:bg-green-600' },
  '생산성':          { base: 'bg-lime-100 text-lime-700 dark:bg-lime-500/25 dark:text-lime-300',             selected: 'bg-lime-500 text-white dark:bg-lime-600' },
  '자기계발':        { base: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-200', selected: 'bg-emerald-600 text-white dark:bg-emerald-700' },
  '인문학':          { base: 'bg-green-200 text-green-800 dark:bg-green-400/25 dark:text-green-200',         selected: 'bg-green-600 text-white dark:bg-green-700' },
  '심리학':          { base: 'bg-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-400/25 dark:text-fuchsia-200', selected: 'bg-fuchsia-600 text-white dark:bg-fuchsia-700' },
  '경제/재테크':      { base: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-400/25 dark:text-yellow-200',     selected: 'bg-yellow-600 text-white dark:bg-yellow-700' },
  '건강/운동':       { base: 'bg-lime-200 text-lime-800 dark:bg-lime-400/25 dark:text-lime-200',             selected: 'bg-lime-600 text-white dark:bg-lime-700' },
  '여행':            { base: 'bg-sky-100 text-sky-700 dark:bg-sky-500/30 dark:text-sky-200',                 selected: 'bg-sky-500 text-white dark:bg-sky-600' },
  '일상 기록':       { base: 'bg-rose-100 text-rose-700 dark:bg-rose-500/30 dark:text-rose-200',             selected: 'bg-rose-500 text-white dark:bg-rose-600' },
};

/** fallback for unknown tags — 채도 있는 색 사용 */
const FALLBACK: TagColorStyle = {
  base: 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300',
  selected: 'bg-blue-500 text-white dark:bg-blue-600',
};

/**
 * 태그의 색상 스타일 클래스를 반환합니다.
 */
export function getTagColor(tag: string, isSelected: boolean = false): string {
  const style = TAG_COLOR_MAP[tag] ?? FALLBACK;
  return isSelected ? style.selected : style.base;
}

/**
 * 태그의 색상 스타일 객체를 반환합니다.
 */
export function getTagColorStyle(tag: string): TagColorStyle {
  return TAG_COLOR_MAP[tag] ?? FALLBACK;
}
