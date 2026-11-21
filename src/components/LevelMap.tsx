import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Gift, Heart, Home, Lock, Map as MapIcon, Settings, Star } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { PlayerInventory } from '../game/dailyRewards';
import { LEVELS } from '../game/levels';
import { useLowPerformanceMode } from '../game/performanceGuard';
import { LevelConfig, LevelProgress } from '../game/types';
import { LevelStartModal, SelectedStartBoosters } from './LevelStartModal';

interface LevelMapProps {
  progress: Record<number, LevelProgress>;
  highestUnlockedLevel: number;
  celebratedThreeStarLevelId: number | null;
  dailyClaimable: boolean;
  inventory: PlayerInventory;
  onCelebrationDone: () => void;
  onOpenSettings: () => void;
  onOpenDailyRewards: () => void;
  onSelectLevel: (levelId: number, boosters: SelectedStartBoosters) => void;
  onBackHome: () => void;
}

const CELEBRATION_SPARKLES: Array<{
  tx: string;
  ty: string;
  delay: string;
  size: number;
  color: string;
}> = [
  { tx: '-38px', ty: '-34px', delay: '60ms', size: 16, color: '#fef08a' },
  { tx: '38px', ty: '-36px', delay: '110ms', size: 18, color: '#ffffff' },
  { tx: '-48px', ty: '4px', delay: '170ms', size: 14, color: '#fde047' },
  { tx: '48px', ty: '6px', delay: '140ms', size: 15, color: '#fef08a' },
  { tx: '-24px', ty: '34px', delay: '220ms', size: 14, color: '#ffffff' },
  { tx: '26px', ty: '34px', delay: '260ms', size: 16, color: '#facc15' },
];

// Map virtual coordinate geometry (400px logical width, 1620px total vertical height)
const MAP_WIDTH = 400;
const NODE_STEP_Y = 122;
const MAP_TOP_PAD = 125;
const MAP_BOTTOM_PAD = 135;
const MAP_HEIGHT = MAP_TOP_PAD + (LEVELS.length - 1) * NODE_STEP_Y + MAP_BOTTOM_PAD;

// Winding horizontal positions (in 0..400 SVG coordinate space) from Level 1 -> Level 12
const NODE_X_COORDS = [200, 275, 135, 258, 125, 270, 285, 145, 128, 272, 148, 222];

function getNodePos(levelId: number): { x: number; y: number } {
  const indexFromBottom = levelId - 1;
  const x = NODE_X_COORDS[indexFromBottom % NODE_X_COORDS.length];
  const y = MAP_HEIGHT - MAP_BOTTOM_PAD - indexFromBottom * NODE_STEP_Y;
  return { x, y };
}

function buildSmoothRoadPath(): string {
  const pts = LEVELS.map((lvl) => getNodePos(lvl.id));
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

const EPISODE_BANNERS: Array<{
  id: string;
  label: string;
  y: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = [
  {
    id: 'ep3',
    label: 'Episode 3 · Mint Meadow',
    y: getNodePos(12).y - 68,
    bgClass: 'bg-gradient-to-b from-[#e8fff5] to-[#b6f5d9]',
    textClass: 'text-[#0a543d]',
    borderClass: 'border-[#38b889]',
  },
  {
    id: 'ep2',
    label: 'Episode 2 · Cocoa River',
    y: getNodePos(8).y - 62,
    bgClass: 'bg-gradient-to-b from-[#fff3df] to-[#f4cfa0]',
    textClass: 'text-[#69320a]',
    borderClass: 'border-[#c47a35]',
  },
  {
    id: 'ep1',
    label: 'Episode 1 · Caramel Hills',
    y: getNodePos(4).y - 62,
    bgClass: 'bg-gradient-to-b from-[#fff7e6] to-[#ffdca6]',
    textClass: 'text-[#7c3d06]',
    borderClass: 'border-[#e89b3c]',
  },
];

export const LevelMap: React.FC<LevelMapProps> = ({
  progress,
  highestUnlockedLevel,
  celebratedThreeStarLevelId,
  dailyClaimable,
  inventory,
  onCelebrationDone,
  onOpenSettings,
  onOpenDailyRewards,
  onSelectLevel,
  onBackHome,
}) => {
  const lowPerf = useLowPerformanceMode();
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(null);
  const currentNodeRef = useRef<HTMLDivElement | null>(null);
  const celebratedNodeRef = useRef<HTMLDivElement | null>(null);

  const roadPathD = useMemo(() => buildSmoothRoadPath(), []);

  useEffect(() => {
    const targetRef =
      celebratedThreeStarLevelId !== null && celebratedNodeRef.current
        ? celebratedNodeRef.current
        : currentNodeRef.current;
    targetRef?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, [highestUnlockedLevel, celebratedThreeStarLevelId]);

  useEffect(() => {
    if (celebratedThreeStarLevelId === null) return;
    soundEngine.playStartupPop();
    soundEngine.vibrate([18, 30, 26]);
    const timer = window.setTimeout(() => {
      onCelebrationDone();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [celebratedThreeStarLevelId, onCelebrationDone]);

  const totalStars = useMemo(
    () => Object.values(progress).reduce((sum, p) => sum + (p?.stars || 0), 0),
    [progress]
  );
  const goldCoins = totalStars * 50 + 100;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#72d48f]">
      {/* Glossy Pink Top Bar (Safe Area Top): Home, Lives, Gold & Settings */}
      <header className="candy-stripes-pink safe-area-top relative z-30 shrink-0 border-b-[3px] border-[#c91c6e] shadow-[0_6px_16px_rgba(115,12,61,0.3)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={onBackHome}
            aria-label="Back to Home"
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-gradient-to-b from-[#ffffff] to-[#ffe1f0] border-2 border-white text-[#b3125d] shadow-[0_4px_0_#b82a70,0_6px_12px_rgba(120,10,60,0.2)] flex items-center justify-center cursor-pointer transition-transform active:translate-y-0.5 shrink-0"
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Center Lives & Gold Status Badges */}
          <div className="flex items-center justify-center gap-2.5 min-w-0">
            {/* Lives (Heart + Number) */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-b from-[#fffdf9] to-[#ffe6f0] border-2 border-white shadow-[0_3px_0_#b82a70,inset_0_2px_2px_rgba(255,255,255,0.9)]"
              aria-label="5 lives"
            >
              <Heart className="w-5 h-5 fill-[#ff2965] text-[#b80b3d] shrink-0" />
              <span className="font-settings-heading font-extrabold text-[17px] leading-none text-[#8f0c47] tabular-nums">
                5
              </span>
            </div>

            {/* Coins / Gold */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-b from-[#fffdf2] to-[#ffe48c] border-2 border-white shadow-[0_3px_0_#c47c0e,inset_0_2px_2px_rgba(255,255,255,0.9)]"
              aria-label={`${goldCoins} gold coins`}
            >
              <Coins className="w-5 h-5 text-[#c77700] shrink-0" />
              <span className="font-settings-heading font-extrabold text-[17px] leading-none text-[#78350f] tabular-nums">
                {goldCoins}
              </span>
            </div>
          </div>

          {/* Right: Round Glossy Blue Settings Gear */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            title="Settings"
            className="candy-btn-blue w-12 h-12 min-w-[48px] min-h-[48px] rounded-full text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Scrollable Rich Illustrated Vertical World Map */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div
          className="relative mx-auto w-full max-w-[520px]"
          style={{ height: `${MAP_HEIGHT}px` }}
        >
          {/* Full-Bleed Original Illustrated SVG Scenery + Winding Striped Road */}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mapWorldBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8ce6d5" />
                <stop offset="22%" stopColor="#94e8b5" />
                <stop offset="36%" stopColor="#7ad996" />
                <stop offset="52%" stopColor="#96de7e" />
                <stop offset="68%" stopColor="#81d46a" />
                <stop offset="86%" stopColor="#a3e675" />
                <stop offset="100%" stopColor="#77cc58" />
              </linearGradient>
              <linearGradient id="mapRiver" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3ba8db" />
                <stop offset="50%" stopColor="#6cd2f7" />
                <stop offset="100%" stopColor="#3194c7" />
              </linearGradient>
              <radialGradient id="mapHillSoft" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#c5fa96" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#5cc24e" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="mapPine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3ac47a" />
                <stop offset="100%" stopColor="#167047" />
              </linearGradient>
              <radialGradient id="mapLolliPink" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffbadf" />
                <stop offset="55%" stopColor="#ff4ba1" />
                <stop offset="100%" stopColor="#ba1162" />
              </radialGradient>
              <radialGradient id="mapLolliBlue" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#b8f0ff" />
                <stop offset="55%" stopColor="#26a9ff" />
                <stop offset="100%" stopColor="#0c5eb3" />
              </radialGradient>
              <radialGradient id="mapLolliGold" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fff4a8" />
                <stop offset="55%" stopColor="#ffae24" />
                <stop offset="100%" stopColor="#bf5e06" />
              </radialGradient>
            </defs>

            {/* Layered Meadow Base */}
            <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapWorldBg)" />

            {/* Soft Layered Meadow Hills & Contour Swells Repeating Vertically */}
            {[160, 460, 790, 1120, 1440].map((cy, idx) => (
              <g key={cy}>
                <ellipse
                  cx={idx % 2 === 0 ? 75 : 330}
                  cy={cy}
                  rx="210"
                  ry="115"
                  fill="url(#mapHillSoft)"
                />
                <ellipse
                  cx={idx % 2 === 0 ? 345 : 55}
                  cy={cy + 90}
                  rx="170"
                  ry="85"
                  fill="#4fb842"
                  fillOpacity="0.22"
                />
              </g>
            ))}

            {/* Sparkling Ribbon River Winding Through Episode 2 */}
            <path
              d="M-20,690 C90,650 185,735 280,695 C340,670 385,685 420,670 L420,740 C375,755 330,738 275,762 C180,802 90,715 -20,758 Z"
              fill="url(#mapRiver)"
              opacity="0.88"
            />
            <path
              d="M-10,715 C95,680 185,762 280,722 C335,700 380,712 415,700"
              fill="none"
              stroke="#d9f6ff"
              strokeWidth="4"
              strokeDasharray="18 22"
              strokeLinecap="round"
              opacity="0.72"
            />

            {/* Soft Drifting Ambient Light Shafts Across Map Valley */}
            <g className={lowPerf ? 'opacity-25' : 'animate-sun-shafts'}>
              <polygon points="40,0 140,0 85,540 -15,540" fill="#ffffff" fillOpacity="0.16" />
              <polygon points="220,380 325,380 265,980 160,980" fill="#ffffff" fillOpacity="0.13" />
              <polygon points="60,940 168,940 108,1580 0,1580" fill="#ffffff" fillOpacity="0.13" />
            </g>

            {/* Soft Gently Drifting Clouds at Top & Mid Biomes */}
            {[
              { x: 26, y: 42, s: 0.7, d: '0s' },
              { x: 266, y: 84, s: 0.62, d: '-4s' },
              { x: 278, y: 515, s: 0.56, d: '-2.5s' },
              { x: 22, y: 955, s: 0.58, d: '-6s' },
            ].map((c, i) => (
              <g key={i} transform={`translate(${c.x}, ${c.y}) scale(${c.s})`} opacity="0.86">
                <g className={lowPerf ? '' : 'animate-float-cloud'} style={lowPerf ? undefined : { animationDelay: c.d }}>
                  <path
                    d="M24,52 C12,52 4,44 4,34 C4,25 12,18 22,18 C26,8 38,3 52,5 C63,7 70,13 74,20 C80,15 90,13 100,16 C111,20 117,29 116,39 C126,40 132,45 132,52 Z"
                    fill="#ffffff"
                  />
                </g>
              </g>
            ))}

            {/* Repeating Original Scenery Props Flanking Both Sides (Swaying Lollipop Trees, Pines, Bushes, Candy Houses) */}
            {[
              { type: 'lolli-pink', x: 318, y: 158, s: 0.85 },
              { type: 'pine', x: 32, y: 235, s: 0.9 },
              { type: 'house', x: 22, y: 365, s: 0.72 },
              { type: 'lolli-blue', x: 325, y: 432, s: 0.82 },
              { type: 'bush', x: 302, y: 575, s: 0.88 },
              { type: 'pine', x: 28, y: 585, s: 0.92 },
              { type: 'lolli-gold', x: 38, y: 785, s: 0.86 },
              { type: 'house', x: 284, y: 825, s: 0.74 },
              { type: 'pine', x: 332, y: 1015, s: 0.92 },
              { type: 'lolli-pink', x: 32, y: 1065, s: 0.88 },
              { type: 'bush', x: 306, y: 1190, s: 0.85 },
              { type: 'lolli-blue', x: 322, y: 1298, s: 0.84 },
              { type: 'house', x: 24, y: 1325, s: 0.74 },
              { type: 'pine', x: 324, y: 1455, s: 0.95 },
              { type: 'bush', x: 30, y: 1478, s: 0.92 },
            ].map((prop, idx) => {
              const swayDelay = `${-(idx * 0.9).toFixed(1)}s`;
              if (prop.type.startsWith('lolli')) {
                const fillId =
                  prop.type === 'lolli-pink'
                    ? 'url(#mapLolliPink)'
                    : prop.type === 'lolli-blue'
                    ? 'url(#mapLolliBlue)'
                    : 'url(#mapLolliGold)';
                return (
                  <g key={idx} transform={`translate(${prop.x}, ${prop.y}) scale(${prop.s})`}>
                    <ellipse cx="26" cy="96" rx="18" ry="5" fill="#1e6b36" fillOpacity="0.28" />
                    <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDelay: swayDelay, animationDuration: '6s' }}>
                      <rect x="22" y="42" width="8" height="54" rx="4" fill="#fffaf0" stroke="#dfd2be" strokeWidth="1.5" />
                      <circle cx="26" cy="28" r="24" fill={fillId} stroke="#ffffff" strokeWidth="2.5" />
                      <path
                        d="M26,13 C35,13 39,21 37,29 C35,37 26,40 19,36 C13,32 13,23 19,19 C24,16 30,20 28,26"
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.86"
                        strokeWidth="3.8"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                );
              }

              if (prop.type === 'pine') {
                return (
                  <g key={idx} transform={`translate(${prop.x}, ${prop.y}) scale(${prop.s})`}>
                    <ellipse cx="24" cy="74" rx="20" ry="5.5" fill="#165e33" fillOpacity="0.3" />
                    <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDelay: swayDelay, animationDuration: '6.5s' }}>
                      <rect x="20" y="52" width="8" height="22" rx="3" fill="#7d4822" />
                      <polygon points="24,4 5,36 43,36" fill="url(#mapPine)" />
                      <polygon points="24,20 0,56 48,56" fill="url(#mapPine)" />
                    </g>
                  </g>
                );
              }

              if (prop.type === 'house') {
                return (
                  <g key={idx} transform={`translate(${prop.x}, ${prop.y}) scale(${prop.s})`}>
                    <ellipse cx="56" cy="112" rx="46" ry="9" fill="#1c6131" fillOpacity="0.28" />
                    <rect x="74" y="10" width="14" height="30" rx="3" fill="#ff70b4" stroke="#b01760" strokeWidth="2" />
                    <rect x="14" y="44" width="84" height="64" rx="11" fill="#fff5db" stroke="#c98e42" strokeWidth="3" />
                    <path
                      d="M4,52 L56,8 L108,52 Z"
                      fill="#ff5ca8"
                      stroke="#b01760"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8,52 Q20,61 32,52 Q44,61 56,52 Q68,61 80,52 Q92,61 104,52"
                      fill="#ffffff"
                    />
                    <path d="M43,108 L43,76 C43,68 69,68 69,76 L69,108 Z" fill="#c76822" stroke="#7d3b0b" strokeWidth="2.5" />
                    <circle cx="29" cy="73" r="8" fill="#8ce0ff" stroke="#ffffff" strokeWidth="2.5" />
                    <circle cx="83" cy="73" r="8" fill="#8ce0ff" stroke="#ffffff" strokeWidth="2.5" />
                  </g>
                );
              }

              return (
                <g key={idx} transform={`translate(${prop.x}, ${prop.y}) scale(${prop.s})`}>
                  <circle cx="22" cy="30" r="18" fill="#3da829" />
                  <circle cx="44" cy="24" r="22" fill="#4ec234" />
                  <circle cx="66" cy="32" r="17" fill="#379e24" />
                  <circle cx="34" cy="20" r="4" fill="#ff5ca8" />
                  <circle cx="54" cy="26" r="4" fill="#ffd836" />
                </g>
              );
            })}

            {/* Subtle Swaying Meadow Flowers Along the Map */}
            {[
              { x: 92, y: 198, color: '#ff6db6', d: '0s' },
              { x: 315, y: 342, color: '#ffd836', d: '-1.4s' },
              { x: 84, y: 662, color: '#7dd3fc', d: '-2.2s' },
              { x: 328, y: 958, color: '#ff6db6', d: '-0.8s' },
              { x: 95, y: 1245, color: '#ffd836', d: '-3.1s' },
              { x: 305, y: 1412, color: '#ff6db6', d: '-1.9s' },
            ].map((fl, i) => (
              <g key={i} transform={`translate(${fl.x}, ${fl.y})`}>
                <g className={lowPerf ? '' : 'animate-ambient-sway'} style={lowPerf ? undefined : { animationDelay: fl.d, animationDuration: '4.8s' }}>
                  <path d="M0,14 Q2,6 0,0" stroke="#318c26" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  <circle cx="0" cy="-1" r="5" fill={fl.color} />
                  <circle cx="0" cy="-1" r="2" fill="#fffbeb" />
                </g>
              </g>
            ))}

            {/* Winding Pink-White Dotted-Striped Candy Path */}
            <path
              d={roadPathD}
              fill="none"
              stroke="#8c0d4d"
              strokeOpacity="0.28"
              strokeWidth="26"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(0, 5)"
            />
            <path
              d={roadPathD}
              fill="none"
              stroke="#ffffff"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={roadPathD}
              fill="none"
              stroke="#ff63ad"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="16 14"
            />
          </svg>

          {/* Episode Banners Only at the Start of Each Episode */}
          {EPISODE_BANNERS.map((banner) => (
            <div
              key={banner.id}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-10"
              style={{ top: `${banner.y}px` }}
            >
              <div
                className={`${banner.bgClass} ${banner.textClass} ${banner.borderClass} border-2 px-4 py-1 rounded-full shadow-[0_4px_10px_rgba(15,40,30,0.2)] font-settings-heading font-extrabold text-[13px] tracking-wide whitespace-nowrap`}
              >
                {banner.label}
              </div>
            </div>
          ))}

          {/* Interactive Level Nodes Positioned Exactly Along the Winding Path */}
          {LEVELS.map((lvl) => {
            const pos = getNodePos(lvl.id);
            const leftPct = (pos.x / MAP_WIDTH) * 100;
            const unlocked = lvl.id <= highestUnlockedLevel;
            const prog = progress[lvl.id];
            const stars = prog?.stars ?? 0;
            const isThreeStar = stars >= 3;
            const isCelebrating = celebratedThreeStarLevelId === lvl.id && isThreeStar;
            const isCurrent = lvl.id === highestUnlockedLevel;
            const isCompleted = stars > 0;

            return (
              <div
                key={lvl.id}
                ref={(el) => {
                  if (isCurrent) currentNodeRef.current = el;
                  if (isCelebrating) celebratedNodeRef.current = el;
                }}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${leftPct}%`, top: `${pos.y}px` }}
              >
                {/* Floating 3-Star Celebratory Pop Banner */}
                {isCelebrating && (
                  <div
                    className="animate-three-star-banner pointer-events-none absolute -top-9 left-1/2 z-30 whitespace-nowrap rounded-full bg-gradient-to-r from-[#ffae19] via-[#ffe047] to-[#ff8c1a] px-3.5 py-1 border-2 border-white shadow-[0_6px_16px_rgba(180,83,9,0.45)] font-settings-heading font-extrabold text-xs sm:text-sm text-[#782800] tracking-wide"
                    aria-live="polite"
                  >
                    ★ 3 STARS! ★
                  </div>
                )}

                <div className="relative flex items-center justify-center">
                  {/* Original Avatar Marker Beside Current Level */}
                  {isCurrent && (
                    <div
                      className={`${
                        lowPerf ? '' : 'animate-avatar-bob'
                      } pointer-events-none absolute -left-[58px] top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-gradient-to-b from-[#fffdf5] to-[#ffe699] border-[3px] border-white shadow-[0_5px_12px_rgba(12,42,78,0.35)] flex items-center justify-center`}
                      aria-hidden="true"
                    >
                      {/* Original Smiling Sugar Star Mascot Avatar */}
                      <svg viewBox="0 0 48 48" className="w-9 h-9">
                        <defs>
                          <radialGradient id="avatarCandy" cx="35%" cy="30%" r="70%">
                            <stop offset="0%" stopColor="#ff9ed2" />
                            <stop offset="60%" stopColor="#ff3d94" />
                            <stop offset="100%" stopColor="#bd0d61" />
                          </radialGradient>
                        </defs>
                        <circle cx="24" cy="25" r="18" fill="url(#avatarCandy)" stroke="#7a063c" strokeWidth="2.2" />
                        <path d="M14,13 L18,5 L24,11 L30,5 L34,13 Z" fill="#ffd836" stroke="#b45309" strokeWidth="1.8" strokeLinejoin="round" />
                        <circle cx="18" cy="24" r="2.6" fill="#1e1b4b" />
                        <circle cx="30" cy="24" r="2.6" fill="#1e1b4b" />
                        <circle cx="17.2" cy="23.1" r="0.9" fill="#ffffff" />
                        <circle cx="29.2" cy="23.1" r="0.9" fill="#ffffff" />
                        <path d="M19,30 Q24,35 29,30" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
                        <ellipse cx="14" cy="28" rx="2.5" ry="1.5" fill="#ff9ed2" />
                        <ellipse cx="34" cy="28" rx="2.5" ry="1.5" fill="#ff9ed2" />
                      </svg>
                    </div>
                  )}

                  {/* Pulsing Bright White Glow Ring on Current Level */}
                  {isCurrent && (
                    <span
                      className={`${
                        lowPerf ? '' : 'animate-current-node-ring'
                      } pointer-events-none absolute -inset-2.5 rounded-full border-[4px] border-white shadow-[0_0_18px_rgba(255,255,255,0.95)]`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Golden Shockwave Ring Burst on New 3-Star Achievement */}
                  {isCelebrating && (
                    <>
                      <span
                        className="animate-star-ring-burst pointer-events-none absolute inset-0 rounded-full border-4 border-[#fde047]"
                        aria-hidden="true"
                      />
                      <span
                        className="animate-star-ring-burst pointer-events-none absolute inset-0 rounded-full border-4 border-white"
                        style={{ animationDelay: '220ms' }}
                        aria-hidden="true"
                      />
                    </>
                  )}

                  {/* Round Glossy 3D Level Node Button (>= 64px) */}
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (!unlocked) return;
                      soundEngine.unlock();
                      soundEngine.playButton();
                      setSelectedLevel(lvl);
                    }}
                    className={`relative overflow-hidden rounded-full flex items-center justify-center font-settings-heading font-extrabold transition-transform ${
                      isCurrent
                        ? `w-[74px] h-[74px] text-[30px] text-white cursor-pointer border-[4px] border-white bg-gradient-to-b from-[#ff72bc] via-[#ef1f80] to-[#c40c62] shadow-[0_7px_0_#850641,0_12px_22px_rgba(120,8,58,0.45),inset_0_3px_4px_rgba(255,255,255,0.65)] ${
                            lowPerf ? '' : 'animate-node-pulse'
                          }`
                        : unlocked
                        ? `w-[66px] h-[66px] text-[27px] text-white cursor-pointer border-[3.5px] border-white bg-gradient-to-b from-[#ff6db6] via-[#e61e78] to-[#bf0e5f] shadow-[0_6px_0_#820640,0_10px_18px_rgba(110,8,54,0.36),inset_0_3px_3px_rgba(255,255,255,0.6)] active:translate-y-1 ${
                            isThreeStar ? 'ring-3 ring-[#fde047]' : ''
                          }`
                        : 'w-[62px] h-[62px] text-[#475569] cursor-not-allowed border-[3px] border-[#e2e8f0] bg-gradient-to-b from-[#cbd5e1] via-[#94a3b8] to-[#64748b] shadow-[0_5px_0_#475569,inset_0_2px_3px_rgba(255,255,255,0.55)]'
                    }`}
                    aria-label={
                      unlocked
                        ? `Level ${lvl.id}, ${stars} of 3 stars`
                        : `Level ${lvl.id} locked`
                    }
                  >
                    {/* Top Glossy Specular Arc */}
                    <span
                      className="pointer-events-none absolute top-1 left-3 right-3 h-3.5 rounded-full bg-white/35"
                      aria-hidden="true"
                    />
                    {unlocked ? (
                      <span className="relative z-10 tabular-nums leading-none drop-shadow-[0_2px_0_rgba(122,9,63,0.72)]">
                        {lvl.id}
                      </span>
                    ) : (
                      <Lock className="relative z-10 w-6 h-6 text-[#f1f5f9] drop-shadow-xs" />
                    )}
                  </button>
                </div>

                {/* 3 Stars Beneath Completed Levels (with full 3-star celebratory animation intact) */}
                {isCompleted && (
                  <div className="relative mt-1.5 flex items-center justify-center gap-0.5">
                    {isThreeStar && !lowPerf && (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          width={13}
                          height={13}
                          className="animate-sugar-sparkle pointer-events-none absolute -left-4 -top-1"
                          style={{ animationDelay: '0s', animationDuration: '2s' }}
                          aria-hidden="true"
                        >
                          <path
                            d="M12 1 L14.8 9.2 L23 12 L14.8 14.8 L12 23 L9.2 14.8 L1 12 L9.2 9.2 Z"
                            fill="#fef08a"
                          />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          width={12}
                          height={12}
                          className="animate-sugar-sparkle pointer-events-none absolute -right-4 -top-0.5"
                          style={{ animationDelay: '0.85s', animationDuration: '2.2s' }}
                          aria-hidden="true"
                        >
                          <path
                            d="M12 1 L14.8 9.2 L23 12 L14.8 14.8 L12 23 L9.2 14.8 L1 12 L9.2 9.2 Z"
                            fill="#ffffff"
                          />
                        </svg>
                      </>
                    )}

                    {isCelebrating &&
                      CELEBRATION_SPARKLES.map((sp, sIdx) => (
                        <svg
                          key={sIdx}
                          viewBox="0 0 24 24"
                          width={sp.size}
                          height={sp.size}
                          className="animate-star-sparkle-pop pointer-events-none absolute left-1/2 top-1/2 -ml-2 -mt-2 z-20"
                          style={
                            {
                              '--tx': sp.tx,
                              '--ty': sp.ty,
                              animationDelay: sp.delay,
                            } as React.CSSProperties
                          }
                          aria-hidden="true"
                        >
                          <path
                            d="M12 1 L14.8 9.2 L23 12 L14.8 14.8 L12 23 L9.2 14.8 L1 12 L9.2 9.2 Z"
                            fill={sp.color}
                          />
                        </svg>
                      ))}

                    {[1, 2, 3].map((s) => {
                      const earned = stars >= s;
                      const isCenterStar = s === 2;
                      const staggerMs = (s - 1) * 140;

                      return (
                        <span
                          key={s}
                          className={`inline-flex items-center justify-center ${
                            isCenterStar ? '-translate-y-0.5' : ''
                          }`}
                        >
                          <Star
                            className={`${
                              isCenterStar ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'
                            } ${
                              earned
                                ? isCelebrating
                                  ? 'fill-[#fde047] text-[#d97706] animate-three-star-pop'
                                  : isThreeStar && !lowPerf
                                  ? 'fill-[#fde047] text-[#d97706] animate-three-star-shimmer'
                                  : 'fill-[#ffd836] text-[#c76e00]'
                                : 'fill-white/70 text-[#7d8da3]'
                            }`}
                            style={
                              isCelebrating
                                ? {
                                    animationDelay: `${staggerMs}ms, ${700 + staggerMs}ms`,
                                  }
                                : isThreeStar && !lowPerf
                                ? {
                                    animationDelay: `${staggerMs * 1.4}ms`,
                                  }
                                : undefined
                            }
                          />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Simple Compact Bottom Navigation Bar (Map, Rewards) with Safe Area Bottom Tray Padding */}
      <nav
        aria-label="Map navigation"
        className="safe-area-bottom-tray relative z-30 shrink-0 bg-gradient-to-b from-[#fffaf2] to-[#ffe6f2] border-t-[3px] border-[#ff9ec9] shadow-[0_-6px_16px_rgba(120,16,66,0.18)]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-4 pt-2 gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playTap();
              currentNodeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }}
            className="flex-1 min-h-[48px] rounded-2xl bg-gradient-to-b from-[#ff6db6] to-[#df1973] border-2 border-white text-white shadow-[0_4px_0_#940b49] flex items-center justify-center gap-2 font-settings-heading font-extrabold text-[17px] cursor-pointer transition-transform active:translate-y-0.5"
            aria-current="page"
          >
            <MapIcon className="w-5 h-5" />
            <span>Map</span>
          </button>

          <button
            type="button"
            onClick={onOpenDailyRewards}
            className={`relative flex-1 min-h-[48px] rounded-2xl bg-gradient-to-b from-[#64e884] to-[#1aa840] border-2 border-white text-white shadow-[0_4px_0_#0f6b27] flex items-center justify-center gap-2 font-settings-heading font-extrabold text-[17px] cursor-pointer transition-transform active:translate-y-0.5 ${
              dailyClaimable ? 'ring-3 ring-[#fde047]' : ''
            }`}
          >
            <Gift className="w-5 h-5" />
            <span>Rewards</span>
          </button>
        </div>
      </nav>

      {/* Hanging-Card Level Start Popup */}
      {selectedLevel && (
        <LevelStartModal
          level={selectedLevel}
          bestStars={progress[selectedLevel.id]?.stars ?? 0}
          inventory={inventory}
          onPlay={(levelId, boosters) => {
            setSelectedLevel(null);
            onSelectLevel(levelId, boosters);
          }}
          onClose={() => setSelectedLevel(null)}
        />
      )}
    </div>
  );
};
