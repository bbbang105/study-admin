'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.45;

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export function usePullToRefresh(containerRef: React.RefObject<HTMLDivElement | null>) {
  const router = useRouter();
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const state = useRef<PullState>('idle');
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLDivElement | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIndicatorRef = useCallback((el: HTMLDivElement | null) => {
    indicatorRef.current = el;
  }, []);

  const setIconRef = useCallback((el: HTMLDivElement | null) => {
    iconRef.current = el;
  }, []);

  const clearAllStyles = useCallback(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    const icon = iconRef.current;

    if (container) {
      container.style.transition = '';
      container.style.transform = '';
    }
    if (indicator) {
      indicator.style.transition = '';
      indicator.style.transform = '';
      indicator.style.opacity = '0';
    }
    if (icon) {
      icon.style.transform = '';
      icon.classList.remove('animate-spin');
    }

    const circle = indicator?.querySelector('[data-circle]') as HTMLElement | null;
    circle?.classList.remove('border-primary');
  }, [containerRef]);

  const applyTransform = useCallback(
    (distance: number, animated: boolean) => {
      const container = containerRef.current;
      const indicator = indicatorRef.current;
      const icon = iconRef.current;
      if (!container) return;

      const transition = animated ? 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)' : 'none';
      container.style.transition = transition;
      container.style.transform = distance > 0 ? `translateY(${distance}px)` : '';

      if (indicator) {
        indicator.style.transition = transition;
        indicator.style.transform = distance > 0 ? `translateY(${distance}px)` : '';
        indicator.style.opacity = distance > 10 ? '1' : '0';
      }

      if (icon && state.current !== 'refreshing') {
        const progress = Math.min(distance / THRESHOLD, 1);
        icon.style.transform = `rotate(${progress * 180}deg)`;
      }
    },
    [containerRef]
  );

  const updateIconState = useCallback((newState: PullState) => {
    const icon = iconRef.current;
    const indicator = indicatorRef.current;
    if (!icon || !indicator) return;

    const circle = indicator.querySelector('[data-circle]') as HTMLElement | null;

    if (newState === 'refreshing') {
      icon.classList.add('animate-spin');
      icon.style.transform = '';
      circle?.classList.add('border-primary');
    } else {
      icon.classList.remove('animate-spin');
      if (newState === 'ready') {
        circle?.classList.add('border-primary');
      } else {
        circle?.classList.remove('border-primary');
      }
    }
  }, []);

  useEffect(() => {
    let isTouching = false;

    function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollTop > 0) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    function onTouchStart(e: TouchEvent) {
      if (state.current === 'refreshing') return;
      if (window.scrollY > 5) return;

      const target = e.target as HTMLElement;
      if (findScrollableParent(target)) return;

      startY.current = e.touches[0]!.clientY;
      pullDistance.current = 0;
      isTouching = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!isTouching || state.current === 'refreshing') return;

      const diff = e.touches[0]!.clientY - startY.current;

      if (diff <= 0) {
        if (pullDistance.current > 0) {
          pullDistance.current = 0;
          state.current = 'idle';
          applyTransform(0, false);
          updateIconState('idle');
        }
        return;
      }

      if (window.scrollY <= 0) {
        e.preventDefault();
      }

      const distance = Math.min(diff * RESISTANCE, MAX_PULL);
      pullDistance.current = distance;

      const newState = distance >= THRESHOLD ? 'ready' : 'pulling';
      if (state.current !== newState) {
        state.current = newState;
        updateIconState(newState);
      }

      applyTransform(distance, false);
    }

    function resetToIdle() {
      state.current = 'idle';
      pullDistance.current = 0;
      clearAllStyles();
    }

    function onTouchEnd() {
      if (!isTouching) return;
      isTouching = false;

      if (state.current === 'ready') {
        state.current = 'refreshing';
        updateIconState('refreshing');
        applyTransform(THRESHOLD * 0.6, true);

        router.refresh();

        resetTimer.current = setTimeout(() => {
          applyTransform(0, true);
          innerTimer.current = setTimeout(() => {
            resetToIdle();
          }, 350);
        }, 800);
      } else {
        applyTransform(0, true);
        innerTimer.current = setTimeout(() => {
          resetToIdle();
        }, 350);
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (innerTimer.current) clearTimeout(innerTimer.current);
    };
  }, [applyTransform, updateIconState, clearAllStyles, router]);

  return { setIndicatorRef, setIconRef };
}
