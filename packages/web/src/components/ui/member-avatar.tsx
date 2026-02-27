'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getDefaultAvatar } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeConfig: Record<AvatarSize, { avatar: string; fallbackText: string }> = {
  xs: { avatar: 'h-4 w-4', fallbackText: 'text-[8px]' },
  sm: { avatar: 'h-5 w-5', fallbackText: 'text-[9px] font-medium' },
  md: { avatar: 'h-8 w-8', fallbackText: 'text-[11px] font-medium' },
  lg: { avatar: 'h-10 w-10', fallbackText: 'text-xs font-medium' },
};

interface MemberAvatarProps {
  memberId?: string | null;
  name: string;
  seed?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
  /** true이면 링크 비활성화 (익명/삭제/자기 프로필 등) */
  noLink?: boolean;
  /** true이면 아바타 옆에 이름 표시 (링크 포함) */
  showName?: boolean;
  /** showName 사용 시 이름 텍스트 스타일 */
  nameClassName?: string;
  /** 관리자 뱃지 표시 */
  isAdmin?: boolean;
}

export function MemberAvatar({
  memberId,
  name,
  seed,
  imageUrl,
  size = 'sm',
  className,
  noLink = false,
  showName = false,
  nameClassName,
  isAdmin = false,
}: MemberAvatarProps) {
  const config = sizeConfig[size];
  const avatarSeed = seed || name;
  const src = imageUrl ?? getDefaultAvatar(avatarSeed);
  const fallbackText = name.slice(0, 2).toUpperCase();

  const canLink = !noLink && memberId;

  const avatar = (
    <Avatar
      className={cn(
        config.avatar,
        'ring-1 ring-border shrink-0',
        canLink && 'hover:ring-primary transition-colors',
        className,
      )}
    >
      <AvatarImage src={src} alt={name} />
      <AvatarFallback className={config.fallbackText}>
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );

  const adminBadge = isAdmin ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
      <Shield className="h-2.5 w-2.5" />
      관리자
    </span>
  ) : null;

  const nameEl = showName ? (
    <>
      <span className={cn(canLink && 'hover:text-primary transition-colors', nameClassName)}>
        {name}
      </span>
      {adminBadge}
    </>
  ) : null;

  if (!canLink) {
    if (!showName) return avatar;
    return (
      <span className="inline-flex items-center gap-1.5 shrink-0">
        {avatar}
        {nameEl}
      </span>
    );
  }

  return (
    <Link
      href={`/members/${memberId}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 shrink-0"
    >
      {avatar}
      {nameEl}
    </Link>
  );
}
