export interface GameSettings {
  gameSounds: boolean;
  backgroundMusic: boolean;
  volume: number; // 0 to 100
  spatialAudio: boolean;
  vibration: boolean;
}

export interface StereoCapability {
  supported: boolean;
  maxChannels: number;
  errorMessage: string | null;
}

const SETTINGS_STORAGE_KEY = 'candy_crush_saga_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  gameSounds: true,
  backgroundMusic: true,
  volume: 85,
  spatialAudio: true,
  vibration: true,
};

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
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const volume =
      typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? Math.max(0, Math.min(100, Math.round(parsed.volume)))
        : DEFAULT_SETTINGS.volume;

    return {
      gameSounds:
        typeof parsed.gameSounds === 'boolean' ? parsed.gameSounds : DEFAULT_SETTINGS.gameSounds,
      backgroundMusic:
        typeof parsed.backgroundMusic === 'boolean'
          ? parsed.backgroundMusic
          : DEFAULT_SETTINGS.backgroundMusic,
      volume,
      spatialAudio: stereoSupported
        ? typeof parsed.spatialAudio === 'boolean'
          ? parsed.spatialAudio
          : true
        : false,
      vibration:
        typeof parsed.vibration === 'boolean' ? parsed.vibration : DEFAULT_SETTINGS.vibration,
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
