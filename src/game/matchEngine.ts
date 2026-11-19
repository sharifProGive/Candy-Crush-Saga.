import { ALL_COLORS } from './levels';
import { CandyColor, CandyPiece, Grid, Position, SpecialType, VfxEvent } from './types';

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
}

/**
 * Expands a list of initial positions to destroy, recursively triggering any
 * Striped, Wrapped, or Color Bomb candies caught in the blast.
 */
export function resolveDestructionChain(
  grid: Grid,
  initialPositions: Position[],
  skipSpecialPosKeys: Set<string> = new Set()
): ClearResolution {
  const clearedKeys = new Set<string>();
  const triggeredSpecialKeys = new Set<string>();
  const vfxEvents: VfxEvent[] = [];
  const triggeredSpecials: SpecialType[] = [];
  let bonusScore = 0;

  const queue: Position[] = [...initialPositions];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    if (pos.row < 0 || pos.row >= GRID_SIZE || pos.col < 0 || pos.col >= GRID_SIZE) continue;
    const key = `${pos.row},${pos.col}`;
    const piece = grid[pos.row][pos.col];
    if (!piece) continue;

    if (!clearedKeys.has(key)) {
      clearedKeys.add(key);
      vfxEvents.push({
        type: 'burst',
        row: pos.row,
        col: pos.col,
        color: piece.color,
        count: piece.special === 'none' ? 10 : 18,
      });
    }

    if (piece.special !== 'none' && !skipSpecialPosKeys.has(key) && !triggeredSpecialKeys.has(key)) {
      triggeredSpecialKeys.add(key);
      triggeredSpecials.push(piece.special);

      if (piece.special === 'striped-h') {
        bonusScore += 180;
        vfxEvents.push({ type: 'beam-h', row: pos.row, color: piece.color });
        for (let c = 0; c < GRID_SIZE; c++) {
          if (c !== pos.col) queue.push({ row: pos.row, col: c });
        }
      } else if (piece.special === 'striped-v') {
        bonusScore += 180;
        vfxEvents.push({ type: 'beam-v', col: pos.col, color: piece.color });
        for (let r = 0; r < GRID_SIZE; r++) {
          if (r !== pos.row) queue.push({ row: r, col: pos.col });
        }
      } else if (piece.special === 'wrapped') {
        bonusScore += 300;
        vfxEvents.push({ type: 'shockwave', row: pos.row, col: pos.col, color: piece.color, radius: 1.8 });
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            queue.push({ row: pos.row + dr, col: pos.col + dc });
          }
        }
      } else if (piece.special === 'color-bomb') {
        bonusScore += 500;
        // Destroy most abundant color on board
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
        vfxEvents.push({ type: 'shockwave', row: pos.row, col: pos.col, color: bestColor, radius: 2.5 });
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const p = grid[r][c];
            if (p && p.color === bestColor) {
              vfxEvents.push({
                type: 'lightning',
                fromRow: pos.row,
                fromCol: pos.col,
                toRow: r,
                toCol: c,
                color: bestColor,
              });
              queue.push({ row: r, col: c });
            }
          }
        }
      }
    }
  }

  return { clearedKeys, vfxEvents, triggeredSpecials, bonusScore };
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
  const targets: Position[] = [posA, posB];
  const vfxEvents: VfxEvent[] = [];
  const skipKeys = new Set<string>([`${posA.row},${posA.col}`, `${posB.row},${posB.col}`]);
  const comboSpecials: SpecialType[] = [];
  let extraBonus = 0;

  // 1. Color Bomb + Color Bomb -> Clears entire board!
  if (a.special === 'color-bomb' && b.special === 'color-bomb') {
    extraBonus += 2000;
    comboSpecials.push('color-bomb', 'color-bomb');
    vfxEvents.push({ type: 'shockwave', row: posB.row, col: posB.col, color: 'purple', radius: 6 });
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        targets.push({ row: r, col: c });
        if ((r + c) % 3 === 0) {
          vfxEvents.push({
            type: 'lightning',
            fromRow: posB.row,
            fromCol: posB.col,
            toRow: r,
            toCol: c,
            color: ALL_COLORS[(r + c) % ALL_COLORS.length],
          });
        }
      }
    }
  }
  // 2. Color Bomb + Regular or Special Candy
  else if (a.special === 'color-bomb' || b.special === 'color-bomb') {
    const bombPos = a.special === 'color-bomb' ? posA : posB;
    const otherPiece = a.special === 'color-bomb' ? b : a;
    const targetColor = otherPiece.color;
    comboSpecials.push('color-bomb');
    extraBonus += 750;

    vfxEvents.push({ type: 'shockwave', row: bombPos.row, col: bombPos.col, color: targetColor, radius: 3 });

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (cell && cell.color === targetColor) {
          // If swapped with striped or wrapped, upgrade matching candies before detonation!
          if (otherPiece.special === 'striped-h' || otherPiece.special === 'striped-v') {
            cell.special = (r + c) % 2 === 0 ? 'striped-h' : 'striped-v';
          } else if (otherPiece.special === 'wrapped') {
            cell.special = 'wrapped';
          }
          vfxEvents.push({
            type: 'lightning',
            fromRow: bombPos.row,
            fromCol: bombPos.col,
            toRow: r,
            toCol: c,
            color: targetColor,
          });
          targets.push({ row: r, col: c });
        }
      }
    }
  }
  // 3. Striped + Striped -> Cross blast centered on posB
  else if (
    (a.special === 'striped-h' || a.special === 'striped-v') &&
    (b.special === 'striped-h' || b.special === 'striped-v')
  ) {
    extraBonus += 450;
    comboSpecials.push('striped-h', 'striped-v');
    vfxEvents.push({ type: 'beam-h', row: posB.row, color: b.color });
    vfxEvents.push({ type: 'beam-v', col: posB.col, color: a.color });
    for (let i = 0; i < GRID_SIZE; i++) {
      targets.push({ row: posB.row, col: i });
      targets.push({ row: i, col: posB.col });
    }
  }
  // 4. Striped + Wrapped -> Giant 3-row & 3-col mega cross!
  else if (
    ((a.special === 'striped-h' || a.special === 'striped-v') && b.special === 'wrapped') ||
    ((b.special === 'striped-h' || b.special === 'striped-v') && a.special === 'wrapped')
  ) {
    extraBonus += 850;
    comboSpecials.push('wrapped', 'striped-h');
    for (let d = -1; d <= 1; d++) {
      const r = posB.row + d;
      const c = posB.col + d;
      if (r >= 0 && r < GRID_SIZE) {
        vfxEvents.push({ type: 'beam-h', row: r, color: b.color });
        for (let col = 0; col < GRID_SIZE; col++) targets.push({ row: r, col });
      }
      if (c >= 0 && c < GRID_SIZE) {
        vfxEvents.push({ type: 'beam-v', col: c, color: a.color });
        for (let row = 0; row < GRID_SIZE; row++) targets.push({ row, col: c });
      }
    }
  }
  // 5. Wrapped + Wrapped -> Huge 5x5 blast!
  else if (a.special === 'wrapped' && b.special === 'wrapped') {
    extraBonus += 900;
    comboSpecials.push('wrapped', 'wrapped');
    vfxEvents.push({ type: 'shockwave', row: posB.row, col: posB.col, color: b.color, radius: 3.4 });
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        targets.push({ row: posB.row + dr, col: posB.col + dc });
      }
    }
  }

  const chain = resolveDestructionChain(grid, targets, skipKeys);
  return {
    clearedKeys: chain.clearedKeys,
    vfxEvents: [...vfxEvents, ...chain.vfxEvents],
    triggeredSpecials: [...comboSpecials, ...chain.triggeredSpecials],
    bonusScore: extraBonus + chain.bonusScore,
  };
}

/**
 * Drops existing candies down into null cells and spawns new candies from the top.
 */
export function applyGravityAndRefill(grid: Grid, colorsCount: number): Grid {
  const next = cloneGrid(grid);

  for (let c = 0; c < GRID_SIZE; c++) {
    const columnEntries: { piece: CandyPiece; fromRow: number }[] = [];
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      const piece = next[r][c];
      if (piece) {
        columnEntries.push({
          piece: { ...piece, isNew: false, isMatched: false, dropRows: 0 },
          fromRow: r,
        });
      }
    }

    let writeRow = GRID_SIZE - 1;
    for (const entry of columnEntries) {
      const dropRows = Math.max(0, writeRow - entry.fromRow);
      next[writeRow][c] = {
        ...entry.piece,
        dropRows,
      };
      writeRow -= 1;
    }

    const spawnedCount = writeRow + 1;
    while (writeRow >= 0) {
      next[writeRow][c] = {
        id: nextCandyId(),
        color: randomColor(colorsCount),
        special: 'none',
        isNew: true,
        dropRows: spawnedCount,
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
export function shuffleGrid(grid: Grid, colorsCount: number): Grid {
  const pieces: CandyPiece[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c]) pieces.push({ ...grid[r][c]!, isNew: true, isMatched: false });
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
