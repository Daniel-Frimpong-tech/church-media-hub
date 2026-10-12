"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up to its value when it first appears. Purely a
 * flourish: the real value is in the markup from the start for screen readers,
 * and people who ask for reduced motion see it immediately.
 */
export function CountUp({
  value,
  format,
  durationMs = 900,
}: {
  value: number;
  /** Turns the in-between number into text, e.g. adding "%" or compacting. */
  format?: (value: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (
      value === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const progress = Math.min((time - start) / durationMs, 1);
      // Ease out: fast at first, settling at the end.
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  const text = (n: number) => (format ? format(n) : n.toLocaleString("en-US"));

  return (
    <>
      <span aria-hidden>{text(shown)}</span>
      <span className="sr-only">{text(value)}</span>
    </>
  );
}
