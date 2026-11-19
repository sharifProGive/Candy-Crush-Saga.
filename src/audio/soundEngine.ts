import { PraiseWord } from '../game/types';

export type MusicTrack = 'lobby' | 'gameplay' | 'none';

export type VoiceClipKey =
  | 'sweet'
  | 'delicious'
  | 'tasty'
  | 'divine'
  | 'sugar_crush'
  | 'fantastic'
  | 'marvelous'
  | 'excellent'
  | 'incredible'
  | 'ultimate'
  | 'awesome'
  | 'combo'
  | 'color_bomb'
  | 'wrapped_candy'
  | 'striped_candy';

const TRACK_URLS: Record<Exclude<MusicTrack, 'none'>, string> = {
  lobby: './assets/aistudio/1_5597b470.mp3',
  gameplay: './assets/aistudio/2_e94f2a79.mp3',
};

const VOICE_CLIP_URLS: Record<VoiceClipKey, string> = {
  sweet: './assets/audio/voice/sweet.mp3',
  delicious: './assets/audio/voice/delicious.mp3',
  tasty: './assets/audio/voice/tasty.mp3',
  divine: './assets/audio/voice/divine.mp3',
  sugar_crush: './assets/audio/voice/sugar_crush.mp3',
  fantastic: './assets/audio/voice/fantastic.mp3',
  marvelous: './assets/audio/voice/marvelous.mp3',
  excellent: './assets/audio/voice/excellent.mp3',
  incredible: './assets/audio/voice/incredible.mp3',
  ultimate: './assets/audio/voice/ultimate.mp3',
  awesome: './assets/audio/voice/awesome.mp3',
  combo: './assets/audio/voice/combo.mp3',
  color_bomb: './assets/audio/voice/color_bomb.mp3',
  wrapped_candy: './assets/audio/voice/wrapped_candy.mp3',
  striped_candy: './assets/audio/voice/striped_candy.mp3',
};

const PRAISE_TO_CLIP: Record<PraiseWord, VoiceClipKey> = {
  'Sweet!': 'sweet',
  'Delicious!': 'delicious',
  'Tasty!': 'tasty',
  'Divine!': 'divine',
  'Sugar Crush!': 'sugar_crush',
  'Fantastic!': 'fantastic',
  'Marvelous!': 'marvelous',
  'Excellent!': 'excellent',
  'Incredible!': 'incredible',
  'Ultimate!': 'ultimate',
  'Awesome!': 'awesome',
  'Combo!': 'combo',
  'Color Bomb!': 'color_bomb',
  'Wrapped Candy!': 'wrapped_candy',
  'Striped Candy!': 'striped_candy',
};

const TARGET_BGM_VOLUME = 0.42;

class CandySoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private echoInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  // Custom MP3 Background Tracks (File 1: Home/Lobby, File 2: Gameplay)
  private tracks: Partial<Record<Exclude<MusicTrack, 'none'>, HTMLAudioElement>> = {};
  private desiredTrack: MusicTrack = 'none';
  private musicPaused = false;
  private unlockListenerAttached = false;
  private fadeTimers: Partial<Record<Exclude<MusicTrack, 'none'>, number>> = {};

  // Pre-fetched raw bytes and pre-decoded Web Audio buffers for zero-lag voice playback
  private rawVoiceBytes: Partial<Record<VoiceClipKey, ArrayBuffer>> = {};
  private decodedVoices: Partial<Record<VoiceClipKey, AudioBuffer>> = {};
  private voicePreloadStarted = false;
  private voiceDecodeStarted = false;
  private activeVoiceSource: AudioBufferSourceNode | null = null;

  // Strict Voice-Over Cooldown Tracking
  private lastVoiceTime = 0;
  private lastPhraseTime: Partial<Record<PraiseWord, number>> = {};
  private lastSpokenPhrase: PraiseWord | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.9;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;
      this.voiceGain.connect(this.masterGain);

      // Warm Echo / Delay Bus (lowpassed so echoes are soft & dreamy, never metallic)
      this.echoInput = this.ctx.createGain();
      this.echoInput.gain.value = 0.34;

      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.145;

      const echoFilter = this.ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = 1150;

      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.28;

      this.echoInput.connect(delay);
      delay.connect(echoFilter);
      echoFilter.connect(this.masterGain);
      echoFilter.connect(feedback);
      feedback.connect(delay);

      // Pre-generate 1-second pink-tinted noise buffer for magical swooshes
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < sampleRate; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      }
      this.noiseBuffer = buffer;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.voiceDecodeStarted) {
      this.decodeAllVoices();
    }
    return this.ctx;
  }

  public preloadVoiceClips(): void {
    if (typeof window === 'undefined' || this.voicePreloadStarted) return;
    this.voicePreloadStarted = true;

    (Object.keys(VOICE_CLIP_URLS) as VoiceClipKey[]).forEach((key) => {
      fetch(VOICE_CLIP_URLS[key])
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => {
          if (!buf) return;
          this.rawVoiceBytes[key] = buf;
          if (this.ctx && !this.decodedVoices[key]) {
            this.decodeSingleVoice(key, buf);
          }
        })
        .catch(() => {});
    });
  }

  private decodeAllVoices(): void {
    if (!this.ctx) return;
    this.voiceDecodeStarted = true;
    (Object.keys(this.rawVoiceBytes) as VoiceClipKey[]).forEach((key) => {
      const buf = this.rawVoiceBytes[key];
      if (buf && !this.decodedVoices[key]) {
        this.decodeSingleVoice(key, buf);
      }
    });
  }

  private decodeSingleVoice(key: VoiceClipKey, arrayBuffer: ArrayBuffer): void {
    if (!this.ctx) return;
    const copy = arrayBuffer.slice(0);
    this.ctx
      .decodeAudioData(copy)
      .then((audioBuf) => {
        this.decodedVoices[key] = audioBuf;
      })
      .catch(() => {});
  }

  private getOrCreateAudio(key: Exclude<MusicTrack, 'none'>): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.tracks[key]) {
      const audio = new Audio(TRACK_URLS[key]);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      audio.muted = this.muted;
      this.tracks[key] = audio;
    }
    return this.tracks[key]!;
  }

  private clearFade(key: Exclude<MusicTrack, 'none'>): void {
    const t = this.fadeTimers[key];
    if (t !== undefined) {
      window.clearInterval(t);
      delete this.fadeTimers[key];
    }
  }

  private fadeAudioTo(
    key: Exclude<MusicTrack, 'none'>,
    targetVol: number,
    durationMs: number,
    onDone?: () => void
  ): void {
    const audio = this.tracks[key];
    if (!audio) {
      onDone?.();
      return;
    }
    this.clearFade(key);

    const startVol = audio.volume;
    const steps = Math.max(1, Math.round(durationMs / 25));
    let step = 0;

    this.fadeTimers[key] = window.setInterval(() => {
      step += 1;
      const progress = Math.min(1, step / steps);
      audio.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * progress));
      if (progress >= 1) {
        this.clearFade(key);
        onDone?.();
      }
    }, 25);
  }

  private attachUnlockListener(): void {
    if (this.unlockListenerAttached || typeof window === 'undefined') return;
    this.unlockListenerAttached = true;

    const handleFirstGesture = () => {
      this.unlock();
      if (this.desiredTrack !== 'none' && !this.musicPaused && !this.muted) {
        this.playTrackElement(this.desiredTrack);
      }
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      this.unlockListenerAttached = false;
    };

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
  }

  private playTrackElement(key: Exclude<MusicTrack, 'none'>): void {
    const audio = this.getOrCreateAudio(key);
    if (!audio) return;

    audio.muted = this.muted;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (this.desiredTrack === key && !this.musicPaused && !this.muted) {
            this.fadeAudioTo(key, TARGET_BGM_VOLUME, 420);
          }
        })
        .catch(() => {
          this.attachUnlockListener();
        });
    }
  }

  public unlock(): void {
    this.preloadVoiceClips();
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isMusicPaused(): boolean {
    return this.musicPaused;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.9, this.ctx.currentTime, 0.03);
    }

    (['lobby', 'gameplay'] as const).forEach((key) => {
      const audio = this.tracks[key];
      if (audio) {
        audio.muted = mute;
      }
    });

    if (mute && this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
      } catch {
        // ignore
      }
      this.activeVoiceSource = null;
    }

    if (!mute && this.desiredTrack !== 'none' && !this.musicPaused) {
      this.playTrackElement(this.desiredTrack);
    }
  }

  /**
   * Smoothly switches between 'lobby' (File 1) and 'gameplay' (File 2) custom MP3 tracks.
   */
  public setMusicTrack(track: MusicTrack): void {
    const previous = this.desiredTrack;
    this.desiredTrack = track;
    this.musicPaused = false;

    const otherKeys: Exclude<MusicTrack, 'none'>[] = ['lobby', 'gameplay'];
    for (const key of otherKeys) {
      if (key !== track) {
        const other = this.tracks[key];
        if (other && !other.paused) {
          this.fadeAudioTo(key, 0, 260, () => {
            other.pause();
            if (previous !== track) {
              other.currentTime = 0;
            }
          });
        }
      }
    }

    if (track === 'none') return;

    const targetAudio = this.getOrCreateAudio(track);
    if (!targetAudio) return;

    if (previous !== track) {
      targetAudio.currentTime = 0;
    }

    if (!this.muted) {
      if (targetAudio.paused) {
        this.playTrackElement(track);
      } else {
        this.fadeAudioTo(track, TARGET_BGM_VOLUME, 320);
      }
    }
  }

  public pauseMusic(): void {
    this.musicPaused = true;
    if (this.desiredTrack === 'none') return;
    const key = this.desiredTrack;
    const audio = this.tracks[key];
    if (audio && !audio.paused) {
      this.fadeAudioTo(key, 0, 180, () => {
        if (this.musicPaused) audio.pause();
      });
    }
  }

  public resumeMusic(): void {
    this.musicPaused = false;
    if (this.desiredTrack === 'none' || this.muted) return;
    this.playTrackElement(this.desiredTrack);
  }

  public stopMusic(): void {
    this.desiredTrack = 'none';
    this.musicPaused = false;
    (['lobby', 'gameplay'] as const).forEach((key) => {
      this.clearFade(key);
      const audio = this.tracks[key];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      }
    });
  }

  private playRoundedTone(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    dest: AudioNode,
    withEcho = false,
    cutoffHz = 1800,
    endFreq?: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);

    const attack = Math.min(0.016, duration * 0.25);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    if (withEcho && this.echoInput) {
      gain.connect(this.echoInput);
    }

    osc.start(startTime);
    osc.stop(startTime + duration + 0.025);
  }

  private playMagicSwoosh(
    startTime: number,
    duration: number,
    startHz: number,
    endHz: number,
    peakGain: number
  ): void {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(startHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(endHz, startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    if (this.echoInput) gain.connect(this.echoInput);

    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  public playTap(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(350, now, 0.085, 0.22, this.sfxGain, true, 1300, 560);
  }

  public playButton(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(440, now, 0.1, 0.18, this.sfxGain, true, 1400, 520);
    this.playRoundedTone(587.33, now + 0.045, 0.12, 0.16, this.sfxGain, true, 1500);
  }

  public playSwap(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(260, now, 0.11, 0.21, this.sfxGain, true, 980, 420);
    this.playRoundedTone(370, now + 0.045, 0.12, 0.15, this.sfxGain, true, 1020, 520);
  }

  public playInvalidSwap(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(240, now, 0.13, 0.18, this.sfxGain, true, 650, 145);
  }

  public playCascadeDrop(count = 3): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const steps = Math.max(2, Math.min(3, count));
    const bubbles: Array<{ delay: number; startHz: number; endHz: number; cutoff: number; gain: number }> = [
      { delay: 0, startHz: 240, endHz: 360, cutoff: 1050, gain: 0.11 },
      { delay: 0.045, startHz: 300, endHz: 430, cutoff: 1150, gain: 0.1 },
      { delay: 0.09, startHz: 350, endHz: 490, cutoff: 1250, gain: 0.09 },
    ];
    for (let i = 0; i < steps; i++) {
      const b = bubbles[i];
      this.playRoundedTone(
        b.startHz,
        now + b.delay,
        0.095,
        b.gain,
        this.sfxGain,
        true,
        b.cutoff,
        b.endHz
      );
    }
  }

  public playMatch(cascadeDepth: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const base = scale[Math.min(cascadeDepth - 1, scale.length - 1)];

    this.playRoundedTone(base, now, 0.16, 0.24, this.sfxGain, true, 1900, base * 1.12);
    this.playRoundedTone(base * 1.25, now + 0.04, 0.18, 0.18, this.sfxGain, true, 2000);
    this.playRoundedTone(base * 1.5, now + 0.08, 0.22, 0.14, this.sfxGain, true, 2200);
  }

  public playStriped(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playMagicSwoosh(now, 0.34, 420, 1900, 0.35);
    this.playRoundedTone(150, now, 0.28, 0.28, this.sfxGain, true, 480, 58);
    this.playRoundedTone(523.25, now + 0.03, 0.24, 0.16, this.sfxGain, true, 1800, 880);
  }

  public playWrapped(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(128, now, 0.44, 0.55, this.sfxGain, true, 260, 34);
    this.playRoundedTone(195, now, 0.24, 0.3, this.sfxGain, true, 420, 62);
    this.playMagicSwoosh(now + 0.02, 0.38, 1200, 240, 0.32);
  }

  public playColorBomb(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(115, now, 0.48, 0.45, this.sfxGain, true, 280, 38);
    this.playMagicSwoosh(now, 0.45, 350, 2200, 0.34);
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, idx) => {
      this.playRoundedTone(f, now + idx * 0.048, 0.26, 0.18, this.sfxGain!, true, 2400);
    });
  }

  public playHammer(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playRoundedTone(165, now, 0.26, 0.42, this.sfxGain, true, 380, 48);
    this.playMagicSwoosh(now, 0.22, 900, 300, 0.24);
  }

  public playFanfare(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((f, i) => {
      this.playRoundedTone(f, now + i * 0.09, 0.42, 0.24, this.sfxGain!, true, 2400);
    });
  }

  public playWin(): void {
    this.playFanfare();
  }

  public playLose(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 329.63, 261.63];
    notes.forEach((f, i) => {
      this.playRoundedTone(f, now + i * 0.16, 0.34, 0.2, this.sfxGain!, true, 1200);
    });
  }

  private playVoiceClip(clip: VoiceClipKey): void {
    if (this.muted) return;
    const ctx = this.ensureContext();

    if (ctx && this.voiceGain && this.decodedVoices[clip]) {
      if (this.activeVoiceSource) {
        try {
          this.activeVoiceSource.stop();
        } catch {
          // ignore
        }
        this.activeVoiceSource = null;
      }

      const source = ctx.createBufferSource();
      source.buffer = this.decodedVoices[clip]!;
      source.connect(this.voiceGain);
      source.onended = () => {
        if (this.activeVoiceSource === source) {
          this.activeVoiceSource = null;
        }
      };
      this.activeVoiceSource = source;
      source.start(0);
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio(VOICE_CLIP_URLS[clip]);
        audio.volume = 0.85;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  /**
   * Smart Cooldown & Strict Milestone Rule for Voice-Overs:
   * - Enforces 2600ms global cooldown (1500ms for major Sugar Crush! milestones)
   * - Enforces 6000ms same-phrase cooldown so voices NEVER spam or repeat back-to-back
   * - Plays pre-decoded cleaned voice MP3 clips with warm Web Audio harmonic chord backing
   */
  public playPraise(word: PraiseWord): boolean {
    if (this.muted) return false;

    const nowMs = Date.now();
    const isMajorMilestone = word === 'Sugar Crush!';
    const minGlobalGap = isMajorMilestone ? 1800 : 3000;
    const minSamePhraseGap = 6500;

    if (!isMajorMilestone && this.activeVoiceSource !== null) {
      return false;
    }
    if (nowMs - this.lastVoiceTime < minGlobalGap) {
      return false;
    }
    if (!isMajorMilestone && this.lastSpokenPhrase === word) {
      return false;
    }
    const prevSame = this.lastPhraseTime[word] ?? 0;
    if (nowMs - prevSame < minSamePhraseGap) {
      return false;
    }

    this.lastVoiceTime = nowMs;
    this.lastPhraseTime[word] = nowMs;
    this.lastSpokenPhrase = word;

    const ctx = this.ensureContext();
    if (ctx && this.sfxGain) {
      const now = ctx.currentTime;
      if (isMajorMilestone) {
        this.playFanfare();
      } else {
        const chord =
          word === 'Delicious!'
            ? [587.33, 739.99, 880.0, 1174.66]
            : [523.25, 659.25, 783.99, 1046.5];
        chord.forEach((f, i) => {
          this.playRoundedTone(f, now + i * 0.045, 0.32, 0.16, this.sfxGain!, true, 2200);
        });
      }
    }

    const clipKey = PRAISE_TO_CLIP[word];
    if (clipKey) {
      this.playVoiceClip(clipKey);
    }

    return true;
  }
}

export const soundEngine = new CandySoundEngine();
