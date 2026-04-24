/**
 * Hook for observing element resize events with performance optimization
 */

import { useEffect, useRef, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useResizeObserver<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update for next frame (ensures 60fps)
      rafRef.current = requestAnimationFrame(() => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setSize({ width, height });
        }
      });
    });

    observer.observe(element);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}
