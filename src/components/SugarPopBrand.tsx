import React, { useId } from 'react';

interface SugarPopBrandProps {
  size?: 'startup' | 'home';
  lowPerf?: boolean;
  onLogoLoad?: () => void;
}

const SPARKLES: Array<{
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
}> = [
  { top: '-6%', left: '12%', size: 28, delay: '0s', duration: '2.0s' },
  { top: '6%', left: '88%', size: 22, delay: '0.45s', duration: '2.3s' },
  { top: '38%', left: '-10%', size: 24, delay: '0.9s', duration: '2.1s' },
  { top: '52%', left: '96%', size: 30, delay: '0.25s', duration: '1.9s' },
  { top: '86%', left: '4%', size: 20, delay: '1.15s', duration: '2.4s' },
  { top: '88%', left: '84%', size: 26, delay: '0.7s', duration: '2.2s' },
];

export const SugarPopBrand: React.FC<SugarPopBrandProps> = ({
  size = 'home',
  lowPerf = false,
  onLogoLoad,
}) => {
  const uid = useId().replace(/:/g, '');
  const isHome = size === 'home';

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div
        className={`relative flex items-center justify-center ${
          isHome ? 'w-44 h-44 sm:w-52 sm:h-52' : 'w-48 h-48 sm:w-56 sm:h-56'
        }`}
      >
        {/* Twinkling 4-Point SVG Sparkles Around Logo (transform & opacity only) */}
        {!lowPerf &&
          SPARKLES.map((sp, idx) => (
            <svg
              key={idx}
              viewBox="0 0 32 32"
              width={sp.size}
              height={sp.size}
              className="animate-sugar-sparkle pointer-events-none absolute"
              style={{
                top: sp.top,
                left: sp.left,
                animationDelay: sp.delay,
                animationDuration: sp.duration,
              }}
              aria-hidden="true"
            >
              <path
                d="M16 1 L19.8 12.2 L31 16 L19.8 19.8 L16 31 L12.2 19.8 L1 16 L12.2 12.2 Z"
                fill="#fffbeb"
              />
            </svg>
          ))}

        {/* Floating & Gently Pulsing Sugar Pop Logo */}
        <div
          className={`${lowPerf ? '' : 'animate-sugar-logo'} relative ${
            isHome ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-44 h-44 sm:w-52 sm:h-52'
          } drop-shadow-[0_16px_24px_rgba(8,38,94,0.38)]`}
        >
          <img
            src="./logo-512.png"
            alt="Sugar Pop"
            width={512}
            height={512}
            onLoad={onLogoLoad}
            className="w-full h-full object-contain select-none pointer-events-none candy-sprite-img"
            draggable={false}
          />
        </div>
      </div>

      {/* Bold Bubble-Letter "Sugar Pop" SVG Title */}
      <div
        className={`${
          isHome ? 'w-[min(86vw,350px)] mt-2' : 'w-[min(86vw,340px)] mt-3'
        } drop-shadow-[0_8px_14px_rgba(12,42,102,0.38)]`}
      >
        <svg
          viewBox="0 0 420 112"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label="Sugar Pop"
        >
          <defs>
            <linearGradient id={`sugarPopTitleFill_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff7a8" />
              <stop offset="42%" stopColor="#ff9bd2" />
              <stop offset="100%" stopColor="#ff2e93" />
            </linearGradient>
          </defs>
          {/* Outer Deep Navy-Blue Bubble Outline */}
          <text
            x="210"
            y="84"
            textAnchor="middle"
            className="font-settings-heading font-extrabold"
            fontSize="74"
            letterSpacing="1.5"
            fill="#0c3278"
            stroke="#0c3278"
            strokeWidth="20"
            strokeLinejoin="round"
            paintOrder="stroke fill"
          >
            Sugar Pop
          </text>
          {/* Inner Crisp White Glossy Rim */}
          <text
            x="210"
            y="80"
            textAnchor="middle"
            className="font-settings-heading font-extrabold"
            fontSize="74"
            letterSpacing="1.5"
            fill={`url(#sugarPopTitleFill_${uid})`}
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinejoin="round"
            paintOrder="stroke fill"
          >
            Sugar Pop
          </text>
        </svg>
      </div>
    </div>
  );
};
