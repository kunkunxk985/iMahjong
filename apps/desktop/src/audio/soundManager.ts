/**
 * SoundManager: Audio Pipeline & Asset Cache
 *
 * Implements:
 * - Web Audio API AudioBuffer memory pool with decoded buffer caching
 * - 3 GainNode audio channels: Master, SFX, and Voice
 * - Responsive volume & mute synchronization with AudioSettings
 * - HTML5 Audio fallback for resilience
 * - Silent error catching to guarantee uninterrupted gameplay thread
 */

import { getAudioSettings, subscribeAudioSettings, type AudioSettings } from './settings';

export type SfxName =
  | 'discard'
  | 'draw'
  | 'shuffle'
  | 'peng'
  | 'chi'
  | 'kan'
  | 'gang'
  | 'guanmen'
  | 'hu'
  | 'qidong_hu'
  | 'baozhuang'
  | 'liuju'
  | 'my_turn'
  | 'tick'
  | 'reject'
  | 'button_hover';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private currentVoiceSource: AudioBufferSourceNode | null = null;
  private currentVoiceElement: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      subscribeAudioSettings((settings) => this.syncVolumes(settings));
      // Auto unlock audio context on first user pointerdown/keydown
      const unlock = () => {
        this.resumeContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true, once: true });
      window.addEventListener('keydown', unlock, { passive: true, once: true });
    }
  }

  /** Ensure AudioContext and Gain routing graph are ready */
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      try {
        this.ctx = new AudioCtxClass();
        const settings = getAudioSettings();

        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.voiceGain = this.ctx.createGain();

        // Connect sub-channels to master, and master to destination
        this.sfxGain.connect(this.masterGain);
        this.voiceGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.syncVolumes(settings);
      } catch (err) {
        console.warn('Failed to initialize AudioContext:', err);
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public async resumeContext(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
  }

  /** Synchronize GainNode channel values with persistent AudioSettings */
  public syncVolumes(settings: AudioSettings): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.voiceGain) return;
    const t = this.ctx.currentTime;
    try {
      const masterVal = settings.muted ? 0 : settings.masterVolume;
      this.masterGain.gain.setValueAtTime(masterVal, t);
      this.sfxGain.gain.setValueAtTime(settings.sfxVolume, t);
      this.voiceGain.gain.setValueAtTime(settings.voiceVolume, t);
    } catch {}
  }

  /** Load an audio file into decoded AudioBuffer */
  public async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const loadPromise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
        const arrayBuf = await res.arrayBuffer();
        const ctx = this.ensureContext();
        if (!ctx) return null;

        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.bufferCache.set(url, audioBuf);
        return audioBuf;
      } catch (err) {
        console.warn(`[SoundManager] Failed to load/decode ${url}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(url);
      }
    })();

    this.loadingPromises.set(url, loadPromise);
    return loadPromise;
  }

  /** Preload multiple audio asset URLs asynchronously */
  public async preloadBatch(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.map((u) => this.loadBuffer(u)));
  }

  /** Play a physical SFX asset by name */
  public async playSfx(name: SfxName | string, options?: { volume?: number; playbackRate?: number }): Promise<void> {
    const settings = getAudioSettings();
    if (settings.muted || settings.masterVolume <= 0 || settings.sfxVolume <= 0) return;

    const url = `./assets/audio/sfx/${name}.wav`;
    const ctx = this.ensureContext();

    if (ctx && this.sfxGain) {
      try {
        let buffer = this.bufferCache.get(url);
        if (!buffer) {
          buffer = (await this.loadBuffer(url)) ?? undefined;
        }

        if (buffer) {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          if (options?.playbackRate) {
            src.playbackRate.value = options.playbackRate;
          }

          if (options?.volume !== undefined && options.volume !== 1.0) {
            const tempGain = ctx.createGain();
            tempGain.gain.setValueAtTime(options.volume, ctx.currentTime);
            src.connect(tempGain);
            tempGain.connect(this.sfxGain);
          } else {
            src.connect(this.sfxGain);
          }

          src.start(0);
          return;
        }
      } catch (err) {
        console.warn(`[SoundManager] Web Audio sfx playback error for ${name}, attempting fallback:`, err);
      }
    }

    // HTML5 Audio Fallback
    try {
      const audio = new Audio(url);
      audio.volume = settings.masterVolume * settings.sfxVolume * (options?.volume ?? 1.0);
      await audio.play();
    } catch {}
  }

  /** Stop any currently playing voice clip to prevent muddy overlapping voice speech */
  public stopVoice(): void {
    if (this.currentVoiceSource) {
      try {
        this.currentVoiceSource.stop();
        this.currentVoiceSource.disconnect();
      } catch {}
      this.currentVoiceSource = null;
    }
    if (this.currentVoiceElement) {
      try {
        this.currentVoiceElement.pause();
        this.currentVoiceElement.currentTime = 0;
      } catch {}
      this.currentVoiceElement = null;
    }
  }

  /** Play a voice clip from either pizhou or mandarin voice pack */
  public async playVoice(pack: 'pizhou' | 'mandarin', clipName: string): Promise<void> {
    const settings = getAudioSettings();
    if (settings.muted || settings.voiceMode === 'off' || settings.masterVolume <= 0 || settings.voiceVolume <= 0) {
      return;
    }

    this.stopVoice();

    const normalizedClip = clipName.replace(/-/g, '_');
    const url = `./assets/audio/voice/${pack}/${normalizedClip}.wav`;
    const ctx = this.ensureContext();

    if (ctx && this.voiceGain) {
      try {
        let buffer = this.bufferCache.get(url);
        if (!buffer) {
          buffer = (await this.loadBuffer(url)) ?? undefined;
        }

        if (buffer) {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(this.voiceGain);
          this.currentVoiceSource = src;
          src.onended = () => {
            if (this.currentVoiceSource === src) {
              this.currentVoiceSource = null;
            }
          };
          src.start(0);
          return;
        }
      } catch (err) {
        console.warn(`[SoundManager] Web Audio voice playback error for ${url}, attempting fallback:`, err);
      }
    }

    // HTML5 Audio Fallback
    try {
      const audio = new Audio(url);
      audio.volume = settings.masterVolume * settings.voiceVolume;
      this.currentVoiceElement = audio;
      audio.onended = () => {
        if (this.currentVoiceElement === audio) {
          this.currentVoiceElement = null;
        }
      };
      await audio.play();
    } catch {}
  }

  /** Preload common core game sounds for immediate zero-latency playback */
  public warmCoreSounds(): void {
    const commonSfx: SfxName[] = ['discard', 'draw', 'peng', 'chi', 'kan', 'gang', 'guanmen', 'hu', 'my_turn', 'tick', 'shuffle'];
    const urls = commonSfx.map((name) => `./assets/audio/sfx/${name}.wav`);
    this.preloadBatch(urls).catch(() => {});
  }
}

export const soundManager = new SoundManager();
