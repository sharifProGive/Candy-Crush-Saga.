import { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DailyRewardModal } from './components/DailyRewardModal';
import { GameBoard } from './components/GameBoard';
import { LevelMap } from './components/LevelMap';
import { SelectedStartBoosters } from './components/LevelStartModal';
import { SettingsModal } from './components/SettingsModal';
import { StartupScreen } from './components/StartupScreen';
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
import { initFullscreenStatusBar } from './game/performanceGuard';
import {
  detectStereoAudioCapability,
  GameSettings,
  loadGameSettings,
  saveGameSettings,
  StereoCapability,
} from './game/settings';
import { GameScreen, LevelProgress } from './game/types';

const STORAGE_KEY = 'sugar_pop_progress_v1';

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
  const [screen, setScreen] = useState<GameScreen>('STARTUP');
  const [progress, setProgress] = useState<Record<number, LevelProgress>>(() => loadProgress());
  const [dailyState, setDailyState] = useState<DailyRewardState>(() => loadDailyRewardState());
  const [showDailyModal, setShowDailyModal] = useState<boolean>(false);
  const [justClaimedDay, setJustClaimedDay] = useState<number | null>(null);
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const [launchExtraMoves, setLaunchExtraMoves] = useState<number>(0);
  const [launchHammerArmed, setLaunchHammerArmed] = useState<boolean>(false);
  const [launchOpeningShuffle, setLaunchOpeningShuffle] = useState<boolean>(false);
  const [celebratedThreeStarLevelId, setCelebratedThreeStarLevelId] = useState<number | null>(null);
  const [stereoCapability] = useState<StereoCapability>(() => detectStereoAudioCapability());
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadGameSettings(stereoCapability.supported)
  );
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Hide native Android/iOS status bar on startup for immersive fullscreen play
  useEffect(() => {
    void initFullscreenStatusBar();
  }, []);

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

  // Sync persisted settings to soundEngine immediately and whenever updated
  useEffect(() => {
    saveGameSettings(settings);
    soundEngine.applySettings(settings, stereoCapability.supported);
  }, [settings, stereoCapability.supported]);

  // Automatically switch between File 1 (Lobby/Home) and File 2/3 (Gameplay) once past STARTUP
  useEffect(() => {
    if (screen === 'STARTUP') return;
    const targetTrack = screen === 'PLAYING' ? 'gameplay' : 'lobby';
    soundEngine.setMusicTrack(targetTrack);
  }, [screen]);

  // Pause music cleanly if browser tab is hidden, resume when visible (if background music enabled)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        soundEngine.pauseMusic();
      } else if (settings.backgroundMusic && screen !== 'STARTUP') {
        soundEngine.resumeMusic();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [settings.backgroundMusic, screen]);

  useEffect(() => {
    return () => {
      soundEngine.stopMusic();
    };
  }, []);

  const handleOpenSettings = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    setShowSettingsModal(true);
  }, []);

  const handleUpdateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      soundEngine.unlock();
      setSettings((prev) => {
        const next: GameSettings = {
          ...prev,
          ...patch,
          spatialAudio: stereoCapability.supported
            ? (patch.spatialAudio ?? prev.spatialAudio)
            : false,
        };
        soundEngine.applySettings(next, stereoCapability.supported);
        if (patch.gameSounds === true || (patch.spatialAudio !== undefined && next.gameSounds)) {
          soundEngine.playButton();
        }
        if (patch.vibration === true) {
          soundEngine.vibrate(20);
        }
        return next;
      });
    },
    [stereoCapability.supported]
  );

  const handleStartupTap = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playStartupPop();
    soundEngine.vibrate(18);
    // Start Audio 1 (Lobby) right inside the user tap gesture so mobile WebView unlocks audio cleanly
    soundEngine.setMusicTrack('lobby');
  }, []);

  const handleStartupComplete = useCallback(() => {
    setScreen('TITLE_MENU');
    if (canClaimDailyReward(dailyState)) {
      setShowDailyModal(true);
    }
  }, [dailyState]);

  const handlePlayNow = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playButton();
    setScreen('LEVEL_MAP');
  }, []);

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

  const handleSelectLevel = useCallback(
    (levelId: number, boosters?: SelectedStartBoosters) => {
      soundEngine.unlock();
      soundEngine.playButton();

      let extraMoves = 0;
      let openingShuffle = false;
      const nextInventory = { ...dailyState.inventory };
      let changed = false;

      if (boosters?.bonusMoves && nextInventory.bonusMoves > 0) {
        nextInventory.bonusMoves -= 1;
        extraMoves = 5;
        changed = true;
      }

      if (boosters?.shuffle && nextInventory.shuffles > 0) {
        nextInventory.shuffles -= 1;
        openingShuffle = true;
        changed = true;
      }

      if (changed) {
        const nextState: DailyRewardState = {
          ...dailyState,
          inventory: nextInventory,
        };
        setDailyState(nextState);
        saveDailyRewardState(nextState);
      }

      setLaunchExtraMoves(extraMoves);
      setLaunchHammerArmed(Boolean(boosters?.hammer && nextInventory.hammers > 0));
      setLaunchOpeningShuffle(openingShuffle);
      setActiveLevelId(levelId);
      setScreen('PLAYING');
    },
    [dailyState]
  );

  const handleLevelComplete = useCallback((levelId: number, score: number, stars: number) => {
    if (stars >= 3) {
      setCelebratedThreeStarLevelId(levelId);
    }
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
    setLaunchExtraMoves(0);
    setLaunchHammerArmed(false);
    setLaunchOpeningShuffle(false);
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

  const activeLevel = LEVELS.find((l) => l.id === activeLevelId) ?? LEVELS[0];

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#2F8CF0]">
      {screen === 'STARTUP' && (
        <StartupScreen
          onTapStart={handleStartupTap}
          onTransitionComplete={handleStartupComplete}
        />
      )}

      {screen === 'TITLE_MENU' && (
        <TitleScreen
          totalStars={totalStars}
          maxStars={LEVELS.length * 3}
          dailyClaimable={dailyClaimable}
          disableShortcuts={showDailyModal || showSettingsModal}
          onOpenSettings={handleOpenSettings}
          onOpenDailyRewards={handleOpenDailyRewards}
          onPlayNow={handlePlayNow}
        />
      )}

      {screen === 'LEVEL_MAP' && (
        <LevelMap
          progress={progress}
          highestUnlockedLevel={highestUnlockedLevel}
          celebratedThreeStarLevelId={celebratedThreeStarLevelId}
          dailyClaimable={dailyClaimable}
          inventory={dailyState.inventory}
          onCelebrationDone={() => setCelebratedThreeStarLevelId(null)}
          onOpenSettings={handleOpenSettings}
          onOpenDailyRewards={handleOpenDailyRewards}
          onSelectLevel={handleSelectLevel}
          onBackHome={() => {
            soundEngine.playButton();
            setCelebratedThreeStarLevelId(null);
            setScreen('TITLE_MENU');
          }}
        />
      )}

      {screen === 'PLAYING' && (
        <GameBoard
          level={activeLevel}
          backgroundMusicEnabled={settings.backgroundMusic}
          inventory={dailyState.inventory}
          initialExtraMoves={launchExtraMoves}
          initialHammerArmed={launchHammerArmed}
          initialOpeningShuffle={launchOpeningShuffle}
          onConsumeBooster={handleConsumeBooster}
          onOpenSettings={handleOpenSettings}
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

      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          stereoCapability={stereoCapability}
          onUpdateSettings={handleUpdateSettings}
          onGameSoundSliderRelease={() => {
            soundEngine.unlock();
            soundEngine.playTap();
          }}
          onClose={() => {
            soundEngine.playButton();
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
}
