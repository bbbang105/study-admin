import { getPartStyle, getPartLabel } from '@/lib/part-config';

interface PartBadgeProps {
  part: string;
  size?: 'sm' | 'default';
}

export function PartBadge({ part, size = 'default' }: PartBadgeProps) {
  const style = getPartStyle(part);
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${style.bg} ${style.text} ${
        size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {getPartLabel(part)}
    </span>
  );
}
