import React, { useEffect, useState } from 'react';
import {
  getCandySpriteSrc,
  isCandySpriteCacheReady,
  preloadAllCandySprites,
  subscribeCandySpriteCache,
} from '../game/candySprites';
import { CandyColor, SpecialType } from '../game/types';

interface CandySpriteProps {
  color: CandyColor;
  special: SpecialType;
  className?: string;
}

export const CandySprite: React.FC<CandySpriteProps> = React.memo(
  ({ color, special, className = 'w-full h-full' }) => {
    const [, setCacheTick] = useState(0);

    useEffect(() => {
      if (isCandySpriteCacheReady()) return undefined;
      void preloadAllCandySprites();
      return subscribeCandySpriteCache(() => setCacheTick((n) => n + 1));
    }, []);

    const src = getCandySpriteSrc(color, special);

    return (
      <div
        className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      >
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="sync"
          className="w-full h-full object-contain select-none pointer-events-none candy-sprite-img"
        />
      </div>
    );
  }
);

CandySprite.displayName = 'CandySprite';
