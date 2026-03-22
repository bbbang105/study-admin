/**
 * 입력 새니타이즈 유틸리티
 */

/**
 * description 필드 새니타이즈
 * - 제어 문자 제거
 * - 제로 너비 / 방향 제어 유니코드 제거
 * - 양쪽 공백 제거, 최대 300자
 */
export function sanitizeDescription(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .trim()
    .slice(0, 300);
}

/**
 * Tiptap JSON content에서 위험한 링크 href 제거
 * javascript:, data:, vbscript: 프로토콜 차단
 */
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeTiptapContent(content: any): any {
  if (!content || typeof content !== 'object') return content;

  // Node 레벨 검사 (image-block의 src)
  if (content.type === 'imageBlock' && content.attrs?.src) {
    if (DANGEROUS_PROTOCOLS.test(content.attrs.src.trim())) {
      content.attrs.src = '';
    }
  }

  // Mark 레벨 검사 (link mark의 href)
  if (Array.isArray(content.marks)) {
    content.marks = content.marks.filter((mark: { type: string; attrs?: { href?: string } }) => {
      if (mark.type === 'link' && mark.attrs?.href) {
        return !DANGEROUS_PROTOCOLS.test(mark.attrs.href.trim());
      }
      return true;
    });
  }

  // 재귀적으로 자식 노드 처리
  if (Array.isArray(content.content)) {
    content.content = content.content.map(sanitizeTiptapContent);
  }

  return content;
}

/**
 * KST (UTC+9) 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayKST(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}
