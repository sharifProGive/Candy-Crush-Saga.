import { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DailyRewardModal } from './components/DailyRewardModal';
import { GameBoard } from './components/GameBoard';
import { LevelMap } from './components/LevelMap';
import { TitleScreen } from './components/TitleScreen';
import {
  canClaimDailyReward,
  claimTodayReward,
  DailyRewardState,
  loadDailyRewardState,
  PlayerInventory,
  saveDailyRewardState,
} from './game/dailyRewards';
import { LEVELS } from './game/levels';
import { GameScreen, LevelProgress } from './game/types';

const STORAGE_KEY = 'candy_crush_saga_progress_v1';

function loadProgress(): Record<number, LevelProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, LevelProgress>;
  } catch {
    return {};
  }
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [progress, setProgress] = useState<Record<number, LevelProgress>>(() => loadProgress());
  const [dailyState, setDailyState] = useState<DailyRewardState>(() => loadDailyRewardState());
  const [showDailyModal, setShowDailyModal] = useState<boolean>(() =>
    canClaimDailyReward(loadDailyRewardState())
  );
  const [justClaimedDay, setJustClaimedDay] = useState<number | null>(null);
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [musicPaused, setMusicPaused] = useState<boolean>(false);

  const highestUnlockedLevel = useMemo(() => {
    let unlocked = 1;
    for (const lvl of LEVELS) {
      if ((progress[lvl.id]?.stars ?? 0) > 0 && lvl.id + 1 <= LEVELS.length) {
        unlocked = Math.max(unlocked, lvl.id + 1);
      }
    }
    return unlocked;
  }, [progress]);

  const totalStars = useMemo(() => {
    return Object.values(progress).reduce((sum, item) => sum + (item?.stars || 0), 0);
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota issues
    }
  }, [progress]);

  // Automatically switch between File 1 (Lobby/Home) and File 2 (Gameplay) based on screen state
  useEffect(() => {
    const targetTrack = screen === 'PLAYING' ? 'gameplay' : 'lobby';
    soundEngine.setMusicTrack(targetTrack);
    setMusicPaused(false);
  }, [screen]);

  // Pause music cleanly if browser tab is hidden, resume when visible (unless manually paused/muted)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        soundEngine.pauseMusic();
      } else if (!musicPaused && !muted) {
        soundEngine.resumeMusic();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [musicPaused, muted]);

  useEffect(() => {
    soundEngine.preloadVoiceClips();
    return () => {
      soundEngine.stopMusic();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next) {
      if (!musicPaused) {
        soundEngine.resumeMusic();
      }
      soundEngine.playButton();
    }
  }, [muted, musicPaused]);

  const handleToggleMusicPause = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    if (musicPaused) {
      setMusicPaused(false);
      soundEngine.resumeMusic();
    } else {
      setMusicPaused(true);
      soundEngine.pauseMusic();
    }
  }, [musicPaused]);

  const handlePlayNow = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    setActiveLevelId(highestUnlockedLevel);
    setScreen('PLAYING');
  }, [highestUnlockedLevel]);

  const handleOpenMap = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    setScreen('LEVEL_MAP');
  }, []);

  const handleSelectLevel = useCallback((levelId: number) => {
    soundEngine.unlock();
    soundEngine.playButton();
    setActiveLevelId(levelId);
    setScreen('PLAYING');
  }, []);

  const handleLevelComplete = useCallback((levelId: number, score: number, stars: number) => {
    setProgress((prev) => {
      const existing = prev[levelId];
      return {
        ...prev,
        [levelId]: {
          stars: Math.max(existing?.stars ?? 0, stars),
          highScore: Math.max(existing?.highScore ?? 0, score),
        },
      };
    });
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextId = Math.min(LEVELS.length, activeLevelId + 1);
    setActiveLevelId(nextId);
  }, [activeLevelId]);

  const dailyClaimable = canClaimDailyReward(dailyState);

  const handleOpenDailyRewards = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    setJustClaimedDay(null);
    setShowDailyModal(true);
  }, []);

  const handleClaimDailyReward = useCallback(() => {
    soundEngine.unlock();
    if (!canClaimDailyReward(dailyState)) return;
    const { nextState, claimedDay } = claimTodayReward(dailyState);
    setDailyState(nextState);
    setJustClaimedDay(claimedDay.day);
    soundEngine.playFanfare();
  }, [dailyState]);

  const handleConsumeBooster = useCallback(
    (type: keyof PlayerInventory): boolean => {
      if (dailyState.inventory[type] <= 0) return false;
      const nextState: DailyRewardState = {
        ...dailyState,
        inventory: {
          ...dailyState.inventory,
          [type]: dailyState.inventory[type] - 1,
        },
      };
      setDailyState(nextState);
      saveDailyRewardState(nextState);
      return true;
    },
    [dailyState]
  );

  const activeLevel = LEVELS.find((l) => l.id === activeLevelId) ?? LEVELS[0];

  return (
    <div className="w-screen h-screen overflow-hidden">
      {screen === 'TITLE_MENU' && (
        <TitleScreen
          highestUnlockedLevel={highestUnlockedLevel}
          totalStars={totalStars}
          maxStars={LEVELS.length * 3}
          muted={muted}
          musicPaused={musicPaused}
          dailyClaimable={dailyClaimable}
          disableShortcuts={showDailyModal}
          onToggleMute={handleToggleMute}
          onToggleMusicPause={handleToggleMusicPause}
          onOpenDailyRewards={handleOpenDailyRewards}
          onPlayNow={handlePlayNow}
          onOpenMap={handleOpenMap}
        />
      )}

      {screen === 'LEVEL_MAP' && (
        <LevelMap
          progress={progress}
          highestUnlockedLevel={highestUnlockedLevel}
          muted={muted}
          musicPaused={musicPaused}
          dailyClaimable={dailyClaimable}
          onToggleMute={handleToggleMute}
          onToggleMusicPause={handleToggleMusicPause}
          onOpenDailyRewards={handleOpenDailyRewards}
          onSelectLevel={handleSelectLevel}
          onBackHome={() => {
            soundEngine.playButton();
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {screen === 'PLAYING' && (
        <GameBoard
          level={activeLevel}
          muted={muted}
          musicPaused={musicPaused}
          inventory={dailyState.inventory}
          onConsumeBooster={handleConsumeBooster}
          onToggleMute={handleToggleMute}
          onToggleMusicPause={handleToggleMusicPause}
          onLevelComplete={handleLevelComplete}
          onNextLevel={handleNextLevel}
          onBackToMap={() => setScreen('LEVEL_MAP')}
        />
      )}

      {showDailyModal && (
        <DailyRewardModal
          dailyState={dailyState}
          justClaimedDay={justClaimedDay}
          onClaim={handleClaimDailyReward}
          onClose={() => {
            soundEngine.playButton();
            setShowDailyModal(false);
          }}
        />
      )}
    </div>
  );
}
