import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * DiceBear 기본 아바타 URL 생성
 * profileImageUrl이 없을 때 seed 기반으로 일관된 아바타 반환
 */
export function getDefaultAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}`;
}
