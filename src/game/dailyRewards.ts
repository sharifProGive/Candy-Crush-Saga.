export interface PlayerInventory {
  hammers: number;
  shuffles: number;
  bonusMoves: number; // Each token grants +5 Moves in a level
}

export interface DailyRewardState {
  lastClaimDate: string | null; // YYYY-MM-DD local date
  streak: number; // 0..7
  inventory: PlayerInventory;
}

export interface DailyRewardDay {
  day: number;
  title: string;
  rewardText: string;
  grant: Partial<PlayerInventory>;
  highlight?: boolean;
}

export const DAILY_REWARD_DAYS: DailyRewardDay[] = [
  {
    day: 1,
    title: 'Day 1',
    rewardText: '+1 Lollipop Hammer',
    grant: { hammers: 1 },
  },
  {
    day: 2,
    title: 'Day 2',
    rewardText: '+1 Extra Moves (+5)',
    grant: { bonusMoves: 1 },
  },
  {
    day: 3,
    title: 'Day 3',
    rewardText: '+2 Board Shuffles',
    grant: { shuffles: 2 },
  },
  {
    day: 4,
    title: 'Day 4',
    rewardText: '+2 Lollipop Hammers',
    grant: { hammers: 2 },
  },
  {
    day: 5,
    title: 'Day 5',
    rewardText: '+2 Extra Moves (+5)',
    grant: { bonusMoves: 2 },
  },
  {
    day: 6,
    title: 'Day 6',
    rewardText: '+2 Hammers & +2 Shuffles',
    grant: { hammers: 2, shuffles: 2 },
  },
  {
    day: 7,
    title: 'Day 7',
    rewardText: '+3 Hammers, +3 Shuffles & +3 Extra Moves',
    grant: { hammers: 3, shuffles: 3, bonusMoves: 3 },
    highlight: true,
  },
];

const DAILY_STORAGE_KEY = 'candy_crush_saga_daily_v1';

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateKey(date: Date = new Date()): string {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return getLocalDateKey(prev);
}

const DEFAULT_STATE: DailyRewardState = {
  lastClaimDate: null,
  streak: 0,
  inventory: {
    hammers: 3,
    shuffles: 2,
    bonusMoves: 1,
  },
};

export function loadDailyRewardState(): DailyRewardState {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<DailyRewardState>;
    return {
      lastClaimDate: parsed.lastClaimDate ?? null,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      inventory: {
        hammers: parsed.inventory?.hammers ?? DEFAULT_STATE.inventory.hammers,
        shuffles: parsed.inventory?.shuffles ?? DEFAULT_STATE.inventory.shuffles,
        bonusMoves: parsed.inventory?.bonusMoves ?? DEFAULT_STATE.inventory.bonusMoves,
      },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveDailyRewardState(state: DailyRewardState): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function canClaimDailyReward(state: DailyRewardState, now: Date = new Date()): boolean {
  const today = getLocalDateKey(now);
  return state.lastClaimDate !== today;
}

/**
 * Returns the 1-based day index (1..7) that is next to be claimed (if claimable)
 * or was just claimed today (if already claimed).
 */
export function getActiveRewardDay(state: DailyRewardState, now: Date = new Date()): number {
  const today = getLocalDateKey(now);
  const yesterday = getYesterdayDateKey(now);

  if (state.lastClaimDate === today) {
    return Math.max(1, Math.min(7, state.streak || 1));
  }

  if (state.lastClaimDate === yesterday) {
    return state.streak >= 7 ? 1 : state.streak + 1;
  }

  return 1;
}

export function claimTodayReward(
  state: DailyRewardState,
  now: Date = new Date()
): { nextState: DailyRewardState; claimedDay: DailyRewardDay } {
  const today = getLocalDateKey(now);
  const nextDayNum = getActiveRewardDay(state, now);
  const dayConfig = DAILY_REWARD_DAYS[nextDayNum - 1] ?? DAILY_REWARD_DAYS[0];

  const nextState: DailyRewardState = {
    lastClaimDate: today,
    streak: nextDayNum,
    inventory: {
      hammers: state.inventory.hammers + (dayConfig.grant.hammers ?? 0),
      shuffles: state.inventory.shuffles + (dayConfig.grant.shuffles ?? 0),
      bonusMoves: state.inventory.bonusMoves + (dayConfig.grant.bonusMoves ?? 0),
    },
  };

  saveDailyRewardState(nextState);
  return { nextState, claimedDay: dayConfig };
}
