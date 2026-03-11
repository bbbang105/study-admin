import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExternalLinkIconProps {
  className?: string;
  label?: string;
}

/**
 * External link icon with screen reader text for accessibility.
 * Defaults to "(새 탭에서 열기)" which means "(opens in new tab)" in Korean.
 */
export function ExternalLinkIcon({ className, label = '(새 탭에서 열기)' }: ExternalLinkIconProps) {
  return (
    <>
      <ExternalLink className={cn('h-3 w-3', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  );
}
