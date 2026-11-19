import React, { useId } from 'react';
import { CandyColor, SpecialType } from '../game/types';

interface CandySpriteProps {
  color: CandyColor;
  special: SpecialType;
  className?: string;
}

export const CandySprite: React.FC<CandySpriteProps> = ({ color, special, className = 'w-full h-full' }) => {
  const uid = useId().replace(/:/g, '');

  if (special === 'color-bomb') {
    return (
      <svg viewBox="0 0 100 100" className={`${className} drop-shadow-[0_4px_5px_rgba(0,0,0,0.45)]`}>
        <defs>
          <radialGradient id={`cb_${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#8c583a" />
            <stop offset="55%" stopColor="#4f2915" />
            <stop offset="100%" stopColor="#2b1207" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill={`url(#cb_${uid})`} stroke="#210b03" strokeWidth="2.5" />
        {/* Glossy chocolate sheen */}
        <ellipse cx="36" cy="30" rx="16" ry="9" transform="rotate(-24 36 30)" fill="rgba(255,255,255,0.28)" />
        {/* Rainbow sprinkles */}
        <circle cx="32" cy="40" r="5" fill="#ff3b6b" stroke="#fff" strokeWidth="1" />
        <circle cx="54" cy="24" r="5" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
        <circle cx="72" cy="42" r="5" fill="#facc15" stroke="#fff" strokeWidth="1" />
        <circle cx="64" cy="68" r="5" fill="#4ade80" stroke="#fff" strokeWidth="1" />
        <circle cx="36" cy="70" r="5" fill="#fb923c" stroke="#fff" strokeWidth="1" />
        <circle cx="50" cy="50" r="5.5" fill="#f8fafc" stroke="#c084fc" strokeWidth="1.5" />
        <circle cx="24" cy="56" r="4" fill="#c084fc" />
        <circle cx="74" cy="58" r="4" fill="#f472b6" />
        <circle cx="48" cy="77" r="4" fill="#38bdf8" />
        <circle cx="66" cy="31" r="3.5" fill="#4ade80" />
      </svg>
    );
  }

  const renderShape = () => {
    switch (color) {
      case 'red':
        // Glossy Red Jelly Bean / Heart-rounded Jelly
        return (
          <g>
            <defs>
              <radialGradient id={`red_${uid}`} cx="35%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ff94aa" />
                <stop offset="40%" stopColor="#ff1f4b" />
                <stop offset="100%" stopColor="#9c0524" />
              </radialGradient>
            </defs>
            <path
              d="M24,30 C35,14 68,14 78,34 C88,54 78,80 54,84 C32,87 14,72 16,50 C17,40 19,36 24,30 Z"
              fill={`url(#red_${uid})`}
              stroke="#8a041f"
              strokeWidth="2.5"
            />
            <path
              d="M29,34 C37,24 56,22 65,30"
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <circle cx="70" cy="39" r="3.5" fill="rgba(255,255,255,0.6)" />
          </g>
        );

      case 'green':
        // Glossy Green Apple / Mint Cushion Square (like screenshot 2)
        return (
          <g>
            <defs>
              <linearGradient id={`grn_${uid}`} x1="15%" y1="10%" x2="85%" y2="95%">
                <stop offset="0%" stopColor="#8cff8c" />
                <stop offset="45%" stopColor="#1bc943" />
                <stop offset="100%" stopColor="#09731d" />
              </linearGradient>
            </defs>
            <rect
              x="16"
              y="16"
              width="68"
              height="68"
              rx="18"
              fill={`url(#grn_${uid})`}
              stroke="#075916"
              strokeWidth="2.5"
            />
            <rect
              x="24"
              y="24"
              width="52"
              height="52"
              rx="12"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="3"
            />
            <path
              d="M25,29 C32,22 65,22 72,27"
              fill="none"
              stroke="rgba(255,255,255,0.78)"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
        );

      case 'blue':
        // Glossy Blue Lollipop Sphere with equatorial ridge (exact match to screenshot 2)
        return (
          <g>
            <defs>
              <radialGradient id={`blu_${uid}`} cx="36%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#99dcff" />
                <stop offset="45%" stopColor="#1687ff" />
                <stop offset="100%" stopColor="#06459e" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="39" fill={`url(#blu_${uid})`} stroke="#053880" strokeWidth="2.5" />
            {/* Equatorial candy seam */}
            <path
              d="M12,50 Q50,62 88,50"
              fill="none"
              stroke="rgba(6,55,130,0.55)"
              strokeWidth="4.5"
            />
            <path
              d="M12,47 Q50,59 88,47"
              fill="none"
              stroke="rgba(165,225,255,0.65)"
              strokeWidth="2.5"
            />
            <ellipse cx="37" cy="30" rx="15" ry="7.5" transform="rotate(-22 37 30)" fill="rgba(255,255,255,0.72)" />
          </g>
        );

      case 'yellow':
        // Glossy Yellow Lemon Teardrop
        return (
          <g>
            <defs>
              <radialGradient id={`yel_${uid}`} cx="38%" cy="32%" r="70%">
                <stop offset="0%" stopColor="#fff8a8" />
                <stop offset="45%" stopColor="#ffd000" />
                <stop offset="100%" stopColor="#c97b00" />
              </radialGradient>
            </defs>
            <path
              d="M50,11 C65,28 84,46 84,64 C84,81 69,90 50,90 C31,90 16,81 16,64 C16,46 35,28 50,11 Z"
              fill={`url(#yel_${uid})`}
              stroke="#9e5d00"
              strokeWidth="2.5"
            />
            <path
              d="M34,47 C36,36 44,26 49,21"
              fill="none"
              stroke="rgba(255,255,255,0.82)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="32" cy="57" r="3.2" fill="rgba(255,255,255,0.65)" />
          </g>
        );

      case 'orange':
        // Glossy Orange Oval Drop with recessed lozenge center (exact match to screenshot 2)
        return (
          <g>
            <defs>
              <radialGradient id={`org_${uid}`} cx="35%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffd08a" />
                <stop offset="48%" stopColor="#ff7b00" />
                <stop offset="100%" stopColor="#b83b00" />
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="50" rx="28" ry="39" fill={`url(#org_${uid})`} stroke="#912d00" strokeWidth="2.5" />
            <ellipse
              cx="50"
              cy="50"
              rx="15"
              ry="24"
              fill="rgba(255,145,25,0.45)"
              stroke="rgba(165,52,0,0.45)"
              strokeWidth="3"
            />
            <ellipse
              cx="36"
              cy="28"
              rx="7"
              ry="12"
              transform="rotate(-18 36 28)"
              fill="rgba(255,255,255,0.68)"
            />
          </g>
        );

      case 'purple':
        // Glossy Purple Grape Cluster (exact match to screenshot 2)
        return (
          <g>
            <defs>
              <radialGradient id={`pur_${uid}`} cx="35%" cy="30%" r="72%">
                <stop offset="0%" stopColor="#f4b3ff" />
                <stop offset="48%" stopColor="#b026ff" />
                <stop offset="100%" stopColor="#5b0499" />
              </radialGradient>
            </defs>
            <g fill={`url(#pur_${uid})`} stroke="#4b0380" strokeWidth="2">
              <circle cx="50" cy="24" r="14" />
              <circle cx="29" cy="38" r="14" />
              <circle cx="71" cy="38" r="14" />
              <circle cx="29" cy="62" r="14" />
              <circle cx="71" cy="62" r="14" />
              <circle cx="50" cy="76" r="14" />
              <circle cx="50" cy="50" r="15" />
            </g>
            <circle cx="46" cy="20" r="4.5" fill="rgba(255,255,255,0.72)" />
            <circle cx="26" cy="34" r="4" fill="rgba(255,255,255,0.6)" />
            <circle cx="46" cy="45" r="5" fill="rgba(255,255,255,0.65)" />
          </g>
        );
    }
  };

  return (
    <div
      className={`relative ${className} ${special === 'wrapped' ? 'animate-wrapped-shimmer' : ''}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.38)] overflow-visible"
      >
        {special === 'wrapped' && (
          <g>
            {/* Sparkling foil wrapper wings behind candy */}
            <rect
              x="7"
              y="7"
              width="86"
              height="86"
              rx="22"
              fill="rgba(255,255,255,0.22)"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeDasharray="10 5"
            />
            <polygon points="6,24 18,36 18,64 6,76" fill="rgba(255,255,255,0.65)" />
            <polygon points="94,24 82,36 82,64 94,76" fill="rgba(255,255,255,0.65)" />
          </g>
        )}

        {renderShape()}

        {/* Striped Candy Sugar Bands */}
        {special === 'striped-h' && (
          <g pointerEvents="none">
            <rect x="18" y="33" width="64" height="8" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="18" y="47" width="64" height="8" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="18" y="61" width="64" height="8" rx="4" fill="rgba(255,255,255,0.9)" />
          </g>
        )}

        {special === 'striped-v' && (
          <g pointerEvents="none">
            <rect x="33" y="18" width="8" height="64" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="47" y="18" width="8" height="64" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="61" y="18" width="8" height="64" rx="4" fill="rgba(255,255,255,0.9)" />
          </g>
        )}

        {special === 'wrapped' && (
          <g pointerEvents="none">
            <path
              d="M20,20 L80,80 M80,20 L20,80"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
