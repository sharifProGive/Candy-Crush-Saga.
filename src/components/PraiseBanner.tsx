import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { PraiseWord } from '../game/types';

export interface PraiseBannerHandle {
  show: (word: PraiseWord, reducedMotion?: boolean) => void;
  clear: () => void;
}

/**
 * Isolated imperative praise banner ("Sweet!", "Delicious!", "Sugar Crush!").
 * Renders strictly one banner at a time using pure transform + opacity WAAPI,
 * causing ZERO re-renders of GameBoard or its 64 tiles.
 */
export const PraiseBanner = forwardRef<PraiseBannerHandle>((_, ref) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    return () => {
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    show(word: PraiseWord, reducedMotion = false) {
      const wrap = wrapRef.current;
      const text = textRef.current;
      if (!wrap || !text) return;

      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }

      text.textContent = word;
      wrap.style.visibility = 'visible';
      wrap.style.willChange = 'transform, opacity';

      if (typeof wrap.animate !== 'function') {
        wrap.style.opacity = '1';
        window.setTimeout(() => {
          if (wrapRef.current) {
            wrapRef.current.style.opacity = '0';
            wrapRef.current.style.visibility = 'hidden';
            wrapRef.current.style.willChange = '';
          }
        }, 900);
        return;
      }

      const keyframes: Keyframe[] = reducedMotion
        ? [
            { transform: 'translate3d(-50%, -50%, 0)', opacity: 0 },
            { transform: 'translate3d(-50%, -50%, 0)', opacity: 1, offset: 0.16 },
            { transform: 'translate3d(-50%, -50%, 0)', opacity: 1, offset: 0.82 },
            { transform: 'translate3d(-50%, -50%, 0)', opacity: 0 },
          ]
        : [
            { transform: 'translate3d(-50%, -32%, 0)', opacity: 0 },
            { transform: 'translate3d(-50%, -56%, 0)', opacity: 1, offset: 0.2 },
            { transform: 'translate3d(-50%, -50%, 0)', opacity: 1, offset: 0.38 },
            { transform: 'translate3d(-50%, -58%, 0)', opacity: 1, offset: 0.8 },
            { transform: 'translate3d(-50%, -84%, 0)', opacity: 0 },
          ];

      const anim = wrap.animate(keyframes, {
        duration: reducedMotion ? 900 : 1200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      });
      animRef.current = anim;

      const finish = () => {
        if (animRef.current === anim) {
          animRef.current = null;
          if (wrapRef.current) {
            wrapRef.current.style.visibility = 'hidden';
            wrapRef.current.style.willChange = '';
          }
        }
      };
      anim.finished.then(finish, finish);
    },
    clear() {
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
      if (wrapRef.current) {
        wrapRef.current.style.visibility = 'hidden';
        wrapRef.current.style.opacity = '0';
        wrapRef.current.style.willChange = '';
      }
    },
  }));

  return (
    <div
      ref={wrapRef}
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-1/2 z-40"
      style={{
        visibility: 'hidden',
        opacity: 0,
        transform: 'translate3d(-50%, -50%, 0)',
      }}
    >
      <div
        ref={textRef}
        className="font-settings-heading font-extrabold text-3xl sm:text-5xl text-[#ffe347] text-stroke-gold whitespace-nowrap"
      />
    </div>
  );
});

PraiseBanner.displayName = 'PraiseBanner';
