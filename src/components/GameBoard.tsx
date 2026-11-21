import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Hammer,
  Lock,
  Map as MapIcon,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  Settings,
  Shuffle,
  Star,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { preloadAllCandySprites } from '../game/candySprites';
import { PlayerInventory } from '../game/dailyRewards';
import {
  computeFxSpeed,
  FX_TIMING,
  FxTimeline,
  scaleTiming,
  TimelineTask,
} from '../game/fxTimeline';
import { CANDY_HEX, LEVELS } from '../game/levels';
import {
  applyGravityAndRefill,
  ClearResolution,
  createInitialGrid,
  findMatchClusters,
  findValidMove,
  GRID_SIZE,
  isAdjacent,
  isSpecialComboSwap,
  nextCandyId,
  resolveDestructionChain,
  resolveSpecialSwapCombo,
  shuffleGrid,
} from '../game/matchEngine';
import {
  useLowPerformanceMode,
  usePrefersReducedMotion,
} from '../game/performanceGuard';
import {
  CandyColor,
  Grid,
  LevelConfig,
  PlayModalState,
  Position,
  PraiseWord,
  SpecialType,
} from '../game/types';
import { CandySprite } from './CandySprite';
import { CandyTile } from './CandyTile';
import { PraiseBanner, PraiseBannerHandle } from './PraiseBanner';
import { VfxCanvas, VfxCanvasHandle } from './VfxCanvas';

interface GameBoardProps {
  level: LevelConfig;
  backgroundMusicEnabled: boolean;
  inventory: PlayerInventory;
  initialExtraMoves?: number;
  initialHammerArmed?: boolean;
  initialOpeningShuffle?: boolean;
  onConsumeBooster: (type: keyof PlayerInventory) => boolean;
  onOpenSettings: () => void;
  onLevelComplete: (levelId: number, score: number, stars: number) => void;
  onNextLevel: () => void;
  onBackToMap: () => void;
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

function waitAnimations(anims: Animation[], fallbackMs: number): Promise<void> {
  if (anims.length === 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, fallbackMs + 160);
    Promise.allSettled(anims.map((a) => a.finished)).then(done);
  });
}

/** Shallow row-level copy of the 8x8 matrix that preserves all untouched CandyPiece object refs */
function shallowGridCopy(g: Grid): Grid {
  return g.map((row) => row.slice());
}

const BOKEH_DOTS: Array<{
  top: string;
  left: string;
  size: number;
  opacity: number;
  delay: string;
}> = [
  { top: '14%', left: '12%', size: 96, opacity: 0.22, delay: '0s' },
  { top: '22%', left: '78%', size: 120, opacity: 0.18, delay: '-2.2s' },
  { top: '68%', left: '8%', size: 110, opacity: 0.16, delay: '-4.5s' },
  { top: '76%', left: '84%', size: 88, opacity: 0.2, delay: '-1.5s' },
  { top: '44%', left: '88%', size: 68, opacity: 0.15, delay: '-3.1s' },
];

export const GameBoard: React.FC<GameBoardProps> = ({
  level,
  backgroundMusicEnabled,
  inventory,
  initialExtraMoves = 0,
  initialHammerArmed = false,
  initialOpeningShuffle = false,
  onConsumeBooster,
  onOpenSettings,
  onLevelComplete,
  onNextLevel,
  onBackToMap,
}) => {
  const lowPerf = useLowPerformanceMode();
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [grid, setGrid] = useState<Grid>(() => createInitialGrid(level.colorsCount));
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(level.moves + initialExtraMoves);
  const [orderCollected, setOrderCollected] = useState(0);
  const [modalState, setModalState] = useState<PlayModalState>('NONE');
  const [selected, setSelected] = useState<Position | null>(null);
  const [hintPair, setHintPair] = useState<[Position, Position] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hammerActive, setHammerActive] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const vfxRef = useRef<VfxCanvasHandle | null>(null);
  const praiseRef = useRef<PraiseBannerHandle | null>(null);
  const timelineRef = useRef<FxTimeline>(new FxTimeline());
  const tileElsRef = useRef<(HTMLDivElement | null)[]>(new Array(GRID_SIZE * GRID_SIZE).fill(null));
  const pendingDropAnimsRef = useRef<Animation[]>([]);
  const dragStartRef = useRef<{ row: number; col: number; x: number; y: number } | null>(null);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const orderRef = useRef(orderCollected);
  orderRef.current = orderCollected;
  const movesRef = useRef(movesLeft);
  movesRef.current = movesLeft;
  const modalRef = useRef(modalState);
  modalRef.current = modalState;
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;
  const hammerActiveRef = useRef(hammerActive);
  hammerActiveRef.current = hammerActive;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const isMountedRef = useRef(true);
  const runIdRef = useRef(0);

  // Preload rasterized candy sprites once at board mount
  useEffect(() => {
    void preloadAllCandySprites();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const timeline = timelineRef.current;
    const clearDrag = () => {
      dragStartRef.current = null;
    };
    window.addEventListener('pointerup', clearDrag);
    window.addEventListener('pointercancel', clearDrag);
    return () => {
      isMountedRef.current = false;
      runIdRef.current += 1;
      timeline.cancel();
      window.removeEventListener('pointerup', clearDrag);
      window.removeEventListener('pointercancel', clearDrag);
    };
  }, []);

  const registerTileEl = useCallback((row: number, col: number, el: HTMLDivElement | null) => {
    tileElsRef.current[row * GRID_SIZE + col] = el;
  }, []);

  const registerDropAnim = useCallback((anim: Animation) => {
    pendingDropAnimsRef.current.push(anim);
  }, []);

  /** Imperative WAAPI board shake (zero React re-renders, disabled under reduced motion) */
  const triggerShake = useCallback(() => {
    if (reducedMotionRef.current) return;
    const el = boardFrameRef.current;
    if (!el || typeof el.animate !== 'function') return;
    el.style.willChange = 'transform';
    const anim = el.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(-5px, 4px, 0)' },
        { transform: 'translate3d(5px, -4px, 0)' },
        { transform: 'translate3d(-4px, -3px, 0)' },
        { transform: 'translate3d(4px, 3px, 0)' },
        { transform: 'translate3d(-2px, 2px, 0)' },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      {
        duration: 280,
        easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      }
    );
    const cleanup = () => {
      if (boardFrameRef.current) {
        boardFrameRef.current.style.willChange = '';
      }
    };
    anim.finished.then(cleanup, cleanup);
  }, []);

  /**
   * Executes a chronological ClearResolution on the single rAF deltaTime FxTimeline AND overlaps
   * per-column gravity drops right at peak pop swell (~90ms after pop start, 0ms pop-to-drop gap):
   * - Special candy pulses, directional beams, wrapped shockwaves, color bomb shake + rays
   * - Distance-staggered pop with soft white ~120ms radial canvas flash covering popping cells
   * - Rising-pitch per-candy pop sound (throttled max 1 per 40ms)
   * - Each affected column begins dropping seamlessly ~90ms after its last pop starts (no empty gaps!)
   */
  const playClearAndOverlapDrop = useCallback(
    async (
      startingGrid: Grid,
      resolution: ClearResolution,
      spawns: Array<{ pos: Position; color: CandyColor; special: SpecialType }>,
      fxSpeed: number,
      cascadeDropPitch: number
    ): Promise<Grid> => {
      if (resolution.clearedKeys.size === 0 && spawns.length === 0) {
        return startingGrid;
      }

      const reduced = reducedMotionRef.current;
      const isMassiveBlast = resolution.clearedKeys.size > 8;
      const tasks: TimelineTask[] = [];
      const touchedEls = new Set<HTMLDivElement>();

      // Pre-compute deterministic post-clear, post-gravity target grid (column-independent)
      const afterClear = shallowGridCopy(startingGrid);
      for (const key of resolution.clearedKeys) {
        const [r, c] = key.split(',').map(Number);
        afterClear[r][c] = null;
      }
      for (const sp of spawns) {
        afterClear[sp.pos.row][sp.pos.col] = {
          id: nextCandyId(),
          color: sp.color,
          special: sp.special,
          isNew: false,
          dropRows: 0,
          isForgedSpecial: true,
          fxSpeed,
        };
      }
      const refilledGrid = applyGravityAndRefill(afterClear, level.colorsCount, fxSpeed);

      // Track affected columns and the latest pop start time in each column
      const affectedCols = new Set<number>();
      const colMaxPopStart = new Array<number>(GRID_SIZE).fill(-1);
      for (const key of resolution.clearedKeys) {
        const [, c] = key.split(',').map(Number);
        affectedCols.add(c);
      }
      for (const sp of spawns) {
        affectedCols.add(sp.pos.col);
      }
      for (let i = 0; i < resolution.timelineSteps.length; i++) {
        const step = resolution.timelineSteps[i];
        if (step.kind === 'candy-pop') {
          affectedCols.add(step.col);
          if (step.timeMs > colMaxPopStart[step.col]) {
            colMaxPopStart[step.col] = step.timeMs;
          }
        }
      }

      // If >8 candies pop, emit one big compensating shockwave at the centroid
      if (isMassiveBlast && resolution.timelineSteps.length > 0) {
        let sumR = 0;
        let sumC = 0;
        let count = 0;
        let sampleColor: CandyColor = 'yellow';
        for (const step of resolution.timelineSteps) {
          if (step.kind === 'candy-pop') {
            if (count === 0) sampleColor = step.color;
            sumR += step.row;
            sumC += step.col;
            count += 1;
          }
        }
        if (count > 0) {
          const avgRow = sumR / count;
          const avgCol = sumC / count;
          tasks.push({
            startTime: scaleTiming(60, fxSpeed),
            run: () => {
              vfxRef.current?.emitEvents([
                {
                  type: 'shockwave',
                  row: avgRow,
                  col: avgCol,
                  color: sampleColor,
                  radius: 3.1,
                  durationMs: scaleTiming(FX_TIMING.wrappedShockwaveDuration, fxSpeed),
                },
              ]);
            },
          });
        }
      }

      for (let i = 0; i < resolution.timelineSteps.length; i++) {
        const step = resolution.timelineSteps[i];
        const startMs = scaleTiming(step.timeMs, fxSpeed);

        if (step.kind === 'special-pulse') {
          const durMs = scaleTiming(step.durationMs, fxSpeed);
          tasks.push({
            startTime: startMs,
            run: () => {
              soundEngine.vibrate(20);
              if (step.special === 'wrapped') {
                soundEngine.playWrapped();
              } else {
                soundEngine.playStriped();
              }
              vfxRef.current?.emitEvents([
                {
                  type: 'special-glow',
                  row: step.row,
                  col: step.col,
                  color: step.color,
                  radius: step.special === 'wrapped' ? 1.8 : 1.5,
                  durationMs: durMs,
                },
              ]);
              const el = tileElsRef.current[step.row * GRID_SIZE + step.col];
              if (el && typeof el.animate === 'function') {
                el.style.willChange = 'transform';
                touchedEls.add(el);
                el.animate(
                  reduced
                    ? [
                        { transform: 'translate3d(0,0,0) scale(1)' },
                        { transform: 'translate3d(0,0,0) scale(1.08)' },
                      ]
                    : [
                        { transform: 'translate3d(0,0,0) scale(1)' },
                        { transform: 'translate3d(0,0,0) scale(1.15)', offset: 0.45 },
                        { transform: 'translate3d(0,0,0) scale(1.06)', offset: 0.72 },
                        { transform: 'translate3d(0,0,0) scale(1.18)' },
                      ],
                  {
                    duration: durMs,
                    easing: 'ease-in-out',
                    fill: 'forwards',
                  }
                );
              }
            },
          });
        } else if (step.kind === 'striped-beam') {
          const scaledPerCell = scaleTiming(step.perCellMs, fxSpeed);
          tasks.push({
            startTime: startMs,
            run: () => {
              triggerShake();
              vfxRef.current?.emitEvents([
                step.horizontal
                  ? {
                      type: 'beam-h',
                      row: step.row,
                      originCol: step.col,
                      color: step.color,
                      perCellMs: scaledPerCell,
                    }
                  : {
                      type: 'beam-v',
                      col: step.col,
                      originRow: step.row,
                      color: step.color,
                      perCellMs: scaledPerCell,
                    },
              ]);
            },
          });
        } else if (step.kind === 'wrapped-shockwave') {
          const durMs = scaleTiming(step.durationMs, fxSpeed);
          tasks.push({
            startTime: startMs,
            run: () => {
              triggerShake();
              soundEngine.vibrate([24, 30, 36]);
              vfxRef.current?.emitEvents([
                {
                  type: 'shockwave',
                  row: step.row,
                  col: step.col,
                  color: step.color,
                  radius: step.radius,
                  durationMs: durMs,
                },
              ]);
            },
          });
        } else if (step.kind === 'bomb-shake') {
          const durMs = scaleTiming(step.durationMs, fxSpeed);
          tasks.push({
            startTime: startMs,
            run: () => {
              soundEngine.playColorBomb();
              soundEngine.vibrate([24, 30, 36]);
              triggerShake();
              vfxRef.current?.emitEvents([
                {
                  type: 'special-glow',
                  row: step.row,
                  col: step.col,
                  color: step.color,
                  radius: 2.3,
                  durationMs: durMs + 140,
                },
              ]);
              const el = tileElsRef.current[step.row * GRID_SIZE + step.col];
              if (el && typeof el.animate === 'function') {
                el.style.willChange = 'transform';
                touchedEls.add(el);
                el.animate(
                  reduced
                    ? [
                        { transform: 'translate3d(0,0,0) scale(1)' },
                        { transform: 'translate3d(0,0,0) scale(1.12)' },
                      ]
                    : [
                        { transform: 'translate3d(0, 0, 0) scale(1.06)' },
                        { transform: 'translate3d(-4px, 3px, 0) scale(1.14)', offset: 0.2 },
                        { transform: 'translate3d(4px, -3px, 0) scale(1.16)', offset: 0.4 },
                        { transform: 'translate3d(-4px, -2px, 0) scale(1.15)', offset: 0.6 },
                        { transform: 'translate3d(4px, 2px, 0) scale(1.18)', offset: 0.8 },
                        { transform: 'translate3d(0, 0, 0) scale(1.16)' },
                      ],
                  {
                    duration: durMs,
                    easing: 'ease-in-out',
                    fill: 'forwards',
                  }
                );
              }
            },
          });
        } else if (step.kind === 'bomb-ray') {
          const glowDurMs = scaleTiming(step.glowDurationMs, fxSpeed);
          const rayDurMs = glowDurMs + scaleTiming(100, fxSpeed);
          tasks.push({
            startTime: startMs,
            run: () => {
              vfxRef.current?.emitEvents([
                {
                  type: 'lightning',
                  fromRow: step.fromRow,
                  fromCol: step.fromCol,
                  toRow: step.toRow,
                  toCol: step.toCol,
                  color: step.color,
                  durationMs: rayDurMs,
                },
                {
                  type: 'special-glow',
                  row: step.toRow,
                  col: step.toCol,
                  color: step.color,
                  radius: 1.25,
                  durationMs: glowDurMs,
                },
              ]);
              // Target candy lights up / swells slightly while charged before popping 200ms later
              const el = tileElsRef.current[step.toRow * GRID_SIZE + step.toCol];
              if (el && typeof el.animate === 'function') {
                el.style.willChange = 'transform';
                touchedEls.add(el);
                el.animate(
                  [
                    { transform: 'translate3d(0,0,0) scale(1)' },
                    { transform: 'translate3d(0,0,0) scale(1.14)' },
                  ],
                  {
                    duration: glowDurMs,
                    easing: 'ease-out',
                    fill: 'forwards',
                  }
                );
              }
            },
          });
        } else if (step.kind === 'candy-pop') {
          const popDurMs = scaleTiming(step.popDurationMs, fxSpeed);
          const swellOffset = Math.min(
            0.55,
            Math.max(0.38, FX_TIMING.popSwellDuration / FX_TIMING.popTotalDuration)
          );
          const pan = ((step.col / (GRID_SIZE - 1)) - 0.5) * 0.9;
          // Soft white ~120ms radial flash bridges pop to incoming falling candy (extended gently if same column has later pops)
          const colWaitMs = Math.max(0, colMaxPopStart[step.col] - step.timeMs);
          const baseFlashMs = Math.min(
            260,
            Math.max(FX_TIMING.popFlashDuration, colWaitMs + FX_TIMING.popDropOverlapDelay + 40)
          );
          const flashDurMs = scaleTiming(baseFlashMs, fxSpeed);

          tasks.push({
            startTime: startMs,
            run: () => {
              soundEngine.playCandyPop(step.pitchStep, pan);
              vfxRef.current?.emitEvents([
                {
                  type: 'pop-flash',
                  row: step.row,
                  col: step.col,
                  durationMs: flashDurMs,
                },
                {
                  type: 'burst',
                  row: step.row,
                  col: step.col,
                  color: step.color,
                  count: step.burstCount,
                  massiveBlast: isMassiveBlast,
                },
              ]);

              const el = tileElsRef.current[step.row * GRID_SIZE + step.col];
              if (el && typeof el.animate === 'function') {
                el.style.willChange = 'transform, opacity';
                touchedEls.add(el);
                el.animate(
                  reduced
                    ? [
                        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
                        { transform: 'translate3d(0, 0, 0) scale(0.85)', opacity: 0 },
                      ]
                    : [
                        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
                        {
                          transform: 'translate3d(0, -2px, 0) scale(1.2)',
                          opacity: 1,
                          offset: swellOffset,
                        },
                        { transform: 'translate3d(0, -4px, 0) scale(0.18)', opacity: 0 },
                      ],
                  {
                    duration: reduced ? Math.round(popDurMs * 0.55) : popDurMs,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    fill: 'forwards',
                  }
                );
              }
            },
          });
        }
      }

      // Group affected columns by their exact drop trigger time (popStart + 90ms overlap + 0ms postPopPause)
      const colDropGroups = new Map<number, number[]>();
      let maxDropTriggerMs = 0;
      for (const col of affectedCols) {
        const lastPopBase = colMaxPopStart[col] >= 0 ? colMaxPopStart[col] : 0;
        const dropAtMs = scaleTiming(
          lastPopBase + FX_TIMING.popDropOverlapDelay + FX_TIMING.postPopPause,
          fxSpeed
        );
        maxDropTriggerMs = Math.max(maxDropTriggerMs, dropAtMs);
        const list = colDropGroups.get(dropAtMs);
        if (list) {
          list.push(col);
        } else {
          colDropGroups.set(dropAtMs, [col]);
        }
      }

      let workingDisplayGrid = shallowGridCopy(startingGrid);
      let playedDropSound = false;
      pendingDropAnimsRef.current = [];

      for (const [dropAtMs, cols] of colDropGroups.entries()) {
        tasks.push({
          startTime: dropAtMs,
          run: () => {
            workingDisplayGrid = shallowGridCopy(workingDisplayGrid);
            for (const c of cols) {
              for (let r = 0; r < GRID_SIZE; r++) {
                workingDisplayGrid[r][c] = refilledGrid[r][c];
              }
            }
            setGrid(workingDisplayGrid);

            if (!playedDropSound) {
              playedDropSound = true;
              soundEngine.playCascadeDrop(cascadeDropPitch);
            }

            for (const sp of spawns) {
              if (cols.includes(sp.pos.col)) {
                vfxRef.current?.emitEvents([
                  {
                    type: 'special-glow',
                    row: sp.pos.row,
                    col: sp.pos.col,
                    color: sp.color,
                    radius: 1.75,
                    durationMs: scaleTiming(FX_TIMING.specialSpawnDuration, fxSpeed),
                  },
                ]);
              }
            }
          },
        });
      }

      // Run all timeline steps + overlapping per-column drops in strict chronological order
      await timelineRef.current.runSequence(tasks, maxDropTriggerMs);

      // Ensure final column's CandyTile useLayoutEffect registers its drop/forge animations
      await nextFrame();
      const anims = pendingDropAnimsRef.current;
      pendingDropAnimsRef.current = [];
      const fallbackMs = scaleTiming(
        FX_TIMING.dropFirstRow + 5 * FX_TIMING.dropPerExtraRow,
        fxSpeed
      );
      if (anims.length > 0) {
        await waitAnimations(anims, fallbackMs);
      }

      for (const el of touchedEls) {
        el.style.willChange = '';
      }

      return refilledGrid;
    },
    [level.colorsCount, triggerShake]
  );

  /** Commits a new grid and awaits the actual WAAPI drop/forge animations triggered by CandyTile */
  const commitDropAndWait = useCallback(async (nextGrid: Grid, fxSpeed: number) => {
    pendingDropAnimsRef.current = [];
    setGrid(nextGrid);
    await nextFrame();
    const anims = pendingDropAnimsRef.current;
    pendingDropAnimsRef.current = [];
    const fallbackMs = scaleTiming(FX_TIMING.dropFirstRow + 3 * FX_TIMING.dropPerExtraRow, fxSpeed);
    if (anims.length > 0) {
      await waitAnimations(anims, fallbackMs);
    }
  }, []);

  // Reset board cleanly whenever level changes (preserving any pre-selected start boosters on initial mount)
  const appliedStartBoostRef = useRef(false);
  const resetLevel = useCallback(
    (applyInitialBoosts = false) => {
      runIdRef.current += 1;
      timelineRef.current.cancel();
      vfxRef.current?.clear();
      praiseRef.current?.clear();
      pendingDropAnimsRef.current = [];
      const baseGrid = createInitialGrid(level.colorsCount);
      const openingGrid =
        applyInitialBoosts && initialOpeningShuffle
          ? shuffleGrid(baseGrid, level.colorsCount, computeFxSpeed())
          : baseGrid;
      setGrid(openingGrid);
      setScore(0);
      setMovesLeft(level.moves + (applyInitialBoosts ? initialExtraMoves : 0));
      setOrderCollected(0);
      setModalState('NONE');
      setSelected(null);
      setHintPair(null);
      setIsBusy(false);
      setHammerActive(Boolean(applyInitialBoosts && initialHammerArmed && inventory.hammers > 0));
      if (applyInitialBoosts && initialOpeningShuffle) {
        const myRun = runIdRef.current;
        setStatusBanner('Opening Shuffle Boost Active!');
        window.setTimeout(() => {
          if (isMountedRef.current && myRun === runIdRef.current) {
            setStatusBanner(null);
          }
        }, 900);
      } else {
        setStatusBanner(null);
      }
    },
    [level, initialExtraMoves, initialHammerArmed, initialOpeningShuffle, inventory.hammers]
  );

  useEffect(() => {
    const shouldApplyBoosts = !appliedStartBoostRef.current;
    appliedStartBoostRef.current = true;
    resetLevel(shouldApplyBoosts);
  }, [level.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause/resume gameplay music when Pause Modal is opened/closed
  useEffect(() => {
    if (modalState === 'PAUSED') {
      soundEngine.pauseMusic();
    } else if (modalState === 'NONE' && backgroundMusicEnabled) {
      soundEngine.resumeMusic();
    }
  }, [modalState, backgroundMusicEnabled]);

  // Escape key pauses/resumes gameplay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalRef.current === 'NONE') {
          setModalState('PAUSED');
        } else if (modalRef.current === 'PAUSED') {
          setModalState('NONE');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Idle Hint Timer (4.2s)
  useEffect(() => {
    if (isBusy || modalState !== 'NONE') {
      setHintPair(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const move = findValidMove(gridRef.current);
      if (move) setHintPair(move);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [grid, isBusy, modalState]);

  /** Draws floating score directly onto the single pooled VFX canvas (zero DOM/state churn) */
  const emitFloatingScore = useCallback((row: number, col: number, points: number, hexColor: string) => {
    vfxRef.current?.emitEvents([
      {
        type: 'float-score',
        row,
        col,
        text: `+${points}`,
        color: hexColor,
      },
    ]);
  }, []);

  /** Imperative single-instance PraiseBanner (zero board re-renders) */
  const showPraise = useCallback((word: PraiseWord) => {
    const spoken = soundEngine.playPraise(word);
    if (!spoken && word !== 'Sugar Crush!') return;
    praiseRef.current?.show(word, reducedMotionRef.current);
  }, []);

  const computeStars = (finalScore: number): number => {
    if (finalScore >= level.starScores[2]) return 3;
    if (finalScore >= level.starScores[1]) return 2;
    if (finalScore >= level.starScores[0]) return 1;
    return 0;
  };

  const checkWinOrLoss = useCallback(
    async (
      currentGrid: Grid,
      latestScore: number,
      latestOrder: number,
      remainingMoves: number,
      myRun: number
    ) => {
      const orderMet = !level.order || latestOrder >= level.order.target;
      const scoreMet = latestScore >= level.targetScore;

      if (orderMet && scoreMet) {
        // Major Level Milestone: Sugar Crush Finale!
        setIsBusy(true);
        soundEngine.vibrate([30, 40, 30, 40, 60]);
        showPraise('Sugar Crush!');
        if (remainingMoves > 0) {
          let working = shallowGridCopy(currentGrid);
          const regularCells: Position[] = [];
          const fallbackCells: Position[] = [];
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              const cell = working[r][c];
              if (cell) {
                fallbackCells.push({ row: r, col: c });
                if (cell.special === 'none') {
                  regularCells.push({ row: r, col: c });
                }
              }
            }
          }

          const pool = regularCells.length >= Math.min(remainingMoves, 10) ? regularCells : fallbackCells;
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }

          const convertCount = Math.min(remainingMoves, 10, pool.length);
          const targets = pool.slice(0, convertCount);
          let remMovesDisplay = remainingMoves;
          let runningScore = latestScore;
          const finaleSpeed = computeFxSpeed({ isSpecialCombo: true });

          // Step 1: Count remaining moves down while forging Striped Candies on the board
          for (let i = 0; i < targets.length; i++) {
            const pos = targets[i];
            const cell = working[pos.row][pos.col];
            if (!cell) continue;
            working = shallowGridCopy(working);
            working[pos.row][pos.col] = {
              ...cell,
              special: i % 2 === 0 ? 'striped-h' : 'striped-v',
              isNew: false,
              dropRows: 0,
              isForgedSpecial: true,
              fxSpeed: finaleSpeed,
            };
            remMovesDisplay = Math.max(0, remMovesDisplay - 1);
            runningScore += 150;
            setMovesLeft(remMovesDisplay);
            setScore(runningScore);
            setGrid(working);
            soundEngine.playTap();
            vfxRef.current?.emitEvents([
              { type: 'burst', row: pos.row, col: pos.col, color: cell.color, count: 3 },
              {
                type: 'special-glow',
                row: pos.row,
                col: pos.col,
                color: cell.color,
                radius: 1.5,
                durationMs: scaleTiming(FX_TIMING.specialSpawnDuration, finaleSpeed),
              },
            ]);
            await timelineRef.current.wait(scaleTiming(95, finaleSpeed));
            if (!isMountedRef.current || myRun !== runIdRef.current) return;
          }

          const extraMoves = Math.max(0, remMovesDisplay);
          if (extraMoves > 0) {
            runningScore += extraMoves * 150;
            setMovesLeft(0);
            setScore(runningScore);
          }

          // Step 2: Sequentially detonate the converted Striped Candies with full choreography
          for (const pos of targets) {
            const targetCell = working[pos.row][pos.col];
            if (!targetCell) continue;
            const res = resolveDestructionChain(working, [pos], new Set(), { originPos: pos });
            const stepSpeed = computeFxSpeed({
              clearedCount: res.clearedKeys.size,
              isSpecialCombo: true,
            });
            const stepPoints = res.clearedKeys.size * 30 + res.bonusScore;
            runningScore += stepPoints;
            setScore(runningScore);
            emitFloatingScore(pos.row, pos.col, stepPoints, '#ffe047');

            working = await playClearAndOverlapDrop(working, res, [], stepSpeed, 2);
            if (!isMountedRef.current || myRun !== runIdRef.current) return;
          }

          await timelineRef.current.wait(scaleTiming(260, finaleSpeed));
          if (!isMountedRef.current || myRun !== runIdRef.current) return;

          setIsBusy(false);
          const stars = Math.max(1, computeStars(runningScore));
          soundEngine.playFanfare();
          onLevelComplete(level.id, runningScore, stars);
          setModalState('VICTORY');
        } else {
          setIsBusy(false);
          const stars = Math.max(1, computeStars(latestScore));
          soundEngine.playFanfare();
          onLevelComplete(level.id, latestScore, stars);
          setModalState('VICTORY');
        }
        return;
      }

      if (remainingMoves <= 0) {
        soundEngine.playLose();
        setModalState('GAME_OVER');
        return;
      }

      // Check for board deadlock
      if (!findValidMove(currentGrid)) {
        setStatusBanner('No moves left · Shuffling candies!');
        const speed = computeFxSpeed();
        await timelineRef.current.wait(scaleTiming(550, speed));
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
        const reshuffled = shuffleGrid(currentGrid, level.colorsCount, speed);
        setStatusBanner(null);
        await commitDropAndWait(reshuffled, speed);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
      }
    },
    [
      level,
      onLevelComplete,
      showPraise,
      emitFloatingScore,
      playClearAndOverlapDrop,
      commitDropAndWait,
    ]
  );

  /**
   * Executes the full match -> sequential clear timeline -> post-pop pause -> special forge ->
   * gravity drop -> cascade gap loop on the single rAF deltaTime FxTimeline.
   */
  const runCascadeLoop = useCallback(
    async (
      startingGrid: Grid,
      preferredPositions: Position[],
      initialSpecialCombo?: { posA: Position; posB: Position },
      remainingMovesOverride?: number,
      runIdOverride?: number
    ) => {
      const myRun = runIdOverride ?? runIdRef.current;
      let workingGrid = shallowGridCopy(startingGrid);
      let cascade = 0;
      let totalScore = scoreRef.current;
      let totalOrder = orderRef.current;

      // Handle Special + Special swap combo on step 0 if triggered
      if (initialSpecialCombo) {
        cascade = 1;
        const comboRes = resolveSpecialSwapCombo(
          workingGrid,
          initialSpecialCombo.posA,
          initialSpecialCombo.posB
        );
        const fxSpeed = computeFxSpeed({
          clearedCount: comboRes.clearedKeys.size,
          isSpecialCombo: true,
          cascadeDepth: cascade,
        });

        let orderGain = 0;
        for (const key of comboRes.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          const p = workingGrid[r][c];
          if (p && level.order && p.color === level.order.color) {
            orderGain += 1;
          }
        }

        const gained = comboRes.clearedKeys.size * 40 + comboRes.bonusScore;
        totalScore += gained;
        totalOrder += orderGain;

        setScore(totalScore);
        setOrderCollected(totalOrder);

        // Execute sequential combo chain timeline overlapped seamlessly with per-column drops
        workingGrid = await playClearAndOverlapDrop(workingGrid, comboRes, [], fxSpeed, 3);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        // Floating score + Praise appear AFTER the clear completes (never mid-explosion)
        emitFloatingScore(
          initialSpecialCombo.posB.row,
          initialSpecialCombo.posB.col,
          gained,
          '#ffea70'
        );
        if (comboRes.triggeredSpecials.includes('color-bomb')) {
          showPraise('Sugar Crush!');
        } else {
          showPraise('Delicious!');
        }

        // Cascade gap (180ms / fxSpeed) before evaluating follow-up matches
        await timelineRef.current.wait(scaleTiming(FX_TIMING.cascadeGap, fxSpeed));
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
      }

      // Main Match & Gravity Cascade Loop
      while (true) {
        const clusters = findMatchClusters(workingGrid, cascade === 0 ? preferredPositions : []);
        if (clusters.length === 0) break;

        cascade += 1;
        soundEngine.playMatch(cascade);
        soundEngine.vibrate(cascade >= 2 ? [16, 22, 20] : 16);

        const initialDestroyPositions: Position[] = [];
        const skipSpawnKeys = new Set<string>();
        const spawns: { pos: Position; color: typeof clusters[number]['color']; special: SpecialType }[] = [];

        for (const cl of clusters) {
          for (const cell of cl.cells) {
            initialDestroyPositions.push(cell);
          }
          if (cl.spawnSpecial !== 'none') {
            spawns.push({
              pos: cl.spawnPos,
              color: cl.color,
              special: cl.spawnSpecial,
            });
            skipSpawnKeys.add(`${cl.spawnPos.row},${cl.spawnPos.col}`);
          }
        }

        const isForgingSpecial = spawns.length > 0;
        const originPos =
          cascade === 1 && preferredPositions.length > 0
            ? preferredPositions[0]
            : clusters[0].spawnPos;

        const resolution = resolveDestructionChain(
          workingGrid,
          initialDestroyPositions,
          skipSpawnKeys,
          {
            originPos,
            popDurationMs: isForgingSpecial
              ? FX_TIMING.specialForgePopDuration
              : FX_TIMING.popTotalDuration,
          }
        );

        const fxSpeed = computeFxSpeed({
          clearedCount: resolution.clearedKeys.size,
          isSpecialCombo: false,
          cascadeDepth: cascade,
        });

        if (cascade >= 3 && resolution.triggeredSpecials.length === 0) {
          triggerShake();
        }

        let orderGain = 0;
        for (const key of resolution.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          const p = workingGrid[r][c];
          if (p && level.order && p.color === level.order.color) {
            orderGain += 1;
          }
        }

        const multiplier = 1 + (cascade - 1) * 0.35;
        const gained = Math.round(
          (resolution.clearedKeys.size * 30 + resolution.bonusScore) * multiplier
        );
        totalScore += gained;
        totalOrder += orderGain;

        setScore(totalScore);
        setOrderCollected(totalOrder);

        // Execute sequential pop/special chain timeline overlapped seamlessly with per-column drops (0ms gap)
        workingGrid = await playClearAndOverlapDrop(workingGrid, resolution, spawns, fxSpeed, 3);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        // Floating score & "Sweet!" / "Delicious!" / "Sugar Crush!" AFTER clear completes
        const anchor = clusters[0].spawnPos;
        emitFloatingScore(anchor.row, anchor.col, gained, CANDY_HEX[clusters[0].color].glow);

        if (resolution.triggeredSpecials.includes('color-bomb')) {
          showPraise('Sugar Crush!');
        } else if (cascade >= 2) {
          showPraise('Delicious!');
        } else if (resolution.clearedKeys.size >= 4) {
          showPraise('Sweet!');
        }

        // Cascade gap (180ms / fxSpeed) before evaluating next cascade wave
        await timelineRef.current.wait(scaleTiming(FX_TIMING.cascadeGap, fxSpeed));
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
      }

      setIsBusy(false);
      const remMoves = remainingMovesOverride ?? movesRef.current;
      await checkWinOrLoss(workingGrid, totalScore, totalOrder, remMoves, myRun);
    },
    [
      level,
      emitFloatingScore,
      showPraise,
      triggerShake,
      playClearAndOverlapDrop,
      checkWinOrLoss,
    ]
  );

  const attemptSwap = useCallback(
    async (posA: Position, posB: Position) => {
      if (isBusyRef.current || modalRef.current !== 'NONE') return;
      if (!isAdjacent(posA, posB)) return;

      const currentGrid = gridRef.current;
      const pieceA = currentGrid[posA.row][posA.col];
      const pieceB = currentGrid[posB.row][posB.col];
      if (!pieceA || !pieceB) return;

      const myRun = runIdRef.current;
      setSelected(null);
      setHintPair(null);
      setIsBusy(true);
      soundEngine.playSwap();
      soundEngine.vibrate(10);

      vfxRef.current?.emitEvents([
        {
          type: 'swap-trail',
          fromRow: posA.row,
          fromCol: posA.col,
          toRow: posB.row,
          toCol: posB.col,
          color: pieceA.color,
        },
      ]);

      // Imperative WAAPI slide on the 2 swapped DOM refs (180ms / fxSpeed, zero React re-renders)
      const swapSpeed = computeFxSpeed();
      const elA = tileElsRef.current[posA.row * GRID_SIZE + posA.col];
      const elB = tileElsRef.current[posB.row * GRID_SIZE + posB.col];
      const parentA = elA?.parentElement ?? null;
      const parentB = elB?.parentElement ?? null;
      const dxA = (posB.col - posA.col) * 100;
      const dyA = (posB.row - posA.row) * 100;
      const dxB = -dxA;
      const dyB = -dyA;
      const swapDuration = reducedMotionRef.current
        ? scaleTiming(100, swapSpeed)
        : scaleTiming(FX_TIMING.swapDuration, swapSpeed);

      const forwardAnims: Animation[] = [];
      if (elA && typeof elA.animate === 'function') {
        elA.style.willChange = 'transform';
        if (parentA) parentA.style.zIndex = '20';
        forwardAnims.push(
          elA.animate(
            [
              { transform: 'translate3d(0, 0, 0)' },
              { transform: `translate3d(${dxA}%, ${dyA}%, 0)` },
            ],
            { duration: swapDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
          )
        );
      }
      if (elB && typeof elB.animate === 'function') {
        elB.style.willChange = 'transform';
        if (parentB) parentB.style.zIndex = '10';
        forwardAnims.push(
          elB.animate(
            [
              { transform: 'translate3d(0, 0, 0)' },
              { transform: `translate3d(${dxB}%, ${dyB}%, 0)` },
            ],
            { duration: swapDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
          )
        );
      }

      const cleanupSwapStyles = (animsToCancel: Animation[]) => {
        for (const a of animsToCancel) a.cancel();
        if (elA) elA.style.willChange = '';
        if (elB) elB.style.willChange = '';
        if (parentA) parentA.style.zIndex = '';
        if (parentB) parentB.style.zIndex = '';
      };

      await waitAnimations(forwardAnims, swapDuration);
      if (!isMountedRef.current || myRun !== runIdRef.current) {
        cleanupSwapStyles(forwardAnims);
        return;
      }

      const swapped = shallowGridCopy(currentGrid);
      swapped[posA.row][posA.col] = pieceB;
      swapped[posB.row][posB.col] = pieceA;

      const specialCombo = isSpecialComboSwap(pieceA, pieceB);
      const clusters = findMatchClusters(swapped, [posA, posB]);

      if (!specialCombo && clusters.length === 0) {
        soundEngine.playInvalidSwap();
        soundEngine.vibrate([12, 28, 12]);
        const backAnims: Animation[] = [];
        for (const a of forwardAnims) a.cancel();

        if (elA && typeof elA.animate === 'function') {
          backAnims.push(
            elA.animate(
              [
                { transform: `translate3d(${dxA}%, ${dyA}%, 0)` },
                { transform: 'translate3d(0, 0, 0)' },
              ],
              { duration: swapDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
          );
        }
        if (elB && typeof elB.animate === 'function') {
          backAnims.push(
            elB.animate(
              [
                { transform: `translate3d(${dxB}%, ${dyB}%, 0)` },
                { transform: 'translate3d(0, 0, 0)' },
              ],
              { duration: swapDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
          );
        }

        await waitAnimations(backAnims, swapDuration);
        cleanupSwapStyles(backAnims);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
        setIsBusy(false);
        return;
      }

      cleanupSwapStyles(forwardAnims);
      setGrid(swapped);
      // Let React paint swapped positions cleanly before starting the clear choreography
      await nextFrame();
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      const nextMoves = Math.max(0, movesRef.current - 1);
      setMovesLeft(nextMoves);

      await runCascadeLoop(
        swapped,
        [posA, posB],
        specialCombo ? { posA, posB } : undefined,
        nextMoves,
        myRun
      );
    },
    [runCascadeLoop]
  );

  // Lollipop Hammer Booster Handler
  const handleHammerCell = useCallback(
    async (row: number, col: number) => {
      if (isBusyRef.current || inventory.hammers <= 0) return;
      const currentGrid = gridRef.current;
      const piece = currentGrid[row][col];
      if (!piece) return;

      if (!onConsumeBooster('hammers')) return;
      const myRun = runIdRef.current;
      setHammerActive(false);
      setIsBusy(true);
      setSelected(null);
      soundEngine.playHammer();
      soundEngine.vibrate([24, 30, 36]);
      triggerShake();

      const working = shallowGridCopy(currentGrid);
      const res = resolveDestructionChain(working, [{ row, col }], new Set(), {
        originPos: { row, col },
      });
      const fxSpeed = computeFxSpeed({ clearedCount: res.clearedKeys.size });

      let orderGain = 0;
      for (const key of res.clearedKeys) {
        const [r, c] = key.split(',').map(Number);
        const p = working[r][c];
        if (p && level.order && p.color === level.order.color) {
          orderGain += 1;
        }
      }

      const gained = res.clearedKeys.size * 45 + res.bonusScore;
      const newScore = scoreRef.current + gained;
      const newOrder = orderRef.current + orderGain;

      setScore(newScore);
      setOrderCollected(newOrder);
      scoreRef.current = newScore;
      orderRef.current = newOrder;

      const refilled = await playClearAndOverlapDrop(working, res, [], fxSpeed, 2);
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      emitFloatingScore(row, col, gained, CANDY_HEX[piece.color].glow);

      await timelineRef.current.wait(scaleTiming(FX_TIMING.cascadeGap, fxSpeed));
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      await runCascadeLoop(refilled, [], undefined, movesRef.current, myRun);
    },
    [
      inventory.hammers,
      onConsumeBooster,
      level,
      triggerShake,
      emitFloatingScore,
      playClearAndOverlapDrop,
      runCascadeLoop,
    ]
  );

  const handleManualShuffle = () => {
    if (isBusy || inventory.shuffles <= 0 || modalState !== 'NONE') return;
    if (!onConsumeBooster('shuffles')) return;
    const myRun = runIdRef.current;
    soundEngine.playButton();
    setSelected(null);
    setHintPair(null);
    setGrid((prev) => shuffleGrid(prev, level.colorsCount, computeFxSpeed()));
    setStatusBanner('Board Shuffled!');
    window.setTimeout(() => {
      if (isMountedRef.current && myRun === runIdRef.current) {
        setStatusBanner(null);
      }
    }, 900);
  };

  const handleUseBonusMoves = () => {
    if (isBusy || inventory.bonusMoves <= 0) return;
    if (modalState !== 'NONE' && modalState !== 'GAME_OVER') return;
    if (!onConsumeBooster('bonusMoves')) return;
    soundEngine.playWin();
    setMovesLeft((m) => m + 5);
    setModalState('NONE');
    setStatusBanner('+5 Extra Moves Added!');
    window.setTimeout(() => {
      if (isMountedRef.current) setStatusBanner(null);
    }, 1200);
  };

  const attemptSwapRef = useRef(attemptSwap);
  attemptSwapRef.current = attemptSwap;
  const handleHammerCellRef = useRef(handleHammerCell);
  handleHammerCellRef.current = handleHammerCell;

  const handleCellPointerDown = useCallback((row: number, col: number, e: React.PointerEvent) => {
    if (isBusyRef.current || modalRef.current !== 'NONE') return;
    soundEngine.unlock();

    if (hammerActiveRef.current) {
      void handleHammerCellRef.current(row, col);
      return;
    }

    dragStartRef.current = { row, col, x: e.clientX, y: e.clientY };

    const currSel = selectedRef.current;
    if (!currSel) {
      soundEngine.playTap();
      setSelected({ row, col });
    } else if (currSel.row === row && currSel.col === col) {
      setSelected(null);
    } else if (isAdjacent(currSel, { row, col })) {
      void attemptSwapRef.current(currSel, { row, col });
      dragStartRef.current = null;
    } else {
      soundEngine.playTap();
      setSelected({ row, col });
    }
  }, []);

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || isBusyRef.current || modalRef.current !== 'NONE' || hammerActiveRef.current) {
      return;
    }

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const threshold = 20;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    let targetRow = start.row;
    let targetCol = start.col;
    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += dx > 0 ? 1 : -1;
    } else {
      targetRow += dy > 0 ? 1 : -1;
    }

    dragStartRef.current = null;
    if (targetRow >= 0 && targetRow < GRID_SIZE && targetCol >= 0 && targetCol < GRID_SIZE) {
      void attemptSwapRef.current({ row: start.row, col: start.col }, { row: targetRow, col: targetCol });
    }
  };

  const handleBoardPointerUp = () => {
    dragStartRef.current = null;
  };

  const progressPct = Math.min(100, (score / level.starScores[2]) * 100);
  const star1Pct = (level.starScores[0] / level.starScores[2]) * 100;
  const star2Pct = (level.starScores[1] / level.starScores[2]) * 100;
  const earnedStars = computeStars(score);
  const hasNextLevel = level.id < LEVELS.length;
  const remainingOrder = level.order ? Math.max(0, level.order.target - orderCollected) : 0;
  const remainingScore = Math.max(0, level.targetScore - score);

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #52dce3 0%, #2ab5c4 50%, #1c8599 100%)',
      }}
    >
      {/* 4 Soft Pre-Feathered Overhead Light Shafts (Pure CSS Gradients, Zero Live Blur) */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${
          lowPerf ? '' : 'animate-light-beams'
        }`}
        aria-hidden="true"
      >
        <div
          className="absolute -top-14 left-[2%] w-[24%] h-[90%] origin-top opacity-24"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(235,254,255,0.55) 50%, rgba(255,255,255,0) 100%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)',
            transform: 'skewX(-16deg)',
          }}
        />
        <div
          className="absolute -top-14 left-[28%] w-[22%] h-[92%] origin-top opacity-20"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(235,254,255,0.52) 50%, rgba(255,255,255,0) 100%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 62%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 62%, rgba(0,0,0,0) 100%)',
            transform: 'skewX(-12deg)',
          }}
        />
        <div
          className="absolute -top-14 left-[54%] w-[22%] h-[88%] origin-top opacity-18"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(220,252,255,0.48) 50%, rgba(255,255,255,0) 100%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.28) 58%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.28) 58%, rgba(0,0,0,0) 100%)',
            transform: 'skewX(-15deg)',
          }}
        />
        <div
          className="absolute -top-14 right-[2%] w-[20%] h-[84%] origin-top opacity-16"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(220,252,255,0.45) 50%, rgba(255,255,255,0) 100%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 56%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 56%, rgba(0,0,0,0) 100%)',
            transform: 'skewX(-19deg)',
          }}
        />
      </div>

      {/* Soft Pre-Feathered Bokeh Orbs (Pure Multi-Stop Radial Gradient, Zero Live Blur) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {BOKEH_DOTS.map((dot, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full ${lowPerf ? '' : 'animate-bokeh-drift'}`}
            style={{
              top: dot.top,
              left: dot.left,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              opacity: dot.opacity,
              animationDelay: lowPerf ? undefined : dot.delay,
              background:
                'radial-gradient(circle, rgba(240,254,255,0.85) 0%, rgba(190,248,255,0.42) 34%, rgba(165,243,252,0.12) 60%, rgba(165,243,252,0) 76%)',
            }}
          />
        ))}
      </div>

      {/* Soft White-Teal Radial Glow Directly Behind Floating Board + Subtle Edge Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 52%, rgba(220, 252, 255, 0.36) 0%, rgba(140, 238, 250, 0.16) 34%, rgba(140, 238, 250, 0) 60%), radial-gradient(ellipse at 50% 50%, rgba(6, 44, 62, 0) 56%, rgba(5, 36, 52, 0.32) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Top Pink Striped HUD Bar (Safe Area Top, Crisp High-Contrast Text & Icons) */}
      <header className="candy-stripes-pink safe-area-top relative z-20 shrink-0 w-full border-b-[3px] border-[#c41468] shadow-[0_6px_16px_rgba(6,38,56,0.28)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5">
          {/* Left: Chunky Bubble-Letter Moves Badge with Crisp White Outline & Pink Border */}
          <div className="shrink-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff7ac0] to-[#d91670] border-[3px] border-white px-3 py-1 min-w-[66px] shadow-[0_4px_0_#8f0946,inset_0_2px_2px_rgba(255,255,255,0.5)]">
            <span className="font-settings font-extrabold text-[10px] uppercase tracking-wider text-white leading-none">
              Moves
            </span>
            <span
              className={`font-settings-heading font-extrabold text-[32px] sm:text-[36px] leading-[1.02] tabular-nums text-white moves-bubble-num ${
                movesLeft <= 5 && !reducedMotion ? 'animate-moves-low' : ''
              }`}
            >
              {movesLeft}
            </span>
          </div>

          {/* Center: 3-Star Progress Bar + High-Contrast Glossy Cream Goal Panel */}
          <div className="flex-1 min-w-0 max-w-[270px] flex flex-col items-center gap-1.5">
            {/* Progress Track with 3 Popping Star Markers */}
            <div className="relative w-full h-4 rounded-full bg-[#610d38]/82 border-2 border-white/90 p-0.5 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffde59] via-[#ff9d2e] to-[#ff4da6] origin-left transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${Math.max(0.04, progressPct / 100)})` }}
              />
              {[
                { pct: star1Pct, met: score >= level.starScores[0] },
                { pct: star2Pct, met: score >= level.starScores[1] },
                { pct: 96, met: score >= level.starScores[2] },
              ].map((st, idx) => (
                <div
                  key={idx}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${st.pct}%` }}
                >
                  <Star
                    className={`w-5 h-5 ${
                      st.met
                        ? 'fill-[#ffe047] text-[#9a3f04] animate-hud-star-pop'
                        : 'fill-[#7c1d4d] text-[#f9b6d8]'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Sharp High-Contrast Cream Rounded Goal Panel */}
            <div className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#fffef9] to-[#ffefd1] border-2 border-[#f2c472] px-3 py-1 shadow-[0_2px_0_#c98e2c,inset_0_1px_1px_rgba(255,255,255,0.95)] text-[#0a1d37] tabular-nums">
              {level.order ? (
                <>
                  <span className="w-6 h-6 shrink-0 inline-flex items-center justify-center">
                    <CandySprite color={level.order.color} special="none" />
                  </span>
                  <span className="font-settings-heading font-extrabold text-[18px] leading-none text-[#0a1d37]">
                    {remainingOrder === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[#146c31]">
                        <Check className="w-4 h-4 stroke-[3.5]" /> Done
                      </span>
                    ) : (
                      remainingOrder
                    )}
                  </span>
                  <span className="text-[#9e6c1e] font-black text-xs">·</span>
                  <span className="font-settings font-extrabold text-[12px] text-[#5c3608] truncate">
                    {score.toLocaleString()} pts
                  </span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 fill-[#f59e0b] text-[#92400e] shrink-0" />
                  <span className="font-settings-heading font-extrabold text-[16px] leading-none text-[#0a1d37]">
                    {score.toLocaleString()}
                  </span>
                  <span className="font-settings font-extrabold text-[12px] text-[#5c3608]">
                    {remainingScore > 0 ? `/ ${level.targetScore.toLocaleString()}` : 'Goal met!'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Glossy Pause Button (>= 48px tap target) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playButton();
              setModalState('PAUSED');
            }}
            aria-label="Pause game"
            title="Pause Game"
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-gradient-to-b from-[#ffffff] to-[#ffe1f0] border-2 border-white text-[#8f0b4a] shadow-[0_4px_0_#b5266c,0_6px_12px_rgba(120,10,60,0.22)] flex items-center justify-center cursor-pointer transition-transform active:translate-y-0.5 shrink-0"
          >
            <Pause className="w-5 h-5 fill-[#8f0b4a]" />
          </button>
        </div>
      </header>

      {/* Center 8x8 Match-3 Game Grid: Unified Translucent Blue Panel (Zero Outer Ring, Soft Inner Glow) */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-2 py-1 min-h-0">
        <div
          ref={boardFrameRef}
          className="relative aspect-square w-[min(calc(100vw-16px),calc(100dvh-204px),520px)] max-w-full p-[6px] sm:p-2"
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
          style={{
            touchAction: 'none',
            borderRadius: '22px',
            backgroundColor: 'rgba(40, 100, 170, 0.62)',
            boxShadow:
              'inset 0 0 24px rgba(160, 220, 255, 0.18), inset 0 1px 0 rgba(235, 250, 255, 0.42), 0 16px 34px rgba(6, 36, 58, 0.34)',
          }}
        >
          {/* 8x8 Memoized Candy Grid */}
          <div className="relative w-full h-full grid grid-cols-8 grid-rows-8 rounded-[16px] overflow-hidden">
            {grid.map((rowArr, r) =>
              rowArr.map((cell, c) => {
                const isSelected = selected?.row === r && selected?.col === c;
                const isHinted = Boolean(
                  hintPair &&
                    ((hintPair[0].row === r && hintPair[0].col === c) ||
                      (hintPair[1].row === r && hintPair[1].col === c))
                );

                return (
                  <CandyTile
                    key={r * GRID_SIZE + c}
                    row={r}
                    col={c}
                    piece={cell}
                    isSelected={isSelected}
                    isHinted={isHinted}
                    hammerActive={hammerActive}
                    reducedMotion={reducedMotion}
                    onCellPointerDown={handleCellPointerDown}
                    registerTileEl={registerTileEl}
                    registerDropAnim={registerDropAnim}
                  />
                );
              })
            )}

            {/* Single Pooled 60FPS Canvas VFX Layer */}
            <VfxCanvas ref={vfxRef} />

            {/* Isolated Imperative Praise Banner (Single Active Banner, Zero Board Re-renders) */}
            <PraiseBanner ref={praiseRef} />

            {/* Status Banner (Deadlock Reshuffle / Hammer Prompt) */}
            {(statusBanner || hammerActive) && (
              <div className="pointer-events-none absolute inset-x-4 bottom-3 z-30 flex justify-center">
                <div className="bg-[#0a1f3d]/94 border border-[#9be3ff]/55 text-white text-xs sm:text-sm font-extrabold px-4 py-1.5 rounded-full shadow-lg">
                  {hammerActive ? 'Tap any candy on the board to smash it!' : statusBanner}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Booster Tray (Safe Area Bottom Tray Padding Prevents Edge Clipping) */}
      <footer className="safe-area-bottom-tray relative z-20 shrink-0 pt-1 px-3 flex items-center justify-center">
        <div className="w-full max-w-[520px] flex items-center justify-between gap-2.5">
          {/* Left: Round Glossy Pink Settings Gear (>= 48px tap target) */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            title="Settings"
            className="candy-btn-pink relative overflow-hidden w-12 h-12 min-w-[48px] min-h-[48px] rounded-full text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <span
              className="pointer-events-none absolute top-1 left-2 right-2 h-2.5 rounded-full bg-white/35"
              aria-hidden="true"
            />
            <Settings className="relative z-10 w-6 h-6 stroke-[2.4]" />
          </button>

          {/* Main Cream Rounded Booster Bar with High-Contrast Round Glossy Bubble Buttons */}
          <div className="flex-1 flex items-center justify-around gap-2 bg-gradient-to-b from-[#fffef8] to-[#ffebc7] border-[3px] border-[#f2c372] px-3 py-1.5 rounded-full shadow-[0_5px_0_#bd8124,0_10px_22px_rgba(4,28,46,0.34),inset_0_2px_2px_rgba(255,255,255,0.95)]">
            {/* Hammer Bubble Button */}
            <button
              type="button"
              disabled={inventory.hammers <= 0 || isBusy}
              onClick={() => {
                soundEngine.playButton();
                setHammerActive((a) => !a);
                setSelected(null);
              }}
              aria-label={`Hammer booster, ${inventory.hammers} left`}
              title="Hammer: smash any candy"
              className={`relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-transform active:translate-y-0.5 ${
                inventory.hammers <= 0
                  ? 'bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] border-2 border-white shadow-[0_3px_0_#475569] text-[#1e293b] cursor-not-allowed'
                  : hammerActive
                  ? 'bg-gradient-to-b from-[#ff7ac0] to-[#d91670] border-2 border-[#fde047] ring-3 ring-[#fde047] shadow-[0_4px_0_#8c0743] text-white cursor-pointer'
                  : 'bg-gradient-to-b from-[#ff72b8] via-[#e61e78] to-[#bf0e5f] border-2 border-white shadow-[0_4px_0_#8c0743,inset_0_2px_2px_rgba(255,255,255,0.55)] text-white cursor-pointer'
              }`}
            >
              <span
                className="pointer-events-none absolute top-1 left-2 right-2 h-2.5 rounded-full bg-white/35"
                aria-hidden="true"
              />
              <Hammer className="relative z-10 w-5 h-5 stroke-[2.5]" />
              <span
                className={`absolute -bottom-1 -right-1 min-w-[21px] h-[21px] px-1 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-extrabold tabular-nums shadow ${
                  inventory.hammers > 0 ? 'bg-[#091c36] text-white' : 'bg-[#475569] text-white'
                }`}
              >
                {inventory.hammers > 0 ? inventory.hammers : <Lock className="w-2.5 h-2.5" />}
              </span>
            </button>

            {/* Shuffle Bubble Button */}
            <button
              type="button"
              disabled={inventory.shuffles <= 0 || isBusy}
              onClick={handleManualShuffle}
              aria-label={`Shuffle booster, ${inventory.shuffles} left`}
              title="Shuffle all candies"
              className={`relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-transform active:translate-y-0.5 ${
                inventory.shuffles <= 0
                  ? 'bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] border-2 border-white shadow-[0_3px_0_#475569] text-[#1e293b] cursor-not-allowed'
                  : 'bg-gradient-to-b from-[#5bc4ff] via-[#1c88eb] to-[#0e62b8] border-2 border-white shadow-[0_4px_0_#08417f,inset_0_2px_2px_rgba(255,255,255,0.55)] text-white cursor-pointer'
              }`}
            >
              <span
                className="pointer-events-none absolute top-1 left-2 right-2 h-2.5 rounded-full bg-white/35"
                aria-hidden="true"
              />
              <Shuffle className="relative z-10 w-5 h-5 stroke-[2.5]" />
              <span
                className={`absolute -bottom-1 -right-1 min-w-[21px] h-[21px] px-1 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-extrabold tabular-nums shadow ${
                  inventory.shuffles > 0 ? 'bg-[#091c36] text-white' : 'bg-[#475569] text-white'
                }`}
              >
                {inventory.shuffles > 0 ? inventory.shuffles : <Lock className="w-2.5 h-2.5" />}
              </span>
            </button>

            {/* +5 Moves Bubble Button */}
            <button
              type="button"
              disabled={inventory.bonusMoves <= 0 || isBusy}
              onClick={handleUseBonusMoves}
              aria-label={`+5 Moves booster, ${inventory.bonusMoves} left`}
              title="Add +5 extra moves"
              className={`relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-transform active:translate-y-0.5 ${
                inventory.bonusMoves <= 0
                  ? 'bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] border-2 border-white shadow-[0_3px_0_#475569] text-[#1e293b] cursor-not-allowed'
                  : 'bg-gradient-to-b from-[#64eb84] via-[#22b84a] to-[#128a32] border-2 border-white shadow-[0_4px_0_#0b5c20,inset_0_2px_2px_rgba(255,255,255,0.55)] text-white cursor-pointer'
              }`}
            >
              <span
                className="pointer-events-none absolute top-1 left-2 right-2 h-2.5 rounded-full bg-white/35"
                aria-hidden="true"
              />
              <PlusCircle className="relative z-10 w-5 h-5 stroke-[2.5]" />
              <span
                className={`absolute -bottom-1 -right-1 min-w-[21px] h-[21px] px-1 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-extrabold tabular-nums shadow ${
                  inventory.bonusMoves > 0 ? 'bg-[#091c36] text-white' : 'bg-[#475569] text-white'
                }`}
              >
                {inventory.bonusMoves > 0 ? inventory.bonusMoves : <Lock className="w-2.5 h-2.5" />}
              </span>
            </button>

            {/* Map Bubble Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playButton();
                onBackToMap();
              }}
              aria-label="Back to Level Map"
              title="Level Map"
              className="relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-gradient-to-b from-[#ffca52] via-[#f59e0b] to-[#d97706] border-2 border-white shadow-[0_4px_0_#92400e,inset_0_2px_2px_rgba(255,255,255,0.55)] text-white flex items-center justify-center cursor-pointer transition-transform active:translate-y-0.5"
            >
              <span
                className="pointer-events-none absolute top-1 left-2 right-2 h-2.5 rounded-full bg-white/35"
                aria-hidden="true"
              />
              <MapIcon className="relative z-10 w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </footer>

      {/* Pause / Victory / Game Over Modal */}
      {modalState !== 'NONE' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#061529]/62 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#fff7fb] border-4 border-[#ff8ec4] shadow-2xl p-6 text-center flex flex-col items-center gap-4">
            {modalState === 'PAUSED' && (
              <>
                <h2 className="font-settings-heading font-extrabold text-3xl text-[#b3125d]">
                  Game Paused
                </h2>
                <p className="text-sm font-bold text-[#334155]">{level.description}</p>
                <div className="w-full flex flex-col gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      setModalState('NONE');
                    }}
                    className="candy-btn-pink w-full min-h-[50px] py-3 rounded-full font-settings-heading font-extrabold text-xl text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="candy-btn-blue w-full min-h-[48px] py-2.5 rounded-full font-settings-heading font-extrabold text-lg text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel(false);
                    }}
                    className="candy-btn-blue w-full min-h-[48px] py-2.5 rounded-full font-settings-heading font-extrabold text-lg text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Restart Level</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      onBackToMap();
                    }}
                    className="w-full min-h-[48px] py-2.5 rounded-full font-bold text-[#1e3a5f] bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Level Map
                  </button>
                </div>
              </>
            )}

            {modalState === 'VICTORY' && (
              <>
                <h2 className="font-settings-heading font-extrabold text-3xl text-[#b3125d]">
                  Level Complete!
                </h2>
                <div className="flex items-center justify-center gap-2 my-1">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-11 h-11 transition-transform ${
                        Math.max(1, earnedStars) >= s
                          ? 'fill-amber-400 text-amber-600 scale-110'
                          : 'fill-slate-200 text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="bg-pink-100/80 w-full rounded-2xl py-3 px-4">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#9e1054]">
                    Final Score
                  </div>
                  <div className="font-settings-heading font-extrabold text-3xl text-[#b3125d] tabular-nums">
                    {score.toLocaleString()}
                  </div>
                </div>
                <div className="w-full flex flex-col gap-2.5 mt-1">
                  {hasNextLevel && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playButton();
                        onNextLevel();
                      }}
                      className="candy-btn-green w-full min-h-[50px] py-3 rounded-full font-settings-heading font-extrabold text-xl text-white cursor-pointer"
                    >
                      Next Level
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel(false);
                    }}
                    className="candy-btn-pink w-full min-h-[48px] py-2.5 rounded-full font-settings-heading font-extrabold text-lg text-white cursor-pointer"
                  >
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      onBackToMap();
                    }}
                    className="w-full min-h-[48px] py-2.5 rounded-full font-bold text-[#1e3a5f] bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Level Map
                  </button>
                </div>
              </>
            )}

            {modalState === 'GAME_OVER' && (
              <>
                <h2 className="font-settings-heading font-extrabold text-3xl text-rose-600">
                  Out of Moves!
                </h2>
                <p className="text-sm font-bold text-[#334155]">
                  You scored {score.toLocaleString()} points. Target was{' '}
                  {level.targetScore.toLocaleString()}.
                </p>
                {level.order && (
                  <p className="text-xs font-extrabold text-[#9e1054]">
                    Collected {Math.min(orderCollected, level.order.target)} / {level.order.target}{' '}
                    {CANDY_HEX[level.order.color].label}s
                  </p>
                )}
                <div className="w-full flex flex-col gap-2.5 mt-2">
                  {inventory.bonusMoves > 0 && (
                    <button
                      type="button"
                      onClick={handleUseBonusMoves}
                      className="candy-btn-green w-full min-h-[50px] py-3 rounded-full font-settings-heading font-extrabold text-xl text-white flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-5 h-5" />
                      <span>Use +5 Extra Moves ({inventory.bonusMoves})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel(false);
                    }}
                    className="candy-btn-pink w-full min-h-[50px] py-3 rounded-full font-settings-heading font-extrabold text-xl text-white cursor-pointer"
                  >
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      onBackToMap();
                    }}
                    className="w-full min-h-[48px] py-2.5 rounded-full font-bold text-[#1e3a5f] bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Level Map
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
