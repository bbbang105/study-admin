export const BOARD_CATEGORIES = [
  { value: 'notice', label: '공지' },
  { value: 'suggestion', label: '건의' },
  { value: 'review', label: '후기' },
  { value: 'knowledge', label: '지식공유' },
  { value: 'daily', label: '일상' },
  { value: 'etc', label: '기타' },
] as const;

export const categoryBadgeConfig: Record<string, { label: string; className: string }> = {
  notice: { label: '공지', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  suggestion: { label: '건의', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  review: { label: '후기', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  knowledge: { label: '지식공유', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  daily: { label: '일상', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  etc: { label: '기타', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
};

export const VALID_CATEGORY_VALUES = BOARD_CATEGORIES.map((c) => c.value) as readonly string[];

export function isValidCategory(value: string): boolean {
  return VALID_CATEGORY_VALUES.includes(value);
}

export function getCategoryLabel(value: string): string {
  return categoryBadgeConfig[value]?.label || value;
}
