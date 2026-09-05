/**
 * Audio Settings & State Store
 *
 * Provides persistent configuration for master volume, SFX volume,
 * voice volume, mute state, and voice mode (Pizhou dialect / Mandarin / Off).
 */

export type VoiceMode = 'pizhou' | 'mandarin' | 'off';

export interface AudioSettings {
  masterVolume: number; // 0.0 - 1.0
  sfxVolume: number;    // 0.0 - 1.0
  voiceVolume: number;  // 0.0 - 1.0
  muted: boolean;
  voiceMode: VoiceMode;
}

const STORAGE_KEY = 'pizhou_audio_settings';
// Keep legacy key for backwards compatibility
const LEGACY_VOICE_KEY = 'pizhou_voice_mode';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  voiceVolume: 1.0,
  muted: false,
  voiceMode: 'pizhou',
};

function clamp01(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

function loadInitialSettings(): AudioSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const voiceMode: VoiceMode =
        parsed.voiceMode === 'pizhou' || parsed.voiceMode === 'mandarin' || parsed.voiceMode === 'off'
          ? parsed.voiceMode
          : DEFAULT_SETTINGS.voiceMode;

      return {
        masterVolume: clamp01(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume),
        sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
        voiceVolume: clamp01(parsed.voiceVolume, DEFAULT_SETTINGS.voiceVolume),
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
        voiceMode,
      };
    }

    // Fallback check for legacy single key
    const legacyMode = localStorage.getItem(LEGACY_VOICE_KEY);
    if (legacyMode === 'pizhou' || legacyMode === 'mandarin' || legacyMode === 'off') {
      return { ...DEFAULT_SETTINGS, voiceMode: legacyMode };
    }
  } catch {}

  return { ...DEFAULT_SETTINGS };
}

let currentSettings: AudioSettings = loadInitialSettings();
const listeners = new Set<(settings: AudioSettings) => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener(currentSettings);
    } catch (err) {
      console.error('AudioSettings listener error:', err);
    }
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    localStorage.setItem(LEGACY_VOICE_KEY, currentSettings.voiceMode);
  } catch {}
}

export function getAudioSettings(): AudioSettings {
  return { ...currentSettings };
}

export function updateAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
  const updated: AudioSettings = {
    masterVolume: partial.masterVolume !== undefined ? clamp01(partial.masterVolume, currentSettings.masterVolume) : currentSettings.masterVolume,
    sfxVolume: partial.sfxVolume !== undefined ? clamp01(partial.sfxVolume, currentSettings.sfxVolume) : currentSettings.sfxVolume,
    voiceVolume: partial.voiceVolume !== undefined ? clamp01(partial.voiceVolume, currentSettings.voiceVolume) : currentSettings.voiceVolume,
    muted: partial.muted !== undefined ? Boolean(partial.muted) : currentSettings.muted,
    voiceMode:
      partial.voiceMode === 'pizhou' || partial.voiceMode === 'mandarin' || partial.voiceMode === 'off'
        ? partial.voiceMode
        : currentSettings.voiceMode,
  };

  currentSettings = updated;
  persistSettings();
  notifyListeners();
  return { ...currentSettings };
}

export function isMuted(): boolean {
  return currentSettings.muted;
}

export function toggleMute(): boolean {
  const next = !currentSettings.muted;
  updateAudioSettings({ muted: next });
  return next;
}

export function getVoiceMode(): VoiceMode {
  return currentSettings.voiceMode;
}

export function setVoiceMode(mode: VoiceMode): void {
  updateAudioSettings({ voiceMode: mode });
}

export function subscribeAudioSettings(listener: (settings: AudioSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
