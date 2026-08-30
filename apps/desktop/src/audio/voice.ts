import { tileLabel } from '@pizhou/shared';

export type VoiceMode = 'pizhou' | 'mandarin' | 'off';

const STORAGE_KEY = 'pizhou_voice_mode';

let currentVoiceMode: VoiceMode = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pizhou' || saved === 'mandarin' || saved === 'off') return saved;
  } catch {}
  return 'pizhou';
})();

export function getVoiceMode(): VoiceMode {
  return currentVoiceMode;
}

export function setVoiceMode(mode: VoiceMode): void {
  currentVoiceMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

const PIZHOU_PHRASES: Record<string, string> = {
  peng: '碰！',
  chi: '吃了！',
  kan: '坎上了！',
  gang: '开杠！',
  'an-gang': '暗杠！',
  'close-gate': '关大门听牌！',
  hu: '给老子胡了！',
  'qidong-gang-hu': '起手杠胡大满贯！',
  baozhuang: '点炮包庄咯！',
};

const MANDARIN_PHRASES: Record<string, string> = {
  peng: '碰！',
  chi: '吃！',
  kan: '坎上！',
  gang: '杠！',
  'an-gang': '暗杠！',
  'close-gate': '关门听牌！',
  hu: '胡了！',
  'qidong-gang-hu': '起手杠胡！',
  baozhuang: '包庄！',
};

let chineseVoice: SpeechSynthesisVoice | null = null;

function getChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (!chineseVoice) {
    const voices = window.speechSynthesis.getVoices();
    chineseVoice =
      voices.find((v) => v.lang.includes('zh-CN') || v.lang.includes('cmn')) ||
      voices.find((v) => v.lang.includes('zh')) ||
      null;
  }
  return chineseVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    chineseVoice = null;
    getChineseVoice();
  };
}

export function speakText(text: string, options?: { pitch?: number; rate?: number }): void {
  if (currentVoiceMode === 'off' || typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // cancel previous unfinished queue
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    const voice = getChineseVoice();
    if (voice) utter.voice = voice;

    if (currentVoiceMode === 'pizhou') {
      utter.pitch = options?.pitch ?? 1.15; // energetic local tone
      utter.rate = options?.rate ?? 1.12;
    } else {
      utter.pitch = options?.pitch ?? 1.0;
      utter.rate = options?.rate ?? 1.05;
    }
    utter.volume = 1.0;

    window.speechSynthesis.speak(utter);
  } catch {}
}

export function speakAction(actionType: string): void {
  if (currentVoiceMode === 'off') return;
  const dict = currentVoiceMode === 'pizhou' ? PIZHOU_PHRASES : MANDARIN_PHRASES;
  const text = dict[actionType] || actionType;
  speakText(text, { pitch: 1.2, rate: 1.15 });
}

export function speakDiscardTile(tileKey: string): void {
  if (currentVoiceMode === 'off') return;
  const label = tileLabel(tileKey);
  speakText(label, { pitch: 1.05, rate: 1.18 });
}
