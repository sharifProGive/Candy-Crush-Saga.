import React, { useEffect, useRef } from 'react';
import {
  AlertCircle,
  Music,
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
  onGameSoundSliderRelease: () => void;
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
    className={`relative shrink-0 w-[62px] h-[34px] rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] ${
      disabled
        ? 'bg-[#cbd5e1] border border-[#94a3b8] cursor-not-allowed'
        : checked
        ? 'settings-toggle-gloss bg-gradient-to-b from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] border border-[#60a5fa] cursor-pointer active:scale-95'
        : 'bg-gradient-to-b from-[#cbd5e1] to-[#94a3b8] border border-[#94a3b8] cursor-pointer shadow-inner active:scale-95'
    }`}
  >
    <span
      className={`block w-[26px] h-[26px] rounded-full bg-white shadow-[0_3px_8px_rgba(15,23,42,0.34)] transform transition-transform duration-200 ${
        checked && !disabled ? 'translate-x-[31px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  stereoCapability,
  onUpdateSettings,
  onGameSoundSliderRelease,
  onClose,
}) => {
  const lastSliderSoundAtRef = useRef<number>(0);

  const playSliderReleaseSound = (currentValue: number) => {
    if (!settings.gameSounds || currentValue <= 0) return;
    const now = Date.now();
    if (now - lastSliderSoundAtRef.current < 140) return;
    lastSliderSoundAtRef.current = now;
    onGameSoundSliderRelease();
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091529]/72 p-3 sm:p-4 font-settings"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 4px Bright Blue Gradient Outer Frame with Deep Soft Shadow */}
      <div className="settings-modal-frame w-full max-w-[460px] max-h-[92dvh] rounded-[28px] p-[4px] flex flex-col">
        <div className="settings-modal-surface relative w-full max-h-[calc(92dvh-8px)] rounded-[24px] flex flex-col overflow-hidden">
          {/* Header (Fixed Top, No Blur) */}
          <div className="relative shrink-0 px-5 pt-5 pb-3.5 text-center border-b border-[#cfe3ff]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gradient-to-b from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] hover:from-[#2563eb] hover:to-[#1e40af] text-white border-2 border-[#93c5fd] shadow-[0_4px_12px_rgba(29,78,216,0.38)] flex items-center justify-center cursor-pointer transition-transform active:scale-90"
            >
              <X className="w-6 h-6" strokeWidth={2.8} />
            </button>

            <h2 className="font-settings-heading settings-title-gradient font-extrabold text-[36px] leading-[1.1] tracking-tight px-10">
              Settings
            </h2>
            <p className="text-[15px] font-bold text-[#1E3A5F] mt-1 leading-snug">
              Customize sound, spatial audio, and haptics
            </p>
          </div>

          {/* Scrollable Settings Cards */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3.5">
            {/* Card 1: Game Sounds + Independent Game Sounds Volume Slider */}
            <div className="rounded-[22px] bg-white border-2 border-[#bdd8ff] shadow-[0_6px_18px_rgba(29,78,216,0.09)] px-4 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] text-white shadow-[0_6px_14px_rgba(37,99,235,0.34)] flex items-center justify-center shrink-0">
                    {settings.gameSounds ? (
                      <Volume2 className="w-7 h-7" strokeWidth={2.4} />
                    ) : (
                      <VolumeX className="w-7 h-7" strokeWidth={2.4} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-settings-heading font-extrabold text-[20px] text-[#0F2747] leading-tight">
                      Game Sounds
                    </div>
                    <div className="text-[15px] font-semibold text-[#1E3A5F] leading-snug mt-0.5">
                      {settings.gameSounds ? (
                        <>
                          <span className="font-extrabold text-[#116630]">On</span>
                          <span> · Pops, cascades &amp; voices</span>
                        </>
                      ) : (
                        <>
                          <span className="font-extrabold text-[#b41818]">Off</span>
                          <span> · Sound effects muted</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.gameSounds}
                  label="Toggle Game Sounds"
                  onToggle={() => onUpdateSettings({ gameSounds: !settings.gameSounds })}
                />
              </div>

              {/* Game Sounds Volume Slider (Directly Below Toggle, No Extra Box) */}
              <div className="pt-1.5">
                <label
                  htmlFor="game-sounds-volume-slider"
                  className={`block text-[15px] font-bold mb-0.5 ${
                    settings.gameSounds ? 'text-[#1E3A5F]' : 'text-[#475569]'
                  }`}
                >
                  Game Sounds Volume
                </label>
                <div className="flex items-center gap-3 min-h-[44px] touch-none">
                  <div
                    className={`shrink-0 ${
                      settings.gameSounds && settings.sfxVolume > 0
                        ? 'text-[#116630]'
                        : 'text-[#475569]'
                    }`}
                    aria-hidden="true"
                  >
                    {settings.gameSounds && settings.sfxVolume > 0 ? (
                      <Volume2 className="w-6 h-6" strokeWidth={2.5} />
                    ) : (
                      <VolumeX className="w-6 h-6" strokeWidth={2.5} />
                    )}
                  </div>

                  <input
                    id="game-sounds-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    disabled={!settings.gameSounds}
                    value={settings.sfxVolume}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateSettings({ sfxVolume: Number(e.target.value) });
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      playSliderReleaseSound(Number(e.currentTarget.value));
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      playSliderReleaseSound(Number(e.currentTarget.value));
                    }}
                    onKeyUp={(e) => {
                      if (
                        e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' ||
                        e.key === 'ArrowUp' ||
                        e.key === 'ArrowDown'
                      ) {
                        playSliderReleaseSound(Number(e.currentTarget.value));
                      }
                    }}
                    aria-label="Game Sounds Volume"
                    aria-valuetext={`${settings.sfxVolume} percent`}
                    className="candy-volume-slider flex-1"
                    style={{
                      background: settings.gameSounds
                        ? `linear-gradient(to right, #15803d 0%, #22c55e ${Math.max(
                            0,
                            settings.sfxVolume * 0.55
                          )}%, #4ade80 ${settings.sfxVolume}%, #dbe5f0 ${settings.sfxVolume}%, #dbe5f0 100%)`
                        : `linear-gradient(to right, #94a3b8 0%, #cbd5e1 ${settings.sfxVolume}%, #e2e8f0 ${settings.sfxVolume}%, #e2e8f0 100%)`,
                    }}
                  />

                  <span
                    className={`font-settings-heading font-extrabold text-[22px] min-w-[3.75rem] text-right tabular-nums shrink-0 ${
                      settings.gameSounds ? 'text-[#116630]' : 'text-[#475569]'
                    }`}
                  >
                    {settings.sfxVolume}%
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Game Background Sounds + Independent Background Music Volume Slider */}
            <div className="rounded-[22px] bg-white border-2 border-[#bdd8ff] shadow-[0_6px_18px_rgba(29,78,216,0.09)] px-4 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#c084fc] via-[#8b5cf6] to-[#6d28d9] text-white shadow-[0_6px_14px_rgba(124,58,237,0.34)] flex items-center justify-center shrink-0">
                    <Music className="w-7 h-7" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-settings-heading font-extrabold text-[20px] text-[#0F2747] leading-tight">
                      Game Background Sounds
                    </div>
                    <div className="text-[15px] font-semibold text-[#1E3A5F] leading-snug mt-0.5">
                      {settings.backgroundMusic ? (
                        <>
                          <span className="font-extrabold text-[#116630]">On</span>
                          <span> · Lobby &amp; gameplay music</span>
                        </>
                      ) : (
                        <>
                          <span className="font-extrabold text-[#b41818]">Off</span>
                          <span> · Background music paused</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.backgroundMusic}
                  label="Toggle Game Background Sounds"
                  onToggle={() => onUpdateSettings({ backgroundMusic: !settings.backgroundMusic })}
                />
              </div>

              {/* Background Music Volume Slider (Directly Below Toggle, No Extra Box) */}
              <div className="pt-1.5">
                <label
                  htmlFor="background-music-volume-slider"
                  className={`block text-[15px] font-bold mb-0.5 ${
                    settings.backgroundMusic ? 'text-[#1E3A5F]' : 'text-[#475569]'
                  }`}
                >
                  Background Music Volume
                </label>
                <div className="flex items-center gap-3 min-h-[44px] touch-none">
                  <div
                    className={`shrink-0 ${
                      settings.backgroundMusic && settings.musicVolume > 0
                        ? 'text-[#116630]'
                        : 'text-[#475569]'
                    }`}
                    aria-hidden="true"
                  >
                    {settings.backgroundMusic && settings.musicVolume > 0 ? (
                      <Volume2 className="w-6 h-6" strokeWidth={2.5} />
                    ) : (
                      <VolumeX className="w-6 h-6" strokeWidth={2.5} />
                    )}
                  </div>

                  <input
                    id="background-music-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    disabled={!settings.backgroundMusic}
                    value={settings.musicVolume}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateSettings({ musicVolume: Number(e.target.value) });
                    }}
                    aria-label="Background Music Volume"
                    aria-valuetext={`${settings.musicVolume} percent`}
                    className="candy-volume-slider flex-1"
                    style={{
                      background: settings.backgroundMusic
                        ? `linear-gradient(to right, #15803d 0%, #22c55e ${Math.max(
                            0,
                            settings.musicVolume * 0.55
                          )}%, #4ade80 ${settings.musicVolume}%, #dbe5f0 ${settings.musicVolume}%, #dbe5f0 100%)`
                        : `linear-gradient(to right, #94a3b8 0%, #cbd5e1 ${settings.musicVolume}%, #e2e8f0 ${settings.musicVolume}%, #e2e8f0 100%)`,
                    }}
                  />

                  <span
                    className={`font-settings-heading font-extrabold text-[22px] min-w-[3.75rem] text-right tabular-nums shrink-0 ${
                      settings.backgroundMusic ? 'text-[#116630]' : 'text-[#475569]'
                    }`}
                  >
                    {settings.musicVolume}%
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Dual-Speaker / Spatial Audio (Teal Gradient Icon) */}
            <div
              className={`rounded-[22px] border-2 px-4 py-4 shadow-[0_6px_18px_rgba(29,78,216,0.09)] flex flex-col gap-2.5 ${
                stereoSupported
                  ? 'bg-white border-[#bdd8ff]'
                  : 'bg-[#fff5f5] border-[#fca5a5]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-[52px] h-[52px] rounded-2xl text-white flex items-center justify-center shrink-0 ${
                      stereoSupported
                        ? 'bg-gradient-to-br from-[#2dd4bf] via-[#0d9488] to-[#0f766e] shadow-[0_6px_14px_rgba(13,148,136,0.34)]'
                        : 'bg-gradient-to-br from-[#fb7185] via-[#e11d48] to-[#be123c] shadow-[0_6px_14px_rgba(225,29,72,0.3)]'
                    }`}
                  >
                    <Speaker className="w-7 h-7" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-settings-heading font-extrabold text-[20px] text-[#0F2747] leading-tight">
                      Dual-Speaker / Spatial Audio
                    </div>
                    <div className="text-[15px] font-semibold text-[#1E3A5F] leading-snug mt-0.5">
                      {stereoSupported ? (
                        spatialActive ? (
                          <>
                            <span className="font-extrabold text-[#116630]">On</span>
                            <span> · Wide stereo for game sounds only</span>
                          </>
                        ) : (
                          <>
                            <span className="font-extrabold text-[#b41818]">Off</span>
                            <span> · Spatial effect stopped in this game</span>
                          </>
                        )
                      ) : (
                        <>
                          <span className="font-extrabold text-[#b41818]">Off</span>
                          <span> · Unavailable on this device</span>
                        </>
                      )}
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
                  className="flex items-start gap-2.5 rounded-2xl bg-[#fee2e2] border-2 border-[#f87171] px-3.5 py-2.5 text-[14px] font-bold text-[#7f1d1d]"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#b91c1c]" strokeWidth={2.4} />
                  <span>
                    {stereoCapability.errorMessage ||
                      'Error: Dual-speaker / stereo audio is not supported on this device'}
                  </span>
                </div>
              )}
            </div>

            {/* Card 4: Vibration / Haptics (Orange Gradient Icon) */}
            <div className="rounded-[22px] bg-white border-2 border-[#bdd8ff] shadow-[0_6px_18px_rgba(29,78,216,0.09)] px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c] text-white shadow-[0_6px_14px_rgba(234,88,12,0.34)] flex items-center justify-center shrink-0">
                  <Smartphone className="w-7 h-7" strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <div className="font-settings-heading font-extrabold text-[20px] text-[#0F2747] leading-tight">
                    Vibration / Haptics
                  </div>
                  <div className="text-[15px] font-semibold text-[#1E3A5F] leading-snug mt-0.5">
                    {settings.vibration ? (
                      <>
                        <span className="font-extrabold text-[#116630]">On</span>
                        <span> · Tactile swap &amp; match feedback</span>
                      </>
                    ) : (
                      <>
                        <span className="font-extrabold text-[#b41818]">Off</span>
                        <span> · Haptics disabled</span>
                      </>
                    )}
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

          {/* Sticky Bottom Footer with 3D Done CTA (Never Cut Off) */}
          <div className="shrink-0 px-4 sm:px-5 pt-3 pb-4 bg-[#e6f0ff] border-t-2 border-[#c7dfff]">
            <button
              type="button"
              onClick={onClose}
              className="candy-btn-blue w-full py-3 px-6 rounded-full font-settings-heading font-extrabold text-[22px] leading-none text-white tracking-wide cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
