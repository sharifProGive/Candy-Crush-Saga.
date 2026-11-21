import React, { useLayoutEffect, useRef } from 'react';
import {
  computeDropDurationMs,
  FX_TIMING,
  scaleTiming,
} from '../game/fxTimeline';
import { CANDY_HEX } from '../game/levels';
import { CandyPiece } from '../game/types';
import { CandySprite } from './CandySprite';

export interface CandyTileProps {
  row: number;
  col: number;
  piece: CandyPiece | null;
  isSelected: boolean;
  isHinted: boolean;
  hammerActive: boolean;
  reducedMotion: boolean;
  onCellPointerDown: (row: number, col: number, e: React.PointerEvent) => void;
  registerTileEl: (row: number, col: number, el: HTMLDivElement | null) => void;
  registerDropAnim: (anim: Animation) => void;
}

const CandyTileInner: React.FC<CandyTileProps> = ({
  row,
  col,
  piece,
  isSelected,
  isHinted,
  hammerActive,
  reducedMotion,
  onCellPointerDown,
  registerTileEl,
  registerDropAnim,
}) => {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const lastDropKeyRef = useRef<string>('');
  const lastForgeIdRef = useRef<string>('');

  const setRef = (el: HTMLDivElement | null) => {
    tileRef.current = el;
    registerTileEl(row, col, el);
  };

  // Run newly forged special candy spawn animation (0.6 -> 1.15 -> 1.0 over 350ms / fxSpeed)
  useLayoutEffect(() => {
    const el = tileRef.current;
    if (!el || !piece || !piece.isForgedSpecial) return;
    if (lastForgeIdRef.current === piece.id) return;
    lastForgeIdRef.current = piece.id;

    if (typeof el.animate !== 'function') return;

    const speed = piece.fxSpeed ?? 1.0;
    const duration = reducedMotion
      ? scaleTiming(140, speed)
      : scaleTiming(FX_TIMING.specialSpawnDuration, speed);

    el.style.willChange = 'transform, opacity';

    const keyframes: Keyframe[] = reducedMotion
      ? [
          { transform: 'translate3d(0, 0, 0) scale(0.9)', opacity: 0.2 },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        ]
      : [
          { transform: 'translate3d(0, 0, 0) scale(0.6)', opacity: 0.25 },
          { transform: 'translate3d(0, 0, 0) scale(1.15)', opacity: 1, offset: 0.68 },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        ];

    const anim = el.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.22, 1.25, 0.36, 1)',
      fill: 'none',
    });

    registerDropAnim(anim);

    const cleanup = () => {
      if (tileRef.current) {
        tileRef.current.style.willChange = '';
      }
    };
    anim.finished.then(cleanup, cleanup);

    return () => {
      anim.cancel();
      if (tileRef.current) {
        tileRef.current.style.willChange = '';
      }
    };
  }, [piece?.id, piece?.isForgedSpecial, piece?.fxSpeed, reducedMotion, registerDropAnim]);

  // Run gravity drop / spawn animation strictly once per (piece.id, dropSeq) via Web Animations API
  // Duration: 260ms for first row + 70ms per extra row, divided by fxSpeed, ease-out with subtle bounce
  useLayoutEffect(() => {
    const el = tileRef.current;
    if (!el || !piece) return;

    const dropRows = piece.dropRows ?? 0;
    const dropSeq = piece.dropSeq ?? 0;
    if (dropRows <= 0 && !piece.isNew) return;

    const dropKey = `${piece.id}:${dropSeq}`;
    if (lastDropKeyRef.current === dropKey) return;
    lastDropKeyRef.current = dropKey;

    if (typeof el.animate !== 'function') return;

    const rowsToTravel = Math.max(1, dropRows);
    const startY = -(rowsToTravel * 100);
    const speed = piece.fxSpeed ?? 1.0;
    const duration = reducedMotion
      ? scaleTiming(140, speed)
      : computeDropDurationMs(rowsToTravel, speed);

    el.style.willChange = 'transform';

    const keyframes: Keyframe[] = reducedMotion
      ? [
          { transform: 'translate3d(0, -14%, 0)', opacity: 0.4 },
          { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        ]
      : [
          {
            transform: `translate3d(0, ${startY}%, 0)`,
            opacity: 1,
            easing: 'cubic-bezier(0.35, 0.30, 0.82, 0.65)',
          },
          {
            transform: 'translate3d(0, 5.5%, 0)',
            opacity: 1,
            offset: 0.84,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          },
          {
            transform: 'translate3d(0, -1.8%, 0)',
            opacity: 1,
            offset: 0.93,
            easing: 'ease-out',
          },
          { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        ];

    const anim = el.animate(keyframes, {
      duration,
      easing: 'linear',
      fill: 'none',
    });

    registerDropAnim(anim);

    const cleanup = () => {
      if (tileRef.current) {
        tileRef.current.style.willChange = '';
      }
    };
    anim.finished.then(cleanup, cleanup);

    return () => {
      anim.cancel();
      if (tileRef.current) {
        tileRef.current.style.willChange = '';
      }
    };
  }, [
    piece?.id,
    piece?.dropSeq,
    piece?.dropRows,
    piece?.isNew,
    piece?.isForgedSpecial,
    piece?.fxSpeed,
    reducedMotion,
    registerDropAnim,
  ]);

  return (
    <button
      type="button"
      onPointerDown={(e) => onCellPointerDown(row, col, e)}
      aria-label={
        piece
          ? `${CANDY_HEX[piece.color].label}${piece.special !== 'none' ? ` (${piece.special})` : ''} at row ${row + 1}, column ${col + 1}`
          : `Empty cell ${row + 1}, ${col + 1}`
      }
      className={`relative w-full h-full flex items-center justify-center p-0 overflow-visible focus-visible:outline-2 focus-visible:outline-white ${
        isSelected ? 'z-10' : ''
      } ${hammerActive ? 'cursor-crosshair' : 'cursor-pointer'}`}
      style={{
        borderRight: col < 7 ? '1px solid rgba(255, 255, 255, 0.06)' : undefined,
        borderBottom: row < 7 ? '1px solid rgba(255, 255, 255, 0.06)' : undefined,
      }}
    >
      {/* Selected Tile Soft White Radial Glow (Pure Opacity, Zero Layout Shift) */}
      {isSelected && (
        <span
          className={`pointer-events-none absolute -inset-1 rounded-full ${
            reducedMotion ? 'opacity-90' : 'animate-selected-glow'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.68) 0%, rgba(230,248,255,0.28) 48%, rgba(255,255,255,0) 74%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Candy Tile: Constant 92% layout size, purely transform/opacity animated */}
      {piece && (
        <div
          key={piece.id}
          ref={setRef}
          className={`w-[92%] h-[92%] flex items-center justify-center ${
            isSelected
              ? reducedMotion
                ? 'tile-selected-static'
                : 'animate-candy-selected'
              : isHinted && !reducedMotion
              ? 'animate-candy-hint'
              : ''
          }`}
        >
          <CandySprite color={piece.color} special={piece.special} />
        </div>
      )}
    </button>
  );
};

export const CandyTile = React.memo(CandyTileInner, (prev, next) => {
  return (
    prev.piece === next.piece &&
    prev.isSelected === next.isSelected &&
    prev.isHinted === next.isHinted &&
    prev.hammerActive === next.hammerActive &&
    prev.reducedMotion === next.reducedMotion
  );
});

CandyTile.displayName = 'CandyTile';
