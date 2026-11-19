import { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DailyRewardModal } from './components/DailyRewardModal';
import { GameBoard } from './components/GameBoard';
import { LevelMap } from './components/LevelMap';
import { SettingsModal } from './components/SettingsModal';
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
import {
  detectStereoAudioCapability,
  GameSettings,
  loadGameSettings,
  saveGameSettings,
  StereoCapability,
} from './game/settings';
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
  const [stereoCapability] = useState<StereoCapability>(() => detectStereoAudioCapability());
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadGameSettings(stereoCapability.supported)
  );
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

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

  // Automatically switch between File 1 (Lobby/Home) and File 2 (Gameplay) based on screen state
  useEffect(() => {
    const targetTrack = screen === 'PLAYING' ? 'gameplay' : 'lobby';
    soundEngine.setMusicTrack(targetTrack);
  }, [screen]);

  // Pause music cleanly if browser tab is hidden, resume when visible (if background music enabled)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        soundEngine.pauseMusic();
      } else if (settings.backgroundMusic && settings.volume > 0) {
        soundEngine.resumeMusic();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [settings.backgroundMusic, settings.volume]);

  useEffect(() => {
    soundEngine.preloadVoiceClips();
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

  const handlePlayNow = useCallback(() => {
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
          dailyClaimable={dailyClaimable}
          onOpenSettings={handleOpenSettings}
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
          backgroundMusicEnabled={settings.backgroundMusic && settings.volume > 0}
          inventory={dailyState.inventory}
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
          onTestGameSound={() => {
            soundEngine.unlock();
            if (!settings.gameSounds || settings.volume === 0) {
              const nextSettings: GameSettings = {
                ...settings,
                gameSounds: true,
                volume: settings.volume === 0 ? 75 : settings.volume,
              };
              setSettings(nextSettings);
              soundEngine.applySettings(nextSettings, stereoCapability.supported);
            }
            soundEngine.playMatch(3);
            soundEngine.vibrate(15);
          }}
          onTestBackgroundMusic={() => {
            soundEngine.unlock();
            if (!settings.backgroundMusic || settings.volume === 0) {
              const nextSettings: GameSettings = {
                ...settings,
                backgroundMusic: true,
                volume: settings.volume === 0 ? 75 : settings.volume,
              };
              setSettings(nextSettings);
              soundEngine.applySettings(nextSettings, stereoCapability.supported);
            }
            return soundEngine.previewBackgroundMusic();
          }}
          onClose={() => {
            soundEngine.playButton();
            const expectedTrack = screen === 'PLAYING' ? 'gameplay' : 'lobby';
            if (soundEngine.getCurrentTrack() !== expectedTrack) {
              soundEngine.setMusicTrack(expectedTrack);
            }
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
}
