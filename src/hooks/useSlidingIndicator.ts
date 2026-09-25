import { useLayoutEffect, useRef } from 'react';
import type { DependencyList, RefObject } from 'react';

export type IndicatorPosition = { left: number; width: number } | null;

// Slides an absolutely positioned pill under whichever child of the group
// carries `data-active`. Pass a `memory` object that outlives the component
// when it remounts on every change (like the view switcher, which each page
// renders separately) so the pill slides from where it last was.
export function useSlidingIndicator(
  deps: DependencyList,
  memory?: { current: IndicatorPosition },
): {
  groupRef: RefObject<HTMLDivElement | null>;
  indicatorRef: RefObject<HTMLSpanElement | null>;
} {
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const localMemory = useRef<IndicatorPosition>(null);
  const last = memory ?? localMemory;

  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator) return;

    const moveTo = (left: number, width: number) => {
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.width = `${width}px`;
    };

    const place = (animate: boolean) => {
      const active = group.querySelector<HTMLElement>('[data-active]');
      if (!active) {
        indicator.style.opacity = '0';
        last.current = null;
        return;
      }
      indicator.style.transition = animate ? '' : 'none';
      indicator.style.opacity = '1';
      moveTo(active.offsetLeft, active.offsetWidth);
      last.current = { left: active.offsetLeft, width: active.offsetWidth };
    };

    // Start from where the pill last was, then slide
    const from = last.current;
    if (from) {
      indicator.style.transition = 'none';
      indicator.style.opacity = '1';
      moveTo(from.left, from.width);
      indicator.getBoundingClientRect();
    }
    place(from !== null);

    // Segment widths change at breakpoints; follow them without animating.
    // The observer fires once on observe, which would cut the slide short.
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (initial) {
        initial = false;
        return;
      }
      place(false);
    });
    observer.observe(group);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { groupRef, indicatorRef };
}
