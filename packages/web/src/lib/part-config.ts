export const PART_OPTIONS = [
  { label: 'Frontend', value: 'frontend' },
  { label: 'Backend', value: 'backend' },
  { label: 'Fullstack', value: 'fullstack' },
  { label: 'Designer', value: 'designer' },
  { label: 'Planner', value: 'planner' },
  { label: 'DevOps', value: 'devops' },
  { label: 'LLMOps', value: 'llmops' },
  { label: 'Other', value: 'other' },
] as const;

const PART_STYLES: Record<string, { bg: string; text: string }> = {
  frontend: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  backend: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
  },
  fullstack: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-400',
  },
  designer: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-700 dark:text-pink-400',
  },
  planner: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  devops: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
  },
  llmops: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-400',
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-gray-100 dark:bg-gray-900/30',
  text: 'text-gray-700 dark:text-gray-400',
};

export function getPartStyle(part: string): { bg: string; text: string } {
  return PART_STYLES[part] ?? DEFAULT_STYLE;
}

export function getPartLabel(part: string): string {
  const option = PART_OPTIONS.find((o) => o.value === part);
  return option?.label ?? part;
}
