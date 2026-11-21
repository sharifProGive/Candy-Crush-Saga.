import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ALL_COLORS, CANDY_HEX } from '../game/levels';
import { GRID_SIZE } from '../game/matchEngine';
import {
  getEffectiveEffectsQuality,
  reportLiveParticleCount,
} from '../game/performanceGuard';
import { CandyColor, VfxEvent } from '../game/types';

export interface VfxCanvasHandle {
  emitEvents: (events: VfxEvent[]) => void;
  clear: () => void;
}

/** Base striped beam thickness relative to cell size (~9% thicker than previous 0.44) */
export const BEAM_THICKNESS = 0.48;

const PARTICLE_POOL_SIZE = 150;
const MAX_LIVE_PARTICLES_HIGH = 80;
const MAX_LIVE_PARTICLES_LOW = 40;
const BEAM_POOL_SIZE = 16;
const SHOCKWAVE_POOL_SIZE = 12;
const ARC_POOL_SIZE = 24;
const GLOW_POOL_SIZE = 20;
const POP_FLASH_POOL_SIZE = 32;
const SCORE_POOL_SIZE = 12;
const MAX_LIGHTNING_SEGMENTS_HIGH = 10; // strictly <= 12
const MAX_LIGHTNING_SEGMENTS_LOW = 5;
const BEAM_FADE_DURATION_SEC = 0.22; // +60ms longer than previous 0.16s

const SHAPE_CIRCLE = 0;
const SHAPE_STAR = 1;
const SHAPE_SHARD = 2;

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  glowKey: CandyColor | 'white';
  life: number;
  maxLife: number;
  shape: number;
  rotation: number;
  vRot: number;
  gravity: number;
}

interface PooledBeam {
  active: boolean;
  horizontal: boolean;
  index: number;
  /** Origin cell along the travel axis for bidirectional expanding beam head */
  originCell: number;
  color: string;
  glow: string;
  glowKey: CandyColor | 'white';
  elapsed: number;
  travelDuration: number;
  fadeDuration: number;
  perCellSec: number;
  sparkleAccum: number;
}

interface PooledPopFlash {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

interface PooledShockwave {
  active: boolean;
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  glowKey: CandyColor | 'white';
  life: number;
  maxLife: number;
}

interface PooledLightningArc {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
  segments: number;
  jitter: Float32Array;
}

interface PooledSpecialGlow {
  active: boolean;
  x: number;
  y: number;
  radiusCells: number;
  glowKey: CandyColor | 'white';
  life: number;
  maxLife: number;
}

interface PooledFloatScore {
  active: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

type GlowKey = CandyColor | 'white';

// Shared offscreen pre-rendered 64x64 radial glow sprites (zero ctx.shadowBlur at runtime)
let cachedGlowSprites: Record<GlowKey, HTMLCanvasElement> | null = null;

function getGlowSprites(): Record<GlowKey, HTMLCanvasElement> | null {
  if (typeof document === 'undefined') return null;
  if (cachedGlowSprites) return cachedGlowSprites;

  const makeSprite = (innerColor: string, midColor: string): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const gctx = c.getContext('2d');
    if (gctx) {
      const grad = gctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.28, innerColor);
      grad.addColorStop(0.62, midColor);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 64, 64);
    }
    return c;
  };

  const map = {} as Record<GlowKey, HTMLCanvasElement>;
  map.white = makeSprite('rgba(255,255,255,0.9)', 'rgba(220,248,255,0.35)');
  for (const color of ALL_COLORS) {
    const hex = CANDY_HEX[color];
    map[color] = makeSprite(hex.glow, `${hex.main}55`);
  }
  cachedGlowSprites = map;
  return map;
}

// Shared offscreen pre-rendered HD striped beam cross-section sprites (zero shadowBlur, zero per-frame gradient GC)
interface BeamSpritePair {
  h: HTMLCanvasElement; // 8x128 gradient along Y (for horizontal beams)
  v: HTMLCanvasElement; // 128x8 gradient along X (for vertical beams)
}

interface BeamSpriteAtlas {
  colors: Record<GlowKey, BeamSpritePair>;
  whiteCore: BeamSpritePair;
}

let cachedBeamSprites: BeamSpriteAtlas | null = null;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(255,255,255,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getBeamSprites(): BeamSpriteAtlas | null {
  if (typeof document === 'undefined') return null;
  if (cachedBeamSprites) return cachedBeamSprites;

  const makePair = (
    drawGradient: (ctx: CanvasRenderingContext2D, grad: CanvasGradient) => void,
    span = 128
  ): BeamSpritePair => {
    // Horizontal beam strip: 8px wide, `span` px tall (gradient vertically)
    const ch = document.createElement('canvas');
    ch.width = 8;
    ch.height = span;
    const hctx = ch.getContext('2d');
    if (hctx) {
      const grad = hctx.createLinearGradient(0, 0, 0, span);
      drawGradient(hctx, grad);
      hctx.fillStyle = grad;
      hctx.fillRect(0, 0, 8, span);
    }

    // Vertical beam strip: `span` px wide, 8px tall (gradient horizontally)
    const cv = document.createElement('canvas');
    cv.width = span;
    cv.height = 8;
    const vctx = cv.getContext('2d');
    if (vctx) {
      const grad = vctx.createLinearGradient(0, 0, span, 0);
      drawGradient(vctx, grad);
      vctx.fillStyle = grad;
      vctx.fillRect(0, 0, span, 8);
    }

    return { h: ch, v: cv };
  };

  const makeColorBeam = (glowHex: string, mainHex: string): BeamSpritePair =>
    makePair((_ctx, grad) => {
      // Wide soft outer low-opacity glow -> crisp white-to-transparent edge -> bright white alpha=1 core
      grad.addColorStop(0.0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.14, hexToRgba(glowHex, 0.16));
      grad.addColorStop(0.26, hexToRgba(mainHex, 0.34));
      grad.addColorStop(0.35, 'rgba(255,255,255,0.72)');
      grad.addColorStop(0.42, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,1)');
      grad.addColorStop(0.58, 'rgba(255,255,255,1)');
      grad.addColorStop(0.65, 'rgba(255,255,255,0.72)');
      grad.addColorStop(0.74, hexToRgba(mainHex, 0.34));
      grad.addColorStop(0.86, hexToRgba(glowHex, 0.16));
      grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    }, 128);

  const colors = {} as Record<GlowKey, BeamSpritePair>;
  colors.white = makeColorBeam('#e0f4ff', '#bfe8ff');
  for (const color of ALL_COLORS) {
    const palette = CANDY_HEX[color];
    colors[color] = makeColorBeam(palette.glow, palette.main);
  }

  // Dedicated pure-white alpha=1 core with silky white-to-transparent edge ramp (drawn source-over for HD contrast)
  const whiteCore = makePair((_ctx, grad) => {
    grad.addColorStop(0.0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.24, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.36, 'rgba(255,255,255,1)');
    grad.addColorStop(0.64, 'rgba(255,255,255,1)');
    grad.addColorStop(0.76, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  }, 64);

  cachedBeamSprites = { colors, whiteCore };
  return cachedBeamSprites;
}

function createParticlePool(): PooledParticle[] {
  const pool: PooledParticle[] = new Array(PARTICLE_POOL_SIZE);
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#ffffff',
      glowKey: 'white',
      life: 0,
      maxLife: 0.4,
      shape: SHAPE_CIRCLE,
      rotation: 0,
      vRot: 0,
      gravity: 0.48,
    };
  }
  return pool;
}

function createBeamPool(): PooledBeam[] {
  const pool: PooledBeam[] = new Array(BEAM_POOL_SIZE);
  for (let i = 0; i < BEAM_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      horizontal: true,
      index: 0,
      originCell: 3.5,
      color: '#ffffff',
      glow: '#ffffff',
      glowKey: 'white',
      elapsed: 0,
      travelDuration: 0.36,
      fadeDuration: BEAM_FADE_DURATION_SEC,
      perCellSec: 0.045,
      sparkleAccum: 0,
    };
  }
  return pool;
}

function createPopFlashPool(): PooledPopFlash[] {
  const pool: PooledPopFlash[] = new Array(POP_FLASH_POOL_SIZE);
  for (let i = 0; i < POP_FLASH_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0.5,
      y: 0.5,
      life: 0,
      maxLife: 0.12,
    };
  }
  return pool;
}

function createShockwavePool(): PooledShockwave[] {
  const pool: PooledShockwave[] = new Array(SHOCKWAVE_POOL_SIZE);
  for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0.5,
      y: 0.5,
      maxRadius: 2,
      color: '#ffffff',
      glowKey: 'white',
      life: 0,
      maxLife: 0.35,
    };
  }
  return pool;
}

function createArcPool(): PooledLightningArc[] {
  const pool: PooledLightningArc[] = new Array(ARC_POOL_SIZE);
  for (let i = 0; i < ARC_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      color: '#ffffff',
      life: 0,
      maxLife: 0.28,
      segments: MAX_LIGHTNING_SEGMENTS_HIGH,
      jitter: new Float32Array(MAX_LIGHTNING_SEGMENTS_HIGH + 1),
    };
  }
  return pool;
}

function createGlowPool(): PooledSpecialGlow[] {
  const pool: PooledSpecialGlow[] = new Array(GLOW_POOL_SIZE);
  for (let i = 0; i < GLOW_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0.5,
      y: 0.5,
      radiusCells: 1.5,
      glowKey: 'white',
      life: 0,
      maxLife: 0.3,
    };
  }
  return pool;
}

function createScorePool(): PooledFloatScore[] {
  const pool: PooledFloatScore[] = new Array(SCORE_POOL_SIZE);
  for (let i = 0; i < SCORE_POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0.5,
      y: 0.5,
      text: '',
      color: '#ffffff',
      life: 0,
      maxLife: 0.85,
    };
  }
  return pool;
}

export const VfxCanvas = forwardRef<VfxCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  // Pre-allocated object pools (zero GC allocation during animation frames)
  const particlesRef = useRef<PooledParticle[]>(createParticlePool());
  const beamsRef = useRef<PooledBeam[]>(createBeamPool());
  const shockwavesRef = useRef<PooledShockwave[]>(createShockwavePool());
  const arcsRef = useRef<PooledLightningArc[]>(createArcPool());
  const glowsRef = useRef<PooledSpecialGlow[]>(createGlowPool());
  const popFlashesRef = useRef<PooledPopFlash[]>(createPopFlashPool());
  const scoresRef = useRef<PooledFloatScore[]>(createScorePool());

  const activeParticlesRef = useRef<number>(0);
  const particleCursorRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Sync backing store size via ResizeObserver (never call getBoundingClientRect inside rAF)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    ctxRef.current = ctx;

    const syncSize = (cssW: number, cssH: number) => {
      const w = Math.max(1, Math.round(cssW));
      const h = Math.max(1, Math.round(cssH));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prev = sizeRef.current;
      if (prev.w === w && prev.h === h && prev.dpr === dpr) return;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const rect = canvas.getBoundingClientRect();
    syncSize(rect.width, rect.height);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          syncSize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      ro.observe(canvas);
    }

    const onWinResize = () => {
      const r = canvas.getBoundingClientRect();
      syncSize(r.width, r.height);
    };
    window.addEventListener('resize', onWinResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      reportLiveParticleCount(0);
    };
  }, []);

  const spawnParticle = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    color: string,
    glowKey: GlowKey,
    life: number,
    shape: number,
    rotation: number,
    vRot: number,
    maxLive: number,
    gravity = 0.48
  ) => {
    if (activeParticlesRef.current >= maxLive) return;
    const pool = particlesRef.current;
    let cursor = particleCursorRef.current;
    for (let step = 0; step < PARTICLE_POOL_SIZE; step++) {
      const slot = pool[cursor];
      cursor = (cursor + 1) % PARTICLE_POOL_SIZE;
      if (!slot.active) {
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.vx = vx;
        slot.vy = vy;
        slot.size = size;
        slot.color = color;
        slot.glowKey = glowKey;
        slot.life = life;
        slot.maxLife = life;
        slot.shape = shape;
        slot.rotation = rotation;
        slot.vRot = vRot;
        slot.gravity = gravity;
        activeParticlesRef.current += 1;
        particleCursorRef.current = cursor;
        return;
      }
    }
  };

  const spawnBeam = (
    horizontal: boolean,
    index: number,
    originCell: number,
    color: string,
    glow: string,
    glowKey: GlowKey,
    perCellMs: number
  ) => {
    const pool = beamsRef.current;
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      const b = pool[i];
      if (!b.active) {
        const maxCells = Math.max(originCell + 0.5, GRID_SIZE - (originCell + 0.5));
        const perCellSec = Math.max(0.015, perCellMs / 1000);
        b.active = true;
        b.horizontal = horizontal;
        b.index = index;
        b.originCell = originCell;
        b.color = color;
        b.glow = glow;
        b.glowKey = glowKey;
        b.elapsed = 0;
        b.perCellSec = perCellSec;
        b.travelDuration = Math.max(0.12, maxCells * perCellSec);
        b.fadeDuration = BEAM_FADE_DURATION_SEC;
        b.sparkleAccum = 0;
        return;
      }
    }
  };

  const spawnPopFlash = (x: number, y: number, durationMs = 120) => {
    const pool = popFlashesRef.current;
    let target = pool[0];
    let minLife = Infinity;
    for (let i = 0; i < POP_FLASH_POOL_SIZE; i++) {
      const f = pool[i];
      if (!f.active) {
        target = f;
        break;
      }
      if (f.life < minLife) {
        minLife = f.life;
        target = f;
      }
    }
    const sec = Math.max(0.08, durationMs / 1000);
    target.active = true;
    target.x = x;
    target.y = y;
    target.life = sec;
    target.maxLife = sec;
  };

  const spawnShockwave = (
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    glowKey: GlowKey,
    durationMs = 350
  ) => {
    const pool = shockwavesRef.current;
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const sw = pool[i];
      if (!sw.active) {
        const sec = Math.max(0.14, durationMs / 1000);
        sw.active = true;
        sw.x = x;
        sw.y = y;
        sw.maxRadius = maxRadius;
        sw.color = color;
        sw.glowKey = glowKey;
        sw.life = sec;
        sw.maxLife = sec;
        return;
      }
    }
  };

  const spawnArc = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    isLow: boolean,
    durationMs = 260
  ) => {
    const pool = arcsRef.current;
    for (let i = 0; i < ARC_POOL_SIZE; i++) {
      const arc = pool[i];
      if (!arc.active) {
        const sec = Math.max(0.12, durationMs / 1000);
        arc.active = true;
        arc.x1 = x1;
        arc.y1 = y1;
        arc.x2 = x2;
        arc.y2 = y2;
        arc.color = color;
        arc.life = sec;
        arc.maxLife = sec;
        const segs = isLow ? MAX_LIGHTNING_SEGMENTS_LOW : MAX_LIGHTNING_SEGMENTS_HIGH;
        arc.segments = segs;
        arc.jitter[0] = 0;
        arc.jitter[segs] = 0;
        for (let s = 1; s < segs; s++) {
          arc.jitter[s] = (Math.random() - 0.5) * (isLow ? 10 : 18);
        }
        return;
      }
    }
  };

  const spawnSpecialGlow = (
    x: number,
    y: number,
    radiusCells: number,
    glowKey: GlowKey,
    durationMs = 300
  ) => {
    const pool = glowsRef.current;
    for (let i = 0; i < GLOW_POOL_SIZE; i++) {
      const g = pool[i];
      if (!g.active) {
        const sec = Math.max(0.12, durationMs / 1000);
        g.active = true;
        g.x = x;
        g.y = y;
        g.radiusCells = radiusCells;
        g.glowKey = glowKey;
        g.life = sec;
        g.maxLife = sec;
        return;
      }
    }
  };

  const spawnFloatScore = (x: number, y: number, text: string, color: string) => {
    const pool = scoresRef.current;
    let target = pool[0];
    let minLife = Infinity;
    for (let i = 0; i < SCORE_POOL_SIZE; i++) {
      const s = pool[i];
      if (!s.active) {
        target = s;
        break;
      }
      if (s.life < minLife) {
        minLife = s.life;
        target = s;
      }
    }
    target.active = true;
    target.x = x;
    target.y = y;
    target.text = text;
    target.color = color;
    target.life = 0.85;
    target.maxLife = 0.85;
  };

  const ensureLoop = () => {
    if (rafRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - lastTimeRef.current) / 1000;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      lastTimeRef.current = now;

      const ctx = ctxRef.current;
      const { w, h, dpr } = sizeRef.current;
      if (!ctx || w <= 0 || h <= 0) {
        rafRef.current = null;
        return;
      }

      const isLow = getEffectiveEffectsQuality() === 'low';
      const maxLive = isLow ? MAX_LIVE_PARTICLES_LOW : MAX_LIVE_PARTICLES_HIGH;
      const allGlowSprites = getGlowSprites();
      const glowSprites = isLow ? null : allGlowSprites;
      const whiteSprite = allGlowSprites ? allGlowSprites.white : null;
      const beamSprites = getBeamSprites();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);

      const cellW = w / GRID_SIZE;
      const cellH = h / GRID_SIZE;

      let anyActive = false;

      // 0. Soft White Radial Pop Flashes (~120ms, covers popping cell smoothly until dropping candy arrives)
      const popFlashes = popFlashesRef.current;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < POP_FLASH_POOL_SIZE; i++) {
        const f = popFlashes[i];
        if (!f.active) continue;
        f.life -= dt;
        if (f.life <= 0) {
          f.active = false;
          continue;
        }
        anyActive = true;
        if (!whiteSprite) continue;

        const progress = 1 - f.life / f.maxLife;
        const alpha =
          progress < 0.22
            ? 0.55 + (progress / 0.22) * 0.35
            : Math.max(0, 0.9 * (1 - (progress - 0.22) / 0.78));
        const radius = cellW * (0.58 + progress * 0.28);
        ctx.globalAlpha = alpha;
        ctx.drawImage(whiteSprite, f.x * w - radius, f.y * h - radius, radius * 2, radius * 2);
      }

      // 1. Special Candy Glows (pre-rendered glow sprite blits, disabled in Low mode)
      const glows = glowsRef.current;
      for (let i = 0; i < GLOW_POOL_SIZE; i++) {
        const g = glows[i];
        if (!g.active) continue;
        g.life -= dt;
        if (g.life <= 0) {
          g.active = false;
          continue;
        }
        anyActive = true;
        if (!glowSprites) continue;

        const progress = 1 - g.life / g.maxLife;
        // Pulse brightly then fade out smoothly
        const pulse = progress < 0.35 ? progress / 0.35 : 1 - (progress - 0.35) / 0.65;
        const alpha = Math.max(0, Math.min(0.9, pulse * 0.9));
        const radius = cellW * g.radiusCells * (0.68 + progress * 0.45);
        const sprite = glowSprites[g.glowKey];
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, g.x * w - radius, g.y * h - radius, radius * 2, radius * 2);
      }

      // 2. Directional Expanding Beams (HD gradient sprites, pure white alpha=1 core, soft outer glow, racing sparkles, smooth +60ms fade)
      const beams = beamsRef.current;
      const sparkleInterval = isLow ? 0.055 : 0.026;
      for (let i = 0; i < BEAM_POOL_SIZE; i++) {
        const b = beams[i];
        if (!b.active) continue;
        b.elapsed += dt;
        const totalDur = b.travelDuration + b.fadeDuration;
        if (b.elapsed >= totalDur) {
          b.active = false;
          continue;
        }
        anyActive = true;

        const reachCells = b.elapsed / b.perCellSec;
        const rawFade =
          b.elapsed <= b.travelDuration
            ? 1
            : Math.max(0, 1 - (b.elapsed - b.travelDuration) / b.fadeDuration);
        const alpha = rawFade < 1 ? Math.pow(rawFade, 1.35) : 1;

        if (b.horizontal) {
          const cy = (b.index + 0.5) * cellH;
          const originX = (b.originCell + 0.5) * cellW;
          const reachPx = reachCells * cellW;
          const xStart = Math.max(0, originX - reachPx);
          const xEnd = Math.min(w, originX + reachPx);
          const span = Math.max(2, xEnd - xStart);

          const fullGlowThickness = cellH * BEAM_THICKNESS * 2.1;
          const coreThickness = cellH * BEAM_THICKNESS * 0.44;

          if (beamSprites) {
            // Outer low-opacity glow + soft gradient edge layer (additive)
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = alpha * (isLow ? 0.72 : 0.94);
            ctx.drawImage(
              beamSprites.colors[b.glowKey].h,
              xStart,
              cy - fullGlowThickness * 0.5,
              span,
              fullGlowThickness
            );

            // Pure bright white center core (alpha=1) with silky white-to-transparent edge ramp
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = alpha;
            ctx.drawImage(
              beamSprites.whiteCore.h,
              xStart,
              cy - coreThickness * 0.5,
              span,
              coreThickness
            );
            ctx.globalCompositeOperation = 'lighter';
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(xStart, cy - coreThickness * 0.35, span, coreThickness * 0.7);
          }

          // Racing tiny sparkle particles along horizontal beam
          if (b.elapsed <= b.travelDuration + 0.06) {
            b.sparkleAccum += dt;
            if (b.sparkleAccum >= sparkleInterval) {
              b.sparkleAccum -= sparkleInterval;
              const yNorm = (cy + (Math.random() - 0.5) * cellH * BEAM_THICKNESS * 0.75) / h;
              const dir = Math.random() < 0.5 ? -1 : 1;
              const edgeX = dir < 0 ? xStart : xEnd;
              const alongX = (xStart + Math.random() * span) / w;
              const spawnX = Math.random() < 0.55 ? edgeX / w : alongX;
              spawnParticle(
                Math.max(0.01, Math.min(0.99, spawnX)),
                yNorm,
                dir * (0.28 + Math.random() * 0.38),
                (Math.random() - 0.5) * 0.09,
                2.5 + Math.random() * 2.0,
                '#ffffff',
                'white',
                0.2 + Math.random() * 0.14,
                SHAPE_STAR,
                Math.random() * Math.PI,
                (Math.random() - 0.5) * 12,
                maxLive,
                0.04
              );
            }
          }

          // Bright leading heads where beam strikes candies
          if (whiteSprite && b.elapsed <= b.travelDuration) {
            const headR = cellW * BEAM_THICKNESS * 1.28;
            ctx.globalAlpha = alpha * 0.95;
            if (xStart > 0) {
              ctx.drawImage(whiteSprite, xStart - headR, cy - headR, headR * 2, headR * 2);
            }
            if (xEnd < w) {
              ctx.drawImage(whiteSprite, xEnd - headR, cy - headR, headR * 2, headR * 2);
            }
          }
        } else {
          const cx = (b.index + 0.5) * cellW;
          const originY = (b.originCell + 0.5) * cellH;
          const reachPx = reachCells * cellH;
          const yStart = Math.max(0, originY - reachPx);
          const yEnd = Math.min(h, originY + reachPx);
          const span = Math.max(2, yEnd - yStart);

          const fullGlowThickness = cellW * BEAM_THICKNESS * 2.1;
          const coreThickness = cellW * BEAM_THICKNESS * 0.44;

          if (beamSprites) {
            // Outer low-opacity glow + soft gradient edge layer (additive)
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = alpha * (isLow ? 0.72 : 0.94);
            ctx.drawImage(
              beamSprites.colors[b.glowKey].v,
              cx - fullGlowThickness * 0.5,
              yStart,
              fullGlowThickness,
              span
            );

            // Pure bright white center core (alpha=1) with silky white-to-transparent edge ramp
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = alpha;
            ctx.drawImage(
              beamSprites.whiteCore.v,
              cx - coreThickness * 0.5,
              yStart,
              coreThickness,
              span
            );
            ctx.globalCompositeOperation = 'lighter';
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - coreThickness * 0.35, yStart, coreThickness * 0.7, span);
          }

          // Racing tiny sparkle particles along vertical beam
          if (b.elapsed <= b.travelDuration + 0.06) {
            b.sparkleAccum += dt;
            if (b.sparkleAccum >= sparkleInterval) {
              b.sparkleAccum -= sparkleInterval;
              const xNorm = (cx + (Math.random() - 0.5) * cellW * BEAM_THICKNESS * 0.75) / w;
              const dir = Math.random() < 0.5 ? -1 : 1;
              const edgeY = dir < 0 ? yStart : yEnd;
              const alongY = (yStart + Math.random() * span) / h;
              const spawnY = Math.random() < 0.55 ? edgeY / h : alongY;
              spawnParticle(
                xNorm,
                Math.max(0.01, Math.min(0.99, spawnY)),
                (Math.random() - 0.5) * 0.09,
                dir * (0.28 + Math.random() * 0.38),
                2.5 + Math.random() * 2.0,
                '#ffffff',
                'white',
                0.2 + Math.random() * 0.14,
                SHAPE_STAR,
                Math.random() * Math.PI,
                (Math.random() - 0.5) * 12,
                maxLive,
                0.04
              );
            }
          }

          if (whiteSprite && b.elapsed <= b.travelDuration) {
            const headR = cellH * BEAM_THICKNESS * 1.28;
            ctx.globalAlpha = alpha * 0.95;
            if (yStart > 0) {
              ctx.drawImage(whiteSprite, cx - headR, yStart - headR, headR * 2, headR * 2);
            }
            if (yEnd < h) {
              ctx.drawImage(whiteSprite, cx - headR, yEnd - headR, headR * 2, headR * 2);
            }
          }
        }
      }

      // 3. Lightning Arcs (Color Bomb — polyline <= 10 segments High / 5 segments Low, zero shadowBlur)
      const arcs = arcsRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < ARC_POOL_SIZE; i++) {
        const arc = arcs[i];
        if (!arc.active) continue;
        arc.life -= dt;
        if (arc.life <= 0) {
          arc.active = false;
          continue;
        }
        anyActive = true;

        const elapsedRatio = 1 - arc.life / arc.maxLife;
        // Zip quickly from origin to target over first 25% of lifetime, then crackle & fade
        const reach = Math.min(1, elapsedRatio / 0.22);
        const fade = arc.life / arc.maxLife;

        const x1 = arc.x1 * w;
        const y1 = arc.y1 * h;
        const x2 = x1 + (arc.x2 * w - x1) * reach;
        const y2 = y1 + (arc.y2 * h - y1) * reach;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const segs = arc.segments;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let s = 1; s < segs; s++) {
          const t = s / segs;
          const j = arc.jitter[s];
          ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
        }
        ctx.lineTo(x2, y2);

        ctx.globalAlpha = Math.min(1, fade * 1.15) * 0.88;
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = isLow ? 2.5 : 4.2;
        ctx.stroke();

        if (!isLow) {
          ctx.globalAlpha = Math.min(1, fade * 1.2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // 4. Shockwaves (Wrapped Candy, Color Bomb & >8 Multi-Candy Blast Ring)
      const waves = shockwavesRef.current;
      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
        const sw = waves[i];
        if (!sw.active) continue;
        sw.life -= dt;
        if (sw.life <= 0) {
          sw.active = false;
          continue;
        }
        anyActive = true;

        const t = 1 - sw.life / sw.maxLife;
        const cx = sw.x * w;
        const cy = sw.y * h;
        const radius = sw.maxRadius * cellW * (0.2 + 0.9 * t);

        if (glowSprites && t < 0.55) {
          const gRad = radius * 1.15;
          ctx.globalAlpha = (1 - t / 0.55) * 0.45;
          ctx.drawImage(glowSprites[sw.glowKey], cx - gRad, cy - gRad, gRad * 2, gRad * 2);
        }

        ctx.globalAlpha = (1 - t) * 0.88;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 5 * (1 - t) + 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (!isLow) {
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }

      // 5. Particles (Pooled, max 80 High / 40 Low, ZERO shadowBlur, zero per-particle save/restore)
      const particles = particlesRef.current;
      let liveCount = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        liveCount += 1;
        anyActive = true;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.rotation += p.vRot * dt;

        const alpha = p.life / p.maxLife;
        const px = p.x * w;
        const py = p.y * h;

        if (p.shape === SHAPE_STAR) {
          if (glowSprites) {
            const gs = p.size * 2.2;
            ctx.globalAlpha = alpha * 0.65;
            ctx.drawImage(glowSprites[p.glowKey], px - gs, py - gs, gs * 2, gs * 2);
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ffffff';
          const cos = Math.cos(p.rotation);
          const sin = Math.sin(p.rotation);
          const rOut = p.size * 1.25;
          const rIn = p.size * 0.36;
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const a1 = (k * Math.PI) / 2;
            const a2 = a1 + Math.PI / 4;
            const ox = Math.cos(a1) * rOut;
            const oy = Math.sin(a1) * rOut;
            const ix = Math.cos(a2) * rIn;
            const iy = Math.sin(a2) * rIn;
            const rx1 = px + ox * cos - oy * sin;
            const ry1 = py + ox * sin + oy * cos;
            const rx2 = px + ix * cos - iy * sin;
            const ry2 = py + ix * sin + iy * cos;
            if (k === 0) ctx.moveTo(rx1, ry1);
            else ctx.lineTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === SHAPE_SHARD) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          const half = p.size * 0.5;
          ctx.fillRect(px - half, py - half * 0.68, p.size, p.size * 0.68);
        } else {
          if (glowSprites) {
            const gs = p.size * 1.75;
            ctx.globalAlpha = alpha * 0.52;
            ctx.drawImage(glowSprites[p.glowKey], px - gs, py - gs, gs * 2, gs * 2);
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.58, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      activeParticlesRef.current = liveCount;
      reportLiveParticleCount(liveCount);

      // 6. Floating Score Popups (drawn on single canvas — zero DOM nodes, zero React re-renders)
      const scores = scoresRef.current;
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = Math.max(17, Math.min(24, Math.round(cellW * 0.42)));
      ctx.font = `800 ${fontSize}px 'Baloo 2', 'Nunito', system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0f172a';
      for (let i = 0; i < SCORE_POOL_SIZE; i++) {
        const s = scores[i];
        if (!s.active) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.active = false;
          continue;
        }
        anyActive = true;

        const t = 1 - s.life / s.maxLife;
        const alpha = t < 0.16 ? t / 0.16 : t > 0.78 ? (1 - t) / 0.22 : 1;
        const sx = s.x * w;
        const sy = s.y * h - t * cellH * 1.15;

        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.strokeText(s.text, sx, sy);
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, sx, sy);
      }

      ctx.globalAlpha = 1;

      if (anyActive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    emitEvents(events: VfxEvent[]) {
      if (events.length === 0) return;

      const isLow = getEffectiveEffectsQuality() === 'low';
      const maxLive = isLow ? MAX_LIVE_PARTICLES_LOW : MAX_LIVE_PARTICLES_HIGH;

      let burstCount = 0;
      let sumRow = 0;
      let sumCol = 0;
      let firstBurstColor: CandyColor = 'yellow';
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'burst') {
          if (burstCount === 0) firstBurstColor = ev.color;
          burstCount += 1;
          sumRow += ev.row;
          sumCol += ev.col;
        }
      }

      const isMassiveBatch = burstCount > 8;
      if (isMassiveBatch) {
        const avgCol = (sumCol / burstCount + 0.5) / GRID_SIZE;
        const avgRow = (sumRow / burstCount + 0.5) / GRID_SIZE;
        const palette = CANDY_HEX[firstBurstColor];
        spawnShockwave(avgCol, avgRow, 3.1, palette.glow, firstBurstColor, 350);
        if (!isLow) {
          spawnSpecialGlow(avgCol, avgRow, 2.4, firstBurstColor, 300);
        }
      }

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'burst') {
          const cx = (ev.col + 0.5) / GRID_SIZE;
          const cy = (ev.row + 0.5) / GRID_SIZE;
          const palette = CANDY_HEX[ev.color];

          let count: number;
          if (isMassiveBatch || ev.massiveBlast) {
            count = isLow ? 1 : 2;
          } else {
            const requested = ev.count ?? 3;
            const clampedHigh = Math.max(2, Math.min(4, requested));
            count = isLow ? Math.max(1, Math.floor(clampedHigh / 2)) : clampedHigh;
          }

          for (let k = 0; k < count; k++) {
            const angle = (Math.PI * 2 * k) / count + (Math.random() - 0.5) * 0.65;
            const speed = 0.16 + Math.random() * 0.34;
            const shape = k === 0 ? SHAPE_STAR : k % 2 === 0 ? SHAPE_SHARD : SHAPE_CIRCLE;
            spawnParticle(
              cx,
              cy,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed - 0.08,
              4.2 + Math.random() * 3.8,
              k === 0 ? '#ffffff' : palette.main,
              ev.color,
              0.36 + Math.random() * 0.18,
              shape,
              Math.random() * Math.PI * 2,
              (Math.random() - 0.5) * 9,
              maxLive
            );
          }
        } else if (ev.type === 'beam-h') {
          const palette = CANDY_HEX[ev.color];
          spawnBeam(
            true,
            ev.row,
            ev.originCol ?? 3.5,
            palette.main,
            palette.glow,
            ev.color,
            ev.perCellMs ?? 45
          );
        } else if (ev.type === 'beam-v') {
          const palette = CANDY_HEX[ev.color];
          spawnBeam(
            false,
            ev.col,
            ev.originRow ?? 3.5,
            palette.main,
            palette.glow,
            ev.color,
            ev.perCellMs ?? 45
          );
        } else if (ev.type === 'shockwave') {
          spawnShockwave(
            (ev.col + 0.5) / GRID_SIZE,
            (ev.row + 0.5) / GRID_SIZE,
            ev.radius ?? 2,
            CANDY_HEX[ev.color].glow,
            ev.color,
            ev.durationMs ?? 350
          );
        } else if (ev.type === 'lightning') {
          spawnArc(
            (ev.fromCol + 0.5) / GRID_SIZE,
            (ev.fromRow + 0.5) / GRID_SIZE,
            (ev.toCol + 0.5) / GRID_SIZE,
            (ev.toRow + 0.5) / GRID_SIZE,
            CANDY_HEX[ev.color].glow,
            isLow,
            ev.durationMs ?? 280
          );
        } else if (ev.type === 'special-glow') {
          if (!isLow) {
            spawnSpecialGlow(
              (ev.col + 0.5) / GRID_SIZE,
              (ev.row + 0.5) / GRID_SIZE,
              ev.radius ?? 1.6,
              ev.color,
              ev.durationMs ?? 300
            );
          }
        } else if (ev.type === 'pop-flash') {
          spawnPopFlash(
            (ev.col + 0.5) / GRID_SIZE,
            (ev.row + 0.5) / GRID_SIZE,
            ev.durationMs ?? 120
          );
        } else if (ev.type === 'swap-trail') {
          const palette = CANDY_HEX[ev.color];
          const steps = isLow ? 2 : 3;
          for (let k = 0; k < steps; k++) {
            const t = (k + 0.5) / steps;
            const x = (ev.fromCol + (ev.toCol - ev.fromCol) * t + 0.5) / GRID_SIZE;
            const y = (ev.fromRow + (ev.toRow - ev.fromRow) * t + 0.5) / GRID_SIZE;
            spawnParticle(
              x,
              y,
              (Math.random() - 0.5) * 0.06,
              (Math.random() - 0.5) * 0.06,
              3.8 + Math.random() * 2,
              k % 2 === 0 ? '#ffffff' : palette.glow,
              ev.color,
              0.22,
              SHAPE_STAR,
              Math.random() * Math.PI,
              4,
              maxLive
            );
          }
        } else if (ev.type === 'float-score') {
          spawnFloatScore(
            (ev.col + 0.5) / GRID_SIZE,
            (ev.row + 0.5) / GRID_SIZE,
            ev.text,
            ev.color
          );
        }
      }

      ensureLoop();
    },
    clear() {
      const particles = particlesRef.current;
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) particles[i].active = false;
      const beams = beamsRef.current;
      for (let i = 0; i < BEAM_POOL_SIZE; i++) beams[i].active = false;
      const waves = shockwavesRef.current;
      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) waves[i].active = false;
      const arcs = arcsRef.current;
      for (let i = 0; i < ARC_POOL_SIZE; i++) arcs[i].active = false;
      const glows = glowsRef.current;
      for (let i = 0; i < GLOW_POOL_SIZE; i++) glows[i].active = false;
      const popFlashes = popFlashesRef.current;
      for (let i = 0; i < POP_FLASH_POOL_SIZE; i++) popFlashes[i].active = false;
      const scores = scoresRef.current;
      for (let i = 0; i < SCORE_POOL_SIZE; i++) scores[i].active = false;

      activeParticlesRef.current = 0;
      reportLiveParticleCount(0);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const ctx = ctxRef.current;
      const { w, h, dpr } = sizeRef.current;
      if (ctx && w > 0 && h > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-20"
      aria-hidden="true"
    />
  );
});

VfxCanvas.displayName = 'VfxCanvas';
