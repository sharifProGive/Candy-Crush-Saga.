import React, { useEffect } from 'react';
import { Gift, Settings, Star } from 'lucide-react';
import { useLowPerformanceMode } from '../game/performanceGuard';
import { SugarPopBrand } from './SugarPopBrand';

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
  const lowPerf = useLowPerformanceMode();

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
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between"
      style={{
        background:
          'linear-gradient(180deg, #56b4ff 0%, #8cd4ff 42%, #d4edff 70%, #ffd8be 100%)',
      }}
    >
      {/* Soft Sunlit Horizon Glow + Gently Pulsing Sky Light Shafts (Zero Live Blur) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 45% at 50% 62%, rgba(255, 245, 214, 0.72) 0%, rgba(255, 220, 190, 0.18) 55%, rgba(255, 220, 190, 0) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${
          lowPerf ? 'opacity-45' : 'animate-sun-shafts'
        }`}
        aria-hidden="true"
      >
        <div
          className="absolute -top-12 left-[14%] w-[24%] h-[78%] origin-top"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,252,235,0.34) 50%, rgba(255,255,255,0) 100%)',
            transform: 'skewX(-16deg)',
          }}
        />
        <div
          className="absolute -top-12 left-[52%] w-[22%] h-[74%] origin-top"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,248,225,0.28) 50%, rgba(255,255,255,0) 100%)',
            transform: 'skewX(-14deg)',
          }}
        />
      </div>

      {/* Slowly Drifting Soft Layered Clouds (transform only, auto-paused in lowPerf) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className={`${
            lowPerf ? '' : 'animate-float-cloud'
          } absolute top-[9%] left-[4%] w-36 sm:w-44 h-16 opacity-95`}
        >
          <svg viewBox="0 0 180 76" className="w-full h-full">
            <defs>
              <linearGradient id="homeCloudA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ffeef4" />
              </linearGradient>
            </defs>
            <path
              d="M28,64 C13,64 4,54 4,42 C4,31 13,22 25,22 C30,10 44,4 60,6 C73,8 82,16 86,25 C93,18 105,15 117,19 C130,24 138,35 137,47 C150,48 158,54 158,64 Z"
              fill="url(#homeCloudA)"
            />
          </svg>
        </div>

        <div
          className={`${
            lowPerf ? '' : 'animate-float-cloud'
          } absolute top-[15%] right-[5%] w-40 sm:w-52 h-18 opacity-90`}
          style={lowPerf ? undefined : { animationDelay: '-4s', animationDuration: '12s' }}
        >
          <svg viewBox="0 0 180 76" className="w-full h-full">
            <path
              d="M28,64 C13,64 4,54 4,42 C4,31 13,22 25,22 C30,10 44,4 60,6 C73,8 82,16 86,25 C93,18 105,15 117,19 C130,24 138,35 137,47 C150,48 158,54 158,64 Z"
              fill="#fffdf9"
            />
          </svg>
        </div>

        <div
          className={`${
            lowPerf ? '' : 'animate-float-cloud'
          } absolute top-[33%] left-[12%] w-28 sm:w-36 h-12 opacity-78`}
          style={lowPerf ? undefined : { animationDelay: '-7s', animationDuration: '14s' }}
        >
          <svg viewBox="0 0 180 76" className="w-full h-full">
            <path
              d="M28,64 C13,64 4,54 4,42 C4,31 13,22 25,22 C30,10 44,4 60,6 C73,8 82,16 86,25 C93,18 105,15 117,19 C130,24 138,35 137,47 C150,48 158,54 158,64 Z"
              fill="#fff6ef"
            />
          </svg>
        </div>
      </div>

      {/* Original Layered Sugar Land Illustration: Rolling Hills, Lollipop Trees, Pines, Bushes & Small Candy House */}
      <svg
        viewBox="0 0 900 1200"
        preserveAspectRatio="xMidYMax slice"
        className="pointer-events-none absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6cd498" />
            <stop offset="55%" stopColor="#43b37a" />
            <stop offset="100%" stopColor="#2c8a62" />
          </linearGradient>
          <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8ce657" />
            <stop offset="50%" stopColor="#52bf36" />
            <stop offset="100%" stopColor="#2e8f26" />
          </linearGradient>
          <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a7f25c" />
            <stop offset="48%" stopColor="#61cc33" />
            <stop offset="100%" stopColor="#35941e" />
          </linearGradient>
          <linearGradient id="hillHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dcff9e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a7f25c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#42c47c" />
            <stop offset="100%" stopColor="#1b754b" />
          </linearGradient>
          <radialGradient id="lolliPink" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffb8de" />
            <stop offset="55%" stopColor="#ff4fa3" />
            <stop offset="100%" stopColor="#c4146a" />
          </radialGradient>
          <radialGradient id="lolliMint" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#b5fff0" />
            <stop offset="55%" stopColor="#2cd4b2" />
            <stop offset="100%" stopColor="#118772" />
          </radialGradient>
          <radialGradient id="lolliSun" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff4a3" />
            <stop offset="55%" stopColor="#ffae24" />
            <stop offset="100%" stopColor="#c96508" />
          </radialGradient>
          <linearGradient id="houseRoof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8ac6" />
            <stop offset="100%" stopColor="#df2882" />
          </linearGradient>
          <linearGradient id="houseWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6de" />
            <stop offset="100%" stopColor="#f5d49c" />
          </linearGradient>
        </defs>

        {/* Layer 1: Distant Rolling Hill */}
        <path
          d="M-40,790 Q210,670 460,750 T940,720 L940,1220 L-40,1220 Z"
          fill="url(#hillFar)"
        />
        <path
          d="M-40,790 Q210,670 460,750 T940,720 L940,755 Q680,785 460,782 Q210,705 -40,820 Z"
          fill="#a6f0c6"
          fillOpacity="0.32"
        />

        {/* Distant Stylized Pine Trees on Far Hill */}
        <g transform="translate(115, 688)">
          <rect x="19" y="50" width="8" height="22" rx="3" fill="#7c4724" />
          <polygon points="23,4 4,38 42,38" fill="url(#pineGrad)" />
          <polygon points="23,20 0,56 46,56" fill="url(#pineGrad)" />
        </g>
        <g transform="translate(162, 698) scale(0.78)">
          <rect x="19" y="50" width="8" height="22" rx="3" fill="#7c4724" />
          <polygon points="23,4 4,38 42,38" fill="url(#pineGrad)" />
          <polygon points="23,20 0,56 46,56" fill="url(#pineGrad)" />
        </g>
        <g transform="translate(760, 676) scale(0.92)">
          <rect x="19" y="50" width="8" height="22" rx="3" fill="#7c4724" />
          <polygon points="23,4 4,38 42,38" fill="url(#pineGrad)" />
          <polygon points="23,20 0,56 46,56" fill="url(#pineGrad)" />
        </g>

        {/* Small Original Candy House on Far-Right Meadow */}
        <g transform="translate(625, 650)">
          {/* Chimney */}
          <rect x="82" y="10" width="16" height="34" rx="4" fill="#ff73b6" stroke="#b01760" strokeWidth="2.5" />
          <rect x="79" y="8" width="22" height="8" rx="4" fill="#fffaf0" />
          {/* Cream Wafer House Body */}
          <rect x="16" y="48" width="92" height="72" rx="12" fill="url(#houseWall)" stroke="#cc9349" strokeWidth="3" />
          {/* Frosted Scalloped Pink Roof */}
          <path
            d="M4,56 L62,8 L120,56 Z"
            fill="url(#houseRoof)"
            stroke="#b01760"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M8,56 Q20,66 32,56 Q44,66 56,56 Q68,66 80,56 Q92,66 104,56 Q112,64 118,56"
            fill="#fffdf7"
            stroke="#f4bed9"
            strokeWidth="2"
          />
          {/* Rounded Caramel Door */}
          <path d="M47,120 L47,84 C47,75 77,75 77,84 L77,120 Z" fill="#c96d24" stroke="#85400e" strokeWidth="2.5" />
          <circle cx="69" cy="99" r="3" fill="#ffe680" />
          {/* Round Peppermint Window */}
          <circle cx="32" cy="79" r="9.5" fill="#99e4ff" stroke="#ffffff" strokeWidth="3" />
          <circle cx="92" cy="79" r="9.5" fill="#99e4ff" stroke="#ffffff" strokeWidth="3" />
        </g>

        {/* Layer 2: Midground Rolling Hill */}
        <path
          d="M-60,850 Q260,765 520,855 T960,815 L960,1220 L-60,1220 Z"
          fill="url(#hillMid)"
        />
        <path
          d="M-60,850 Q260,765 520,855 T960,815 L960,848 Q720,880 520,884 Q260,796 -60,882 Z"
          fill="url(#hillHighlight)"
        />

        {/* Lollipop Trees on Midground Hill with Gentle Ambient Foliage Sway */}
        <g transform="translate(86, 742)">
          <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '6.2s' }}>
            <rect x="26" y="48" width="8" height="62" rx="4" fill="#fffaf0" stroke="#e2d5c3" strokeWidth="1.5" />
            <circle cx="30" cy="32" r="28" fill="url(#lolliPink)" stroke="#9e0e55" strokeWidth="3" />
            <path
              d="M30,14 C41,14 46,24 44,33 C42,43 31,47 22,42 C15,38 15,27 22,22 C28,18 35,23 33,30"
              fill="none"
              stroke="#fff4fa"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <ellipse cx="20" cy="18" rx="8" ry="4" transform="rotate(-28 20 18)" fill="#ffffff" fillOpacity="0.65" />
          </g>
        </g>

        <g transform="translate(154, 772) scale(0.76)">
          <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '5.4s', animationDelay: '-1.8s' }}>
            <rect x="26" y="48" width="8" height="62" rx="4" fill="#fffaf0" stroke="#e2d5c3" strokeWidth="1.5" />
            <circle cx="30" cy="32" r="28" fill="url(#lolliMint)" stroke="#0c6e5d" strokeWidth="3" />
            <path
              d="M30,14 C41,14 46,24 44,33 C42,43 31,47 22,42 C15,38 15,27 22,22 C28,18 35,23 33,30"
              fill="none"
              stroke="#e8fff9"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>
        </g>

        <g transform="translate(768, 746) scale(0.88)">
          <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '6.6s', animationDelay: '-2.6s' }}>
            <rect x="26" y="48" width="8" height="62" rx="4" fill="#fffaf0" stroke="#e2d5c3" strokeWidth="1.5" />
            <circle cx="30" cy="32" r="28" fill="url(#lolliSun)" stroke="#9e4d04" strokeWidth="3" />
            <path
              d="M30,14 C41,14 46,24 44,33 C42,43 31,47 22,42 C15,38 15,27 22,22 C28,18 35,23 33,30"
              fill="none"
              stroke="#fffbe0"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Layer 3: Foreground Sunny Rolling Hills */}
        <path
          d="M-60,945 Q230,865 460,955 Q685,1030 960,925 L960,1220 L-60,1220 Z"
          fill="url(#hillFront)"
        />
        <path
          d="M-60,945 Q230,865 460,955 Q685,1030 960,925 L960,960 Q685,1062 460,986 Q230,896 -60,978 Z"
          fill="url(#hillHighlight)"
        />

        {/* Soft Foreground Bushes with Candy Berries */}
        <g transform="translate(18, 922)">
          <circle cx="32" cy="42" r="28" fill="#3da829" />
          <circle cx="64" cy="34" r="34" fill="#4ec234" />
          <circle cx="98" cy="44" r="26" fill="#379e24" />
          <circle cx="48" cy="26" r="5" fill="#ff5ca8" />
          <circle cx="76" cy="36" r="5" fill="#ffd836" />
          <circle cx="28" cy="46" r="4.5" fill="#38bdf8" />
        </g>
        <g transform="translate(758, 908)">
          <circle cx="28" cy="44" r="26" fill="#3da829" />
          <circle cx="62" cy="32" r="34" fill="#4ec234" />
          <circle cx="96" cy="44" r="28" fill="#379e24" />
          <circle cx="52" cy="28" r="5" fill="#ff5ca8" />
          <circle cx="80" cy="40" r="5" fill="#ffd836" />
        </g>

        {/* Gently Swaying Grass Blades & Original Candy Flowers */}
        <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '4.6s' }}>
          <path d="M235,985 Q239,968 245,960 M242,986 Q248,972 256,966" stroke="#d4ff96" strokeOpacity="0.65" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <circle cx="258" cy="962" r="6" fill="#ff6db6" />
          <circle cx="258" cy="962" r="2.5" fill="#fff4a3" />
        </g>
        <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '5.1s', animationDelay: '-1.5s' }}>
          <path d="M620,1018 Q624,1002 630,994 M628,1019 Q634,1006 642,1000" stroke="#d4ff96" strokeOpacity="0.65" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <circle cx="644" cy="996" r="6" fill="#ffd836" />
          <circle cx="644" cy="996" r="2.5" fill="#ffffff" />
        </g>
        <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDuration: '4.9s', animationDelay: '-2.7s' }}>
          <path d="M448,1044 Q452,1030 458,1022 M442,1044 Q436,1031 430,1026" stroke="#d4ff96" strokeOpacity="0.58" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <circle cx="428" cy="1023" r="5.5" fill="#7dd3fc" />
          <circle cx="428" cy="1023" r="2.2" fill="#fffdf0" />
        </g>
      </svg>

      {/* Top HUD Bar (Safe Area Top + Glossy Cream/Gold Stars Pill + Glossy Blue Settings Gear) */}
      <div className="safe-area-top relative z-20 w-full max-w-2xl flex items-center justify-between px-4 sm:px-6 pt-3">
        <div
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-1.5 rounded-full bg-gradient-to-b from-[#fffdf2] via-[#fff2c6] to-[#f8d778] border-[2.5px] border-[#fffef7] shadow-[0_4px_0_#c78816,0_8px_16px_rgba(120,74,8,0.28),inset_0_2px_2px_rgba(255,255,255,0.9)]"
          aria-label={`Stars earned: ${totalStars} of ${maxStars}`}
        >
          <Star className="w-5 h-5 fill-[#ffb800] text-[#b45309] shrink-0" />
          <span className="font-settings-heading font-extrabold text-[17px] leading-none text-[#78350f] tabular-nums whitespace-nowrap">
            Stars: {totalStars}/{maxStars}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Settings"
          title="Settings"
          className="candy-btn-blue relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-full text-white flex items-center justify-center cursor-pointer"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Center Reusable Sugar Pop Brand Lockup (Logo + Sparkles + Bubble Title) */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 -mt-2">
        <SugarPopBrand size="home" lowPerf={lowPerf} />
      </div>

      {/* Primary Action Stack (Safe Area Bottom Tray) */}
      <div className="safe-area-bottom-tray relative z-20 flex flex-col items-center gap-3.5 px-5 w-full max-w-[310px]">
        <button
          type="button"
          onClick={onPlayNow}
          className={`candy-btn-pink ${
            lowPerf ? '' : 'animate-play-pulse'
          } relative overflow-hidden w-full min-h-[58px] py-3.5 px-8 rounded-full font-settings-heading font-extrabold text-[30px] leading-none text-white tracking-wide cursor-pointer whitespace-nowrap`}
        >
          <span
            className="pointer-events-none absolute top-1.5 left-7 right-7 h-3.5 rounded-full bg-white/32"
            aria-hidden="true"
          />
          <span className="relative z-10 drop-shadow-[0_2px_0_rgba(130,8,64,0.65)]">Play</span>
        </button>

        <button
          type="button"
          onClick={onOpenDailyRewards}
          className={`candy-btn-green relative overflow-hidden w-full min-h-[50px] py-2.5 px-6 rounded-full font-settings-heading font-extrabold text-[20px] leading-none text-white flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            dailyClaimable ? 'ring-4 ring-[#fde047]' : ''
          }`}
        >
          <span
            className="pointer-events-none absolute top-1 left-6 right-6 h-3 rounded-full bg-white/28"
            aria-hidden="true"
          />
          <Gift className="relative z-10 w-5 h-5" />
          <span className="relative z-10 drop-shadow-[0_1.5px_0_rgba(10,75,26,0.55)]">
            {dailyClaimable ? 'Daily Gift!' : 'Rewards'}
          </span>
        </button>

        {/* Keyboard hint shown strictly on desktop (hover: hover and pointer: fine), hidden on mobile */}
        <p className="desktop-only-hint text-xs font-extrabold text-[#0c3c6e] bg-white/75 px-4 py-1.5 rounded-full text-center shadow-xs">
          Drag or click candies to swap · Enter to play · Esc to pause
        </p>
      </div>
    </div>
  );
};
