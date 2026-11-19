# Candy Crush Match-3 Saga

A polished, mobile-friendly Match-3 puzzle game with smooth 8x8 swap gliding, proportional waterfall gravity drops, special candy combos (Striped, Wrapped, Color Bomb), Sugar Crush finale, Daily Rewards, custom Lobby & Gameplay background music, watery cascade Web Audio SFX, and rare milestone voice-overs.

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-builds & deploys to GitHub Pages on push
├── public/
│   └── assets/
│       ├── aistudio/
│       │   ├── 1_5597b470.mp3  # Custom Home/Lobby background music
│       │   └── 2_e94f2a79.mp3  # Custom Gameplay background music
│       └── audio/
│           └── voice/          # 15 cleaned & trimmed voice-over MP3 clips
├── src/
│   ├── audio/
│   │   └── soundEngine.ts      # Web Audio SFX, cascade drops, music & voice cooldowns
│   ├── components/
│   │   ├── CandySprite.tsx     # Glossy SVG candies & special power-up overlays
│   │   ├── DailyRewardModal.tsx# 7-day persistent Daily Rewards calendar
│   │   ├── GameBoard.tsx       # 8x8 grid, swap physics, cascades & Sugar Crush finale
│   │   ├── LevelMap.tsx        # 12-level Kingdom progression map
│   │   ├── TitleScreen.tsx     # Animated candy landscape lobby & export modal
│   │   └── VfxCanvas.tsx       # High-DPI particle, beam & shockwave canvas layer
│   ├── game/
│   │   ├── dailyRewards.ts     # Daily reward persistence & booster inventory
│   │   ├── levels.ts           # 12 progressive levels across 3 biomes
│   │   ├── matchEngine.ts      # Match clustering, special combos & gravity refill
│   │   └── types.ts            # TypeScript models
│   ├── App.tsx                 # Screen router, audio lifecycle & state sync
│   ├── index.css               # Tailwind CSS & keyframe animations
│   └── main.tsx                # Application entry point
├── index.html                  # HTML entry point & fonts
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite config (relative base './' for GitHub Pages)
```

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

## Build for Production

```bash
npm run build
```
