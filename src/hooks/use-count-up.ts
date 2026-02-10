import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  duration?: number;
  enabled?: boolean;
}

/**
 * Hook that animates a number counting up from 0 to target value.
 * Uses requestAnimationFrame for smooth animation with easeOutExpo easing.
 *
 * @param target - The final number to animate to
 * @param options - Configuration options
 * @param options.duration - Animation duration in ms (default: 1500)
 * @param options.enabled - Whether to animate (default: true)
 * @returns The current animated number as an integer
 */
export function useCountUp(
  target: number,
  options?: UseCountUpOptions
): number {
  const { duration = 1500, enabled = true } = options || {};

  const [current, setCurrent] = useState(() => enabled ? 0 : 0);
  const animationFrameRef = useRef<number>(0);

  // Easing function: easeOutExpo
  const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };

  useEffect(() => {
    if (!enabled) return;

    // If prefers reduced motion, jump to target
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCurrent(target);
      return;
    }

    let startTime = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.floor(target * easeOutExpo(progress));

      setCurrent(value);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrent(target);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration, enabled]);

  return current;
}
