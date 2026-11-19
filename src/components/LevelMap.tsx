import React, { useEffect, useRef } from 'react';
import { Gift, Home, Lock, Settings, Star } from 'lucide-react';
import { LEVELS } from '../game/levels';
import { LevelProgress } from '../game/types';

interface LevelMapProps {
  progress: Record<number, LevelProgress>;
  highestUnlockedLevel: number;
  dailyClaimable: boolean;
  onOpenSettings: () => void;
  onOpenDailyRewards: () => void;
  onSelectLevel: (levelId: number) => void;
  onBackHome: () => void;
}

export const LevelMap: React.FC<LevelMapProps> = ({
  progress,
  highestUnlockedLevel,
  dailyClaimable,
  onOpenSettings,
  onOpenDailyRewards,
  onSelectLevel,
  onBackHome,
}) => {
  const currentNodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }, [highestUnlockedLevel]);

  // Reverse order so Level 1 starts at bottom and Level 12 is at the top (just like Candy Crush Saga!)
  const orderedLevels = [...LEVELS].reverse();

  // Horizontal wave offsets (%) so the road winds smoothly left and right
  const getXOffset = (levelId: number): number => {
    const wave = [0, 14, -12, 8, -16, 12, 16, -8, -14, 14, -10, 6];
    return wave[(levelId - 1) % wave.length];
  };

  const totalStars = Object.values(progress).reduce((sum, p) => sum + (p?.stars || 0), 0);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#a6e37e]">
      {/* Top Peppermint HUD Bar */}
      <header className="candy-stripes-pink relative z-20 shrink-0 flex items-center justify-between px-4 py-3 border-b-4 border-[#d95b96] shadow-md">
        <button
          type="button"
          onClick={onBackHome}
          aria-label="Back to Title Screen"
          className="w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#b3125d] shadow flex items-center justify-center cursor-pointer transition-transform active:scale-95"
        >
          <Home className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white text-stroke-pink tracking-wide whitespace-nowrap">
            Candy Kingdom Map
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 bg-white/85 px-3 py-1 rounded-xl text-[#8c0743] font-extrabold text-sm tabular-nums shadow-inner">
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            <span>
              {totalStars} / {LEVELS.length * 3}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDailyRewards}
            aria-label="Open Daily Rewards"
            title="Daily Rewards"
            className={`w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#b3125d] shadow flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${
              dailyClaimable ? 'ring-3 ring-yellow-300' : ''
            }`}
          >
            <Gift className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            title="Settings"
            className="w-11 h-11 rounded-full bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] hover:from-[#2563eb] hover:to-[#1e40af] text-white border-2 border-[#93c5fd] shadow flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Scrollable Winding Kingdom Map */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="relative mx-auto w-full max-w-2xl min-h-full py-10 px-4 flex flex-col items-center"
          style={{
            background:
              'linear-gradient(180deg, #86e3b5 0%, #a4ebb2 28%, #5b9bd5 32%, #4a7eb5 37%, #a1d973 41%, #e8cb8e 70%, #f5d38c 100%)',
          }}
        >
          {/* Biome Banners */}
          <div className="w-full flex flex-col gap-6 relative z-10">
            {orderedLevels.map((lvl, idx) => {
              const unlocked = lvl.id <= highestUnlockedLevel;
              const prog = progress[lvl.id];
              const stars = prog?.stars ?? 0;
              const isCurrent = lvl.id === highestUnlockedLevel;
              const offsetX = getXOffset(lvl.id);

              const showMintLabel = lvl.id === 12;
              const showChocoLabel = lvl.id === 8;
              const showCaramelLabel = lvl.id === 4;

              return (
                <React.Fragment key={lvl.id}>
                  {showMintLabel && (
                    <div className="self-center bg-white/85 px-5 py-1.5 rounded-2xl shadow-sm text-sm font-extrabold text-[#0b5e44] tracking-wide">
                      Episode 3 · Mint Meadow
                    </div>
                  )}
                  {showChocoLabel && (
                    <div className="self-center my-2 bg-[#5e2f16]/90 px-5 py-1.5 rounded-2xl shadow text-sm font-extrabold text-[#ffdfb3] tracking-wide border-2 border-[#a86234]">
                      Episode 2 · Chocolate River
                    </div>
                  )}
                  {showCaramelLabel && (
                    <div className="self-center my-2 bg-white/85 px-5 py-1.5 rounded-2xl shadow-sm text-sm font-extrabold text-[#8a4508] tracking-wide">
                      Episode 1 · Caramel Town
                    </div>
                  )}

                  <div
                    ref={isCurrent ? currentNodeRef : undefined}
                    className="relative flex flex-col items-center py-2"
                    style={{ transform: `translateX(${offsetX}%)` }}
                  >
                    {/* Striped Road Connector downwards to next node */}
                    {idx < orderedLevels.length - 1 && (
                      <div
                        className="absolute top-12 w-5 h-20 -z-10 rounded-full opacity-90"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(135deg, #ffffff 0px, #ffffff 10px, #ff99c8 10px, #ff99c8 20px)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        }}
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex items-center gap-3">
                      {isCurrent && (
                        <div className="hidden sm:flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-b from-[#60d394] to-[#2e9950] border-2 border-white shadow-lg text-white font-display font-bold text-xs">
                          YOU
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && onSelectLevel(lvl.id)}
                        className={`relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex flex-col items-center justify-center font-display font-bold text-2xl transition-transform ${
                          unlocked
                            ? isCurrent
                              ? 'candy-btn-pink text-white cursor-pointer ring-4 ring-yellow-300/90 scale-105'
                              : 'candy-btn-pink text-white cursor-pointer'
                            : 'bg-slate-400/90 border-2 border-slate-200 text-slate-100 shadow-inner cursor-not-allowed opacity-85'
                        }`}
                        aria-label={
                          unlocked
                            ? `Play Level ${lvl.id}: ${lvl.name}, ${stars} of 3 stars`
                            : `Level ${lvl.id} locked`
                        }
                      >
                        {unlocked ? (
                          <span className="tabular-nums drop-shadow">{lvl.id}</span>
                        ) : (
                          <Lock className="w-6 h-6" />
                        )}
                      </button>
                    </div>

                    {/* 3-Star Cluster & Level Name */}
                    <div className="mt-1.5 flex items-center gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 sm:w-5 sm:h-5 ${
                            stars >= s
                              ? 'fill-amber-400 text-amber-600 drop-shadow-sm'
                              : 'fill-white/60 text-slate-400/70'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="mt-0.5 text-xs font-extrabold text-slate-900 bg-white/75 px-2.5 py-0.5 rounded-lg shadow-xs whitespace-nowrap">
                      {lvl.name}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
