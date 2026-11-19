import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Hammer,
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
import { PlayerInventory } from '../game/dailyRewards';
import { CANDY_HEX, LEVELS } from '../game/levels';
import {
  applyGravityAndRefill,
  cloneGrid,
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
  FloatingScore,
  Grid,
  LevelConfig,
  PlayModalState,
  Position,
  PraisePopup,
  PraiseWord,
  SpecialType,
} from '../game/types';
import { CandySprite } from './CandySprite';
import { VfxCanvas, VfxCanvasHandle } from './VfxCanvas';

interface GameBoardProps {
  level: LevelConfig;
  backgroundMusicEnabled: boolean;
  inventory: PlayerInventory;
  onConsumeBooster: (type: keyof PlayerInventory) => boolean;
  onOpenSettings: () => void;
  onLevelComplete: (levelId: number, score: number, stars: number) => void;
  onNextLevel: () => void;
  onBackToMap: () => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const GameBoard: React.FC<GameBoardProps> = ({
  level,
  backgroundMusicEnabled,
  inventory,
  onConsumeBooster,
  onOpenSettings,
  onLevelComplete,
  onNextLevel,
  onBackToMap,
}) => {
  const [grid, setGrid] = useState<Grid>(() => createInitialGrid(level.colorsCount));
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(level.moves);
  const [orderCollected, setOrderCollected] = useState(0);
  const [modalState, setModalState] = useState<PlayModalState>('NONE');
  const [selected, setSelected] = useState<Position | null>(null);
  const [hintPair, setHintPair] = useState<[Position, Position] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [praisePopup, setPraisePopup] = useState<PraisePopup | null>(null);
  const [hammerActive, setHammerActive] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [swappingPair, setSwappingPair] = useState<{ a: Position; b: Position } | null>(null);

  const vfxRef = useRef<VfxCanvasHandle | null>(null);
  const dragStartRef = useRef<{ row: number; col: number; x: number; y: number } | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const orderRef = useRef(orderCollected);
  orderRef.current = orderCollected;
  const movesRef = useRef(movesLeft);
  movesRef.current = movesLeft;
  const modalRef = useRef(modalState);
  modalRef.current = modalState;
  const isMountedRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    const clearDrag = () => {
      dragStartRef.current = null;
    };
    window.addEventListener('pointerup', clearDrag);
    window.addEventListener('pointercancel', clearDrag);
    return () => {
      isMountedRef.current = false;
      runIdRef.current += 1;
      window.removeEventListener('pointerup', clearDrag);
      window.removeEventListener('pointercancel', clearDrag);
    };
  }, []);

  // Reset board cleanly whenever level changes
  const resetLevel = useCallback(() => {
    runIdRef.current += 1;
    vfxRef.current?.clear();
    setGrid(createInitialGrid(level.colorsCount));
    setScore(0);
    setMovesLeft(level.moves);
    setOrderCollected(0);
    setModalState('NONE');
    setSelected(null);
    setHintPair(null);
    setSwappingPair(null);
    setIsBusy(false);
    setHammerActive(false);
    setFloatingScores([]);
    setPraisePopup(null);
    setStatusBanner(null);
  }, [level]);

  useEffect(() => {
    resetLevel();
  }, [resetLevel]);

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
      const move = findValidMove(grid);
      if (move) setHintPair(move);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [grid, isBusy, modalState]);

  const triggerShake = useCallback(() => {
    setShaking(false);
    requestAnimationFrame(() => {
      if (isMountedRef.current) setShaking(true);
    });
    window.setTimeout(() => {
      if (isMountedRef.current) setShaking(false);
    }, 340);
  }, []);

  const addFloatingScore = useCallback((row: number, col: number, points: number, hexColor: string) => {
    const id = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFloatingScores((prev) => [...prev.slice(-8), { id, row, col, text: `+${points}`, color: hexColor }]);
    window.setTimeout(() => {
      if (isMountedRef.current) {
        setFloatingScores((prev) => prev.filter((item) => item.id !== id));
      }
    }, 900);
  }, []);

  const showPraise = useCallback((word: PraiseWord) => {
    const spoken = soundEngine.playPraise(word);
    // Display the visual banner on milestone/combo praises even if voice is in cooldown,
    // or synchronize directly when spoken
    if (!spoken && word !== 'Sugar Crush!') return;
    const id = `pr_${Date.now()}`;
    setPraisePopup({ id, word });
    window.setTimeout(() => {
      if (isMountedRef.current) {
        setPraisePopup((curr) => (curr?.id === id ? null : curr));
      }
    }, 1250);
  }, []);

  const playSpecialSounds = (specials: SpecialType[]) => {
    soundEngine.vibrate([24, 30, 36]);
    if (specials.includes('color-bomb')) {
      soundEngine.playColorBomb();
    } else if (specials.includes('wrapped')) {
      soundEngine.playWrapped();
    } else if (specials.includes('striped-h') || specials.includes('striped-v')) {
      soundEngine.playStriped();
    }
  };

  const computeStars = (finalScore: number): number => {
    if (finalScore >= level.starScores[2]) return 3;
    if (finalScore >= level.starScores[1]) return 2;
    if (finalScore >= level.starScores[0]) return 1;
    return 0;
  };

  const clearDropFlags = (g: Grid): Grid =>
    g.map((row) =>
      row.map((cell) => (cell ? { ...cell, isNew: false, dropRows: 0 } : null))
    );

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
          let working = cloneGrid(currentGrid);
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

          // Step 1: Count remaining moves down while forging Striped Candies on the board
          for (let i = 0; i < targets.length; i++) {
            const pos = targets[i];
            const cell = working[pos.row][pos.col];
            if (!cell) continue;
            working[pos.row][pos.col] = {
              ...cell,
              special: i % 2 === 0 ? 'striped-h' : 'striped-v',
              isNew: false,
              dropRows: 0,
            };
            remMovesDisplay = Math.max(0, remMovesDisplay - 1);
            runningScore += 150;
            setMovesLeft(remMovesDisplay);
            setScore(runningScore);
            setGrid(cloneGrid(working));
            soundEngine.playTap();
            vfxRef.current?.emitEvents([
              { type: 'burst', row: pos.row, col: pos.col, color: cell.color, count: 8 },
            ]);
            await sleep(80);
            if (!isMountedRef.current || myRun !== runIdRef.current) return;
          }

          // Account for any remaining moves beyond the converted targets
          const extraMoves = Math.max(0, remMovesDisplay);
          if (extraMoves > 0) {
            runningScore += extraMoves * 150;
            setMovesLeft(0);
            setScore(runningScore);
          }

          // Step 2: Sequentially detonate the converted Striped Candies
          for (const pos of targets) {
            const targetCell = working[pos.row][pos.col];
            if (!targetCell) continue;
            const res = resolveDestructionChain(working, [pos]);
            playSpecialSounds(
              res.triggeredSpecials.length > 0 ? res.triggeredSpecials : ['striped-h']
            );
            triggerShake();

            for (const key of res.clearedKeys) {
              const [r, c] = key.split(',').map(Number);
              const p = working[r][c];
              if (p) p.isMatched = true;
            }

            const stepPoints = res.clearedKeys.size * 30 + res.bonusScore;
            runningScore += stepPoints;
            setGrid(cloneGrid(working));
            setScore(runningScore);
            vfxRef.current?.emitEvents(res.vfxEvents);
            addFloatingScore(pos.row, pos.col, stepPoints, '#ffe047');

            await sleep(165);
            if (!isMountedRef.current || myRun !== runIdRef.current) return;

            for (const key of res.clearedKeys) {
              const [r, c] = key.split(',').map(Number);
              working[r][c] = null;
            }
            working = applyGravityAndRefill(working, level.colorsCount);
            setGrid(cloneGrid(working));
            soundEngine.playCascadeDrop(2);

            await sleep(170);
            if (!isMountedRef.current || myRun !== runIdRef.current) return;

            working = clearDropFlags(working);
          }

          setGrid(cloneGrid(working));
          await sleep(320);
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
        await sleep(650);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
        const reshuffled = shuffleGrid(currentGrid, level.colorsCount);
        setGrid(reshuffled);
        setStatusBanner(null);
        await sleep(260);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
        setGrid((prev) => clearDropFlags(prev));
      }
    },
    [level, onLevelComplete, showPraise, triggerShake, addFloatingScore]
  );

  /**
   * Executes the full match -> special spawn -> destruction -> gravity -> cascade loop.
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
      let workingGrid = cloneGrid(startingGrid);
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
        playSpecialSounds(comboRes.triggeredSpecials);
        triggerShake();

        let orderGain = 0;
        for (const key of comboRes.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          const p = workingGrid[r][c];
          if (p) {
            p.isMatched = true;
            if (level.order && p.color === level.order.color) orderGain += 1;
          }
        }

        const gained = comboRes.clearedKeys.size * 40 + comboRes.bonusScore;
        totalScore += gained;
        totalOrder += orderGain;

        setGrid(cloneGrid(workingGrid));
        setScore(totalScore);
        setOrderCollected(totalOrder);
        vfxRef.current?.emitEvents(comboRes.vfxEvents);
        addFloatingScore(
          initialSpecialCombo.posB.row,
          initialSpecialCombo.posB.col,
          gained,
          '#ffea70'
        );
        const comboSpecials = comboRes.triggeredSpecials;
        if (comboSpecials.includes('color-bomb')) {
          showPraise('Sugar Crush!');
        } else {
          showPraise('Delicious!');
        }

        await sleep(230);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        for (const key of comboRes.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          workingGrid[r][c] = null;
        }
        workingGrid = applyGravityAndRefill(workingGrid, level.colorsCount);
        setGrid(cloneGrid(workingGrid));
        soundEngine.playCascadeDrop(3);

        await sleep(250);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        workingGrid = clearDropFlags(workingGrid);
        setGrid(cloneGrid(workingGrid));
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

        const resolution = resolveDestructionChain(workingGrid, initialDestroyPositions, skipSpawnKeys);
        if (resolution.triggeredSpecials.length > 0) {
          playSpecialSounds(resolution.triggeredSpecials);
          triggerShake();
        } else if (cascade >= 3) {
          triggerShake();
        }

        let orderGain = 0;
        for (const key of resolution.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          const p = workingGrid[r][c];
          if (p) {
            p.isMatched = true;
            if (level.order && p.color === level.order.color) orderGain += 1;
          }
        }

        const multiplier = 1 + (cascade - 1) * 0.35;
        const gained = Math.round(
          (resolution.clearedKeys.size * 30 + resolution.bonusScore) * multiplier
        );
        totalScore += gained;
        totalOrder += orderGain;

        setGrid(cloneGrid(workingGrid));
        setScore(totalScore);
        setOrderCollected(totalOrder);
        vfxRef.current?.emitEvents(resolution.vfxEvents);

        const anchor = clusters[0].spawnPos;
        addFloatingScore(anchor.row, anchor.col, gained, CANDY_HEX[clusters[0].color].glow);

        // Intelligent & Rare Praise Voice-Overs:
        // - "Sugar Crush!" strictly on Color Bomb detonations (or level win milestones)
        // - "Delicious!" only on cascading combo reactions (cascade >= 2)
        // - "Sweet!" only when clearing 4 or more candies
        if (resolution.triggeredSpecials.includes('color-bomb')) {
          showPraise('Sugar Crush!');
        } else if (cascade >= 2) {
          showPraise('Delicious!');
        } else if (resolution.clearedKeys.size >= 4) {
          showPraise('Sweet!');
        }

        await sleep(210);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        // Clear matched cells, then place newly forged special candies
        for (const key of resolution.clearedKeys) {
          const [r, c] = key.split(',').map(Number);
          workingGrid[r][c] = null;
        }
        for (const sp of spawns) {
          workingGrid[sp.pos.row][sp.pos.col] = {
            id: nextCandyId(),
            color: sp.color,
            special: sp.special,
            isNew: false,
            dropRows: 0,
          };
        }

        // Apply gravity & spawn falling candies
        workingGrid = applyGravityAndRefill(workingGrid, level.colorsCount);
        setGrid(cloneGrid(workingGrid));
        soundEngine.playCascadeDrop(3);

        await sleep(245);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;

        workingGrid = clearDropFlags(workingGrid);
        setGrid(cloneGrid(workingGrid));
      }

      setIsBusy(false);
      const remMoves = remainingMovesOverride ?? movesRef.current;
      await checkWinOrLoss(workingGrid, totalScore, totalOrder, remMoves, myRun);
    },
    [level, addFloatingScore, showPraise, triggerShake, checkWinOrLoss]
  );

  const attemptSwap = useCallback(
    async (posA: Position, posB: Position) => {
      if (isBusy || modalRef.current !== 'NONE') return;
      if (!isAdjacent(posA, posB)) return;

      const pieceA = grid[posA.row][posA.col];
      const pieceB = grid[posB.row][posB.col];
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

      // Visually slide the two candies across each other smoothly
      setSwappingPair({ a: posA, b: posB });

      await sleep(170);
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      const swapped = cloneGrid(grid);
      swapped[posA.row][posA.col] = { ...pieceB, isNew: false, dropRows: 0 };
      swapped[posB.row][posB.col] = { ...pieceA, isNew: false, dropRows: 0 };

      const specialCombo = isSpecialComboSwap(pieceA, pieceB);
      const clusters = findMatchClusters(swapped, [posA, posB]);

      if (!specialCombo && clusters.length === 0) {
        // Invalid swap: smoothly glide back to original positions
        soundEngine.playInvalidSwap();
        soundEngine.vibrate([12, 28, 12]);
        setSwappingPair(null);
        await sleep(165);
        if (!isMountedRef.current || myRun !== runIdRef.current) return;
        setIsBusy(false);
        return;
      }

      setSwappingPair(null);
      setGrid(swapped);

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
    [grid, isBusy, runCascadeLoop]
  );

  // Lollipop Hammer Booster Handler
  const handleHammerCell = useCallback(
    async (row: number, col: number) => {
      if (isBusy || inventory.hammers <= 0) return;
      const piece = grid[row][col];
      if (!piece) return;

      if (!onConsumeBooster('hammers')) return;
      const myRun = runIdRef.current;
      setHammerActive(false);
      setIsBusy(true);
      setSelected(null);
      soundEngine.playHammer();
      soundEngine.vibrate([24, 30, 36]);
      triggerShake();

      const working = cloneGrid(grid);
      const res = resolveDestructionChain(working, [{ row, col }]);
      if (res.triggeredSpecials.length > 0) playSpecialSounds(res.triggeredSpecials);

      let orderGain = 0;
      for (const key of res.clearedKeys) {
        const [r, c] = key.split(',').map(Number);
        const p = working[r][c];
        if (p) {
          p.isMatched = true;
          if (level.order && p.color === level.order.color) orderGain += 1;
        }
      }

      const gained = res.clearedKeys.size * 45 + res.bonusScore;
      const newScore = scoreRef.current + gained;
      const newOrder = orderRef.current + orderGain;

      setGrid(cloneGrid(working));
      setScore(newScore);
      setOrderCollected(newOrder);
      scoreRef.current = newScore;
      orderRef.current = newOrder;
      vfxRef.current?.emitEvents(res.vfxEvents);
      addFloatingScore(row, col, gained, CANDY_HEX[piece.color].glow);

      await sleep(220);
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      for (const key of res.clearedKeys) {
        const [r, c] = key.split(',').map(Number);
        working[r][c] = null;
      }

      const refilled = applyGravityAndRefill(working, level.colorsCount);
      setGrid(refilled);
      soundEngine.playCascadeDrop(2);

      await sleep(245);
      if (!isMountedRef.current || myRun !== runIdRef.current) return;

      const settled = clearDropFlags(refilled);
      setGrid(settled);

      await runCascadeLoop(settled, [], undefined, movesRef.current, myRun);
    },
    [grid, isBusy, inventory.hammers, onConsumeBooster, level, triggerShake, addFloatingScore, runCascadeLoop]
  );

  const handleManualShuffle = () => {
    if (isBusy || inventory.shuffles <= 0 || modalState !== 'NONE') return;
    if (!onConsumeBooster('shuffles')) return;
    const myRun = runIdRef.current;
    soundEngine.playButton();
    setSelected(null);
    setHintPair(null);
    setGrid((prev) => shuffleGrid(prev, level.colorsCount));
    setStatusBanner('Board Shuffled!');
    window.setTimeout(() => {
      if (isMountedRef.current && myRun === runIdRef.current) {
        setGrid((prev) => clearDropFlags(prev));
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

  // Pointer Drag-and-Drop + Click-to-Swap Handlers
  const handleCellPointerDown = (row: number, col: number, e: React.PointerEvent) => {
    if (isBusy || modalState !== 'NONE') return;
    soundEngine.unlock();

    if (hammerActive) {
      handleHammerCell(row, col);
      return;
    }

    dragStartRef.current = { row, col, x: e.clientX, y: e.clientY };

    if (!selected) {
      soundEngine.playTap();
      setSelected({ row, col });
    } else if (selected.row === row && selected.col === col) {
      setSelected(null);
    } else if (isAdjacent(selected, { row, col })) {
      attemptSwap(selected, { row, col });
      dragStartRef.current = null;
    } else {
      soundEngine.playTap();
      setSelected({ row, col });
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || isBusy || modalState !== 'NONE' || hammerActive) return;

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
      attemptSwap({ row: start.row, col: start.col }, { row: targetRow, col: targetCol });
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

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #98e6ea 0%, #6dd2dc 45%, #4bb3c2 100%)',
      }}
    >
      {/* Subtle Aqua Candy World Background Silhouettes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25" aria-hidden="true">
        <div className="absolute -left-24 top-1/4 w-72 h-72 rounded-full bg-white/40 blur-2xl" />
        <div className="absolute -right-20 bottom-1/4 w-80 h-80 rounded-full bg-[#1a788c]/35 blur-2xl" />
      </div>

      {/* Top Pink Peppermint HUD Bar (Screenshot 2 Layout) */}
      <header className="candy-stripes-pink relative z-20 shrink-0 w-full px-3 sm:px-6 py-2.5 border-b-4 border-[#d95b96] shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Moves Left & Level */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white/85 px-3 py-1 rounded-2xl shadow-inner text-center min-w-[64px]">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9e1054] leading-none">
                Moves
              </div>
              <div
                className={`font-display font-bold text-2xl sm:text-3xl leading-tight tabular-nums text-stroke-pink text-white ${
                  movesLeft <= 5 ? 'animate-pulse' : ''
                }`}
              >
                {movesLeft}
              </div>
            </div>
            <div className="hidden sm:block text-xs font-extrabold text-[#7a093f] bg-white/75 px-2.5 py-1 rounded-xl">
              Lv {level.id} · {level.name}
            </div>
          </div>

          {/* Center: 3-Star Progress Meter + Target / Order */}
          <div className="flex-1 max-w-xs sm:max-w-sm flex flex-col items-center gap-1">
            {/* 3-Star Progress Track */}
            <div className="relative w-full h-4 bg-[#6e1240]/60 rounded-full p-0.5 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffcf40] via-[#ff9d2e] to-[#ff4da6] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
              {[
                { pct: star1Pct, met: score >= level.starScores[0] },
                { pct: star2Pct, met: score >= level.starScores[1] },
                { pct: 98, met: score >= level.starScores[2] },
              ].map((st, idx) => (
                <div
                  key={idx}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${st.pct}%` }}
                >
                  <Star
                    className={`w-4 h-4 ${
                      st.met ? 'fill-amber-300 text-amber-600 drop-shadow' : 'fill-[#8f295c] text-[#f7a8ce]'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Score + Order Pill-free Crisp Readout */}
            <div className="w-full flex items-center justify-center gap-3 bg-white/85 px-3 py-1 rounded-xl shadow-xs text-xs sm:text-sm font-extrabold text-[#7a093f] tabular-nums">
              <span>
                Score: {score.toLocaleString()} / {level.targetScore.toLocaleString()}
              </span>
              {level.order && (
                <span className="flex items-center gap-1 border-l border-[#d95b96]/40 pl-2.5">
                  <span className="w-4 h-4 inline-block">
                    <CandySprite color={level.order.color} special="none" />
                  </span>
                  <span>
                    {Math.min(orderCollected, level.order.target)}/{level.order.target}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Settings & Pause */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open Settings"
              title="Settings"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] hover:from-[#2563eb] hover:to-[#1e40af] text-white border-2 border-[#93c5fd] shadow flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playButton();
                setModalState('PAUSED');
              }}
              aria-label="Pause game"
              title="Pause Game"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-[#b3125d] shadow flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Pause className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Center 8x8 Match-3 Game Grid */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-2 sm:px-4 py-2 min-h-0">
        <div
          className={`relative aspect-square w-[min(94vw,62vh,520px)] max-w-full rounded-2xl p-1.5 sm:p-2.5 bg-[#1b3957]/88 border-4 border-[#90d8f0]/80 shadow-[0_14px_34px_rgba(8,36,64,0.42)] ${
            shaking ? 'animate-board-shake' : ''
          }`}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
          style={{ touchAction: 'none' }}
        >
          {/* 8x8 Checkerboard Cells */}
          <div className="relative w-full h-full grid grid-cols-8 grid-rows-8 gap-0.5 rounded-xl overflow-hidden">
            {grid.map((rowArr, r) =>
              rowArr.map((cell, c) => {
                const isSelected = selected?.row === r && selected?.col === c;
                const isHinted =
                  hintPair &&
                  ((hintPair[0].row === r && hintPair[0].col === c) ||
                    (hintPair[1].row === r && hintPair[1].col === c));
                const checkerDark = (r + c) % 2 === 1;

                const isSwappingA =
                  swappingPair && swappingPair.a.row === r && swappingPair.a.col === c;
                const isSwappingB =
                  swappingPair && swappingPair.b.row === r && swappingPair.b.col === c;

                let swapTransform: string | undefined;
                if (isSwappingA && swappingPair) {
                  const dx = (swappingPair.b.col - swappingPair.a.col) * 100;
                  const dy = (swappingPair.b.row - swappingPair.a.row) * 100;
                  swapTransform = `translate3d(${dx}%, ${dy}%, 0) scale(1.06)`;
                } else if (isSwappingB && swappingPair) {
                  const dx = (swappingPair.a.col - swappingPair.b.col) * 100;
                  const dy = (swappingPair.a.row - swappingPair.b.row) * 100;
                  swapTransform = `translate3d(${dx}%, ${dy}%, 0)`;
                }

                const isDropping = Boolean(cell && (cell.isNew || (cell.dropRows ?? 0) > 0));

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onPointerDown={(e) => handleCellPointerDown(r, c, e)}
                    aria-label={
                      cell
                        ? `${CANDY_HEX[cell.color].label}${cell.special !== 'none' ? ` (${cell.special})` : ''} at row ${r + 1}, column ${c + 1}`
                        : `Empty cell ${r + 1}, ${c + 1}`
                    }
                    className={`relative w-full h-full flex items-center justify-center p-0.5 sm:p-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white ${
                      checkerDark ? 'bg-[#1f4266]/90' : 'bg-[#2a527a]/90'
                    } ${isSwappingA ? 'z-20' : isSwappingB ? 'z-10' : ''} ${
                      isSelected ? 'bg-[#4682b4]/95 ring-2 ring-inset ring-yellow-300 z-10' : ''
                    } ${hammerActive ? 'hover:bg-rose-500/40 cursor-crosshair' : 'cursor-pointer'}`}
                  >
                    {cell && (
                      <div
                        key={cell.id}
                        style={{
                          ...(isDropping
                            ? ({ '--drop-rows': cell.dropRows ?? 1 } as React.CSSProperties)
                            : {}),
                          ...(swapTransform ? { transform: swapTransform } : {}),
                        }}
                        className={`w-full h-full transition-transform duration-150 ease-out ${
                          cell.isMatched
                            ? 'animate-candy-pop'
                            : isDropping
                            ? 'animate-candy-spawn'
                            : isSelected
                            ? 'animate-candy-selected'
                            : isHinted
                            ? 'animate-candy-hint'
                            : isSwappingA || isSwappingB
                            ? ''
                            : 'hover:scale-105'
                        }`}
                      >
                        <CandySprite color={cell.color} special={cell.special} />
                      </div>
                    )}
                  </button>
                );
              })
            )}

            {/* High-DPI Canvas Particle, Beam & Lightning VFX Layer */}
            <VfxCanvas ref={vfxRef} />

            {/* Floating Score Popups */}
            {floatingScores.map((fs) => (
              <div
                key={fs.id}
                className="pointer-events-none absolute z-30 font-display font-bold text-lg sm:text-2xl text-white text-stroke-dark animate-float-score tabular-nums"
                style={{
                  left: `${((fs.col + 0.5) / GRID_SIZE) * 100}%`,
                  top: `${((fs.row + 0.5) / GRID_SIZE) * 100}%`,
                  color: fs.color,
                }}
              >
                {fs.text}
              </div>
            ))}

            {/* Praise Word Comic Banner ("Sweet!", "Delicious!", "Divine!", "Sugar Crush!") */}
            {praisePopup && (
              <div
                key={praisePopup.id}
                className="pointer-events-none absolute left-1/2 top-1/2 z-40 animate-praise-pop"
              >
                <div className="font-display font-bold text-3xl sm:text-5xl text-[#ffe347] text-stroke-gold whitespace-nowrap drop-shadow-xl">
                  {praisePopup.word}
                </div>
              </div>
            )}

            {/* Status Banner (e.g. Deadlock Reshuffle / Hammer Prompt) */}
            {(statusBanner || hammerActive) && (
              <div className="pointer-events-none absolute inset-x-4 bottom-3 z-30 flex justify-center">
                <div className="bg-slate-900/90 text-white text-xs sm:text-sm font-bold px-4 py-1.5 rounded-xl shadow-lg">
                  {hammerActive ? 'Tap any candy on the board to smash it!' : statusBanner}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Booster Tray (Screenshot 2 Inspired) */}
      <footer className="relative z-20 shrink-0 pb-3 pt-1 px-3 flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 bg-[#ffe9f2]/95 border-2 border-[#f29ec6] px-3 sm:px-4 py-1.5 rounded-full shadow-lg">
          <button
            type="button"
            disabled={inventory.hammers <= 0 || isBusy}
            onClick={() => {
              soundEngine.playButton();
              setHammerActive((a) => !a);
              setSelected(null);
            }}
            className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-transform active:scale-95 cursor-pointer ${
              hammerActive
                ? 'bg-[#e61e78] text-white ring-2 ring-yellow-300'
                : inventory.hammers > 0
                ? 'bg-white text-[#9e1054] hover:bg-pink-50 shadow-xs'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Smash any single candy without using a move"
          >
            <Hammer className="w-4 h-4" />
            <span>Hammer</span>
            <span className="tabular-nums font-extrabold">({inventory.hammers})</span>
          </button>

          <button
            type="button"
            disabled={inventory.shuffles <= 0 || isBusy}
            onClick={handleManualShuffle}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-transform active:scale-95 cursor-pointer ${
              inventory.shuffles > 0
                ? 'bg-white text-[#0e67c2] hover:bg-sky-50 shadow-xs'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Shuffle all candies without using a move"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
            <span className="tabular-nums font-extrabold">({inventory.shuffles})</span>
          </button>

          <button
            type="button"
            disabled={inventory.bonusMoves <= 0 || isBusy}
            onClick={handleUseBonusMoves}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-transform active:scale-95 cursor-pointer ${
              inventory.bonusMoves > 0
                ? 'bg-white text-[#158f35] hover:bg-emerald-50 shadow-xs'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Grant +5 extra moves in this level"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+5 Moves</span>
            <span className="tabular-nums font-extrabold">({inventory.bonusMoves})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playButton();
              onBackToMap();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm shadow-xs cursor-pointer transition-transform active:scale-95"
          >
            <MapIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </footer>

      {/* Pause / Victory / Game Over Modal */}
      {modalState !== 'NONE' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#fff7fb] border-4 border-[#ff8ec4] shadow-2xl p-6 text-center flex flex-col items-center gap-4">
            {modalState === 'PAUSED' && (
              <>
                <h2 className="font-display font-bold text-3xl text-[#b3125d]">Game Paused</h2>
                <p className="text-sm font-bold text-slate-600">{level.description}</p>
                <div className="w-full flex flex-col gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      setModalState('NONE');
                    }}
                    className="candy-btn-pink w-full py-3 rounded-full font-display font-bold text-xl text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="candy-btn-blue w-full py-2.5 rounded-full font-display font-semibold text-lg text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel();
                    }}
                    className="candy-btn-blue w-full py-2.5 rounded-full font-display font-semibold text-lg text-white flex items-center justify-center gap-2 cursor-pointer"
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
                    className="w-full py-2.5 rounded-full font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Kingdom Map
                  </button>
                </div>
              </>
            )}

            {modalState === 'VICTORY' && (
              <>
                <h2 className="font-display font-bold text-3xl text-[#b3125d]">Level Complete!</h2>
                <div className="flex items-center justify-center gap-2 my-1">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-11 h-11 transition-transform ${
                        Math.max(1, earnedStars) >= s
                          ? 'fill-amber-400 text-amber-600 scale-110 drop-shadow'
                          : 'fill-slate-200 text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="bg-pink-100/80 w-full rounded-2xl py-3 px-4">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#9e1054]">
                    Final Score
                  </div>
                  <div className="font-display font-bold text-3xl text-[#b3125d] tabular-nums">
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
                      className="candy-btn-green w-full py-3 rounded-full font-display font-bold text-xl text-white cursor-pointer"
                    >
                      Next Level
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel();
                    }}
                    className="candy-btn-pink w-full py-2.5 rounded-full font-display font-semibold text-lg text-white cursor-pointer"
                  >
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      onBackToMap();
                    }}
                    className="w-full py-2.5 rounded-full font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Kingdom Map
                  </button>
                </div>
              </>
            )}

            {modalState === 'GAME_OVER' && (
              <>
                <h2 className="font-display font-bold text-3xl text-rose-600">Out of Moves!</h2>
                <p className="text-sm font-bold text-slate-600">
                  You scored {score.toLocaleString()} points. Target was {level.targetScore.toLocaleString()}.
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
                      className="candy-btn-green w-full py-3 rounded-full font-display font-bold text-xl text-white flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-5 h-5" />
                      <span>Use +5 Extra Moves ({inventory.bonusMoves})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      resetLevel();
                    }}
                    className="candy-btn-pink w-full py-3 rounded-full font-display font-bold text-xl text-white cursor-pointer"
                  >
                    Play Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playButton();
                      onBackToMap();
                    }}
                    className="w-full py-2.5 rounded-full font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Kingdom Map
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
