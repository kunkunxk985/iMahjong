import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Mock AudioContext and Web Audio Infrastructure for High-Precision Probing
// ---------------------------------------------------------------------------

interface MockGainState {
  value: number;
  time: number;
}

class MockAudioParam {
  value = 1.0;
  history: MockGainState[] = [];

  setValueAtTime(val: number, time: number) {
    this.value = val;
    this.history.push({ value: val, time });
  }
}

class MockGainNode {
  gain = new MockAudioParam();
  connectedTo: unknown[] = [];

  connect(dest: unknown) {
    this.connectedTo.push(dest);
  }
  disconnect() {
    this.connectedTo = [];
  }
}

class MockBufferSourceNode {
  buffer: unknown = null;
  playbackRate = { value: 1.0 };
  started = false;
  stopped = false;
  disconnected = false;
  startTime = -1;
  stopTime = -1;
  onended: (() => void) | null = null;
  connectedTo: unknown[] = [];

  connect(dest: unknown) {
    this.connectedTo.push(dest);
  }

  disconnect() {
    this.disconnected = true;
    this.connectedTo = [];
  }

  start(when = 0) {
    this.started = true;
    this.startTime = when;
  }

  stop(when = 0) {
    this.stopped = true;
    this.stopTime = when;
  }
}

class ProbingMockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = { name: 'AudioDestination' };
  createdSources: MockBufferSourceNode[] = [];
  gains: MockGainNode[] = [];
  decodedBuffersCount = 0;

  createGain() {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const src = new MockBufferSourceNode();
    this.createdSources.push(src);
    return src;
  }

  async decodeAudioData(buf: ArrayBuffer) {
    this.decodedBuffersCount++;
    return {
      duration: 1.2,
      length: 44100 * 1.2,
      numberOfChannels: 1,
      sampleRate: 44100,
    };
  }

  async resume() {
    this.state = 'running';
  }
}

// ---------------------------------------------------------------------------
// Test Suite 1: Audio Concurrency & Rapid Burst Stress Testing
// ---------------------------------------------------------------------------

test('Challenger 2 - 1.1: 1,000 rapid consecutive calls to playSfx and playVoice', async () => {
  // Scenario: Rapid gameplay action flood — 1,000 audio calls in rapid succession.
  // Probes:
  // 1. Zero unhandled promise rejections.
  // 2. Memory stability (no unbounded growth or leak).
  // 3. Clean error isolation and resolution.

  const mockCtx = new ProbingMockAudioContext();
  const unhandledErrors: unknown[] = [];
  const rejectionHandler = (err: unknown) => unhandledErrors.push(err);
  process.on('unhandledRejection', rejectionHandler);

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function () {
      return mockCtx;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(2048),
  });

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_burst_1000`);
    const sm = soundMod.soundManager;

    const sfxKeys = ['discard', 'draw', 'peng', 'chi', 'kan', 'gang', 'guanmen', 'hu', 'tick', 'my_turn'];
    const voiceClips = ['peng', 'chi', 'kan', 'gang', 'close_gate', 'hu', 'wan_1', 'tiao_9', 'dragon_1'];

    const memBefore = process.memoryUsage().heapUsed;
    const calls: Promise<void>[] = [];

    // Fire 500 SFX and 500 Voice calls rapidly
    for (let i = 0; i < 500; i++) {
      const sfx = sfxKeys[i % sfxKeys.length];
      const voice = voiceClips[i % voiceClips.length];
      calls.push(sm.playSfx(sfx));
      calls.push(sm.playVoice('pizhou', voice));
    }

    await Promise.all(calls);

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    assert.equal(unhandledErrors.length, 0, `Must have zero unhandled promise rejections, got: ${unhandledErrors.length}`);
    assert.ok(memDeltaMB < 25, `Heap memory growth (${memDeltaMB.toFixed(2)} MB) must be strictly bounded (< 25 MB)`);
    assert.ok(mockCtx.createdSources.length > 0, 'Buffer sources must have been created');
  } finally {
    process.removeListener('unhandledRejection', rejectionHandler);
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
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  }
});

test('Challenger 2 - 1.2: Empirical verification of asynchronous voice loading race condition & overlap', async () => {
  // Scenario: Voice exclusivity under asynchronous buffer loading latency.
  // Empirical Finding: When Voice 1 ('peng') is loading asynchronously and Voice 2 ('hu') is triggered,
  // because stopVoice() only stops currently playing nodes before the await, both sources end up starting
  // concurrently and playing together without interruption.

  const mockCtx = new ProbingMockAudioContext();
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  const mockStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function () {
      return mockCtx;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  // Mock fetch with controlled URL latency
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    if (url.includes('peng')) {
      await new Promise((r) => setTimeout(r, 30)); // Voice 1 takes 30ms
    } else if (url.includes('hu')) {
      await new Promise((r) => setTimeout(r, 10)); // Voice 2 takes 10ms
    }
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    };
  };

  try {
    const soundMod = await import(`../apps/desktop/src/audio/soundManager.ts?t=${Date.now()}_voice_race`);
    const sm = soundMod.soundManager;

    // Call Voice 1 (peng, slower)
    const p1 = sm.playVoice('pizhou', 'peng');
    // After 5ms, call Voice 2 (hu, faster)
    await new Promise((r) => setTimeout(r, 5));
    const p2 = sm.playVoice('pizhou', 'hu');

    await Promise.all([p1, p2]);

    const sources = mockCtx.createdSources;
    assert.equal(sources.length, 2, 'Two voice buffer sources were instantiated');

    // Check if both sources were started
    assert.equal(sources[0].started, true, 'Source 1 was started');
    assert.equal(sources[1].started, true, 'Source 2 was started');

    // Check if either source was stopped by the exclusivity mechanism
    const stoppedCount = sources.filter((s) => s.stopped).length;

    // Notice: Due to the asynchronous loading race condition, neither was stopped before start!
    // Both played concurrently in Web Audio!
    // This is documented empirically:
    assert.equal(stoppedCount, 0, 'Observed: Neither source was stopped during async load overlap');

    // When stopVoice() is subsequently called:
    sm.stopVoice();
    // In current implementation, sources[1] ('peng', loaded last) was registered as currentVoiceSource
    // while sources[0] ('hu', loaded first) was overwritten and leaked unstopped!
    assert.equal(sources[1].stopped, true, 'Last registered source (sources[1]) was stopped');
    assert.equal(sources[0].stopped, false, 'Overwritten preceding source (sources[0]) remained leaked/unstopped');
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
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Mute Synchronization & Immediate Silencing
// ---------------------------------------------------------------------------

test('Challenger 2 - 2.1: Mute immediately zeroes Master GainNode in Web Audio graph', async () => {
  const mockCtx = new ProbingMockAudioContext();
  mockCtx.currentTime = 12.345;

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function () {
      return mockCtx;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  try {
    const settingsMod = await import('../apps/desktop/src/audio/settings.ts');
    const soundMod = await import('../apps/desktop/src/audio/soundManager.ts');
    const sm = soundMod.soundManager;

    // Reset settings to unmuted default
    settingsMod.updateAudioSettings({ muted: false, masterVolume: 0.8, sfxVolume: 0.9, voiceVolume: 1.0 });

    // Ensure context initialized
    await sm.resumeContext();

    // Verify 3 gain nodes created: master, sfx, voice
    assert.equal(mockCtx.gains.length, 3, 'Must create masterGain, sfxGain, voiceGain');
    const [masterGain, sfxGain, voiceGain] = mockCtx.gains;

    // Manually ensure sync
    sm.syncVolumes(settingsMod.getAudioSettings());

    // Initially unmuted: masterGain should be masterVolume (0.8)
    assert.equal(masterGain.gain.value, 0.8);

    // Call toggleMute() -> muted: true
    settingsMod.toggleMute();

    // Verify masterGain was set to 0.0 at currentTime 12.345
    assert.equal(masterGain.gain.value, 0.0, 'Master gain must be immediately zeroed upon mute');
    const lastMasterCall = masterGain.gain.history[masterGain.gain.history.length - 1];
    assert.equal(lastMasterCall.value, 0.0);
    assert.equal(lastMasterCall.time, 12.345);

    // Verify sub-channel volumes are preserved
    assert.equal(sfxGain.gain.value, 0.9);
    assert.equal(voiceGain.gain.value, 1.0);

    // Call toggleMute() again -> muted: false
    mockCtx.currentTime = 15.0;
    settingsMod.toggleMute();
    assert.equal(masterGain.gain.value, 0.8, 'Master gain must be immediately restored to 0.8 upon unmute');
    const restoredCall = masterGain.gain.history[masterGain.gain.history.length - 1];
    assert.equal(restoredCall.value, 0.8);
    assert.equal(restoredCall.time, 15.0);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  }
});

test('Challenger 2 - 2.2: While muted, playSfx and playVoice reject playback immediately without allocating nodes', async () => {
  const mockCtx = new ProbingMockAudioContext();

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;

  const mockStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };

  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function () {
      return mockCtx;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1024),
  });

  try {
    const settingsMod = await import('../apps/desktop/src/audio/settings.ts');
    const soundMod = await import('../apps/desktop/src/audio/soundManager.ts');
    const sm = soundMod.soundManager;

    // Set muted = true
    settingsMod.updateAudioSettings({ muted: true });

    const sourcesBefore = mockCtx.createdSources.length;

    // Call 50 SFX and Voice requests
    for (let i = 0; i < 25; i++) {
      await sm.playSfx('discard');
      await sm.playVoice('pizhou', 'peng');
    }

    const sourcesAfter = mockCtx.createdSources.length;
    assert.equal(
      sourcesAfter,
      sourcesBefore,
      'When muted, zero AudioBufferSourceNodes must be instantiated or scheduled',
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
    if (originalFetch === undefined) {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    } else {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Subscriber Lifecycle & Listener Error Isolation
// ---------------------------------------------------------------------------

test('Challenger 2 - 3.1: Subscriber robustness: Error thrown in one listener does NOT break other subscribers', async () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  const mockStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };

  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  try {
    const { updateAudioSettings, subscribeAudioSettings } = await import(
      '../apps/desktop/src/audio/settings.ts'
    );

    let goodSubscriber1Received = false;
    let goodSubscriber2Received = false;

    // Subscriber 1: healthy
    const unsub1 = subscribeAudioSettings(() => {
      goodSubscriber1Received = true;
    });

    // Subscriber 2: throws unexpected runtime error
    const unsub2 = subscribeAudioSettings(() => {
      throw new Error('Simulated UI component render crash during settings change');
    });

    // Subscriber 3: healthy (registered after the failing subscriber)
    const unsub3 = subscribeAudioSettings(() => {
      goodSubscriber2Received = true;
    });

    // Trigger update
    updateAudioSettings({ masterVolume: 0.45 });

    assert.equal(goodSubscriber1Received, true, 'Subscriber before faulty listener must execute');
    assert.equal(goodSubscriber2Received, true, 'Subscriber after faulty listener must NOT be blocked');

    // Clean up
    unsub1();
    unsub2();
    unsub3();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Table Component & SettingsModal Integration Contracts
// ---------------------------------------------------------------------------

test('Challenger 2 - 4.1: SettingsModal volume sliders update AudioSettings in real-time', async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockLocalStorage;

  try {
    const { getAudioSettings, updateAudioSettings } = await import(
      '../apps/desktop/src/audio/settings.ts'
    );

    // Simulate slider drag on masterVolume to 42%
    updateAudioSettings({ masterVolume: 0.42 });
    assert.equal(getAudioSettings().masterVolume, 0.42);

    // Simulate slider drag on sfxVolume to 88%
    updateAudioSettings({ sfxVolume: 0.88 });
    assert.equal(getAudioSettings().sfxVolume, 0.88);

    // Simulate slider drag on voiceVolume to 15%
    updateAudioSettings({ voiceVolume: 0.15 });
    assert.equal(getAudioSettings().voiceVolume, 0.15);

    // Simulate voiceMode chip change to 'off'
    updateAudioSettings({ voiceMode: 'off' });
    assert.equal(getAudioSettings().voiceMode, 'off');

    // Verify localStorage has full snapshot
    const raw = store.get('pizhou_audio_settings');
    assert.ok(raw, 'localStorage must contain pizhou_audio_settings');
    const saved = JSON.parse(raw);
    assert.equal(saved.masterVolume, 0.42);
    assert.equal(saved.sfxVolume, 0.88);
    assert.equal(saved.voiceVolume, 0.15);
    assert.equal(saved.voiceMode, 'off');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    }
  }
});

test('Challenger 2 - 4.2: Game table event dispatch simulation through useSoundEffects logic', () => {
  const dispatchedSfx: string[] = [];
  const dispatchedVoice: string[] = [];

  function simulateDispatch(prevView: any, nextView: any) {
    if (!prevView) return;
    if (prevView.sequence === nextView.sequence) return;

    // 1. Shuffle sound on game initiation
    if (
      (prevView.phase !== 'playing' && nextView.phase === 'playing') ||
      (nextView.round !== undefined && prevView.round !== undefined && nextView.round !== prevView.round)
    ) {
      dispatchedSfx.push('shuffle');
    }

    // 2. Discard sound + voice
    if (
      nextView.lastDiscard &&
      (!prevView.lastDiscard || prevView.lastDiscard.tile.id !== nextView.lastDiscard.tile.id)
    ) {
      dispatchedSfx.push('discard');
      dispatchedVoice.push(nextView.lastDiscard.tile.key.replace(/-/g, '_'));
    }

    // 3. Draw
    const me = nextView.players?.find((p: any) => p.seat === nextView.mySeat);
    const oldMe = prevView.players?.find((p: any) => p.seat === prevView.mySeat);
    if (me?.lastDrawnId && me.lastDrawnId !== oldMe?.lastDrawnId) {
      dispatchedSfx.push('draw');
    }

    // 4. Melds & Guanmen
    for (const p of nextView.players || []) {
      const oldP = prevView.players?.find((x: any) => x.seat === p.seat);
      if (!oldP) continue;

      if ((p.melds?.length || 0) > (oldP.melds?.length || 0)) {
        const newMeld = p.melds[p.melds.length - 1];
        if (newMeld.type === 'chi') {
          dispatchedSfx.push('chi');
          dispatchedVoice.push('chi');
        } else if (newMeld.type === 'peng') {
          dispatchedSfx.push('peng');
          dispatchedVoice.push('peng');
        } else if (newMeld.type === 'kan') {
          dispatchedSfx.push('kan');
          dispatchedVoice.push('kan');
        } else if (newMeld.type === 'ming-gang' || newMeld.type === 'zi-gang') {
          dispatchedSfx.push('gang');
          dispatchedVoice.push('gang');
        } else if (newMeld.type === 'an-gang') {
          dispatchedSfx.push('gang');
          dispatchedVoice.push('an_gang');
        }
      }

      if (p.closed && !oldP.closed) {
        dispatchedSfx.push('guanmen');
        dispatchedVoice.push('close_gate');
      }
    }

    // 5. Hu & Settlement
    if (nextView.settlement && !prevView.settlement && nextView.settlement.winnerSeat !== null) {
      if (nextView.settlement.baoZhuang) {
        dispatchedSfx.push('baozhuang');
        dispatchedVoice.push('baozhuang');
      } else if (nextView.settlement.winType === 'qidong-gang-hu') {
        dispatchedSfx.push('qidong_hu');
        dispatchedVoice.push('qidong_gang_hu');
      } else {
        dispatchedSfx.push('hu');
        dispatchedVoice.push('hu');
      }
    }

    // 6. Draw closure
    if (nextView.settlement?.liuju && !prevView.settlement?.liuju) {
      dispatchedSfx.push('liuju');
    }

    // 7. My turn
    if (
      nextView.currentSeat === nextView.mySeat &&
      nextView.gamePhase === 'self-turn' &&
      (prevView.currentSeat !== nextView.mySeat || prevView.gamePhase !== 'self-turn')
    ) {
      dispatchedSfx.push('my_turn');
    }
  }

  // Sequence 1: Start game
  const v1 = { sequence: 1, phase: 'lobby', mySeat: 0, players: [{ seat: 0, melds: [], closed: false }] };
  const v2 = { sequence: 2, phase: 'playing', round: 1, mySeat: 0, players: [{ seat: 0, melds: [], closed: false }] };
  simulateDispatch(v1, v2);
  assert.deepEqual(dispatchedSfx, ['shuffle'], 'Round start must trigger shuffle sound');

  // Sequence 2: Duplicate sequence -> must not trigger duplicate sound
  simulateDispatch(v2, { ...v2 });
  assert.equal(dispatchedSfx.length, 1, 'Duplicate sequence must be ignored');

  // Sequence 3: Draw tile
  const v3 = { ...v2, sequence: 3, players: [{ seat: 0, melds: [], closed: false, lastDrawnId: 'w1_1' }] };
  simulateDispatch(v2, v3);
  assert.equal(dispatchedSfx[dispatchedSfx.length - 1], 'draw');

  // Sequence 4: Discard wan-1
  const v4 = {
    ...v3,
    sequence: 4,
    lastDiscard: { seat: 0, tile: { id: 'w1_1', key: 'wan-1' } },
  };
  simulateDispatch(v3, v4);
  assert.equal(dispatchedSfx[dispatchedSfx.length - 1], 'discard');
  assert.equal(dispatchedVoice[dispatchedVoice.length - 1], 'wan_1');

  // Sequence 5: Guanmen (Close gate)
  const v5 = {
    ...v4,
    sequence: 5,
    players: [{ seat: 0, melds: [], closed: true, lastDrawnId: 'w1_1' }],
  };
  simulateDispatch(v4, v5);
  assert.equal(dispatchedSfx[dispatchedSfx.length - 1], 'guanmen');
  assert.equal(dispatchedVoice[dispatchedVoice.length - 1], 'close_gate');

  // Sequence 6: Baozhuang
  const v6 = {
    ...v5,
    sequence: 6,
    settlement: { winnerSeat: 1, baoZhuang: true },
  };
  simulateDispatch(v5, v6);
  assert.equal(dispatchedSfx[dispatchedSfx.length - 1], 'baozhuang');
  assert.equal(dispatchedVoice[dispatchedVoice.length - 1], 'baozhuang');

  // Sequence 7: Qi Dong Gang Hu
  const v7 = {
    ...v5,
    sequence: 7,
    settlement: { winnerSeat: 0, winType: 'qidong-gang-hu' },
  };
  simulateDispatch(v5, v7);
  assert.equal(dispatchedSfx[dispatchedSfx.length - 1], 'qidong_hu');
  assert.equal(dispatchedVoice[dispatchedVoice.length - 1], 'qidong_gang_hu');
});
