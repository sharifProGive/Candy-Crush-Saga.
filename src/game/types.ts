export type CandyColor = 'red' | 'green' | 'blue' | 'yellow' | 'orange' | 'purple';

export type SpecialType = 'none' | 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb';

export interface CandyPiece {
  id: string;
  color: CandyColor;
  special: SpecialType;
  isNew?: boolean;
  isMatched?: boolean;
  dropRows?: number;
  /** Monotonic sequence bumped only when this piece drops/spawns, triggering a single WAAPI drop */
  dropSeq?: number;
  /** True when newly forged from a 4+/L/T/5 match to play the 0.6 -> 1.15 -> 1.0 glow spawn */
  isForgedSpecial?: boolean;
  /** fxSpeed snapshot used by CandyTile WAAPI drop/spawn duration */
  fxSpeed?: number;
}

export type Grid = (CandyPiece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface CandyOrder {
  color: CandyColor;
  target: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  biome: 'caramel' | 'chocolate' | 'mint';
  moves: number;
  colorsCount: 4 | 5 | 6;
  targetScore: number;
  starScores: [number, number, number];
  order?: CandyOrder;
  description: string;
}

export type GameScreen = 'STARTUP' | 'TITLE_MENU' | 'LEVEL_MAP' | 'PLAYING';

export type PlayModalState = 'NONE' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type PraiseWord =
  | 'Sweet!'
  | 'Tasty!'
  | 'Delicious!'
  | 'Divine!'
  | 'Fantastic!'
  | 'Marvelous!'
  | 'Excellent!'
  | 'Incredible!'
  | 'Ultimate!'
  | 'Awesome!'
  | 'Combo!'
  | 'Color Bomb!'
  | 'Wrapped Candy!'
  | 'Striped Candy!'
  | 'Sugar Crush!';

export interface FloatingScore {
  id: string;
  row: number;
  col: number;
  text: string;
  color: string;
}

export interface PraisePopup {
  id: string;
  word: PraiseWord;
}

export type VfxEvent =
  | { type: 'burst'; row: number; col: number; color: CandyColor; count?: number; massiveBlast?: boolean }
  | { type: 'beam-h'; row: number; originCol?: number; color: CandyColor; perCellMs?: number }
  | { type: 'beam-v'; col: number; originRow?: number; color: CandyColor; perCellMs?: number }
  | { type: 'shockwave'; row: number; col: number; color: CandyColor; radius?: number; durationMs?: number }
  | {
      type: 'lightning';
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      color: CandyColor;
      durationMs?: number;
    }
  | { type: 'swap-trail'; fromRow: number; fromCol: number; toRow: number; toCol: number; color: CandyColor }
  | { type: 'special-glow'; row: number; col: number; color: CandyColor; radius?: number; durationMs?: number }
  | { type: 'pop-flash'; row: number; col: number; durationMs?: number }
  | { type: 'float-score'; row: number; col: number; text: string; color: string };

/**
 * Chronological step produced by matchEngine for sequential chain-reaction playback.
 * All timeMs / durationMs values are in base ms (scaled at playback by / fxSpeed).
 */
export type ClearTimelineStep =
  | {
      kind: 'special-pulse';
      timeMs: number;
      row: number;
      col: number;
      color: CandyColor;
      special: SpecialType;
      durationMs: number;
    }
  | {
      kind: 'striped-beam';
      timeMs: number;
      row: number;
      col: number;
      horizontal: boolean;
      color: CandyColor;
      perCellMs: number;
    }
  | {
      kind: 'wrapped-shockwave';
      timeMs: number;
      row: number;
      col: number;
      color: CandyColor;
      radius: number;
      durationMs: number;
    }
  | {
      kind: 'bomb-shake';
      timeMs: number;
      row: number;
      col: number;
      color: CandyColor;
      durationMs: number;
    }
  | {
      kind: 'bomb-ray';
      timeMs: number;
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      color: CandyColor;
      glowDurationMs: number;
    }
  | {
      kind: 'candy-pop';
      timeMs: number;
      row: number;
      col: number;
      color: CandyColor;
      special: SpecialType;
      popDurationMs: number;
      burstCount: number;
      pitchStep: number;
    };

export interface LevelProgress {
  stars: number; // 0-3
  highScore: number;
}
