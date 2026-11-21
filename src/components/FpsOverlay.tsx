import React, { useEffect, useRef } from 'react';
import {
  getPerformanceSnapshot,
  isFpsCounterRequested,
  subscribeEffectsQuality,
} from '../game/performanceGuard';

/**
 * Debug FPS & Effects Quality overlay shown strictly when `?fps=1` is present in the URL.
 * Updates directly via DOM ref every 250ms to cause ZERO React re-renders.
 */
export const FpsOverlay: React.FC = () => {
  const enabled = isFpsCounterRequested();
  const labelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    // Ensure the frame monitor is active while ?fps=1 is open
    const unsub = subscribeEffectsQuality(() => {});

    const update = () => {
      const el = labelRef.current;
      if (!el) return;
      const snap = getPerformanceSnapshot();
      const modeTag =
        snap.userQuality === 'auto'
          ? `AUTO:${snap.effectiveQuality.toUpperCase()}`
          : snap.userQuality.toUpperCase();
      el.textContent = `${snap.fps} FPS · ${snap.avgFrameMs.toFixed(1)}ms · ${modeTag} · P:${snap.liveParticles}`;
    };

    update();
    const timer = window.setInterval(update, 250);
    return () => {
      window.clearInterval(timer);
      unsub();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={labelRef}
      className="pointer-events-none fixed top-2 right-2 z-[9999] rounded-lg bg-[#051224]/88 border border-[#67e8f9]/60 px-2.5 py-1 font-mono text-[11px] font-bold text-[#a5f3fc] shadow-md tabular-nums"
      aria-hidden="true"
    >
      60 FPS · 16.7ms
    </div>
  );
};
