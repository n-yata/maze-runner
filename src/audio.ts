import type { SoundKey } from './types.js';

interface SoundDef {
  frequency: number;
  type: OscillatorType;
  duration: number;
  gainPeak: number;
}

const SOUND_DEFS: Record<SoundKey, SoundDef> = {
  EAT_DOT:   { frequency: 440,  type: 'square',   duration: 0.05, gainPeak: 0.1 },
  EAT_POWER: { frequency: 220,  type: 'sawtooth',  duration: 0.3,  gainPeak: 0.3 },
  EAT_GHOST: { frequency: 880,  type: 'square',   duration: 0.2,  gainPeak: 0.4 },
  DEATH:     { frequency: 110,  type: 'sawtooth',  duration: 1.0,  gainPeak: 0.5 },
  GAME_START:{ frequency: 523,  type: 'triangle', duration: 0.5,  gainPeak: 0.4 },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(key: SoundKey): void {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const def = SOUND_DEFS[key];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = def.type;
    osc.frequency.setValueAtTime(def.frequency, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(def.gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + def.duration);

    osc.start(now);
    osc.stop(now + def.duration);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}
