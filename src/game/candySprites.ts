import { CandyColor, SpecialType } from './types';

const ALL_COLORS: CandyColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const ALL_SPECIALS: SpecialType[] = ['none', 'striped-h', 'striped-v', 'wrapped'];

function getSpriteKey(color: CandyColor, special: SpecialType): string {
  return special === 'color-bomb' ? 'color-bomb' : `${color}:${special}`;
}

/**
 * Original high-volume glossy candy SVG sprites filling ~94% of the 120x120 viewBox.
 * Each candy includes:
 * - Soft pre-feathered contact shadow underneath (radial gradient, zero live blur)
 * - Deep colored outline / rim
 * - Rich multi-stop internal radial/linear gradient
 * - Strong top-left specular highlight
 * - Warm/bright bottom-right reflected rim light for 3D depth
 */
function buildCandySvgMarkup(color: CandyColor, special: SpecialType): string {
  if (special === 'color-bomb') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <radialGradient id="cbShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#041528" stop-opacity="0.46"/>
          <stop offset="68%" stop-color="#041528" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#041528" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="cbBody" cx="32%" cy="26%" r="74%">
          <stop offset="0%" stop-color="#a86d48"/>
          <stop offset="42%" stop-color="#5d2f16"/>
          <stop offset="82%" stop-color="#351608"/>
          <stop offset="100%" stop-color="#200b02"/>
        </radialGradient>
        <radialGradient id="cbBounce" cx="76%" cy="80%" r="42%">
          <stop offset="0%" stop-color="#ffc98a" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#ffc98a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="44" ry="7.5" fill="url(#cbShadow)"/>
      <circle cx="60" cy="58" r="53" fill="url(#cbBody)" stroke="#1b0802" stroke-width="3.6"/>
      <circle cx="60" cy="58" r="50" fill="url(#cbBounce)"/>
      <ellipse cx="41" cy="31" rx="22" ry="11.5" transform="rotate(-26 41 31)" fill="#ffffff" fill-opacity="0.34"/>
      <circle cx="36" cy="45" r="7" fill="#ff3366" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="65" cy="24" r="7" fill="#38bdf8" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="89" cy="47" r="7" fill="#fde047" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="79" cy="82" r="7" fill="#4ade80" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="41" cy="85" r="7" fill="#fb923c" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="60" cy="58" r="7.8" fill="#ffffff" stroke="#c084fc" stroke-width="2.2"/>
      <circle cx="24" cy="67" r="5.6" fill="#c084fc" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="93" cy="69" r="5.6" fill="#f472b6" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="59" cy="95" r="5.4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="82" cy="33" r="5.2" fill="#4ade80" stroke="#ffffff" stroke-width="1.4"/>
      <circle cx="46" cy="29" r="4.8" fill="#fde047" stroke="#ffffff" stroke-width="1.4"/>
    </svg>`;
  }

  let clipPath = '';
  let shapeDefs = '';
  let shapeBody = '';
  let shapeHighlight = '';

  const shadowDef = `
    <radialGradient id="cShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#05182e" stop-opacity="0.44"/>
      <stop offset="68%" stop-color="#05182e" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#05182e" stop-opacity="0"/>
    </radialGradient>`;

  switch (color) {
    case 'red': {
      // Tilted glossy jelly bean (expanded to fill ~94% of viewBox)
      const beanPath =
        'M27,20 C44,3 82,4 100,25 C117,44 113,82 91,100 C71,115 35,113 18,93 C4,77 7,52 19,39 C23,34 21,26 27,20 Z';
      clipPath = `<path d="${beanPath}"/>`;
      shapeDefs = `${shadowDef}
        <radialGradient id="gMain" cx="30%" cy="22%" r="78%">
          <stop offset="0%" stop-color="#ffb8c6"/>
          <stop offset="26%" stop-color="#ff2952"/>
          <stop offset="72%" stop-color="#d40830"/>
          <stop offset="100%" stop-color="#7c0219"/>
        </radialGradient>
        <radialGradient id="gBounce" cx="80%" cy="82%" r="44%">
          <stop offset="0%" stop-color="#ff9fb4" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#ff9fb4" stop-opacity="0"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="113" rx="43" ry="7" fill="url(#cShadow)"/>
        <path d="${beanPath}" fill="url(#gMain)" stroke="#6e0116" stroke-width="3.8" stroke-linejoin="round"/>
        <path d="${beanPath}" fill="url(#gBounce)"/>
        <path d="M54,101 C73,104 92,94 100,77" fill="none" stroke="#ffb3c4" stroke-opacity="0.62" stroke-width="5.2" stroke-linecap="round"/>`;
      shapeHighlight = `
        <path d="M30,29 C43,14 68,13 84,23" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="8.5" stroke-linecap="round"/>
        <ellipse cx="92" cy="34" rx="4.5" ry="6" transform="rotate(-24 92 34)" fill="#ffffff" fill-opacity="0.82"/>
        <circle cx="24" cy="43" r="3.4" fill="#ffffff" fill-opacity="0.72"/>`;
      break;
    }

    case 'orange': {
      // Plump glossy oval with sculpted inner ring
      clipPath = `<ellipse cx="60" cy="58" rx="43" ry="52"/>`;
      shapeDefs = `${shadowDef}
        <radialGradient id="gMain" cx="30%" cy="22%" r="78%">
          <stop offset="0%" stop-color="#ffe7ad"/>
          <stop offset="28%" stop-color="#ff8812"/>
          <stop offset="74%" stop-color="#e35200"/>
          <stop offset="100%" stop-color="#8f2700"/>
        </radialGradient>
        <radialGradient id="gInner" cx="40%" cy="32%" r="72%">
          <stop offset="0%" stop-color="#ffc266" stop-opacity="0.86"/>
          <stop offset="70%" stop-color="#d94a00" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#852200" stop-opacity="0.85"/>
        </radialGradient>
        <radialGradient id="gBounce" cx="80%" cy="84%" r="44%">
          <stop offset="0%" stop-color="#ffd585" stop-opacity="0.58"/>
          <stop offset="100%" stop-color="#ffd585" stop-opacity="0"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="113" rx="38" ry="7" fill="url(#cShadow)"/>
        <ellipse cx="60" cy="58" rx="43" ry="52" fill="url(#gMain)" stroke="#7a2000" stroke-width="3.8"/>
        <ellipse cx="60" cy="58" rx="41" ry="50" fill="url(#gBounce)"/>
        <ellipse cx="60" cy="58" rx="26" ry="35" fill="url(#gInner)" stroke="#ffda96" stroke-opacity="0.62" stroke-width="2.8"/>
        <path d="M60,33 C74,33 79,49 75,63 C72,77 56,84 46,76 C38,69 40,51 52,47 C60,44 67,52 64,60" fill="none" stroke="#fff3d1" stroke-opacity="0.72" stroke-width="4.4" stroke-linecap="round"/>
        <path d="M56,102 C74,102 90,91 96,74" fill="none" stroke="#ffe09e" stroke-opacity="0.55" stroke-width="4.6" stroke-linecap="round"/>`;
      shapeHighlight = `
        <ellipse cx="40" cy="29" rx="10" ry="17" transform="rotate(-22 40 29)" fill="#ffffff" fill-opacity="0.86"/>
        <circle cx="32" cy="51" r="4" fill="#ffffff" fill-opacity="0.72"/>`;
      break;
    }

    case 'yellow': {
      // Glossy lemon drop
      const dropPath =
        'M60,5 C81,25 109,50 109,74 C109,99 88,111 60,111 C32,111 11,99 11,74 C11,50 39,25 60,5 Z';
      clipPath = `<path d="${dropPath}"/>`;
      shapeDefs = `${shadowDef}
        <radialGradient id="gMain" cx="33%" cy="28%" r="76%">
          <stop offset="0%" stop-color="#ffffd1"/>
          <stop offset="30%" stop-color="#ffdc0d"/>
          <stop offset="76%" stop-color="#e89a00"/>
          <stop offset="100%" stop-color="#9e5300"/>
        </radialGradient>
        <radialGradient id="gBounce" cx="78%" cy="84%" r="44%">
          <stop offset="0%" stop-color="#fff8b0" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#fff8b0" stop-opacity="0"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="113" rx="42" ry="7" fill="url(#cShadow)"/>
        <path d="${dropPath}" fill="url(#gMain)" stroke="#874500" stroke-width="3.8" stroke-linejoin="round"/>
        <path d="${dropPath}" fill="url(#gBounce)"/>
        <path d="M56,103 C77,104 95,94 101,78" fill="none" stroke="#fff9bd" stroke-opacity="0.65" stroke-width="5" stroke-linecap="round"/>`;
      shapeHighlight = `
        <path d="M34,54 C38,38 48,25 57,16" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="8" stroke-linecap="round"/>
        <circle cx="30" cy="68" r="4.6" fill="#ffffff" fill-opacity="0.82"/>`;
      break;
    }

    case 'green': {
      // Squat glossy jelly cube with beveled pillow face
      clipPath = `<rect x="8" y="11" width="104" height="96" rx="28"/>`;
      shapeDefs = `${shadowDef}
        <linearGradient id="gMain" x1="14%" y1="6%" x2="86%" y2="96%">
          <stop offset="0%" stop-color="#b5ffad"/>
          <stop offset="28%" stop-color="#24d94b"/>
          <stop offset="74%" stop-color="#0d9929"/>
          <stop offset="100%" stop-color="#065917"/>
        </linearGradient>
        <linearGradient id="gBevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="#064a12" stop-opacity="0.28"/>
        </linearGradient>
        <radialGradient id="gBounce" cx="82%" cy="84%" r="44%">
          <stop offset="0%" stop-color="#a8ff9e" stop-opacity="0.58"/>
          <stop offset="100%" stop-color="#a8ff9e" stop-opacity="0"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="112" rx="46" ry="7" fill="url(#cShadow)"/>
        <rect x="8" y="11" width="104" height="96" rx="28" fill="url(#gMain)" stroke="#054712" stroke-width="3.8"/>
        <rect x="10" y="13" width="100" height="92" rx="26" fill="url(#gBounce)"/>
        <rect x="20" y="23" width="80" height="72" rx="18" fill="url(#gBevel)" stroke="#e0ffd6" stroke-opacity="0.5" stroke-width="2.6"/>
        <path d="M58,99 L84,99 C95,99 102,92 102,80" fill="none" stroke="#bfffb3" stroke-opacity="0.58" stroke-width="4.5" stroke-linecap="round"/>`;
      shapeHighlight = `
        <path d="M24,26 C38,18 82,18 96,25" fill="none" stroke="#ffffff" stroke-opacity="0.92" stroke-width="7.8" stroke-linecap="round"/>
        <circle cx="22" cy="41" r="4.2" fill="#ffffff" fill-opacity="0.78"/>`;
      break;
    }

    case 'blue': {
      // Glossy round ridged ball
      clipPath = `<circle cx="60" cy="58" r="52"/>`;
      shapeDefs = `${shadowDef}
        <radialGradient id="gMain" cx="30%" cy="22%" r="78%">
          <stop offset="0%" stop-color="#c4f0ff"/>
          <stop offset="30%" stop-color="#2196ff"/>
          <stop offset="74%" stop-color="#0b5ed1"/>
          <stop offset="100%" stop-color="#032e73"/>
        </radialGradient>
        <radialGradient id="gBounce" cx="80%" cy="82%" r="44%">
          <stop offset="0%" stop-color="#9be3ff" stop-opacity="0.62"/>
          <stop offset="100%" stop-color="#9be3ff" stop-opacity="0"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="113" rx="43" ry="7" fill="url(#cShadow)"/>
        <circle cx="60" cy="58" r="52" fill="url(#gMain)" stroke="#03265e" stroke-width="3.8"/>
        <circle cx="60" cy="58" r="50" fill="url(#gBounce)"/>
        <path d="M9,58 Q60,77 111,58" fill="none" stroke="#03265e" stroke-opacity="0.62" stroke-width="8"/>
        <path d="M9,54 Q60,73 111,54" fill="none" stroke="#c2ecff" stroke-opacity="0.9" stroke-width="4.5"/>
        <path d="M54,102 C76,102 95,90 103,72" fill="none" stroke="#a6e6ff" stroke-opacity="0.58" stroke-width="4.6" stroke-linecap="round"/>`;
      shapeHighlight = `
        <ellipse cx="41" cy="31" rx="21" ry="10.5" transform="rotate(-24 41 31)" fill="#ffffff" fill-opacity="0.9"/>
        <circle cx="72" cy="23" r="4.4" fill="#ffffff" fill-opacity="0.72"/>`;
      break;
    }

    case 'purple': {
      // Glossy 6-lobe scalloped cluster
      clipPath = `
        <circle cx="60" cy="25" r="21"/>
        <circle cx="31" cy="41" r="21"/>
        <circle cx="89" cy="41" r="21"/>
        <circle cx="31" cy="75" r="21"/>
        <circle cx="89" cy="75" r="21"/>
        <circle cx="60" cy="91" r="21"/>
        <circle cx="60" cy="58" r="24"/>`;
      shapeDefs = `${shadowDef}
        <radialGradient id="gMain" cx="30%" cy="24%" r="76%">
          <stop offset="0%" stop-color="#fad1ff"/>
          <stop offset="32%" stop-color="#bd33ff"/>
          <stop offset="76%" stop-color="#7c0fc9"/>
          <stop offset="100%" stop-color="#420273"/>
        </radialGradient>
        <radialGradient id="gLobe" cx="32%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#fce0ff"/>
          <stop offset="44%" stop-color="#b529ff"/>
          <stop offset="100%" stop-color="#53058f"/>
        </radialGradient>`;
      shapeBody = `
        <ellipse cx="60" cy="113" rx="39" ry="7" fill="url(#cShadow)"/>
        <g fill="url(#gLobe)" stroke="#380263" stroke-width="3.6">
          <circle cx="60" cy="25" r="20.5"/>
          <circle cx="31" cy="41" r="20.5"/>
          <circle cx="89" cy="41" r="20.5"/>
          <circle cx="31" cy="75" r="20.5"/>
          <circle cx="89" cy="75" r="20.5"/>
          <circle cx="60" cy="91" r="20.5"/>
          <circle cx="60" cy="58" r="23" fill="url(#gMain)"/>
        </g>
        <path d="M68,101 C81,98 92,89 97,77" fill="none" stroke="#f0b8ff" stroke-opacity="0.58" stroke-width="4.5" stroke-linecap="round"/>`;
      shapeHighlight = `
        <ellipse cx="55" cy="18" rx="8.5" ry="5" transform="rotate(-14 55 18)" fill="#ffffff" fill-opacity="0.9"/>
        <ellipse cx="26" cy="35" rx="7.5" ry="4.5" transform="rotate(-24 26 35)" fill="#ffffff" fill-opacity="0.8"/>
        <ellipse cx="54" cy="51" rx="9.5" ry="5.5" transform="rotate(-18 54 51)" fill="#ffffff" fill-opacity="0.84"/>
        <circle cx="84" cy="35" r="4.4" fill="#ffffff" fill-opacity="0.68"/>`;
      break;
    }
  }

  const wrappedBack =
    special === 'wrapped'
      ? `<g>
          <polygon points="2,20 19,37 19,79 2,96" fill="#ffffff" fill-opacity="0.76" stroke="#e2f1ff" stroke-width="2"/>
          <polygon points="118,20 101,37 101,79 118,96" fill="#ffffff" fill-opacity="0.76" stroke="#e2f1ff" stroke-width="2"/>
          <rect x="6" y="6" width="108" height="108" rx="28" fill="#ffffff" fill-opacity="0.24" stroke="#ffffff" stroke-width="4"/>
        </g>`
      : '';

  const stripedOverlay =
    special === 'striped-h'
      ? `<g clip-path="url(#candyClip)">
          <rect x="4" y="26" width="112" height="11.5" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
          <rect x="4" y="52" width="112" height="11.5" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
          <rect x="4" y="78" width="112" height="11.5" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
        </g>`
      : special === 'striped-v'
      ? `<g clip-path="url(#candyClip)">
          <rect x="26" y="4" width="11.5" height="112" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
          <rect x="52" y="4" width="11.5" height="112" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
          <rect x="78" y="4" width="11.5" height="112" rx="5.5" fill="#ffffff" fill-opacity="0.94"/>
        </g>`
      : '';

  const wrappedFront =
    special === 'wrapped'
      ? `<g>
          <path d="M18,18 L102,102 M102,18 L18,102" stroke="#ffffff" stroke-opacity="0.34" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M16,20 Q60,10 104,20" fill="none" stroke="#ffffff" stroke-opacity="0.68" stroke-width="3.5" stroke-linecap="round"/>
        </g>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      ${shapeDefs}
      <clipPath id="candyClip">${clipPath}</clipPath>
    </defs>
    ${wrappedBack}
    ${shapeBody}
    ${stripedOverlay}
    ${shapeHighlight}
    ${wrappedFront}
  </svg>`;
}

const svgUrlCache = new Map<string, string>();
const rasterUrlCache = new Map<string, string>();
const cacheListeners = new Set<() => void>();
let preloadPromise: Promise<void> | null = null;

function getSvgDataUrl(color: CandyColor, special: SpecialType): string {
  const key = getSpriteKey(color, special);
  const existing = svgUrlCache.get(key);
  if (existing) return existing;
  const svg = buildCandySvgMarkup(color, special);
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  svgUrlCache.set(key, encoded);
  return encoded;
}

function rasterizeSpriteToHighDpiPng(key: string, svgDataUrl: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        // Always render at >= 3x DPR (324px to 432px) so sprites are never upscaled or blurry
        const dpr = Math.min(4, Math.max(3, Math.ceil(window.devicePixelRatio || 3)));
        const size = 108 * dpr;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          const pngUrl = canvas.toDataURL('image/png');
          rasterUrlCache.set(key, pngUrl);
        }
      } catch {
        // Fall back seamlessly to cached SVG data URL
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = svgDataUrl;
  });
}

/**
 * Returns the cached >= 3x PNG sprite if pre-rendered, or the crisp SVG data URL immediately.
 */
export function getCandySpriteSrc(color: CandyColor, special: SpecialType): string {
  const key = getSpriteKey(color, special);
  return rasterUrlCache.get(key) ?? getSvgDataUrl(color, special);
}

/**
 * Preloads & caches all 25 high-resolution candy sprites once at startup.
 */
export function preloadAllCandySprites(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  const jobs: Promise<void>[] = [];
  for (const color of ALL_COLORS) {
    for (const special of ALL_SPECIALS) {
      const key = getSpriteKey(color, special);
      const svgUrl = getSvgDataUrl(color, special);
      jobs.push(rasterizeSpriteToHighDpiPng(key, svgUrl));
    }
  }
  const cbKey = getSpriteKey('red', 'color-bomb');
  jobs.push(rasterizeSpriteToHighDpiPng(cbKey, getSvgDataUrl('red', 'color-bomb')));

  preloadPromise = Promise.all(jobs).then(() => {
    for (const cb of cacheListeners) cb();
  });

  return preloadPromise;
}

export function subscribeCandySpriteCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}
