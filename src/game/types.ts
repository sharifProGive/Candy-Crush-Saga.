export type CandyColor = 'red' | 'green' | 'blue' | 'yellow' | 'orange' | 'purple';

export type SpecialType = 'none' | 'striped-h' | 'striped-v' | 'wrapped' | 'color-bomb';

export interface CandyPiece {
  id: string;
  color: CandyColor;
  special: SpecialType;
  isNew?: boolean;
  isMatched?: boolean;
  dropRows?: number;
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
  | { type: 'burst'; row: number; col: number; color: CandyColor; count?: number }
  | { type: 'beam-h'; row: number; color: CandyColor }
  | { type: 'beam-v'; col: number; color: CandyColor }
  | { type: 'shockwave'; row: number; col: number; color: CandyColor; radius?: number }
  | { type: 'lightning'; fromRow: number; fromCol: number; toRow: number; toCol: number; color: CandyColor }
  | { type: 'swap-trail'; fromRow: number; fromCol: number; toRow: number; toCol: number; color: CandyColor };

export interface LevelProgress {
  stars: number; // 0-3
  highScore: number;
}
