/**
 * URL 검증 유틸리티
 * 블로그 URL 형식 검증 및 플랫폼 감지
 * Requirements: 1.1, 1.3
 */

/**
 * 지원하는 블로그 플랫폼
 */
export type BlogPlatform = 'velog' | 'tistory' | 'medium' | 'unknown';

/**
 * SSRF 방지: 안전한 외부 URL인지 검증
 * 로컬호스트, 프라이빗 네트워크, 메타데이터 엔드포인트 차단
 */
export function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

    // IPv6 loopback and link-local
    if (hostname === '::1' || hostname.toLowerCase().startsWith('fe80:')) {
      return false;
    }

    // IPv4 private/reserved ranges
    const parts = hostname.split('.');
    const first = parseInt(parts[0] ?? '', 10);
    const second = parseInt(parts[1] ?? '', 10);
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
      hostname.startsWith('192.168.') ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * URL 검증 결과
 */
export interface UrlValidationResult {
  isValid: boolean;
  platform: BlogPlatform;
  normalizedUrl: string | null;
  error?: string;
}

/**
 * 블로그 플랫폼별 URL 패턴
 */
const PLATFORM_PATTERNS: Record<BlogPlatform, RegExp> = {
  velog: /^https?:\/\/velog\.io\/@[\w-]+(\/posts)?\/?$/,
  tistory: /^https?:\/\/[\w-]+\.tistory\.com\/?$/,
  medium: /^https?:\/\/medium\.com\/@[\w-]+\/?$/,
  unknown: /^https?:\/\/.+/,
};

/**
 * URL이 유효한 형식인지 검증
 * @param url 검증할 URL 문자열
 * @returns URL이 유효하면 true
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    // http 또는 https 프로토콜만 허용
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // 호스트가 있어야 함
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return false;
    }
    // 호스트에 최소한 하나의 점이 있어야 함 (localhost 제외)
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 블로그 URL이 유효한 형식인지 검증
 * 일반 URL 검증 + 블로그 플랫폼 패턴 검증
 * @param url 검증할 블로그 URL
 * @returns URL이 유효하면 true
 */
export function isValidBlogUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  const trimmed = url.trim();
  
  // 알려진 플랫폼 패턴 검증
  for (const platform of ['velog', 'tistory', 'medium'] as BlogPlatform[]) {
    if (PLATFORM_PATTERNS[platform].test(trimmed)) {
      return true;
    }
  }

  // 알려지지 않은 플랫폼도 유효한 URL이면 허용
  return true;
}

/**
 * URL에서 블로그 플랫폼 감지
 * @param url 블로그 URL
 * @returns 감지된 플랫폼
 */
export function detectBlogPlatform(url: string): BlogPlatform {
  if (!isValidUrl(url)) {
    return 'unknown';
  }

  const trimmed = url.trim();

  if (PLATFORM_PATTERNS.velog.test(trimmed)) {
    return 'velog';
  }
  if (PLATFORM_PATTERNS.tistory.test(trimmed)) {
    return 'tistory';
  }
  if (PLATFORM_PATTERNS.medium.test(trimmed)) {
    return 'medium';
  }

  return 'unknown';
}

/**
 * URL 정규화 (trailing slash 제거, 소문자 변환 등)
 * @param url 정규화할 URL
 * @returns 정규화된 URL 또는 null (유효하지 않은 경우)
 */
export function normalizeUrl(url: string): string | null {
  if (!isValidUrl(url)) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    // 프로토콜을 https로 통일 (선택적)
    // pathname에서 trailing slash 제거 (루트 제외)
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.hostname}${pathname}`;
  } catch {
    return null;
  }
}

/**
 * URL 검증 및 상세 결과 반환
 * @param url 검증할 URL
 * @returns 검증 결과 객체
 */
export function validateBlogUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      platform: 'unknown',
      normalizedUrl: null,
      error: 'URL이 비어있거나 문자열이 아닙니다.',
    };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      platform: 'unknown',
      normalizedUrl: null,
      error: 'URL이 비어있습니다.',
    };
  }

  if (!isValidUrl(trimmed)) {
    return {
      isValid: false,
      platform: 'unknown',
      normalizedUrl: null,
      error: '올바른 URL 형식이 아닙니다.',
    };
  }

  const platform = detectBlogPlatform(trimmed);
  const normalizedUrl = normalizeUrl(trimmed);

  return {
    isValid: true,
    platform,
    normalizedUrl,
  };
}
