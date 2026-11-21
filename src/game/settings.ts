export type EffectsQuality = 'auto' | 'high' | 'low';

export interface GameSettings {
  gameSounds: boolean;
  sfxVolume: number; // 0 to 100 (independent volume for game sounds & voices)
  backgroundMusic: boolean;
  musicVolume: number; // 0 to 100 (independent volume for background music)
  spatialAudio: boolean;
  vibration: boolean;
  effectsQuality: EffectsQuality;
  slowMoEffects: boolean; // Debug toggle: 0.5x fxSpeed
}

export interface StereoCapability {
  supported: boolean;
  maxChannels: number;
  errorMessage: string | null;
}

export const SETTINGS_STORAGE_KEY = 'sugar_pop_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  gameSounds: true,
  sfxVolume: 85,
  backgroundMusic: true,
  musicVolume: 85,
  spatialAudio: true,
  vibration: true,
  effectsQuality: 'auto',
  slowMoEffects: false,
};

function clampVolume(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.min(100, Math.round(val)));
  }
  return fallback;
}

function parseEffectsQuality(val: unknown): EffectsQuality {
  if (val === 'auto' || val === 'high' || val === 'low') {
    return val;
  }
  return DEFAULT_SETTINGS.effectsQuality;
}

export function detectStereoAudioCapability(): StereoCapability {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      maxChannels: 1,
      errorMessage: 'Error: Dual-speaker / stereo audio is not supported on this device',
    };
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    return {
      supported: false,
      maxChannels: 0,
      errorMessage: 'Error: Dual-speaker / stereo audio is not supported on this device',
    };
  }

  let probeCtx: AudioContext | null = null;
  try {
    probeCtx = new AudioCtx();
    const maxChannels = probeCtx.destination?.maxChannelCount ?? 0;
    const hasStereoNodes =
      typeof probeCtx.createStereoPanner === 'function' ||
      typeof probeCtx.createChannelMerger === 'function';
    const supported = maxChannels > 1 && hasStereoNodes;

    return {
      supported,
      maxChannels,
      errorMessage: supported
        ? null
        : 'Error: Dual-speaker / stereo audio is not supported on this device',
    };
  } catch {
    return {
      supported: false,
      maxChannels: 1,
      errorMessage: 'Error: Dual-speaker / stereo audio is not supported on this device',
    };
  } finally {
    if (probeCtx) {
      probeCtx.close().catch(() => {});
    }
  }
}

export function loadGameSettings(stereoSupported: boolean): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        spatialAudio: stereoSupported ? true : false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings> & { volume?: number };
    const legacyVolume = clampVolume(parsed.volume, DEFAULT_SETTINGS.sfxVolume);

    return {
      gameSounds:
        typeof parsed.gameSounds === 'boolean' ? parsed.gameSounds : DEFAULT_SETTINGS.gameSounds,
      sfxVolume: clampVolume(parsed.sfxVolume, legacyVolume),
      backgroundMusic:
        typeof parsed.backgroundMusic === 'boolean'
          ? parsed.backgroundMusic
          : DEFAULT_SETTINGS.backgroundMusic,
      musicVolume: clampVolume(parsed.musicVolume, legacyVolume),
      spatialAudio: stereoSupported
        ? typeof parsed.spatialAudio === 'boolean'
          ? parsed.spatialAudio
          : true
        : false,
      vibration:
        typeof parsed.vibration === 'boolean' ? parsed.vibration : DEFAULT_SETTINGS.vibration,
      effectsQuality: parseEffectsQuality(parsed.effectsQuality),
      slowMoEffects:
        typeof parsed.slowMoEffects === 'boolean'
          ? parsed.slowMoEffects
          : DEFAULT_SETTINGS.slowMoEffects,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      spatialAudio: stereoSupported ? true : false,
    };
  }
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function triggerHaptic(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration restrictions on unsupported browsers
    }
  }
}
