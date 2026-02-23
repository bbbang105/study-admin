/**
 * 키워드 추출 유틸리티
 * 텍스트에서 키워드 추출, 불용어 필터링
 * Requirements: 14.1, 14.6
 */

/**
 * 한국어 불용어 목록
 * 일반적으로 의미가 없는 조사, 접속사, 대명사 등
 */
const KOREAN_STOP_WORDS = new Set([
  // 조사
  '이', '가', '은', '는', '을', '를', '의', '에', '에서', '로', '으로',
  '와', '과', '도', '만', '까지', '부터', '에게', '한테', '께',
  // 접속사
  '그리고', '그러나', '그래서', '하지만', '또한', '또는', '및', '혹은',
  // 대명사
  '나', '너', '우리', '저', '그', '그녀', '이것', '저것', '그것',
  // 지시어
  '이런', '저런', '그런', '어떤', '무슨', '어느',
  // 동사/형용사 어미
  '하다', '되다', '있다', '없다', '같다', '이다',
  // 부사
  '매우', '아주', '정말', '너무', '많이', '조금', '잘', '더', '가장',
  // 기타
  '것', '수', '등', '때', '중', '위', '후', '전', '내', '외',
]);

/**
 * 영어 불용어 목록
 */
const ENGLISH_STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  // Conjunctions
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while', 'because',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  // Common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'can', 'must', 'shall',
  // Others
  'what', 'which', 'who', 'whom', 'how', 'why', 'where', 'when',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'here', 'there', 'about', 'over', 'again',
]);

/**
 * 모든 불용어 통합
 */
const ALL_STOP_WORDS = new Set([...KOREAN_STOP_WORDS, ...ENGLISH_STOP_WORDS]);

/**
 * 키워드 추출 결과
 */
export interface KeywordExtractionResult {
  keywords: string[];
  originalText: string;
}

/**
 * 키워드 추출 옵션
 */
export interface KeywordExtractorOptions {
  minLength?: number;        // 최소 키워드 길이 (기본: 2)
  maxKeywords?: number;      // 최대 키워드 수 (기본: 무제한)
  includeNumbers?: boolean;  // 숫자 포함 여부 (기본: false)
  customStopWords?: string[]; // 추가 불용어
}

const DEFAULT_OPTIONS: Required<KeywordExtractorOptions> = {
  minLength: 2,
  maxKeywords: Infinity,
  includeNumbers: false,
  customStopWords: [],
};

/**
 * 텍스트 정규화
 * - 소문자 변환
 * - 특수문자 제거
 * - 연속 공백 제거
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .trim()
    // HTML 태그 제거
    .replace(/<[^>]*>/g, ' ')
    // URL 제거
    .replace(/https?:\/\/[^\s]+/g, ' ')
    // 이메일 제거
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, ' ')
    // 특수문자를 공백으로 변환 (한글, 영문, 숫자 제외)
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    // 연속 공백 제거
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 키워드 정규화
 * - 소문자 변환
 * - 앞뒤 공백 제거
 */
export function normalizeKeyword(keyword: string): string {
  if (!keyword || typeof keyword !== 'string') {
    return '';
  }
  return keyword.toLowerCase().trim();
}

/**
 * 불용어인지 확인
 */
export function isStopWord(word: string, customStopWords: string[] = []): boolean {
  const normalized = normalizeKeyword(word);
  if (!normalized) {
    return true;
  }
  
  if (ALL_STOP_WORDS.has(normalized)) {
    return true;
  }
  
  if (customStopWords.length > 0) {
    const customSet = new Set(customStopWords.map(w => normalizeKeyword(w)));
    if (customSet.has(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 유효한 키워드인지 확인
 */
export function isValidKeyword(
  word: string,
  options: Required<KeywordExtractorOptions>
): boolean {
  const normalized = normalizeKeyword(word);
  
  // 빈 문자열 제외
  if (!normalized) {
    return false;
  }
  
  // 최소 길이 체크
  if (normalized.length < options.minLength) {
    return false;
  }
  
  // 불용어 체크
  if (isStopWord(normalized, options.customStopWords)) {
    return false;
  }
  
  // 숫자만으로 이루어진 단어 체크
  if (!options.includeNumbers && /^\d+$/.test(normalized)) {
    return false;
  }
  
  return true;
}

/**
 * 텍스트에서 키워드 추출
 * 
 * @param text 키워드를 추출할 텍스트
 * @param options 추출 옵션
 * @returns 추출된 키워드 배열
 */
export function extractKeywords(
  text: string,
  options: KeywordExtractorOptions = {}
): string[] {
  const mergedOptions: Required<KeywordExtractorOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return [];
  }

  // 단어 분리
  const words = normalizedText.split(/\s+/);
  
  // 유효한 키워드만 필터링
  const validKeywords = words
    .map(normalizeKeyword)
    .filter(word => isValidKeyword(word, mergedOptions));
  
  // 중복 제거
  const uniqueKeywords = [...new Set(validKeywords)];
  
  // 최대 개수 제한
  if (mergedOptions.maxKeywords !== Infinity && uniqueKeywords.length > mergedOptions.maxKeywords) {
    return uniqueKeywords.slice(0, mergedOptions.maxKeywords);
  }
  
  return uniqueKeywords;
}

/**
 * 여러 텍스트에서 키워드 추출 및 병합
 * 
 * @param texts 키워드를 추출할 텍스트 배열
 * @param options 추출 옵션
 * @returns 추출된 키워드 배열 (중복 제거됨)
 */
export function extractKeywordsFromMultiple(
  texts: string[],
  options: KeywordExtractorOptions = {}
): string[] {
  if (!Array.isArray(texts)) {
    return [];
  }

  const allKeywords: string[] = [];
  
  for (const text of texts) {
    const keywords = extractKeywords(text, options);
    allKeywords.push(...keywords);
  }
  
  // 중복 제거
  const uniqueKeywords = [...new Set(allKeywords)];
  
  const mergedOptions: Required<KeywordExtractorOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  // 최대 개수 제한
  if (mergedOptions.maxKeywords !== Infinity && uniqueKeywords.length > mergedOptions.maxKeywords) {
    return uniqueKeywords.slice(0, mergedOptions.maxKeywords);
  }
  
  return uniqueKeywords;
}

/**
 * 포스트 제목과 설명에서 키워드 추출
 * Requirements: 14.1
 * 
 * @param title 포스트 제목
 * @param description 포스트 설명 (선택)
 * @param options 추출 옵션
 * @returns 추출된 키워드 배열
 */
export function extractKeywordsFromPost(
  title: string,
  description?: string,
  options: KeywordExtractorOptions = {}
): string[] {
  const texts = [title];
  if (description) {
    texts.push(description);
  }
  return extractKeywordsFromMultiple(texts, options);
}

/**
 * 불용어 목록 가져오기 (테스트용)
 */
export function getStopWords(): Set<string> {
  return new Set(ALL_STOP_WORDS);
}

/**
 * 한국어 불용어 목록 가져오기
 */
export function getKoreanStopWords(): Set<string> {
  return new Set(KOREAN_STOP_WORDS);
}

/**
 * 영어 불용어 목록 가져오기
 */
export function getEnglishStopWords(): Set<string> {
  return new Set(ENGLISH_STOP_WORDS);
}
