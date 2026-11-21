import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { soundEngine } from '../audio/soundEngine';
import { preloadAllCandySprites } from '../game/candySprites';
import { SugarPopBrand } from './SugarPopBrand';

interface StartupScreenProps {
  onTapStart: () => void;
  onTransitionComplete: () => void;
}

const LOADING_TIPS: string[] = [
  'Match 4 in a row to make a Striped Candy!',
  'Match an L or T shape to create a Wrapped Candy!',
  'Match 5 in a line for a super Color Bomb!',
  'Combine two special candies for a huge Sugar Pop blast!',
  'Save extra moves to earn 3 shining Stars!',
];

const MIN_LOADING_DURATION_MS = 2000;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export const StartupScreen: React.FC<StartupScreenProps> = ({
  onTapStart,
  onTransitionComplete,
}) => {
  const [displayProgress, setDisplayProgress] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [tipIndex, setTipIndex] = useState<number>(0);

  const splashHiddenRef = useRef<boolean>(false);
  const assetProgressRef = useRef<number>(0);
  const assetsDoneRef = useRef<boolean>(false);
  const exitStartedRef = useRef<boolean>(false);

  const hideNativeSplash = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {
      // Safe no-op on standard web browsers
    });
  }, []);

  // Fallback timer so native splash always hides cleanly even if image was cached synchronously
  useEffect(() => {
    const fallbackTimer = window.setTimeout(hideNativeSplash, 160);
    return () => window.clearTimeout(fallbackTimer);
  }, [hideNativeSplash]);

  // Rotate gameplay tips smoothly at the bottom
  useEffect(() => {
    const interval = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3400);
    return () => window.clearInterval(interval);
  }, []);

  // Real asset preloading (logo images, fonts, 3x candy sprites, 15 voice clips, BGM metadata) + 2-second minimum ramp
  useEffect(() => {
    let cancelled = false;
    const startTime = performance.now();

    let completedUnits = 0;
    const baseUnits = 4; // logo-512, logo, fonts, candy sprites
    let audioTotal = 17;
    let audioLoaded = 0;

    const updateRealProgress = () => {
      const total = baseUnits + audioTotal;
      const done = completedUnits + audioLoaded;
      assetProgressRef.current = Math.min(1, done / Math.max(1, total));
    };

    const imagesAndFonts = Promise.all([
      preloadImage('./logo-512.png').finally(() => {
        completedUnits += 1;
        updateRealProgress();
      }),
      preloadImage('./logo.png').finally(() => {
        completedUnits += 1;
        updateRealProgress();
      }),
      preloadAllCandySprites().finally(() => {
        completedUnits += 1;
        updateRealProgress();
      }),
      (typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve()
      ).finally(() => {
        completedUnits += 1;
        updateRealProgress();
      }),
    ]);

    const audioPreload = soundEngine.preloadAllAssets((loaded, total) => {
      audioLoaded = loaded;
      audioTotal = total;
      updateRealProgress();
    });

    Promise.all([imagesAndFonts, audioPreload]).finally(() => {
      assetProgressRef.current = 1;
      assetsDoneRef.current = true;
    });

    let rafId = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startTime;
      const timeFraction = Math.min(1, elapsed / MIN_LOADING_DURATION_MS);
      const targetFraction = Math.min(timeFraction, assetProgressRef.current);
      const easedPct = Math.min(100, Math.round(targetFraction * 100));

      setDisplayProgress((prev) => (easedPct > prev ? easedPct : prev));

      if (timeFraction >= 1 && assetsDoneRef.current) {
        setDisplayProgress(100);
        setIsReady(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleStartTap = useCallback(() => {
    if (!isReady || exitStartedRef.current) return;
    exitStartedRef.current = true;
    onTapStart();
    setIsExiting(true);
    window.setTimeout(() => {
      onTransitionComplete();
    }, 340);
  }, [isReady, onTapStart, onTransitionComplete]);

  // Allow Enter / Space once ready
  useEffect(() => {
    if (!isReady) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStartTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isReady, handleStartTap]);

  return (
    <div
      className={`sugar-pop-stripes safe-area-top safe-area-bottom relative w-full h-full overflow-hidden flex flex-col items-center justify-between px-6 py-8 sm:py-10 transition-[transform,opacity] duration-350 ease-out ${
        isExiting ? 'opacity-0 scale-108 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Sky Radial Glow Behind Center Logo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.32) 0%, rgba(125, 211, 252, 0.12) 38%, rgba(12, 68, 152, 0.22) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Top Spacer for Vertical Balance */}
      <div className="h-4 shrink-0" aria-hidden="true" />

      {/* Center Hero: Reusable Sugar Pop Logo + Sparkles + Bubble Title */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm">
        <SugarPopBrand size="startup" onLogoLoad={hideNativeSplash} />

        {/* Loading Progress Bar OR Pulsing "Tap to start" Button */}
        <div className="w-full max-w-[300px] mt-7 min-h-[86px] flex flex-col items-center justify-center">
          {!isReady ? (
            <div className="w-full flex flex-col items-center gap-2.5">
              {/* Glossy Rounded Progress Bar Track */}
              <div
                className="w-full h-7 rounded-full bg-[#0e428a]/65 border-[3px] border-white/95 p-1 shadow-[0_6px_16px_rgba(8,38,94,0.32)] overflow-hidden"
                role="progressbar"
                aria-valuenow={displayProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Loading Sugar Pop"
              >
                <div
                  className="w-full h-full rounded-full bg-gradient-to-r from-[#ff2e93] via-[#ff6b4a] to-[#ffae19] origin-left transition-transform duration-100 ease-out shadow-[inset_0_2px_3px_rgba(255,255,255,0.55)]"
                  style={{ transform: `scaleX(${Math.max(0.04, displayProgress / 100)})` }}
                />
              </div>

              <div className="flex items-center justify-between w-full px-2">
                <span className="font-settings-heading font-extrabold text-[19px] text-white tracking-wide drop-shadow-[0_2px_3px_rgba(9,35,84,0.55)]">
                  Loading...
                </span>
                <span className="font-settings-heading font-extrabold text-[19px] text-[#fff6b3] tabular-nums drop-shadow-[0_2px_3px_rgba(9,35,84,0.55)]">
                  {displayProgress}%
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartTap}
              className="animate-tap-pulse w-full py-4 px-8 rounded-full font-settings-heading font-extrabold text-[26px] leading-none text-white tracking-wide cursor-pointer border-[3px] border-[#fff3c4] bg-gradient-to-b from-[#ff5ca8] via-[#ff3b7f] to-[#ff7b1c] shadow-[0_7px_0_#9e174b,0_14px_26px_rgba(9,35,84,0.42),inset_0_3px_4px_rgba(255,255,255,0.65)] active:translate-y-1 transition-transform"
            >
              Tap to start
            </button>
          )}
        </div>
      </div>

      {/* Bottom Rotating Gameplay Tip */}
      <div className="relative z-10 w-full max-w-sm min-h-[44px] flex items-center justify-center px-3">
        <p
          key={tipIndex}
          className="animate-sugar-tip text-center font-settings font-extrabold text-[14px] sm:text-[15px] text-white bg-[#0d3e85]/45 border border-white/30 px-4 py-2 rounded-2xl shadow-sm"
        >
          {LOADING_TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
};
