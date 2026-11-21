import React, { useState } from 'react';
import { Check, Hammer, Lock, PlusCircle, Shuffle, Star, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { PlayerInventory } from '../game/dailyRewards';
import { CANDY_HEX } from '../game/levels';
import { LevelConfig } from '../game/types';
import { CandySprite } from './CandySprite';

export interface SelectedStartBoosters {
  hammer: boolean;
  shuffle: boolean;
  bonusMoves: boolean;
}

interface LevelStartModalProps {
  level: LevelConfig;
  bestStars: number;
  inventory: PlayerInventory;
  onPlay: (levelId: number, boosters: SelectedStartBoosters) => void;
  onClose: () => void;
}

const COLOR_GOAL_NOUN: Record<string, string> = {
  red: 'red candies',
  orange: 'orange candies',
  yellow: 'yellow candies',
  green: 'green candies',
  blue: 'blue candies',
  purple: 'purple candies',
};

export const LevelStartModal: React.FC<LevelStartModalProps> = ({
  level,
  bestStars,
  inventory,
  onPlay,
  onClose,
}) => {
  const [selected, setSelected] = useState<SelectedStartBoosters>({
    hammer: false,
    shuffle: false,
    bonusMoves: false,
  });

  const toggleBooster = (key: keyof SelectedStartBoosters, available: number) => {
    if (available <= 0) return;
    soundEngine.unlock();
    soundEngine.playTap();
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const goalText = level.order
    ? `Collect ${level.order.target} ${COLOR_GOAL_NOUN[level.order.color] ?? `${CANDY_HEX[level.order.color].label.toLowerCase()}s`}!`
    : `Reach ${level.targetScore.toLocaleString()} points!`;

  const boosterItems: Array<{
    key: keyof SelectedStartBoosters;
    label: string;
    count: number;
    icon: React.ReactNode;
    gradient: string;
    edgeColor: string;
  }> = [
    {
      key: 'hammer',
      label: 'Hammer',
      count: inventory.hammers,
      icon: <Hammer className="w-7 h-7 text-white drop-shadow-sm" />,
      gradient: 'from-[#ff6fb5] via-[#ec2280] to-[#c40f62]',
      edgeColor: '#8c0743',
    },
    {
      key: 'shuffle',
      label: 'Shuffle',
      count: inventory.shuffles,
      icon: <Shuffle className="w-7 h-7 text-white drop-shadow-sm" />,
      gradient: 'from-[#5bc4ff] via-[#1c88eb] to-[#0e62b8]',
      edgeColor: '#08417f',
    },
    {
      key: 'bonusMoves',
      label: '+5 Moves',
      count: inventory.bonusMoves,
      icon: <PlusCircle className="w-7 h-7 text-white drop-shadow-sm" />,
      gradient: 'from-[#64eb84] via-[#22b84a] to-[#128a32]',
      edgeColor: '#0b5c20',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-[#061529]/62 px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${level.id} details`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playButton();
          onClose();
        }
      }}
    >
      {/* Hanging Card Assembly Dropping Smoothly From Top */}
      <div className="animate-hanging-card relative w-full max-w-[360px] flex flex-col items-center pb-8">
        {/* Two Striped Hanging Cords */}
        <div className="w-[210px] flex items-end justify-between" aria-hidden="true">
          <div className="w-3 h-16 sm:h-20 candy-cord-stripe rounded-b-sm shadow-sm" />
          <div className="w-3 h-16 sm:h-20 candy-cord-stripe rounded-b-sm shadow-sm" />
        </div>

        {/* Main Glossy Cream & Pink Hanging Card */}
        <div className="relative -mt-2 w-full rounded-[30px] bg-gradient-to-b from-[#fffdf7] to-[#fff1f7] border-[4px] border-[#ff7ab8] shadow-[0_18px_40px_rgba(7,20,44,0.52),inset_0_3px_0_rgba(255,255,255,0.9)] px-5 pt-7 pb-6 flex flex-col items-center">
          {/* Two Golden Cord Eyelets */}
          <div
            className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 w-[214px] flex items-center justify-between px-0.5"
            aria-hidden="true"
          >
            <span className="w-5 h-5 rounded-full bg-gradient-to-b from-[#ffe985] to-[#e08f00] border-2 border-[#fffaf0] shadow-md" />
            <span className="w-5 h-5 rounded-full bg-gradient-to-b from-[#ffe985] to-[#e08f00] border-2 border-[#fffaf0] shadow-md" />
          </div>

          {/* Top-Right Glossy Red Round X Button (>= 48px tap target) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playButton();
              onClose();
            }}
            aria-label="Close level popup"
            className="candy-btn-red absolute -top-4 -right-3 w-12 h-12 min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center text-white cursor-pointer z-20"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>

          {/* Header Ribbon: Level N */}
          <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-[#ff6db4] to-[#df1b74] border-[3px] border-white px-7 py-1.5 shadow-[0_5px_0_#9b0b4d,0_8px_16px_rgba(155,11,77,0.3)] -mt-1">
            <h2 className="font-settings-heading font-extrabold text-[28px] leading-none text-white tracking-wide drop-shadow-[0_2px_0_rgba(122,9,63,0.65)]">
              Level {level.id}
            </h2>
          </div>

          {/* Previous Best Stars Row */}
          <div className="flex items-center justify-center gap-1.5 mt-3" aria-label={`Best: ${bestStars} of 3 stars`}>
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`${s === 2 ? 'w-7 h-7 -mt-1' : 'w-6 h-6'} ${
                  bestStars >= s
                    ? 'fill-[#ffd836] text-[#d97706]'
                    : 'fill-[#f3d4e3] text-[#d9a8c1]'
                }`}
              />
            ))}
          </div>

          {/* Goal Row (Icon + Clear Goal Text) */}
          <div className="mt-3.5 w-full rounded-2xl bg-[#fff6e5] border-2 border-[#f6cf8a] px-4 py-3 shadow-[inset_0_2px_5px_rgba(180,120,25,0.12)] flex items-center gap-3.5">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-white border-2 border-[#ffe2ab] shadow-xs flex items-center justify-center p-1">
              {level.order ? (
                <CandySprite color={level.order.color} special="none" />
              ) : (
                <Star className="w-8 h-8 fill-[#ffd836] text-[#d97706]" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-settings font-extrabold text-[15px] leading-snug text-[#1e3a5f]">
                {goalText}
              </div>
              <div className="font-settings font-bold text-[13px] text-[#7a4b14] mt-0.5 tabular-nums">
                {level.moves + (selected.bonusMoves ? 5 : 0)} moves
                {selected.bonusMoves ? ' (+5 active)' : ''}
              </div>
            </div>
          </div>

          {/* Booster Selector Section */}
          <div className="mt-4 w-full flex flex-col items-center">
            <p className="font-settings font-extrabold text-[15px] text-[#1e3a5f] mb-3">
              Select boosters:
            </p>

            <div className="flex items-start justify-center gap-4 w-full">
              {boosterItems.map((item) => {
                const isSelected = selected[item.key];
                const isLocked = item.count <= 0;
                return (
                  <div key={item.key} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => toggleBooster(item.key, item.count)}
                      aria-pressed={isSelected}
                      aria-label={`${item.label} (${item.count} available)`}
                      className={`relative w-[62px] h-[62px] min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center transition-transform active:translate-y-0.5 ${
                        isLocked
                          ? 'bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] border-[3px] border-[#e2e8f0] shadow-[0_4px_0_#64748b] cursor-not-allowed opacity-80'
                          : `bg-gradient-to-b ${item.gradient} border-[3px] ${
                              isSelected ? 'border-[#fde047] ring-4 ring-[#4ade80]/70' : 'border-white'
                            } cursor-pointer`
                      }`}
                      style={
                        isLocked
                          ? undefined
                          : {
                              boxShadow: `0 5px 0 ${item.edgeColor}, 0 8px 14px rgba(15,23,42,0.22), inset 0 3px 3px rgba(255,255,255,0.55)`,
                            }
                      }
                    >
                      {/* Top Gloss Highlight */}
                      <span
                        className="pointer-events-none absolute top-1 left-2.5 right-2.5 h-3.5 rounded-full bg-white/35"
                        aria-hidden="true"
                      />

                      {isLocked ? (
                        <Lock className="w-6 h-6 text-[#475569]" />
                      ) : (
                        item.icon
                      )}

                      {/* Count Badge OR Selected Checkmark */}
                      <span
                        className={`absolute -bottom-1 -right-1 min-w-[24px] h-[24px] px-1 rounded-full border-2 border-white flex items-center justify-center text-[12px] font-extrabold tabular-nums shadow ${
                          isSelected
                            ? 'bg-[#16a34a] text-white'
                            : isLocked
                            ? 'bg-[#64748b] text-white'
                            : 'bg-[#0f294a] text-white'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3.5]" /> : item.count}
                      </span>
                    </button>
                    <span className="font-settings font-extrabold text-[12px] text-[#334155] whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary Glossy Pink Play! CTA (>= 54px tall) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playButton();
              onPlay(level.id, selected);
            }}
            className="candy-btn-pink relative overflow-hidden mt-5 w-full min-h-[54px] py-3.5 px-8 rounded-full font-settings-heading font-extrabold text-[26px] leading-none text-white tracking-wide cursor-pointer"
          >
            <span
              className="pointer-events-none absolute top-1 left-6 right-6 h-3.5 rounded-full bg-white/30"
              aria-hidden="true"
            />
            <span className="relative z-10">Play!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
