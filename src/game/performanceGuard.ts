import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { EffectsQuality, SETTINGS_STORAGE_KEY } from './settings';

export type EffectiveEffectsQuality = 'high' | 'low';

export interface PerformanceSnapshot {
  fps: number;
  avgFrameMs: number;
  userQuality: EffectsQuality;
  effectiveQuality: EffectiveEffectsQuality;
  liveParticles: number;
}

const FRAME_WINDOW = 10;
const DOWNGRADE_AVG_MS = 24;
const RECOVERY_AVG_MS = 20;
const RECOVERY_HOLD_MS = 2000;

let userQuality: EffectsQuality = readInitialEffectsQuality();
let autoDowngraded = false;
let effectiveQuality: EffectiveEffectsQuality = computeEffectiveQuality();
let monitorRafId: number | null = null;
let fpsDebugEnabled = false;

// Rolling 10-frame ring buffer (zero GC allocations)
const frameDeltas = new Float64Array(FRAME_WINDOW);
let frameIdx = 0;
let frameCount = 0;
let frameSum = 0;
let lastFrameTs = 0;
let goodAccumMs = 0;
let currentAvgMs = 16.67;
let currentFps = 60;
let liveParticlesCount = 0;

const qualityListeners = new Set<(eff: EffectiveEffectsQuality) => void>();

function readInitialEffectsQuality(): EffectsQuality {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { effectsQuality?: unknown };
      if (
        parsed.effectsQuality === 'auto' ||
        parsed.effectsQuality === 'high' ||
        parsed.effectsQuality === 'low'
      ) {
        return parsed.effectsQuality;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return 'auto';
}

function isFpsDebugParamEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('fps') === '1';
  } catch {
    return false;
  }
}

function computeEffectiveQuality(): EffectiveEffectsQuality {
  if (userQuality === 'low') return 'low';
  if (userQuality === 'high') return 'high';
  return autoDowngraded ? 'low' : 'high';
}

function notifyIfChanged() {
  const next = computeEffectiveQuality();
  if (next === effectiveQuality) return;
  effectiveQuality = next;
  for (const listener of qualityListeners) {
    listener(next);
  }
}

function resetFrameWindow() {
  frameIdx = 0;
  frameCount = 0;
  frameSum = 0;
  lastFrameTs = 0;
  goodAccumMs = 0;
}

function shouldRunMonitor(): boolean {
  if (typeof window === 'undefined') return false;
  return userQuality === 'auto' || fpsDebugEnabled;
}

function stopMonitor() {
  if (monitorRafId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(monitorRafId);
    monitorRafId = null;
  }
  lastFrameTs = 0;
}

function ensureMonitor() {
  if (typeof window === 'undefined') return;
  fpsDebugEnabled = isFpsDebugParamEnabled();
  if (!shouldRunMonitor()) {
    stopMonitor();
    return;
  }
  if (monitorRafId !== null) return;

  const tick = (now: number) => {
    if (!shouldRunMonitor()) {
      monitorRafId = null;
      return;
    }

    if (document.hidden) {
      resetFrameWindow();
      monitorRafId = window.requestAnimationFrame(tick);
      return;
    }

    if (lastFrameTs > 0) {
      const dt = now - lastFrameTs;
      // Ignore synthetic gaps from tab switches, modal drags, or OS pauses (>250ms)
      if (dt > 0 && dt < 250) {
        if (frameCount < FRAME_WINDOW) {
          frameDeltas[frameIdx] = dt;
          frameSum += dt;
          frameCount += 1;
        } else {
          frameSum -= frameDeltas[frameIdx];
          frameDeltas[frameIdx] = dt;
          frameSum += dt;
        }
        frameIdx = (frameIdx + 1) % FRAME_WINDOW;

        const avg = frameSum / frameCount;
        currentAvgMs = avg;
        currentFps = avg > 0 ? Math.min(120, Math.round(1000 / avg)) : 60;

        if (userQuality === 'auto' && frameCount >= FRAME_WINDOW) {
          if (!autoDowngraded && avg > DOWNGRADE_AVG_MS) {
            autoDowngraded = true;
            goodAccumMs = 0;
            notifyIfChanged();
          } else if (autoDowngraded) {
            if (avg <= RECOVERY_AVG_MS) {
              goodAccumMs += dt;
              if (goodAccumMs >= RECOVERY_HOLD_MS) {
                autoDowngraded = false;
                goodAccumMs = 0;
                notifyIfChanged();
              }
            } else {
              goodAccumMs = 0;
            }
          }
        }
      } else {
        resetFrameWindow();
      }
    }

    lastFrameTs = now;
    monitorRafId = window.requestAnimationFrame(tick);
  };

  monitorRafId = window.requestAnimationFrame(tick);
}

export function setEffectsQualityPreference(next: EffectsQuality): void {
  userQuality = next;
  if (next !== 'auto') {
    autoDowngraded = false;
    goodAccumMs = 0;
  } else {
    resetFrameWindow();
  }
  notifyIfChanged();
  ensureMonitor();
}

export function getEffectiveEffectsQuality(): EffectiveEffectsQuality {
  return effectiveQuality;
}

export function getUserEffectsQuality(): EffectsQuality {
  return userQuality;
}

export function reportLiveParticleCount(count: number): void {
  liveParticlesCount = count;
}

export function getPerformanceSnapshot(): PerformanceSnapshot {
  return {
    fps: currentFps,
    avgFrameMs: currentAvgMs,
    userQuality,
    effectiveQuality,
    liveParticles: liveParticlesCount,
  };
}

export function subscribeEffectsQuality(
  listener: (eff: EffectiveEffectsQuality) => void
): () => void {
  ensureMonitor();
  qualityListeners.add(listener);
  return () => {
    qualityListeners.delete(listener);
  };
}

export function isFpsCounterRequested(): boolean {
  return isFpsDebugParamEnabled();
}

/**
 * React hook returning the live effective effects quality ('high' | 'low').
 * Automatically downgrades to 'low' when 10 consecutive frames average > 24ms,
 * and restores to 'high' after 2 seconds of smooth frames (in 'auto' mode).
 */
export function useEffectiveEffectsQuality(): EffectiveEffectsQuality {
  const [eff, setEff] = useState<EffectiveEffectsQuality>(() => effectiveQuality);

  useEffect(() => {
    ensureMonitor();
    setEff(effectiveQuality);
    return subscribeEffectsQuality(setEff);
  }, []);

  return eff;
}

/**
 * Separate hook for OS prefers-reduced-motion so gameplay transitions stay smooth
 * without abruptly cutting off while purely decorative motion pauses properly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

/**
 * Returns true when decorative background animations (clouds, swaying trees, bokeh, shafts)
 * should pause to preserve 60fps or respect prefers-reduced-motion.
 */
export function useLowPerformanceMode(): boolean {
  const eff = useEffectiveEffectsQuality();
  const reduced = usePrefersReducedMotion();
  return eff === 'low' || reduced;
}

/**
 * Hides the native Android/iOS status bar on startup for an immersive fullscreen experience.
 * Safe no-op on standard desktop/mobile web browsers.
 */
export async function initFullscreenStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.hide();
  } catch {
    // Ignore on platforms where StatusBar plugin is unavailable
  }
}
