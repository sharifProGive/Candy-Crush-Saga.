import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

const PERF_MODE_STORAGE_KEY = 'sugar_pop_perf_mode';

let globalLowPerf = false;
let monitorStarted = false;
const listeners = new Set<(low: boolean) => void>();

function readInitialLowPerf(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(PERF_MODE_STORAGE_KEY) === 'low') {
      return true;
    }
  } catch {
    // Ignore storage read errors
  }
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
  }
  return false;
}

function setLowPerf(next: boolean) {
  if (globalLowPerf === next) return;
  globalLowPerf = next;
  for (const listener of listeners) {
    listener(next);
  }
}

function ensureFpsMonitor() {
  if (monitorStarted || typeof window === 'undefined') return;
  monitorStarted = true;
  globalLowPerf = readInitialLowPerf();
  if (globalLowPerf) return;

  // Lightweight rolling FPS guard: if two consecutive 2-second windows average < 38 FPS,
  // automatically disable purely decorative background animations (light beams, drifting clouds, sparkles).
  let windowStart = performance.now();
  let frameCount = 0;
  let consecutiveLowWindows = 0;

  const sample = (now: number) => {
    if (globalLowPerf) return;
    if (document.hidden) {
      windowStart = now;
      frameCount = 0;
      window.requestAnimationFrame(sample);
      return;
    }

    frameCount += 1;
    const elapsed = now - windowStart;
    if (elapsed >= 2000) {
      const fps = (frameCount * 1000) / elapsed;
      if (fps < 38) {
        consecutiveLowWindows += 1;
        if (consecutiveLowWindows >= 2) {
          setLowPerf(true);
          return;
        }
      } else {
        consecutiveLowWindows = 0;
      }
      windowStart = now;
      frameCount = 0;
    }

    window.requestAnimationFrame(sample);
  };

  window.requestAnimationFrame(sample);
}

/**
 * Returns true when decorative animations (clouds, light beams, bokeh drift, sparkles)
 * should be paused to preserve 60fps gameplay on lower-end devices or reduced-motion settings.
 */
export function useLowPerformanceMode(): boolean {
  const [lowPerf, setLocalLowPerf] = useState<boolean>(() => {
    if (!monitorStarted) {
      globalLowPerf = readInitialLowPerf();
    }
    return globalLowPerf;
  });

  useEffect(() => {
    ensureFpsMonitor();
    setLocalLowPerf(globalLowPerf);
    listeners.add(setLocalLowPerf);

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const onMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setLowPerf(true);
    };

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', onMediaChange);
    }

    return () => {
      listeners.delete(setLocalLowPerf);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', onMediaChange);
      }
    };
  }, []);

  return lowPerf;
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
