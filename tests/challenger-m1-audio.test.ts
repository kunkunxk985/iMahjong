import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioAssetDir = path.join(root, 'apps/desktop/public/assets/audio');
const sfxDir = path.join(audioAssetDir, 'sfx');
const mandarinDir = path.join(audioAssetDir, 'voice/mandarin');
const pizhouDir = path.join(audioAssetDir, 'voice/pizhou');

// ---------------------------------------------------------------------------
// Helper: Strict WAV Header & Chunk Validator
// ---------------------------------------------------------------------------
interface WavValidationResult {
  valid: boolean;
  error?: string;
  format?: number;
  channels?: number;
  sampleRate?: number;
  byteRate?: number;
  blockAlign?: number;
  bitsPerSample?: number;
  dataByteLength?: number;
  maxAmplitude?: number;
}

function validateWavFile(filePath: string): WavValidationResult {
  const buf = readFileSync(filePath);
  if (buf.length < 44) {
    return { valid: false, error: `File too small: ${buf.length} bytes (min 44)` };
  }

  // Check RIFF header
  const riff = buf.toString('ascii', 0, 4);
  if (riff !== 'RIFF') {
    return { valid: false, error: `Invalid RIFF header: ${riff}` };
  }

  const wave = buf.toString('ascii', 8, 12);
  if (wave !== 'WAVE') {
    return { valid: false, error: `Invalid WAVE tag: ${wave}` };
  }

  let offset = 12;
  let fmt: {
    format: number;
    channels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bitsPerSample: number;
  } | null = null;

  let dataChunk: { offset: number; size: number } | null = null;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      if (chunkSize < 16) {
        return { valid: false, error: `Invalid fmt chunk size: ${chunkSize} (min 16)` };
      }
      fmt = {
        format: buf.readUInt16LE(offset + 8),
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        byteRate: buf.readUInt32LE(offset + 16),
        blockAlign: buf.readUInt16LE(offset + 20),
        bitsPerSample: buf.readUInt16LE(offset + 22),
      };
    } else if (chunkId === 'data') {
      dataChunk = { offset: offset + 8, size: chunkSize };
    }

    offset += 8 + chunkSize;
  }

  if (!fmt) {
    return { valid: false, error: "Missing 'fmt ' chunk in WAV file" };
  }
  if (!dataChunk) {
    return { valid: false, error: "Missing 'data' chunk in WAV file" };
  }

  // Format validation: 1 = PCM, 3 = IEEE float, 0xfffe = Extensible PCM
  if (fmt.format !== 1 && fmt.format !== 3 && fmt.format !== 0xfffe) {
    return { valid: false, error: `Unsupported audio format code: ${fmt.format}` };
  }

  if (fmt.channels < 1) {
    return { valid: false, error: `Invalid channel count: ${fmt.channels}` };
  }

  if (fmt.sampleRate < 8000) {
    return { valid: false, error: `Unreasonably low sample rate: ${fmt.sampleRate} Hz` };
  }

  if (fmt.bitsPerSample < 8) {
    return { valid: false, error: `Unreasonably low bit depth: ${fmt.bitsPerSample} bits` };
  }

  // Check expected byteRate and blockAlign for standard PCM
  const expectedBlockAlign = fmt.channels * (fmt.bitsPerSample / 8);
  if (fmt.blockAlign !== expectedBlockAlign) {
    return { valid: false, error: `blockAlign mismatch: got ${fmt.blockAlign}, expected ${expectedBlockAlign}` };
  }

  const expectedByteRate = fmt.sampleRate * expectedBlockAlign;
  if (fmt.byteRate !== expectedByteRate) {
    return { valid: false, error: `byteRate mismatch: got ${fmt.byteRate}, expected ${expectedByteRate}` };
  }

  // Data chunk check
  if (dataChunk.size <= 0) {
    return { valid: false, error: `Empty data chunk size: ${dataChunk.size}` };
  }

  // Check if buffer has enough bytes
  if (dataChunk.offset + dataChunk.size > buf.length) {
    return {
      valid: false,
      error: `Truncated data chunk: declared ${dataChunk.size}, buffer available ${buf.length - dataChunk.offset}`,
    };
  }

  // Sample data amplitude sanity check: verify not flatline 0 silence
  let maxAmp = 0;
  const sampleCount = Math.min(2000, Math.floor(dataChunk.size / 2));
  for (let i = 0; i < sampleCount; i++) {
    const val = Math.abs(buf.readInt16LE(dataChunk.offset + i * 2));
    if (val > maxAmp) maxAmp = val;
  }

  return {
    valid: true,
    format: fmt.format,
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    byteRate: fmt.byteRate,
    blockAlign: fmt.blockAlign,
    bitsPerSample: fmt.bitsPerSample,
    dataByteLength: dataChunk.size,
    maxAmplitude: maxAmp,
  };
}

// ---------------------------------------------------------------------------
// 1. WAV Format & Asset Integrity Empirical Test Suite
// ---------------------------------------------------------------------------
test('Empirical Test 1.1: Comprehensive WAV header & audio frame validation on all 16 SFX assets', () => {
  const expectedSfx = [
    'discard', 'draw', 'shuffle', 'peng', 'chi', 'kan', 'gang', 'guanmen',
    'hu', 'qidong_hu', 'baozhuang', 'liuju', 'my_turn', 'tick', 'reject', 'button_hover'
  ];

  assert.ok(existsSync(sfxDir), 'SFX directory must exist');
  const files = readdirSync(sfxDir).filter((f) => f.endsWith('.wav'));
  assert.equal(files.length, 16, `Expected 16 SFX WAV files, found ${files.length}`);

  for (const name of expectedSfx) {
    const filePath = path.join(sfxDir, `${name}.wav`);
    assert.ok(existsSync(filePath), `SFX file ${name}.wav must exist`);
    const res = validateWavFile(filePath);
    assert.ok(res.valid, `SFX ${name}.wav failed WAV validation: ${res.error}`);
    assert.equal(res.format, 1, `SFX ${name}.wav format must be 1 (PCM)`);
    assert.equal(res.channels, 1, `SFX ${name}.wav should be mono`);
    assert.equal(res.sampleRate, 44100, `SFX ${name}.wav sample rate should be 44100 Hz`);
    assert.equal(res.bitsPerSample, 16, `SFX ${name}.wav should be 16-bit PCM`);
    assert.ok(res.dataByteLength! > 500, `SFX ${name}.wav data size (${res.dataByteLength}) must be > 500 bytes`);
    assert.ok(res.maxAmplitude! > 100, `SFX ${name}.wav must have non-zero acoustic amplitude (got ${res.maxAmplitude})`);
  }
});

test('Empirical Test 1.2: Comprehensive WAV header & audio frame validation on all 39 Mandarin voice assets', () => {
  assert.ok(existsSync(mandarinDir), 'Mandarin voice directory must exist');
  const files = readdirSync(mandarinDir).filter((f) => f.endsWith('.wav'));
  assert.equal(files.length, 39, `Expected 39 Mandarin voice files, found ${files.length}`);

  for (const file of files) {
    const filePath = path.join(mandarinDir, file);
    const res = validateWavFile(filePath);
    assert.ok(res.valid, `Mandarin voice ${file} failed WAV validation: ${res.error}`);
    assert.equal(res.format, 1, `Mandarin voice ${file} format must be 1 (PCM)`);
    assert.ok(res.sampleRate! >= 16000, `Mandarin voice ${file} sample rate must be >= 16kHz`);
    assert.equal(res.bitsPerSample, 16, `Mandarin voice ${file} should be 16-bit PCM`);
    assert.ok(res.dataByteLength! > 1000, `Mandarin voice ${file} data size must be > 1000 bytes`);
    assert.ok(res.maxAmplitude! > 500, `Mandarin voice ${file} must have audible speech amplitude (got ${res.maxAmplitude})`);
  }
});

test('Empirical Test 1.3: Comprehensive WAV header & audio frame validation on all 39 Pizhou dialect voice assets', () => {
  assert.ok(existsSync(pizhouDir), 'Pizhou voice directory must exist');
  const files = readdirSync(pizhouDir).filter((f) => f.endsWith('.wav'));
  assert.equal(files.length, 39, `Expected 39 Pizhou voice files, found ${files.length}`);

  for (const file of files) {
    const filePath = path.join(pizhouDir, file);
    const res = validateWavFile(filePath);
    assert.ok(res.valid, `Pizhou voice ${file} failed WAV validation: ${res.error}`);
    assert.equal(res.format, 1, `Pizhou voice ${file} format must be 1 (PCM)`);
    assert.ok(res.sampleRate! >= 16000, `Pizhou voice ${file} sample rate must be >= 16kHz`);
    assert.equal(res.bitsPerSample, 16, `Pizhou voice ${file} should be 16-bit PCM`);
    assert.ok(res.dataByteLength! > 1000, `Pizhou voice ${file} data size must be > 1000 bytes`);
    assert.ok(res.maxAmplitude! > 500, `Pizhou voice ${file} must have audible speech amplitude (got ${res.maxAmplitude})`);
  }
});

// ---------------------------------------------------------------------------
// 2. Audio Settings & LocalStorage Persistence Empirical Test Suite
// ---------------------------------------------------------------------------
test('Empirical Test 2.1: In-memory and LocalStorage serialization, multichannel updates and subscription', async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: { localStorage: mockLocalStorage }, configurable: true, writable: true });

  const { getAudioSettings, updateAudioSettings, toggleMute, subscribeAudioSettings, isMuted } = await import(
    '../apps/desktop/src/audio/settings.ts'
  );

  // 1. Initial defaults
  const initial = getAudioSettings();
  assert.ok(typeof initial.masterVolume === 'number');
  assert.ok(typeof initial.sfxVolume === 'number');
  assert.ok(typeof initial.voiceVolume === 'number');

  // 2. Update settings and verify persistence
  const updated = updateAudioSettings({
    masterVolume: 0.65,
    sfxVolume: 0.75,
    voiceVolume: 0.85,
    muted: true,
    voiceMode: 'mandarin',
  });

  assert.equal(updated.masterVolume, 0.65);
  assert.equal(updated.sfxVolume, 0.75);
  assert.equal(updated.voiceVolume, 0.85);
  assert.equal(updated.muted, true);
  assert.equal(updated.voiceMode, 'mandarin');

  // Verify localStorage content
  const rawStored = store.get('pizhou_audio_settings');
  assert.ok(rawStored, 'pizhou_audio_settings must be written to localStorage');
  const parsedStored = JSON.parse(rawStored!);
  assert.equal(parsedStored.masterVolume, 0.65);
  assert.equal(parsedStored.sfxVolume, 0.75);
  assert.equal(parsedStored.voiceVolume, 0.85);
  assert.equal(parsedStored.muted, true);
  assert.equal(parsedStored.voiceMode, 'mandarin');

  // Verify backwards compatible legacy key is written
  assert.equal(store.get('pizhou_voice_mode'), 'mandarin');

  // 3. Test toggleMute
  const nextMuteState = toggleMute();
  assert.equal(nextMuteState, false, 'toggleMute should switch muted from true to false');
  assert.equal(isMuted(), false);
  assert.equal(JSON.parse(store.get('pizhou_audio_settings')!).muted, false);

  // 4. Test subscription listener notification
  let listenerCalledWith: unknown = null;
  const unsubscribe = subscribeAudioSettings((s: unknown) => {
    listenerCalledWith = s;
  });

  updateAudioSettings({ masterVolume: 0.5 });
  assert.ok(listenerCalledWith, 'Subscription listener must be called on update');
  assert.equal((listenerCalledWith as { masterVolume: number }).masterVolume, 0.5);

  // Unsubscribe and ensure no further calls
  listenerCalledWith = null;
  unsubscribe();
  updateAudioSettings({ masterVolume: 0.9 });
  assert.equal(listenerCalledWith, null, 'Unsubscribed listener must not be called');
});

test('Empirical Test 2.2: LocalStorage deserialization from prior state and legacy fallback upon fresh load', () => {
  const runnerScript = `
    const store = new Map();
    store.set('pizhou_voice_mode', 'mandarin');
    const mock = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'window', { value: { localStorage: mock }, configurable: true, writable: true });

    import('./apps/desktop/src/audio/settings.ts').then(({ getAudioSettings }) => {
      console.log(JSON.stringify(getAudioSettings()));
    });
  `;

  const output = execFileSync('node', ['--import', 'tsx', '--input-type=module', '-e', runnerScript], {
    cwd: root,
  }).toString();

  const settings = JSON.parse(output.trim());
  assert.equal(settings.voiceMode, 'mandarin', 'Must migrate legacy pizhou_voice_mode setting on boot');
  assert.equal(settings.masterVolume, 0.8, 'Other fields must take default values');
});

test('Empirical Test 2.3: AudioSettings adversarial fuzzing & boundary protection', () => {
  const runnerScript = `
    const store = new Map();
    // Corrupt and extreme values in localStorage
    store.set('pizhou_audio_settings', JSON.stringify({
      masterVolume: 9999,
      sfxVolume: -50,
      voiceVolume: 'ultra-loud',
      muted: 'yes',
      voiceMode: 'pirate-bay'
    }));

    const mock = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'window', { value: { localStorage: mock }, configurable: true, writable: true });

    import('./apps/desktop/src/audio/settings.ts').then(({ getAudioSettings, updateAudioSettings }) => {
      const loaded = getAudioSettings();
      const updated = updateAudioSettings({
        masterVolume: NaN,
        sfxVolume: Infinity,
        voiceVolume: -Infinity,
        voiceMode: 'invalid'
      });

      // Also simulate localStorage throwing QuotaExceededError
      mock.setItem = () => { throw new Error('DOMException: QuotaExceededError'); };
      let threw = false;
      try {
        updateAudioSettings({ masterVolume: 0.42 });
      } catch {
        threw = true;
      }

      console.log(JSON.stringify({ loaded, updated, quotaThrew: threw, finalMaster: getAudioSettings().masterVolume }));
    });
  `;

  const output = execFileSync('node', ['--import', 'tsx', '--input-type=module', '-e', runnerScript], {
    cwd: root,
  }).toString();

  const res = JSON.parse(output.trim());

  // Sanitization on load
  assert.equal(res.loaded.masterVolume, 1.0, 'masterVolume 9999 must be clamped to 1.0');
  assert.equal(res.loaded.sfxVolume, 0.0, 'sfxVolume -50 must be clamped to 0.0');
  assert.equal(res.loaded.voiceVolume, 1.0, 'String voiceVolume must fall back to default (1.0)');
  assert.equal(res.loaded.muted, false, 'Non-boolean muted must fall back to default (false)');
  assert.equal(res.loaded.voiceMode, 'pizhou', 'Invalid voiceMode must fall back to default ("pizhou")');

  // Boundary handling on update
  assert.equal(res.updated.masterVolume, 1.0, 'NaN must be rejected / keep previous valid value');
  assert.equal(res.updated.sfxVolume, 1.0, 'Infinity must be clamped to 1.0');
  assert.equal(res.updated.voiceVolume, 0.0, '-Infinity must be clamped to 0.0');
  assert.equal(res.updated.voiceMode, 'pizhou', 'Invalid voiceMode update must be rejected');

  // Quota exception isolation
  assert.equal(res.quotaThrew, false, 'updateAudioSettings must never crash when localStorage throws');
  assert.equal(res.finalMaster, 0.42, 'In-memory state continues updating despite storage failure');
});

// ---------------------------------------------------------------------------
// 3. Audio Pipeline Error Resilience & Fallback Empirical Test Suite
// ---------------------------------------------------------------------------
test('Empirical Test 3.1: AudioContext failure resilience & graceful HTMLAudio fallback', async () => {
  // Test Scenario: Web Audio is either absent or throws on constructor.
  // Requirement: UI and game loops must NOT throw; HTMLAudio is attempted or silently caught.

  let audioCreatedCount = 0;
  let audioPlayedCount = 0;

  class MockHTMLAudio {
    src: string;
    volume = 1.0;
    onended: (() => void) | null = null;
    constructor(src: string) {
      this.src = src;
      audioCreatedCount++;
    }
    async play() {
      audioPlayedCount++;
      return Promise.resolve();
    }
    pause() {}
  }

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  (globalThis as unknown as { window: unknown }).window = {
    // AudioContext throws on instantiation
    AudioContext: class BrokenAudioContext {
      constructor() {
        throw new Error('NotAllowedError: AudioContext is not permitted in current sandbox');
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  (globalThis as unknown as { Audio: unknown }).Audio = MockHTMLAudio;

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_fallback`);
    const sm = soundMod.soundManager;

    // Trigger SFX
    let didThrow = false;
    try {
      await sm.playSfx('discard');
    } catch (err) {
      didThrow = true;
    }
    assert.equal(didThrow, false, 'playSfx must not throw when AudioContext fails');
    assert.equal(audioCreatedCount, 1, 'HTMLAudio should be created as fallback');
    assert.equal(audioPlayedCount, 1, 'HTMLAudio.play() should be called');

    // Trigger Voice
    didThrow = false;
    try {
      await sm.playVoice('pizhou', 'hu');
    } catch {
      didThrow = true;
    }
    assert.equal(didThrow, false, 'playVoice must not throw when AudioContext fails');
    assert.equal(audioCreatedCount, 2, 'HTMLAudio should be created for voice fallback');
    assert.equal(audioPlayedCount, 2, 'HTMLAudio.play() should be called for voice');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalAudio === undefined) {
      delete (globalThis as unknown as { Audio?: unknown }).Audio;
    } else {
      (globalThis as unknown as { Audio: unknown }).Audio = originalAudio;
    }
  }
});

test('Empirical Test 3.2: Missing audio asset (HTTP 404 / network fail) resilience', async () => {
  // Test Scenario: Fetch fails with 404 or network error.
  // Requirement: loadBuffer returns null, playSfx / playVoice silently catch without unhandled rejection.

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;
  const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  // Mock AudioContext with functioning gain nodes
  class MockGainNode {
    gain = { setValueAtTime: () => {} };
    connect() {}
  }

  class MockAudioContext {
    state = 'running';
    destination = {};
    currentTime = 0;
    createGain() {
      return new MockGainNode();
    }
    async decodeAudioData() {
      throw new Error('Invalid audio data');
    }
    async resume() {}
  }

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: MockAudioContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  // Mock fetch returning HTTP 404
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };

  // Mock HTMLAudio play returning rejected promise (file 404)
  (globalThis as unknown as { Audio: unknown }).Audio = class FailingAudio {
    volume = 1;
    async play() {
      throw new Error('DEMUXER_ERROR_COULD_NOT_OPEN: 404 Not Found');
    }
  };

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_404`);
    const sm = soundMod.soundManager;

    // Test loadBuffer directly
    const buffer = await sm.loadBuffer('./assets/audio/sfx/non_existent.wav');
    assert.equal(buffer, null, 'loadBuffer must return null on 404 rather than throwing');

    // Test playSfx directly on 404 asset
    let didThrow = false;
    try {
      await sm.playSfx('non_existent_sfx');
    } catch {
      didThrow = true;
    }
    assert.equal(didThrow, false, 'playSfx must silently handle 404 without crashing caller');

    // Test playVoice directly on 404 asset
    didThrow = false;
    try {
      await sm.playVoice('pizhou', 'non_existent_voice');
    } catch {
      didThrow = true;
    }
    assert.equal(didThrow, false, 'playVoice must silently handle 404 without crashing caller');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalFetch === undefined) {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    } else {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
    }
    if (originalAudio === undefined) {
      delete (globalThis as unknown as { Audio?: unknown }).Audio;
    } else {
      (globalThis as unknown as { Audio: unknown }).Audio = originalAudio;
    }
  }
});

test('Empirical Test 3.3: Total audio failure (Web Audio throws AND HTML5 autoplay blocked)', async () => {
  // Scenario: Both Web Audio and HTML5 Audio fail simultaneously (e.g. browser strict autoplay policy NotAllowedError)
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: class {
      constructor() {
        throw new Error('DOMException: AudioContext permission denied');
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
  };

  (globalThis as unknown as { Audio: unknown }).Audio = class AutoplayBlockedAudio {
    volume = 1;
    async play() {
      const err = new Error('NotAllowedError: play() failed because the user didn\'t interact with the document first.');
      err.name = 'NotAllowedError';
      throw err;
    }
  };

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_total_fail`);
    const sm = soundMod.soundManager;

    let didThrow = false;
    try {
      await sm.playSfx('discard');
      await sm.playVoice('mandarin', 'hu');
    } catch {
      didThrow = true;
    }

    assert.equal(didThrow, false, 'Dual failure must still be caught silently and never throw');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalAudio === undefined) {
      delete (globalThis as unknown as { Audio?: unknown }).Audio;
    } else {
      (globalThis as unknown as { Audio: unknown }).Audio = originalAudio;
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Voice Overlap Interruption & High Concurrency Stress Test Suite
// ---------------------------------------------------------------------------
test('Empirical Test 4.1: Voice exclusivity & interruption (stopVoice stops previous utterance)', async () => {
  let stoppedNodes = 0;
  let disconnectedNodes = 0;

  class MockBufferSource {
    buffer: unknown = {};
    onended: (() => void) | null = null;
    connect() {}
    start() {}
    stop() {
      stoppedNodes++;
    }
    disconnect() {
      disconnectedNodes++;
    }
  }

  class MockGainNode {
    gain = { setValueAtTime: () => {} };
    connect() {}
  }

  class MockAudioContext {
    state = 'running';
    destination = {};
    currentTime = 0;
    createGain() {
      return new MockGainNode();
    }
    createBufferSource() {
      return new MockBufferSource();
    }
    async decodeAudioData() {
      return { duration: 1.5, length: 66150 };
    }
    async resume() {}
  }

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: MockAudioContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1024),
  });

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_exclusivity`);
    const sm = soundMod.soundManager;

    // Start playing first voice
    await sm.playVoice('pizhou', 'close_gate');
    assert.equal(stoppedNodes, 0, 'First voice starts without stopping anything');

    // Immediately start playing second voice
    await sm.playVoice('pizhou', 'hu');
    assert.equal(stoppedNodes, 1, 'Previous voice must be stopped when new voice plays');
    assert.equal(disconnectedNodes, 1, 'Previous voice must be disconnected when new voice plays');

    // Calling stopVoice explicitly
    sm.stopVoice();
    assert.equal(stoppedNodes, 2, 'stopVoice explicitly stops active voice source');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalFetch === undefined) {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    } else {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  }
});

test('Empirical Test 4.2: High-concurrency stress test with request deduplication', async () => {
  let fetchCount = 0;
  let decodeCount = 0;

  class MockGainNode {
    gain = { setValueAtTime: () => {} };
    connect() {}
  }

  class MockAudioContext {
    state = 'running';
    destination = {};
    currentTime = 0;
    createGain() {
      return new MockGainNode();
    }
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1.0 },
        connect() {},
        start() {},
      };
    }
    async decodeAudioData() {
      decodeCount++;
      return { duration: 0.2 };
    }
    async resume() {}
  }

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: MockAudioContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
  };

  (globalThis as unknown as { fetch: unknown }).fetch = async () => {
    fetchCount++;
    // Simulate slight network latency
    await new Promise((r) => setTimeout(r, 10));
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
    };
  };

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_concurrency`);
    const sm = soundMod.soundManager;

    // Fire 50 simultaneous playSfx requests for the exact same sound 'discard'
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(sm.playSfx('discard'));
    }

    await Promise.all(promises);

    // In-flight deduplication must ensure only 1 fetch was made for this url
    assert.equal(fetchCount, 1, `Expected exactly 1 fetch for 50 concurrent requests, got ${fetchCount}`);
    assert.equal(decodeCount, 1, `Expected exactly 1 decode for 50 concurrent requests, got ${decodeCount}`);

    // Fire 50 more requests: must hit memory cache with 0 additional fetches or decodes
    for (let i = 0; i < 50; i++) {
      promises.push(sm.playSfx('discard'));
    }
    await Promise.all(promises);
    assert.equal(fetchCount, 1, 'Subsequent requests must read from buffer cache with 0 network calls');
    assert.equal(decodeCount, 1, 'Subsequent requests must read from buffer cache with 0 decodes');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalFetch === undefined) {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    } else {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Decommissioning & Mapped Action Completeness
// ---------------------------------------------------------------------------
test('Empirical Test 5.1: Static audit: 100% elimination of createOscillator, speechSynthesis, and white noise', () => {
  const desktopSrcDir = path.join(root, 'apps/desktop/src');
  const audioDir = path.join(desktopSrcDir, 'audio');

  function checkDir(dir: string, pattern: RegExp, name: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(full, pattern, name);
      } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        const content = readFileSync(full, 'utf8');
        assert.ok(
          !pattern.test(content),
          `Found forbidden legacy pattern "${name}" in ${path.relative(root, full)}`,
        );
      }
    }
  }

  checkDir(audioDir, /createOscillator/, 'createOscillator');
  checkDir(audioDir, /speechSynthesis/, 'speechSynthesis');
  checkDir(audioDir, /SpeechSynthesisUtterance/, 'SpeechSynthesisUtterance');
  checkDir(audioDir, /Math\.random\(\)\s*\*\s*2\s*-\s*1/, 'Math.random white noise');
});

test('Empirical Test 5.2: Complete game action & tile voice clip disk file correspondence', () => {
  // Validate all 9 actions in voice.ts map to existing disk files
  const actions = ['peng', 'chi', 'kan', 'gang', 'an_gang', 'close_gate', 'hu', 'qidong_gang_hu', 'baozhuang'];
  for (const act of actions) {
    assert.ok(existsSync(path.join(mandarinDir, `${act}.wav`)), `Mandarin clip ${act}.wav must exist`);
    assert.ok(existsSync(path.join(pizhouDir, `${act}.wav`)), `Pizhou clip ${act}.wav must exist`);
  }

  // Validate all 36 tile announcement clips map to existing disk files
  const suits = ['wan', 'tiao', 'tong'];
  for (const s of suits) {
    for (let r = 1; r <= 9; r++) {
      const key = `${s}_${r}`;
      assert.ok(existsSync(path.join(mandarinDir, `${key}.wav`)), `Mandarin clip ${key}.wav must exist`);
      assert.ok(existsSync(path.join(pizhouDir, `${key}.wav`)), `Pizhou clip ${key}.wav must exist`);
    }
  }
  for (let d = 1; d <= 3; d++) {
    const key = `dragon_${d}`;
    assert.ok(existsSync(path.join(mandarinDir, `${key}.wav`)), `Mandarin clip ${key}.wav must exist`);
    assert.ok(existsSync(path.join(pizhouDir, `${key}.wav`)), `Pizhou clip ${key}.wav must exist`);
  }
});
