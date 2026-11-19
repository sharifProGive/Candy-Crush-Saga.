import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CANDY_HEX } from '../game/levels';
import { GRID_SIZE } from '../game/matchEngine';
import { VfxEvent } from '../game/types';

export interface VfxCanvasHandle {
  emitEvents: (events: VfxEvent[]) => void;
  clear: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  glow: string;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'shard';
  rotation: number;
  vRot: number;
}

interface Beam {
  horizontal: boolean;
  index: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

export const VfxCanvas = forwardRef<VfxCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const arcsRef = useRef<LightningArc[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const ensureLoop = () => {
    if (rafRef.current !== null) return;
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - lastTimeRef.current) / 1000;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      lastTimeRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = null;
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(1, Math.round(rect.width * dpr));
      const targetH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = null;
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cellW = rect.width / GRID_SIZE;
      const cellH = rect.height / GRID_SIZE;

      // 1. Beams (Striped Candy Neon/Rainbow Laser Trails)
      const nextBeams: Beam[] = [];
      for (const b of beamsRef.current) {
        b.life -= dt;
        if (b.life <= 0) continue;
        nextBeams.push(b);

        const alpha = Math.min(1, b.life / b.maxLife);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;

        if (b.horizontal) {
          const cy = (b.index + 0.5) * cellH;
          const grad = ctx.createLinearGradient(0, cy - cellH * 0.45, 0, cy + cellH * 0.45);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.25, b.color);
          grad.addColorStop(0.5, '#ffffff');
          grad.addColorStop(0.75, b.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, cy - cellH * 0.45, rect.width, cellH * 0.9);
        } else {
          const cx = (b.index + 0.5) * cellW;
          const grad = ctx.createLinearGradient(cx - cellW * 0.45, 0, cx + cellW * 0.45, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.25, b.color);
          grad.addColorStop(0.5, '#ffffff');
          grad.addColorStop(0.75, b.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(cx - cellW * 0.45, 0, cellW * 0.9, rect.height);
        }
        ctx.restore();
      }
      beamsRef.current = nextBeams;

      // 2. Lightning Arcs (Color Bomb Beams)
      const nextArcs: LightningArc[] = [];
      for (const arc of arcsRef.current) {
        arc.life -= dt;
        if (arc.life <= 0) continue;
        nextArcs.push(arc);

        const progress = arc.life / arc.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = progress;
        ctx.strokeStyle = arc.color;
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const x1 = arc.x1 * rect.width;
        const y1 = arc.y1 * rect.height;
        const x2 = arc.x2 * rect.width;
        const y2 = arc.y2 * rect.height;
        ctx.moveTo(x1, y1);
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 26;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 26;
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }
      arcsRef.current = nextArcs;

      // 3. Shockwaves (Wrapped Candy & Bomb Rings)
      const nextWaves: Shockwave[] = [];
      for (const sw of shockwavesRef.current) {
        sw.life -= dt;
        if (sw.life <= 0) continue;
        nextWaves.push(sw);

        const t = 1 - sw.life / sw.maxLife;
        const radius = sw.maxRadius * cellW * (0.25 + 0.9 * t);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 6 * (1 - t) + 1.5;
        ctx.beginPath();
        ctx.arc(sw.x * rect.width, sw.y * rect.height, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      shockwavesRef.current = nextWaves;

      // 4. Particles (Candy shards, sparkles, starbursts)
      const nextParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life -= dt;
        if (p.life <= 0) continue;
        nextParticles.push(p);

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.42 * dt; // subtle gravity
        p.rotation += p.vRot * dt;

        const alpha = Math.max(0, p.life / p.maxLife);
        const px = p.x * rect.width;
        const py = p.y * rect.height;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'lighter';

        if (p.shape === 'star') {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            ctx.lineTo(Math.cos(angle) * p.size * 1.4, Math.sin(angle) * p.size * 1.4);
            ctx.lineTo(
              Math.cos(angle + Math.PI / 4) * p.size * 0.42,
              Math.sin(angle + Math.PI / 4) * p.size * 0.42
            );
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'shard') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      particlesRef.current = nextParticles;

      ctx.restore();

      if (
        particlesRef.current.length > 0 ||
        beamsRef.current.length > 0 ||
        shockwavesRef.current.length > 0 ||
        arcsRef.current.length > 0
      ) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useImperativeHandle(ref, () => ({
    emitEvents(events: VfxEvent[]) {
      for (const ev of events) {
        if (ev.type === 'burst') {
          const cx = (ev.col + 0.5) / GRID_SIZE;
          const cy = (ev.row + 0.5) / GRID_SIZE;
          const palette = CANDY_HEX[ev.color];
          const count = ev.count ?? 12;
          for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 0.14 + Math.random() * 0.38;
            particlesRef.current.push({
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.08,
              size: 4 + Math.random() * 5,
              color: i % 3 === 0 ? '#ffffff' : palette.main,
              glow: palette.glow,
              life: 0.42 + Math.random() * 0.25,
              maxLife: 0.65,
              shape: i % 3 === 0 ? 'star' : i % 2 === 0 ? 'shard' : 'circle',
              rotation: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 10,
            });
          }
        } else if (ev.type === 'beam-h') {
          beamsRef.current.push({
            horizontal: true,
            index: ev.row,
            color: CANDY_HEX[ev.color].main,
            life: 0.34,
            maxLife: 0.34,
          });
        } else if (ev.type === 'beam-v') {
          beamsRef.current.push({
            horizontal: false,
            index: ev.col,
            color: CANDY_HEX[ev.color].main,
            life: 0.34,
            maxLife: 0.34,
          });
        } else if (ev.type === 'shockwave') {
          shockwavesRef.current.push({
            x: (ev.col + 0.5) / GRID_SIZE,
            y: (ev.row + 0.5) / GRID_SIZE,
            maxRadius: ev.radius ?? 2,
            color: CANDY_HEX[ev.color].glow,
            life: 0.4,
            maxLife: 0.4,
          });
        } else if (ev.type === 'lightning') {
          arcsRef.current.push({
            x1: (ev.fromCol + 0.5) / GRID_SIZE,
            y1: (ev.fromRow + 0.5) / GRID_SIZE,
            x2: (ev.toCol + 0.5) / GRID_SIZE,
            y2: (ev.toRow + 0.5) / GRID_SIZE,
            color: CANDY_HEX[ev.color].glow,
            life: 0.36,
            maxLife: 0.36,
          });
        } else if (ev.type === 'swap-trail') {
          const palette = CANDY_HEX[ev.color];
          const steps = 6;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = ((ev.fromCol + (ev.toCol - ev.fromCol) * t) + 0.5) / GRID_SIZE;
            const y = ((ev.fromRow + (ev.toRow - ev.fromRow) * t) + 0.5) / GRID_SIZE;
            particlesRef.current.push({
              x,
              y,
              vx: (Math.random() - 0.5) * 0.08,
              vy: (Math.random() - 0.5) * 0.08,
              size: 4 + Math.random() * 3,
              color: i % 2 === 0 ? '#ffffff' : palette.glow,
              glow: palette.main,
              life: 0.25,
              maxLife: 0.25,
              shape: 'star',
              rotation: Math.random() * Math.PI,
              vRot: 5,
            });
          }
        }
      }
      ensureLoop();
    },
    clear() {
      particlesRef.current = [];
      beamsRef.current = [];
      shockwavesRef.current = [];
      arcsRef.current = [];
    },
  }));

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-20"
      aria-hidden="true"
    />
  );
});

VfxCanvas.displayName = 'VfxCanvas';
