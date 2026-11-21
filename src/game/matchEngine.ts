import { FX_TIMING } from './fxTimeline';
import { ALL_COLORS } from './levels';
import {
  CandyColor,
  CandyPiece,
  ClearTimelineStep,
  Grid,
  Position,
  SpecialType,
  VfxEvent,
} from './types';

export const GRID_SIZE = 8;

let idCounter = 1;
export function nextCandyId(): string {
  idCounter += 1;
  return `candy_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function randomColor(colorsCount: number): CandyColor {
  const palette = ALL_COLORS.slice(0, colorsCount);
  return palette[Math.floor(Math.random() * palette.length)];
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function createInitialGrid(colorsCount: number): Grid {
  let grid: Grid = [];
  for (let attempt = 0; attempt < 25; attempt++) {
    grid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null)
    );
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const forbidden = new Set<CandyColor>();
        if (
          c >= 2 &&
          grid[r][c - 1]?.color &&
          grid[r][c - 1]?.color === grid[r][c - 2]?.color
        ) {
          forbidden.add(grid[r][c - 1]!.color);
        }
        if (
          r >= 2 &&
          grid[r - 1][c]?.color &&
          grid[r - 1][c]?.color === grid[r - 2][c]?.color
        ) {
          forbidden.add(grid[r - 1][c]!.color);
        }
        const candidates = ALL_COLORS.slice(0, colorsCount).filter((col) => !forbidden.has(col));
        const color =
          candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : randomColor(colorsCount);
        grid[r][c] = {
          id: nextCandyId(),
          color,
          special: 'none',
        };
      }
    }
    if (findValidMove(grid)) {
      return grid;
    }
  }
  return grid;
}

export function isAdjacent(a: Position, b: Position): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export interface MatchCluster {
  cells: Position[];
  color: CandyColor;
  spawnSpecial: SpecialType;
  spawnPos: Position;
}

/**
 * Finds all horizontal and vertical runs >= 3, merges intersecting runs of the same color,
 * and classifies special candy creation:
 * - 5+ in a line -> color-bomb
 * - L or T intersection (both H>=3 and V>=3) -> wrapped
 * - 4 in a line -> striped-h (from vertical match) or striped-v (from horizontal match)
 */
export function findMatchClusters(grid: Grid, preferredPositions: Position[] = []): MatchCluster[] {
  interface Run {
    cells: Position[];
    color: CandyColor;
    dir: 'h' | 'v';
  }

  const runs: Run[] = [];

  // Horizontal runs
  for (let r = 0; r < GRID_SIZE; r++) {
    let c = 0;
    while (c < GRID_SIZE) {
      const piece = grid[r][c];
      if (!piece || piece.special === 'color-bomb') {
        c += 1;
        continue;
      }
      let end = c + 1;
      while (
        end < GRID_SIZE &&
        grid[r][end] &&
        grid[r][end]!.special !== 'color-bomb' &&
        grid[r][end]!.color === piece.color
      ) {
        end += 1;
      }
      if (end - c >= 3) {
        const cells: Position[] = [];
        for (let k = c; k < end; k++) cells.push({ row: r, col: k });
        runs.push({ cells, color: piece.color, dir: 'h' });
      }
      c = end;
    }
  }

  // Vertical runs
  for (let c = 0; c < GRID_SIZE; c++) {
    let r = 0;
    while (r < GRID_SIZE) {
      const piece = grid[r][c];
      if (!piece || piece.special === 'color-bomb') {
        r += 1;
        continue;
      }
      let end = r + 1;
      while (
        end < GRID_SIZE &&
        grid[end][c] &&
        grid[end][c]!.special !== 'color-bomb' &&
        grid[end][c]!.color === piece.color
      ) {
        end += 1;
      }
      if (end - r >= 3) {
        const cells: Position[] = [];
        for (let k = r; k < end; k++) cells.push({ row: k, col: c });
        runs.push({ cells, color: piece.color, dir: 'v' });
      }
      r = end;
    }
  }

  if (runs.length === 0) return [];

  // Merge intersecting runs of the same color via BFS
  const visitedRun = new Array(runs.length).fill(false);
  const clusters: MatchCluster[] = [];

  const shareCell = (a: Run, b: Run) => {
    if (a.color !== b.color) return false;
    return a.cells.some((ca) => b.cells.some((cb) => ca.row === cb.row && ca.col === cb.col));
  };

  for (let i = 0; i < runs.length; i++) {
    if (visitedRun[i]) continue;
    const queue = [i];
    visitedRun[i] = true;
    const groupRuns: Run[] = [];

    while (queue.length > 0) {
      const idx = queue.shift()!;
      groupRuns.push(runs[idx]);
      for (let j = 0; j < runs.length; j++) {
        if (!visitedRun[j] && shareCell(runs[idx], runs[j])) {
          visitedRun[j] = true;
          queue.push(j);
        }
      }
    }

    const cellMap = new Map<string, Position>();
    let hasH = false;
    let hasV = false;
    let maxLineLen = 0;
    let maxLineDir: 'h' | 'v' = 'h';

    for (const run of groupRuns) {
      if (run.dir === 'h') hasH = true;
      if (run.dir === 'v') hasV = true;
      if (run.cells.length > maxLineLen) {
        maxLineLen = run.cells.length;
        maxLineDir = run.dir;
      }
      for (const cell of run.cells) {
        cellMap.set(`${cell.row},${cell.col}`, cell);
      }
    }

    const cells = Array.from(cellMap.values());
    let spawnSpecial: SpecialType = 'none';
    if (maxLineLen >= 5) {
      spawnSpecial = 'color-bomb';
    } else if (hasH && hasV) {
      spawnSpecial = 'wrapped';
    } else if (maxLineLen === 4) {
      // Classic match-3 rule: horizontal 4 makes vertical-clearing stripe or vice-versa (or match dir)
      spawnSpecial = maxLineDir === 'h' ? 'striped-v' : 'striped-h';
    }

    // Pick spawn position: prefer one of the player's swapped positions if inside cluster
    let spawnPos = cells[Math.floor(cells.length / 2)];
    for (const pref of preferredPositions) {
      if (cells.some((c) => c.row === pref.row && c.col === pref.col)) {
        spawnPos = pref;
        break;
      }
    }

    clusters.push({
      cells,
      color: groupRuns[0].color,
      spawnSpecial,
      spawnPos,
    });
  }

  return clusters;
}

export interface ClearResolution {
  clearedKeys: Set<string>;
  vfxEvents: VfxEvent[];
  triggeredSpecials: SpecialType[];
  bonusScore: number;
  /** Chronological chain-reaction choreography in base ms (scaled by / fxSpeed) */
  timelineSteps: ClearTimelineStep[];
  /** Total base ms until the final candy pop completes */
  totalDurationMs: number;
}

export interface DestructionOptions {
  originPos?: Position;
  popDurationMs?: number;
  /** Optional explicit starting times (key "r,c" -> base ms) for pre-scheduled combo targets */
  seedTimes?: Map<string, number>;
}

let dropSeqCounter = 1;
export function nextDropSeq(): number {
  dropSeqCounter += 1;
  return dropSeqCounter;
}

interface ScheduledCellEvent {
  pos: Position;
  timeMs: number;
  fromParentEffect: boolean;
}

function manhattanDist(a: Position, b: Position): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function popMinTimeItem(queue: ScheduledCellEvent[]): ScheduledCellEvent {
  let bestIdx = 0;
  let bestTime = queue[0].timeMs;
  for (let i = 1; i < queue.length; i++) {
    if (queue[i].timeMs < bestTime) {
      bestTime = queue[i].timeMs;
      bestIdx = i;
    }
  }
  const item = queue[bestIdx];
  queue.splice(bestIdx, 1);
  return item;
}

/**
 * Expands a list of initial positions to destroy, recursively triggering any
 * Striped, Wrapped, or Color Bomb candies caught in the blast in exact
 * chronological distance-based chain-reaction order.
 */
export function resolveDestructionChain(
  grid: Grid,
  initialPositions: Position[],
  skipSpecialPosKeys: Set<string> = new Set(),
  options: DestructionOptions = {}
): ClearResolution {
  const clearedKeys = new Set<string>();
  const poppedKeys = new Set<string>();
  const triggeredSpecialKeys = new Set<string>();
  const vfxEvents: VfxEvent[] = [];
  const triggeredSpecials: SpecialType[] = [];
  const timelineSteps: ClearTimelineStep[] = [];
  let bonusScore = 0;

  const basePopDuration = options.popDurationMs ?? FX_TIMING.popTotalDuration;

  // Deduplicate initial positions while preserving valid board coordinates
  const uniqueInitial: Position[] = [];
  const seenInit = new Set<string>();
  for (const p of initialPositions) {
    if (p.row < 0 || p.row >= GRID_SIZE || p.col < 0 || p.col >= GRID_SIZE) continue;
    if (!grid[p.row][p.col]) continue;
    const k = `${p.row},${p.col}`;
    if (!seenInit.has(k)) {
      seenInit.add(k);
      uniqueInitial.push(p);
    }
  }

  const origin = options.originPos ?? uniqueInitial[0] ?? { row: 3, col: 3 };
  uniqueInitial.sort((a, b) => {
    const da = manhattanDist(a, origin);
    const db = manhattanDist(b, origin);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  // Compute staggered base start times for initial matched candies (40ms <=6, 25ms >6, max 300ms total)
  const initCount = uniqueInitial.length;
  let staggerStep =
    initCount <= 6 ? FX_TIMING.staggerSmallStep : FX_TIMING.staggerLargeStep;
  if (initCount > 1 && (initCount - 1) * staggerStep > FX_TIMING.staggerMaxTotal) {
    staggerStep = FX_TIMING.staggerMaxTotal / (initCount - 1);
  }

  const queue: ScheduledCellEvent[] = [];
  for (let i = 0; i < uniqueInitial.length; i++) {
    const p = uniqueInitial[i];
    const k = `${p.row},${p.col}`;
    const seeded = options.seedTimes?.get(k);
    queue.push({
      pos: p,
      timeMs: seeded !== undefined ? seeded : Math.round(i * staggerStep),
      fromParentEffect: seeded !== undefined,
    });
  }

  const scheduleCandyPop = (
    row: number,
    col: number,
    piece: CandyPiece,
    timeMs: number,
    durationMs: number
  ) => {
    const key = `${row},${col}`;
    if (poppedKeys.has(key)) return;
    poppedKeys.add(key);
    clearedKeys.add(key);
    const burstCount = piece.special === 'none' ? 3 : 4;
    vfxEvents.push({
      type: 'burst',
      row,
      col,
      color: piece.color,
      count: burstCount,
    });
    timelineSteps.push({
      kind: 'candy-pop',
      timeMs,
      row,
      col,
      color: piece.color,
      special: piece.special,
      popDurationMs: durationMs,
      burstCount,
      pitchStep: 0, // assigned in chronological order after loop
    });
  };

  while (queue.length > 0) {
    const item = popMinTimeItem(queue);
    const { pos, timeMs, fromParentEffect } = item;
    if (pos.row < 0 || pos.row >= GRID_SIZE || pos.col < 0 || pos.col >= GRID_SIZE) continue;

    const key = `${pos.row},${pos.col}`;
    const piece = grid[pos.row][pos.col];
    if (!piece) continue;

    const isTriggerableSpecial =
      piece.special !== 'none' &&
      !skipSpecialPosKeys.has(key) &&
      !triggeredSpecialKeys.has(key);

    if (isTriggerableSpecial) {
      triggeredSpecialKeys.add(key);
      clearedKeys.add(key);
      triggeredSpecials.push(piece.special);

      // If another special's beam/shockwave touched this special, wait +80ms before launching its effect
      const triggerStart = fromParentEffect
        ? timeMs + FX_TIMING.chainTriggerDelay
        : timeMs;

      if (piece.special === 'striped-h' || piece.special === 'striped-v') {
        const horizontal = piece.special === 'striped-h';
        bonusScore += 180;
        vfxEvents.push({
          type: 'special-glow',
          row: pos.row,
          col: pos.col,
          color: piece.color,
          radius: 1.5,
          durationMs: FX_TIMING.stripedPulseDuration,
        });
        vfxEvents.push(
          horizontal
            ? {
                type: 'beam-h',
                row: pos.row,
                originCol: pos.col,
                color: piece.color,
                perCellMs: FX_TIMING.stripedBeamPerCell,
              }
            : {
                type: 'beam-v',
                col: pos.col,
                originRow: pos.row,
                color: piece.color,
                perCellMs: FX_TIMING.stripedBeamPerCell,
              }
        );

        // 1) Pulse 250ms, then 2) beam shoots outward at 45ms/cell
        timelineSteps.push({
          kind: 'special-pulse',
          timeMs: triggerStart,
          row: pos.row,
          col: pos.col,
          color: piece.color,
          special: piece.special,
          durationMs: FX_TIMING.stripedPulseDuration,
        });

        const beamStart = triggerStart + FX_TIMING.stripedPulseDuration;
        timelineSteps.push({
          kind: 'striped-beam',
          timeMs: beamStart,
          row: pos.row,
          col: pos.col,
          horizontal,
          color: piece.color,
          perCellMs: FX_TIMING.stripedBeamPerCell,
        });

        // The striped candy itself pops as the beam fires
        scheduleCandyPop(pos.row, pos.col, piece, beamStart, FX_TIMING.popTotalDuration);

        if (horizontal) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (c === pos.col) continue;
            const dist = Math.abs(c - pos.col);
            queue.push({
              pos: { row: pos.row, col: c },
              timeMs: beamStart + dist * FX_TIMING.stripedBeamPerCell,
              fromParentEffect: true,
            });
          }
        } else {
          for (let r = 0; r < GRID_SIZE; r++) {
            if (r === pos.row) continue;
            const dist = Math.abs(r - pos.row);
            queue.push({
              pos: { row: r, col: pos.col },
              timeMs: beamStart + dist * FX_TIMING.stripedBeamPerCell,
              fromParentEffect: true,
            });
          }
        }
      } else if (piece.special === 'wrapped') {
        bonusScore += 300;
        vfxEvents.push({
          type: 'special-glow',
          row: pos.row,
          col: pos.col,
          color: piece.color,
          radius: 1.7,
          durationMs: FX_TIMING.wrappedPulseDuration,
        });
        vfxEvents.push({
          type: 'shockwave',
          row: pos.row,
          col: pos.col,
          color: piece.color,
          radius: 1.8,
          durationMs: FX_TIMING.wrappedShockwaveDuration,
        });

        // 1) Pulse 300ms, then 2) 350ms shockwave expanding outward, neighbors pop at dist * 60ms
        timelineSteps.push({
          kind: 'special-pulse',
          timeMs: triggerStart,
          row: pos.row,
          col: pos.col,
          color: piece.color,
          special: piece.special,
          durationMs: FX_TIMING.wrappedPulseDuration,
        });

        const waveStart = triggerStart + FX_TIMING.wrappedPulseDuration;
        timelineSteps.push({
          kind: 'wrapped-shockwave',
          timeMs: waveStart,
          row: pos.row,
          col: pos.col,
          color: piece.color,
          radius: 1.8,
          durationMs: FX_TIMING.wrappedShockwaveDuration,
        });

        scheduleCandyPop(pos.row, pos.col, piece, waveStart, FX_TIMING.popTotalDuration);

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const dist = Math.hypot(dr, dc);
            queue.push({
              pos: { row: pos.row + dr, col: pos.col + dc },
              timeMs: waveStart + Math.round(dist * FX_TIMING.wrappedDistanceStagger),
              fromParentEffect: true,
            });
          }
        }
      } else if (piece.special === 'color-bomb') {
        bonusScore += 500;
        const counts: Partial<Record<CandyColor, number>> = {};
        let bestColor: CandyColor = piece.color;
        let maxCount = -1;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const p = grid[r][c];
            if (p && p.special !== 'color-bomb') {
              const n = (counts[p.color] || 0) + 1;
              counts[p.color] = n;
              if (n > maxCount) {
                maxCount = n;
                bestColor = p.color;
              }
            }
          }
        }

        const targets: Position[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const p = grid[r][c];
            if (p && p.color === bestColor) {
              targets.push({ row: r, col: c });
            }
          }
        }
        targets.sort((a, b) => manhattanDist(a, pos) - manhattanDist(b, pos));

        // 1) Shake 250ms + flash
        timelineSteps.push({
          kind: 'bomb-shake',
          timeMs: triggerStart,
          row: pos.row,
          col: pos.col,
          color: bestColor,
          durationMs: FX_TIMING.colorBombShakeDuration,
        });

        const raysStart = triggerStart + FX_TIMING.colorBombShakeDuration;
        const rayStep =
          targets.length > 1
            ? Math.min(
                FX_TIMING.colorBombRayStagger,
                FX_TIMING.colorBombRayMaxStagger / (targets.length - 1)
              )
            : 0;

        for (let i = 0; i < targets.length; i++) {
          const tPos = targets[i];
          const rayTime = raysStart + Math.round(i * rayStep);
          vfxEvents.push({
            type: 'lightning',
            fromRow: pos.row,
            fromCol: pos.col,
            toRow: tPos.row,
            toCol: tPos.col,
            color: bestColor,
            durationMs: FX_TIMING.colorBombTargetGlowDelay + 120,
          });
          timelineSteps.push({
            kind: 'bomb-ray',
            timeMs: rayTime,
            fromRow: pos.row,
            fromCol: pos.col,
            toRow: tPos.row,
            toCol: tPos.col,
            color: bestColor,
            glowDurationMs: FX_TIMING.colorBombTargetGlowDelay,
          });
          queue.push({
            pos: tPos,
            timeMs: rayTime + FX_TIMING.colorBombTargetGlowDelay,
            fromParentEffect: true,
          });
        }

        const bombPopTime =
          raysStart + Math.round(Math.max(0, targets.length - 1) * rayStep) + 160;
        scheduleCandyPop(pos.row, pos.col, piece, bombPopTime, FX_TIMING.popTotalDuration);
      }
      continue;
    }

    // Regular candy (or already-skipped/already-triggered cell): pop once at earliest hit time
    if (!poppedKeys.has(key)) {
      scheduleCandyPop(pos.row, pos.col, piece, timeMs, basePopDuration);
    }
  }

  return finalizeTimelineResolution(
    clearedKeys,
    vfxEvents,
    triggeredSpecials,
    bonusScore,
    timelineSteps
  );
}

function finalizeTimelineResolution(
  clearedKeys: Set<string>,
  vfxEvents: VfxEvent[],
  triggeredSpecials: SpecialType[],
  bonusScore: number,
  timelineSteps: ClearTimelineStep[]
): ClearResolution {
  timelineSteps.sort((a, b) => a.timeMs - b.timeMs);

  let pitchIdx = 0;
  let totalDurationMs = 0;
  for (let i = 0; i < timelineSteps.length; i++) {
    const step = timelineSteps[i];
    if (step.kind === 'candy-pop') {
      step.pitchStep = pitchIdx;
      pitchIdx += 1;
      totalDurationMs = Math.max(totalDurationMs, step.timeMs + step.popDurationMs);
    } else if (step.kind === 'special-pulse' || step.kind === 'bomb-shake') {
      totalDurationMs = Math.max(totalDurationMs, step.timeMs + step.durationMs);
    } else if (step.kind === 'wrapped-shockwave') {
      totalDurationMs = Math.max(totalDurationMs, step.timeMs + step.durationMs);
    } else if (step.kind === 'bomb-ray') {
      totalDurationMs = Math.max(totalDurationMs, step.timeMs + step.glowDurationMs);
    } else if (step.kind === 'striped-beam') {
      totalDurationMs = Math.max(totalDurationMs, step.timeMs + GRID_SIZE * step.perCellMs);
    }
  }

  return {
    clearedKeys,
    vfxEvents,
    triggeredSpecials,
    bonusScore,
    timelineSteps,
    totalDurationMs,
  };
}

/**
 * Checks if swapping two positions triggers a Special + Special or Color Bomb + Candy combo.
 */
export function isSpecialComboSwap(a: CandyPiece | null, b: CandyPiece | null): boolean {
  if (!a || !b) return false;
  if (a.special === 'color-bomb' || b.special === 'color-bomb') return true;
  if (a.special !== 'none' && b.special !== 'none') return true;
  return false;
}

export function resolveSpecialSwapCombo(
  grid: Grid,
  posA: Position,
  posB: Position
): ClearResolution {
  const a = grid[posA.row][posA.col]!;
  const b = grid[posB.row][posB.col]!;
  const targets: Position[] = [];
  const seedTimes = new Map<string, number>();
  const prefixSteps: ClearTimelineStep[] = [];
  const vfxEvents: VfxEvent[] = [];
  const skipKeys = new Set<string>([`${posA.row},${posA.col}`, `${posB.row},${posB.col}`]);
  const comboSpecials: SpecialType[] = [];
  let extraBonus = 0;

  const setEarliestSeed = (r: number, c: number, t: number) => {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;
    const k = `${r},${c}`;
    const prev = seedTimes.get(k);
    if (prev === undefined || t < prev) {
      seedTimes.set(k, t);
    }
    targets.push({ row: r, col: c });
  };

  // 1. Color Bomb + Color Bomb -> Clears entire board in expanding wave!
  if (a.special === 'color-bomb' && b.special === 'color-bomb') {
    extraBonus += 2000;
    comboSpecials.push('color-bomb', 'color-bomb');
    prefixSteps.push({
      kind: 'bomb-shake',
      timeMs: 0,
      row: posB.row,
      col: posB.col,
      color: 'purple',
      durationMs: FX_TIMING.colorBombShakeDuration,
    });
    const waveStart = FX_TIMING.colorBombShakeDuration;
    prefixSteps.push({
      kind: 'wrapped-shockwave',
      timeMs: waveStart,
      row: posB.row,
      col: posB.col,
      color: 'purple',
      radius: 6,
      durationMs: 420,
    });
    setEarliestSeed(posA.row, posA.col, waveStart);
    setEarliestSeed(posB.row, posB.col, waveStart);

    const boardCells: Position[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if ((r === posA.row && c === posA.col) || (r === posB.row && c === posB.col)) continue;
        boardCells.push({ row: r, col: c });
      }
    }
    boardCells.sort((p1, p2) => manhattanDist(p1, posB) - manhattanDist(p2, posB));

    let rayIdx = 0;
    for (let i = 0; i < boardCells.length; i++) {
      const cellPos = boardCells[i];
      const dist = Math.hypot(cellPos.row - posB.row, cellPos.col - posB.col);
      const hitT = waveStart + Math.round(dist * 55);
      if ((cellPos.row + cellPos.col) % 4 === 0 && rayIdx < 12) {
        prefixSteps.push({
          kind: 'bomb-ray',
          timeMs: waveStart + rayIdx * 35,
          fromRow: posB.row,
          fromCol: posB.col,
          toRow: cellPos.row,
          toCol: cellPos.col,
          color: ALL_COLORS[(cellPos.row + cellPos.col) % ALL_COLORS.length],
          glowDurationMs: 160,
        });
        rayIdx += 1;
      }
      setEarliestSeed(cellPos.row, cellPos.col, hitT);
    }
  }
  // 2. Color Bomb + Regular or Special Candy
  else if (a.special === 'color-bomb' || b.special === 'color-bomb') {
    const bombPos = a.special === 'color-bomb' ? posA : posB;
    const otherPos = a.special === 'color-bomb' ? posB : posA;
    const otherPiece = a.special === 'color-bomb' ? b : a;
    const targetColor = otherPiece.color;
    comboSpecials.push('color-bomb');
    extraBonus += 750;

    prefixSteps.push({
      kind: 'bomb-shake',
      timeMs: 0,
      row: bombPos.row,
      col: bombPos.col,
      color: targetColor,
      durationMs: FX_TIMING.colorBombShakeDuration,
    });

    const raysStart = FX_TIMING.colorBombShakeDuration;
    const matchingTargets: Position[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (cell && cell.color === targetColor) {
          if (otherPiece.special === 'striped-h' || otherPiece.special === 'striped-v') {
            cell.special = (r + c) % 2 === 0 ? 'striped-h' : 'striped-v';
          } else if (otherPiece.special === 'wrapped') {
            cell.special = 'wrapped';
          }
          matchingTargets.push({ row: r, col: c });
        }
      }
    }
    matchingTargets.sort((p1, p2) => manhattanDist(p1, bombPos) - manhattanDist(p2, bombPos));

    const rayStep =
      matchingTargets.length > 1
        ? Math.min(
            FX_TIMING.colorBombRayStagger,
            FX_TIMING.colorBombRayMaxStagger / (matchingTargets.length - 1)
          )
        : 0;

    for (let i = 0; i < matchingTargets.length; i++) {
      const tPos = matchingTargets[i];
      const rayTime = raysStart + Math.round(i * rayStep);
      prefixSteps.push({
        kind: 'bomb-ray',
        timeMs: rayTime,
        fromRow: bombPos.row,
        fromCol: bombPos.col,
        toRow: tPos.row,
        toCol: tPos.col,
        color: targetColor,
        glowDurationMs: FX_TIMING.colorBombTargetGlowDelay,
      });
      setEarliestSeed(tPos.row, tPos.col, rayTime + FX_TIMING.colorBombTargetGlowDelay);
    }

    const bombPopTime =
      raysStart + Math.round(Math.max(0, matchingTargets.length - 1) * rayStep) + 160;
    setEarliestSeed(bombPos.row, bombPos.col, bombPopTime);
    setEarliestSeed(otherPos.row, otherPos.col, raysStart + FX_TIMING.colorBombTargetGlowDelay);
  }
  // 3. Striped + Striped -> Cross blast centered on posB
  else if (
    (a.special === 'striped-h' || a.special === 'striped-v') &&
    (b.special === 'striped-h' || b.special === 'striped-v')
  ) {
    extraBonus += 450;
    comboSpecials.push('striped-h', 'striped-v');

    prefixSteps.push({
      kind: 'special-pulse',
      timeMs: 0,
      row: posB.row,
      col: posB.col,
      color: b.color,
      special: 'striped-h',
      durationMs: FX_TIMING.stripedPulseDuration,
    });
    const beamStart = FX_TIMING.stripedPulseDuration;
    prefixSteps.push({
      kind: 'striped-beam',
      timeMs: beamStart,
      row: posB.row,
      col: posB.col,
      horizontal: true,
      color: b.color,
      perCellMs: FX_TIMING.stripedBeamPerCell,
    });
    prefixSteps.push({
      kind: 'striped-beam',
      timeMs: beamStart,
      row: posB.row,
      col: posB.col,
      horizontal: false,
      color: a.color,
      perCellMs: FX_TIMING.stripedBeamPerCell,
    });

    setEarliestSeed(posA.row, posA.col, beamStart);
    setEarliestSeed(posB.row, posB.col, beamStart);
    for (let i = 0; i < GRID_SIZE; i++) {
      setEarliestSeed(posB.row, i, beamStart + Math.abs(i - posB.col) * FX_TIMING.stripedBeamPerCell);
      setEarliestSeed(i, posB.col, beamStart + Math.abs(i - posB.row) * FX_TIMING.stripedBeamPerCell);
    }
  }
  // 4. Striped + Wrapped -> Giant 3-row & 3-col mega cross!
  else if (
    ((a.special === 'striped-h' || a.special === 'striped-v') && b.special === 'wrapped') ||
    ((b.special === 'striped-h' || b.special === 'striped-v') && a.special === 'wrapped')
  ) {
    extraBonus += 850;
    comboSpecials.push('wrapped', 'striped-h');

    prefixSteps.push({
      kind: 'special-pulse',
      timeMs: 0,
      row: posB.row,
      col: posB.col,
      color: b.color,
      special: 'wrapped',
      durationMs: FX_TIMING.wrappedPulseDuration,
    });
    const beamStart = FX_TIMING.wrappedPulseDuration;
    setEarliestSeed(posA.row, posA.col, beamStart);
    setEarliestSeed(posB.row, posB.col, beamStart);

    for (let d = -1; d <= 1; d++) {
      const r = posB.row + d;
      const c = posB.col + d;
      const laneOffset = Math.abs(d) * 35;
      if (r >= 0 && r < GRID_SIZE) {
        prefixSteps.push({
          kind: 'striped-beam',
          timeMs: beamStart + laneOffset,
          row: r,
          col: posB.col,
          horizontal: true,
          color: b.color,
          perCellMs: FX_TIMING.stripedBeamPerCell,
        });
        for (let col = 0; col < GRID_SIZE; col++) {
          setEarliestSeed(
            r,
            col,
            beamStart + laneOffset + Math.abs(col - posB.col) * FX_TIMING.stripedBeamPerCell
          );
        }
      }
      if (c >= 0 && c < GRID_SIZE) {
        prefixSteps.push({
          kind: 'striped-beam',
          timeMs: beamStart + laneOffset,
          row: posB.row,
          col: c,
          horizontal: false,
          color: a.color,
          perCellMs: FX_TIMING.stripedBeamPerCell,
        });
        for (let row = 0; row < GRID_SIZE; row++) {
          setEarliestSeed(
            row,
            c,
            beamStart + laneOffset + Math.abs(row - posB.row) * FX_TIMING.stripedBeamPerCell
          );
        }
      }
    }
  }
  // 5. Wrapped + Wrapped -> Huge 5x5 blast!
  else if (a.special === 'wrapped' && b.special === 'wrapped') {
    extraBonus += 900;
    comboSpecials.push('wrapped', 'wrapped');

    prefixSteps.push({
      kind: 'special-pulse',
      timeMs: 0,
      row: posB.row,
      col: posB.col,
      color: b.color,
      special: 'wrapped',
      durationMs: FX_TIMING.wrappedPulseDuration,
    });
    const waveStart = FX_TIMING.wrappedPulseDuration;
    prefixSteps.push({
      kind: 'wrapped-shockwave',
      timeMs: waveStart,
      row: posB.row,
      col: posB.col,
      color: b.color,
      radius: 3.4,
      durationMs: FX_TIMING.wrappedShockwaveDuration,
    });

    setEarliestSeed(posA.row, posA.col, waveStart);
    setEarliestSeed(posB.row, posB.col, waveStart);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dist = Math.hypot(dr, dc);
        setEarliestSeed(
          posB.row + dr,
          posB.col + dc,
          waveStart + Math.round(dist * FX_TIMING.wrappedDistanceStagger)
        );
      }
    }
  }

  const chain = resolveDestructionChain(grid, targets, skipKeys, {
    originPos: posB,
    seedTimes,
  });

  const combinedSteps = [...prefixSteps, ...chain.timelineSteps];
  const finalized = finalizeTimelineResolution(
    chain.clearedKeys,
    [...vfxEvents, ...chain.vfxEvents],
    [...comboSpecials, ...chain.triggeredSpecials],
    extraBonus + chain.bonusScore,
    combinedSteps
  );

  return finalized;
}

/**
 * Drops existing candies down into null cells and spawns new candies from the top.
 * Structurally shares unchanged CandyPiece references so React.memo tiles skip re-rendering.
 */
export function applyGravityAndRefill(
  grid: Grid,
  colorsCount: number,
  fxSpeed = 1.0
): Grid {
  const next: Grid = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null)
  );
  const seq = nextDropSeq();

  for (let c = 0; c < GRID_SIZE; c++) {
    const columnEntries: { piece: CandyPiece; fromRow: number }[] = [];
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      const piece = grid[r][c];
      if (piece) {
        columnEntries.push({ piece, fromRow: r });
      }
    }

    let writeRow = GRID_SIZE - 1;
    for (const entry of columnEntries) {
      const dropRows = Math.max(0, writeRow - entry.fromRow);
      if (
        dropRows === 0 &&
        !entry.piece.isMatched &&
        !entry.piece.isNew &&
        (entry.piece.dropRows ?? 0) === 0
      ) {
        // Untouched tile (or newly forged special staying at its cell): preserve exact ref!
        next[writeRow][c] = entry.piece;
      } else if (dropRows === 0) {
        next[writeRow][c] = {
          id: entry.piece.id,
          color: entry.piece.color,
          special: entry.piece.special,
          isNew: false,
          isMatched: false,
          dropRows: 0,
          isForgedSpecial: entry.piece.isForgedSpecial,
          fxSpeed,
        };
      } else {
        next[writeRow][c] = {
          id: entry.piece.id,
          color: entry.piece.color,
          special: entry.piece.special,
          isNew: false,
          isMatched: false,
          dropRows,
          dropSeq: seq,
          isForgedSpecial: false,
          fxSpeed,
        };
      }
      writeRow -= 1;
    }

    const spawnedCount = writeRow + 1;
    while (writeRow >= 0) {
      next[writeRow][c] = {
        id: nextCandyId(),
        color: randomColor(colorsCount),
        special: 'none',
        isNew: true,
        isMatched: false,
        dropRows: spawnedCount,
        dropSeq: seq,
        fxSpeed,
      };
      writeRow -= 1;
    }
  }

  return next;
}

/**
 * Finds a valid move pair on the board for hints and deadlock checks.
 */
export function findValidMove(grid: Grid): [Position, Position] | null {
  const trySwap = (r1: number, c1: number, r2: number, c2: number): boolean => {
    const a = grid[r1][c1];
    const b = grid[r2][c2];
    if (!a || !b) return false;
    if (isSpecialComboSwap(a, b)) return true;

    const test = cloneGrid(grid);
    test[r1][c1] = b;
    test[r2][c2] = a;
    return findMatchClusters(test).length > 0;
  };

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c + 1 < GRID_SIZE && trySwap(r, c, r, c + 1)) {
        return [
          { row: r, col: c },
          { row: r, col: c + 1 },
        ];
      }
      if (r + 1 < GRID_SIZE && trySwap(r, c, r + 1, c)) {
        return [
          { row: r, col: c },
          { row: r + 1, col: c },
        ];
      }
    }
  }
  return null;
}

/**
 * Shuffles non-special candies until there are no immediate matches and at least one valid move.
 */
export function shuffleGrid(grid: Grid, colorsCount: number, fxSpeed = 1.0): Grid {
  const seq = nextDropSeq();
  const pieces: CandyPiece[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c]) {
        pieces.push({
          ...grid[r][c]!,
          isNew: true,
          isMatched: false,
          dropRows: 1,
          dropSeq: seq,
          isForgedSpecial: false,
          fxSpeed,
        });
      }
    }
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    const candidate: Grid = Array.from({ length: GRID_SIZE }, (_, r) =>
      Array.from({ length: GRID_SIZE }, (_, c) => pieces[r * GRID_SIZE + c])
    );
    if (findMatchClusters(candidate).length === 0 && findValidMove(candidate)) {
      return candidate;
    }
  }

  return createInitialGrid(colorsCount);
}
