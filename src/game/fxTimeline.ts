/**
 * Central choreography timing configuration (base values in milliseconds).
 * Every delay and animation duration scales via `scaleTiming(baseMs, fxSpeed)`.
 */
export const FX_TIMING = {
  // Swap
  swapDuration: 180,

  // Regular 3-match pop: swell 1.0 -> 1.2 (120ms), then shrink & vanish (140ms) = 260ms
  popSwellDuration: 120,
  popShrinkDuration: 140,
  popTotalDuration: 260,
  /** Pop-to-drop gap set to 0ms so upper candies never wait behind empty cells */
  postPopPause: 0,
  /** Drop overlaps pop ~90ms after pop start (at peak swell, 80-100ms window) */
  popDropOverlapDelay: 90,
  /** Soft white radial canvas flash duration covering each popping cell */
  popFlashDuration: 120,

  // Drop & Cascade
  dropFirstRow: 260,
  dropPerExtraRow: 70,
  cascadeGap: 180,

  // 4+ match Special Forging
  specialForgePopDuration: 300,
  specialSpawnDuration: 350,

  // Staggered Clear Order
  staggerSmallStep: 40, // <= 6 candies
  staggerLargeStep: 25, // > 6 candies
  staggerMaxTotal: 300,
  popSoundThrottle: 40, // max 1 pop sound per 40ms

  // Striped Candy Sequence
  stripedPulseDuration: 250,
  stripedBeamPerCell: 45, // ~360ms across 8 cells; ~600-700ms total

  // Wrapped Candy Sequence
  wrappedPulseDuration: 300,
  wrappedShockwaveDuration: 350,
  wrappedDistanceStagger: 60,

  // Color Bomb Sequence
  colorBombShakeDuration: 250,
  colorBombRayStagger: 60,
  colorBombRayMaxStagger: 600,
  colorBombTargetGlowDelay: 200,

  // Special-to-Special Chain Delay (parentStart + dist * stagger + 80ms)
  chainTriggerDelay: 80,
} as const;

let slowMoEnabled = false;

export function setSlowMoEffects(enabled: boolean): void {
  slowMoEnabled = enabled;
}

export function isSlowMoEffectsEnabled(): boolean {
  return slowMoEnabled;
}

export interface FxSpeedContext {
  clearedCount?: number;
  isSpecialCombo?: boolean;
  cascadeDepth?: number;
}

/**
 * Computes event-driven fxSpeed multiplier:
 * - Single regular event: 1.0
 * - >10 candies cleared at once: 1.15
 * - Special + Special combo swap: 1.2
 * - Cascade depth past 4 (> 4): 1.15
 * Clamped strictly to [1.0, 1.3], and halved to 0.5x when debug Slow-mo toggle is enabled.
 */
export function computeFxSpeed(ctx: FxSpeedContext = {}): number {
  let speed = 1.0;

  if (ctx.isSpecialCombo) {
    speed = Math.max(speed, 1.2);
  }
  if ((ctx.clearedCount ?? 0) > 10) {
    speed = Math.max(speed, 1.15);
  }
  if ((ctx.cascadeDepth ?? 0) > 4) {
    speed = Math.max(speed, 1.15);
  }
  // Small additive boost only when multiple big conditions overlap, still strictly <= 1.3
  if (ctx.isSpecialCombo && (ctx.clearedCount ?? 0) > 10) {
    speed = Math.max(speed, 1.25);
  }
  if ((ctx.cascadeDepth ?? 0) > 4 && ((ctx.clearedCount ?? 0) > 10 || ctx.isSpecialCombo)) {
    speed = 1.3;
  }

  const clamped = Math.min(1.3, Math.max(1.0, speed));
  return slowMoEnabled ? clamped * 0.5 : clamped;
}

export function scaleTiming(baseMs: number, fxSpeed: number): number {
  const safeSpeed = fxSpeed > 0 ? fxSpeed : 1.0;
  return Math.max(16, Math.round(baseMs / safeSpeed));
}

export function computeDropDurationMs(rowsToTravel: number, fxSpeed: number): number {
  const extraRows = Math.max(0, rowsToTravel - 1);
  const base = FX_TIMING.dropFirstRow + extraRows * FX_TIMING.dropPerExtraRow;
  return scaleTiming(base, fxSpeed);
}

export interface TimelineTask {
  startTime: number; // ms relative to timeline start
  run: () => void;
}

/**
 * Single requestAnimationFrame + deltaTime choreography runner.
 * Guarantees chronological execution order even if frames drop, without setTimeout chains.
 */
export class FxTimeline {
  private rafId: number | null = null;
  private cancelled = false;
  private activeResolve: (() => void) | null = null;

  public cancel(): void {
    this.cancelled = true;
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.activeResolve) {
      const r = this.activeResolve;
      this.activeResolve = null;
      r();
    }
  }

  /**
   * Executes scheduled tasks strictly in startTime order on a single rAF deltaTime clock,
   * resolving once elapsed time >= totalDurationMs and all tasks have fired.
   */
  public runSequence(tasks: TimelineTask[], totalDurationMs: number): Promise<void> {
    this.cancel();
    this.cancelled = false;

    const ordered = tasks
      .map((t, idx) => ({ startTime: Math.max(0, t.startTime), idx, run: t.run }))
      .sort((a, b) => (a.startTime !== b.startTime ? a.startTime - b.startTime : a.idx - b.idx));

    const endMs = Math.max(
      totalDurationMs,
      ordered.length > 0 ? ordered[ordered.length - 1].startTime : 0
    );

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      for (const item of ordered) item.run();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.activeResolve = resolve;
      let cursor = 0;
      let elapsedMs = 0;
      let lastTs = performance.now();

      // Fire any t=0 tasks immediately on the initial frame
      while (cursor < ordered.length && ordered[cursor].startTime <= 0) {
        ordered[cursor].run();
        cursor += 1;
      }

      if (endMs <= 0 && cursor >= ordered.length) {
        this.activeResolve = null;
        resolve();
        return;
      }

      const tick = (now: number) => {
        if (this.cancelled) {
          this.rafId = null;
          return;
        }

        // Clamp deltaTime so tab switches or hiccups preserve exact event order
        const rawDt = now - lastTs;
        const dt = rawDt > 0 ? Math.min(rawDt, 50) : 16.67;
        lastTs = now;
        elapsedMs += dt;

        while (cursor < ordered.length && ordered[cursor].startTime <= elapsedMs) {
          ordered[cursor].run();
          cursor += 1;
        }

        if (cursor >= ordered.length && elapsedMs >= endMs) {
          this.rafId = null;
          this.activeResolve = null;
          resolve();
          return;
        }

        this.rafId = window.requestAnimationFrame(tick);
      };

      this.rafId = window.requestAnimationFrame(tick);
    });
  }

  /** DeltaTime rAF wait helper (replaces setTimeout pauses in choreography) */
  public wait(durationMs: number): Promise<void> {
    if (durationMs <= 0) return Promise.resolve();
    return this.runSequence([], durationMs);
  }
}
