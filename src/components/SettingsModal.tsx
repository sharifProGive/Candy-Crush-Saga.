import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Music,
  Play,
  Smartphone,
  Speaker,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GameSettings, StereoCapability } from '../game/settings';

interface SettingsModalProps {
  settings: GameSettings;
  stereoCapability: StereoCapability;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onTestGameSound: () => void;
  onTestBackgroundMusic: () => 'lobby' | 'gameplay';
  onClose: () => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  disabled = false,
  label,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className={`relative shrink-0 w-14 h-8 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] ${
      disabled
        ? 'bg-slate-300 cursor-not-allowed opacity-70'
        : checked
        ? 'bg-gradient-to-r from-[#2563eb] via-[#1d4ed8] to-[#1e40af] cursor-pointer shadow-inner ring-1 ring-blue-400/50'
        : 'bg-slate-300 hover:bg-slate-400/80 cursor-pointer shadow-inner'
    }`}
  >
    <span
      className={`block w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
        checked && !disabled ? 'translate-x-7' : 'translate-x-1'
      }`}
    />
  </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  stereoCapability,
  onUpdateSettings,
  onTestGameSound,
  onTestBackgroundMusic,
  onClose,
}) => {
  const [previewTrackLabel, setPreviewTrackLabel] = useState<'Lobby' | 'Gameplay' | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const stereoSupported = stereoCapability.supported;
  const spatialActive = stereoSupported && settings.spatialAudio;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-[#f2f8ff] border-4 border-[#4da6ff] shadow-2xl p-5 sm:p-6 flex flex-col gap-4">
        {/* Close Button (Rich Blue) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white shadow-md flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pr-8 pl-8">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#0f4ea8]">
            Settings
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            Customize sound, spatial audio, and haptics
          </p>
        </div>

        {/* Settings List */}
        <div className="flex flex-col gap-3">
          {/* Grouped Sound Controls */}
          <div className="rounded-2xl bg-white border-2 border-blue-200/90 shadow-xs divide-y divide-blue-100 overflow-hidden">
            {/* 1. Game Sounds + First Green Button directly underneath its blue toggle */}
            <div className="flex flex-col gap-2.5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1d4ed8] flex items-center justify-center shrink-0">
                    {settings.gameSounds ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-slate-800 leading-tight">
                      Game Sounds
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {settings.gameSounds ? 'On · Pops, cascades & voices' : 'Off · Sound effects muted'}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.gameSounds}
                  label="Toggle Game Sounds"
                  onToggle={() => onUpdateSettings({ gameSounds: !settings.gameSounds })}
                />
              </div>

              {/* First Green Button directly below the first blue toggle */}
              <button
                type="button"
                onClick={onTestGameSound}
                className="candy-btn-green w-full py-2 px-4 rounded-full font-display font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{settings.gameSounds ? 'Test Game Sound' : 'Turn On & Test Sound'}</span>
              </button>
            </div>

            {/* 2. Game Background Sounds + Second Green Button directly underneath its blue toggle */}
            <div className="flex flex-col gap-2.5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1d4ed8] flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-slate-800 leading-tight">
                      Game Background Sounds
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {settings.backgroundMusic
                        ? 'On · Lobby & gameplay music'
                        : 'Off · Background music paused'}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.backgroundMusic}
                  label="Toggle Game Background Sounds"
                  onToggle={() => onUpdateSettings({ backgroundMusic: !settings.backgroundMusic })}
                />
              </div>

              {/* Second Green Button directly below the second blue toggle */}
              <button
                type="button"
                onClick={() => {
                  const track = onTestBackgroundMusic();
                  setPreviewTrackLabel(track === 'lobby' ? 'Lobby' : 'Gameplay');
                }}
                className="candy-btn-green w-full py-2 px-4 rounded-full font-display font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Music className="w-4 h-4" />
                <span>
                  {settings.backgroundMusic
                    ? previewTrackLabel
                      ? `Preview Music (${previewTrackLabel})`
                      : 'Preview Background Music'
                    : 'Turn On & Play Music'}
                </span>
              </button>
            </div>

            {/* 3. Audio / Sound Volume Slider (Bright Green Bar & Handle) */}
            <div className="flex flex-col gap-2.5 px-4 py-3.5 bg-emerald-50/45">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#16a34a] flex items-center justify-center shrink-0">
                    {settings.volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </div>
                  <label
                    htmlFor="game-volume-slider"
                    className="font-extrabold text-sm text-slate-800"
                  >
                    Audio / Sound Volume
                  </label>
                </div>
                <span className="font-display font-bold text-base text-[#16a34a] tabular-nums">
                  {settings.volume}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-extrabold text-slate-400 tabular-nums">0%</span>
                <input
                  id="game-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.volume}
                  onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
                  aria-label="Audio and Sound Volume"
                  aria-valuetext={`${settings.volume} percent`}
                  className="candy-volume-slider flex-1 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #22c55e 0%, #4ade80 ${settings.volume}%, #d1fae5 ${settings.volume}%, #d1fae5 100%)`,
                  }}
                />
                <span className="text-[11px] font-extrabold text-slate-400 tabular-nums">100%</span>
              </div>
            </div>
          </div>

          {/* 4. Game-Only Dual-Speaker / Spatial Audio */}
          <div
            className={`flex flex-col gap-2 rounded-2xl border-2 px-4 py-3 shadow-xs ${
              stereoSupported
                ? 'bg-white border-blue-200/90'
                : 'bg-rose-50/75 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    stereoSupported
                      ? 'bg-blue-100 text-[#1d4ed8]'
                      : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  <Speaker className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm text-slate-800 leading-tight">
                    Dual-Speaker / Spatial Audio
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    {stereoSupported
                      ? spatialActive
                        ? 'On · Stereo & echo effect inside this game'
                        : 'Off · Spatial effect stopped in this game only'
                      : 'Unavailable on this device'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={spatialActive}
                disabled={!stereoSupported}
                label="Toggle Dual-Speaker Spatial Audio"
                onToggle={() => {
                  if (!stereoSupported) return;
                  onUpdateSettings({ spatialAudio: !settings.spatialAudio });
                }}
              />
            </div>

            {!stereoSupported && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-rose-100/90 border border-rose-300 px-3 py-2 text-xs font-bold text-rose-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>
                  {stereoCapability.errorMessage ||
                    'Error: Dual-speaker / stereo audio is not supported on this device'}
                </span>
              </div>
            )}
          </div>

          {/* 5. Vibration / Haptics */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border-2 border-blue-200/90 px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1d4ed8] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-slate-800 leading-tight">
                  Vibration / Haptics
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {settings.vibration
                    ? 'On · Tactile swap & match feedback'
                    : 'Off · Haptics disabled'}
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.vibration}
              label="Toggle Vibration and Haptics"
              onToggle={() => onUpdateSettings({ vibration: !settings.vibration })}
            />
          </div>
        </div>

        {/* Done CTA (Rich Blue) */}
        <button
          type="button"
          onClick={onClose}
          className="candy-btn-blue w-full py-2.5 px-6 rounded-full font-display font-bold text-lg text-white cursor-pointer mt-1"
        >
          Done
        </button>
      </div>
    </div>
  );
};
