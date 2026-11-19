import React from 'react';
import { Check, Gift, Hammer, PlusCircle, Shuffle, Sparkles, X } from 'lucide-react';
import {
  canClaimDailyReward,
  DAILY_REWARD_DAYS,
  DailyRewardState,
  getActiveRewardDay,
} from '../game/dailyRewards';

interface DailyRewardModalProps {
  dailyState: DailyRewardState;
  justClaimedDay: number | null;
  onClaim: () => void;
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  dailyState,
  justClaimedDay,
  onClaim,
  onClose,
}) => {
  const claimable = canClaimDailyReward(dailyState);
  const activeDay = getActiveRewardDay(dailyState);

  const renderGrantIcons = (grant: (typeof DAILY_REWARD_DAYS)[number]['grant']) => {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[#9e1054]">
        {grant.hammers && (
          <span className="inline-flex items-center gap-0.5 text-xs font-extrabold tabular-nums">
            <Hammer className="w-4 h-4 text-[#e61e78]" />+{grant.hammers}
          </span>
        )}
        {grant.shuffles && (
          <span className="inline-flex items-center gap-0.5 text-xs font-extrabold tabular-nums">
            <Shuffle className="w-4 h-4 text-[#1c88eb]" />+{grant.shuffles}
          </span>
        )}
        {grant.bonusMoves && (
          <span className="inline-flex items-center gap-0.5 text-xs font-extrabold tabular-nums">
            <PlusCircle className="w-4 h-4 text-[#22b84a]" />+{grant.bonusMoves * 5} Moves
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Rewards"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#fff8fc] border-4 border-[#ff8ec4] shadow-2xl p-5 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Daily Rewards"
          className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-pink-100 hover:bg-pink-200 text-[#9e1054] flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pr-6 sm:pr-0">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-b from-[#ff6db3] to-[#d91670] text-white shadow-md mb-2">
            <Gift className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#b3125d]">
            Daily Rewards
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-600 mt-0.5">
            {claimable
              ? `Open every day to build your streak! Day ${activeDay} reward is ready.`
              : justClaimedDay
              ? `Day ${justClaimedDay} reward claimed! Come back tomorrow for Day ${justClaimedDay >= 7 ? 1 : justClaimedDay + 1}.`
              : `Today's reward is already claimed! Next up: Day ${activeDay >= 7 ? 1 : activeDay + 1}.`}
          </p>
        </div>

        {/* 7-Day Reward Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DAILY_REWARD_DAYS.map((item) => {
            const isPastClaimed = claimable ? item.day < activeDay : item.day <= activeDay;
            const isTodayTarget = claimable && item.day === activeDay;
            const isJustClaimed = !claimable && justClaimedDay === item.day;

            return (
              <div
                key={item.day}
                className={`relative rounded-2xl p-2.5 border-2 flex flex-col items-center justify-between gap-1.5 text-center transition-transform ${
                  item.day === 7 ? 'col-span-2' : ''
                } ${
                  isTodayTarget
                    ? 'bg-gradient-to-b from-[#fff2b3] to-[#ffe17d] border-[#f59e0b] shadow-md scale-[1.02]'
                    : isJustClaimed
                    ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                    : isPastClaimed
                    ? 'bg-pink-50/80 border-pink-200 opacity-80'
                    : 'bg-white border-pink-200'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-xs font-extrabold uppercase tracking-wide text-[#8c0743]">
                  {item.highlight && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{item.title}</span>
                </div>

                {renderGrantIcons(item.grant)}

                <div className="text-[11px] font-bold text-slate-700 leading-tight">
                  {item.rewardText}
                </div>

                {isPastClaimed && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    <span>Claimed</span>
                  </div>
                )}

                {isTodayTarget && (
                  <div className="mt-0.5 text-[11px] font-extrabold text-amber-800">
                    Ready Now!
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Booster Inventory Summary */}
        <div className="bg-pink-100/75 rounded-2xl px-4 py-2.5 flex items-center justify-around text-xs font-extrabold text-[#7a093f] tabular-nums">
          <div className="flex items-center gap-1.5">
            <Hammer className="w-4 h-4 text-[#e61e78]" />
            <span>Hammers: {dailyState.inventory.hammers}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-4 h-4 text-[#1c88eb]" />
            <span>Shuffles: {dailyState.inventory.shuffles}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-[#22b84a]" />
            <span>+5 Moves: {dailyState.inventory.bonusMoves}</span>
          </div>
        </div>

        {/* Action Button */}
        {claimable ? (
          <button
            type="button"
            onClick={onClaim}
            className="candy-btn-pink w-full py-3 rounded-full font-display font-bold text-xl text-white cursor-pointer"
          >
            Claim Day {activeDay} Reward
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="candy-btn-green w-full py-3 rounded-full font-display font-bold text-xl text-white cursor-pointer"
          >
            Continue Playing
          </button>
        )}
      </div>
    </div>
  );
};
