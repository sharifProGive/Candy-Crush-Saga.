import React, { useEffect } from 'react';
import { Gift, Settings } from 'lucide-react';
import { CandySprite } from './CandySprite';

interface TitleScreenProps {
  totalStars: number;
  maxStars: number;
  dailyClaimable: boolean;
  disableShortcuts?: boolean;
  onOpenSettings: () => void;
  onOpenDailyRewards: () => void;
  onPlayNow: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  totalStars,
  maxStars,
  dailyClaimable,
  disableShortcuts = false,
  onOpenSettings,
  onOpenDailyRewards,
  onPlayNow,
}) => {
  useEffect(() => {
    if (disableShortcuts) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPlayNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPlayNow, disableShortcuts]);

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between bg-gradient-to-b from-[#63b3ff] via-[#8fd1ff] to-[#bfe8ff]">
      {/* Animated Sky Clouds */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="animate-float-cloud absolute top-[10%] left-[6%] w-36 h-14 opacity-95">
          <svg viewBox="0 0 160 70" className="w-full h-full">
            <path
              d="M25,58 C12,58 4,49 4,38 C4,28 12,20 22,20 C26,9 38,3 52,5 C64,7 72,14 76,22 C82,16 92,14 102,18 C113,22 119,32 118,43 C128,44 134,50 134,58 Z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <div
          className="animate-float-cloud absolute top-[16%] right-[8%] w-44 h-16 opacity-90"
          style={{ animationDelay: '-3.5s' }}
        >
          <svg viewBox="0 0 160 70" className="w-full h-full">
            <path
              d="M25,58 C12,58 4,49 4,38 C4,28 12,20 22,20 C26,9 38,3 52,5 C64,7 72,14 76,22 C82,16 92,14 102,18 C113,22 119,32 118,43 C128,44 134,50 134,58 Z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <div
          className="animate-float-cloud absolute top-[35%] left-[18%] w-28 h-11 opacity-75"
          style={{ animationDelay: '-6s' }}
        >
          <svg viewBox="0 0 160 70" className="w-full h-full">
            <path
              d="M25,58 C12,58 4,49 4,38 C4,28 12,20 22,20 C26,9 38,3 52,5 C64,7 72,14 76,22 C82,16 92,14 102,18 C113,22 119,32 118,43 C128,44 134,50 134,58 Z"
              fill="#ffffff"
            />
          </svg>
        </div>
      </div>

      {/* Candy Kingdom Rolling Hills, Waffle Castle & Caramel Road */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        className="pointer-events-none absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#80d436" />
            <stop offset="100%" stopColor="#4c9c1b" />
          </linearGradient>
          <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#92e33b" />
            <stop offset="100%" stopColor="#4e9e18" />
          </linearGradient>
          <linearGradient id="roadGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd748" />
            <stop offset="55%" stopColor="#d9872b" />
            <stop offset="100%" stopColor="#a65a18" />
          </linearGradient>
        </defs>

        {/* Distant Candy Castle */}
        <g transform="translate(880, 360)">
          <rect x="40" y="70" width="220" height="170" rx="14" fill="#6876d4" />
          <rect x="20" y="95" width="55" height="145" rx="8" fill="#7c8be6" />
          <rect x="225" y="80" width="55" height="160" rx="8" fill="#5e6bc7" />
          {/* Waffle Cone Roofs */}
          <polygon points="105,72 150,-5 195,72" fill="#b56b26" stroke="#7d410b" strokeWidth="4" />
          <polygon points="15,96 47,30 80,96" fill="#c77a30" stroke="#7d410b" strokeWidth="3" />
          <polygon points="220,82 252,18 284,82" fill="#9e591c" stroke="#7d410b" strokeWidth="3" />
          {/* Heart Door */}
          <path d="M150,210 C125,190 112,168 128,155 C138,146 148,155 150,162 C152,155 162,146 172,155 C188,168 175,190 150,210 Z" fill="#f7c873" stroke="#8f5313" strokeWidth="4" />
        </g>

        {/* Back Rolling Hill */}
        <path d="M-40,620 Q420,470 860,550 T1480,530 L1480,920 L-40,920 Z" fill="url(#hillBack)" />

        {/* Winding Caramel Road */}
        <path
          d="M960,555 C860,600 940,655 770,700 C610,745 450,805 320,920 L690,920 C765,805 890,740 1005,675 C1065,640 1015,585 1030,555 Z"
          fill="url(#roadGold)"
        />

        {/* Foreground Left & Right Hills */}
        <path d="M-60,660 Q250,590 480,740 Q320,840 280,920 L-60,920 Z" fill="url(#hillFront)" />
        <path d="M980,710 Q1220,600 1490,670 L1490,920 L840,920 Q900,790 980,710 Z" fill="url(#hillFront)" />
      </svg>

      {/* Foreground Decorative Glossy Candy Clusters */}
      <div className="pointer-events-none absolute bottom-12 left-4 sm:left-10 flex items-end gap-2 opacity-95" aria-hidden="true">
        <div className="w-12 h-12 sm:w-16 sm:h-16 -rotate-12">
          <CandySprite color="purple" special="none" />
        </div>
        <div className="w-14 h-14 sm:w-20 sm:h-20 translate-y-2">
          <CandySprite color="blue" special="none" />
        </div>
        <div className="w-11 h-11 sm:w-14 sm:h-14 rotate-12 -translate-x-2">
          <CandySprite color="red" special="striped-h" />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-12 right-4 sm:right-10 flex items-end gap-2 opacity-95" aria-hidden="true">
        <div className="w-11 h-11 sm:w-14 sm:h-14 -rotate-12 translate-x-2">
          <CandySprite color="yellow" special="none" />
        </div>
        <div className="w-14 h-14 sm:w-20 sm:h-20 translate-y-1">
          <CandySprite color="red" special="color-bomb" />
        </div>
        <div className="w-12 h-12 sm:w-16 sm:h-16 rotate-12">
          <CandySprite color="green" special="none" />
        </div>
      </div>

      {/* Top Audio Controls */}
      <div className="relative z-20 w-full flex items-center justify-between px-5 pt-4">
        <div className="text-sm font-bold text-[#0c3c6e] bg-white/70 px-3.5 py-1.5 rounded-xl shadow-sm tabular-nums">
          Stars: {totalStars} / {maxStars}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Settings"
          title="Settings"
          className="w-11 h-11 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] hover:from-[#2563eb] hover:to-[#1e40af] text-white border-2 border-[#93c5fd] shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Center Hanging Candy Sign Lockup */}
      <div className="relative z-10 flex flex-col items-center -mt-4 sm:-mt-8 px-4">
        {/* Hanging Cord */}
        <div className="w-1.5 h-16 sm:h-24 bg-[#fff5d6] shadow-sm -mb-3 rounded-full" aria-hidden="true" />
        <div className="w-[min(88vw,380px)] drop-shadow-[0_12px_20px_rgba(12,48,88,0.3)]">
          <svg viewBox="0 0 420 270" className="w-full h-auto overflow-visible" role="img" aria-label="Candy Crush Saga">
            <defs>
              <linearGradient id="candyTitleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff380" />
                <stop offset="45%" stopColor="#ffae19" />
                <stop offset="100%" stopColor="#e65100" />
              </linearGradient>
              <linearGradient id="heartRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6b8b" />
                <stop offset="100%" stopColor="#c90832" />
              </linearGradient>
            </defs>

            {/* Cream backing silhouette */}
            <rect x="46" y="26" width="328" height="218" rx="44" fill="#fffaf0" stroke="#e2d1b3" strokeWidth="4" />
            <circle cx="210" cy="24" r="18" fill="#fffaf0" />
            <circle cx="210" cy="22" r="7" fill="#7fc8ff" />

            {/* "Candy" */}
            <text
              x="195"
              y="112"
              textAnchor="middle"
              className="font-display font-bold"
              fontSize="74"
              fill="url(#candyTitleGrad)"
              stroke="#782800"
              strokeWidth="10"
              paintOrder="stroke fill"
            >
              Candy
            </text>

            {/* Center Heart */}
            <path
              d="M202,158 C184,144 176,130 187,120 C194,114 200,120 202,125 C204,120 210,114 217,120 C228,130 220,144 202,158 Z"
              fill="url(#heartRed)"
              stroke="#780720"
              strokeWidth="4"
            />

            {/* "Crush" */}
            <text
              x="195"
              y="214"
              textAnchor="middle"
              className="font-display font-bold"
              fontSize="76"
              fill="url(#candyTitleGrad)"
              stroke="#782800"
              strokeWidth="10"
              paintOrder="stroke fill"
            >
              Crush
            </text>

            {/* Vertical "SAGA" Tag */}
            <g transform="translate(312, 56)">
              <rect x="0" y="0" width="54" height="162" rx="10" fill="#fff9ed" stroke="#d43547" strokeWidth="4" />
              <circle cx="27" cy="14" r="4" fill="#2e9950" />
              <text x="27" y="48" textAnchor="middle" fontSize="28" fontWeight="900" fill="#d4182f">S</text>
              <text x="27" y="82" textAnchor="middle" fontSize="28" fontWeight="900" fill="#d4182f">A</text>
              <text x="27" y="116" textAnchor="middle" fontSize="28" fontWeight="900" fill="#d4182f">G</text>
              <text x="27" y="150" textAnchor="middle" fontSize="28" fontWeight="900" fill="#d4182f">A</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Primary Action Stack */}
      <div className="relative z-20 flex flex-col items-center gap-3.5 pb-6 px-4 w-full max-w-xs">
        <button
          type="button"
          onClick={onPlayNow}
          className="candy-btn-pink w-full py-3.5 px-8 rounded-full font-display font-bold text-2xl sm:text-3xl text-white tracking-wide cursor-pointer whitespace-nowrap"
        >
          Play
        </button>

        <button
          type="button"
          onClick={onOpenDailyRewards}
          className={`candy-btn-green w-full py-2.5 px-6 rounded-full font-display font-semibold text-base sm:text-lg text-white flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            dailyClaimable ? 'ring-4 ring-yellow-300' : ''
          }`}
        >
          <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{dailyClaimable ? 'Daily Gift!' : 'Rewards'}</span>
        </button>

        <p className="text-xs sm:text-sm font-bold text-[#0c3c6e] bg-white/65 px-4 py-1.5 rounded-xl text-center">
          Drag or click candies to swap · Enter to play · Esc to pause
        </p>
      </div>
    </div>
  );
};
