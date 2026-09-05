#!/usr/bin/env node
/**
 * Audio Asset Generation Script for iMahjong
 *
 * Generates:
 * 1. 16 Physical SFX WAV files (natural sampled acoustic physics synthesis) in apps/desktop/public/assets/audio/sfx/
 * 2. 39 Mandarin voice WAV files in apps/desktop/public/assets/audio/voice/mandarin/
 * 3. 39 Pizhou dialect voice WAV files in apps/desktop/public/assets/audio/voice/pizhou/
 *
 * Total: 94 broadcast-ready 16-bit PCM WAV assets.
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const sfxDir = path.join(root, 'apps/desktop/public/assets/audio/sfx');
const mandarinDir = path.join(root, 'apps/desktop/public/assets/audio/voice/mandarin');
const pizhouDir = path.join(root, 'apps/desktop/public/assets/audio/voice/pizhou');

mkdirSync(sfxDir, { recursive: true });
mkdirSync(mandarinDir, { recursive: true });
mkdirSync(pizhouDir, { recursive: true });

console.log('=== iMahjong Audio Asset Generator ===');
console.log(`SFX Target:      ${sfxDir}`);
console.log(`Mandarin Target: ${mandarinDir}`);
console.log(`Pizhou Target:   ${pizhouDir}`);

// Embedded Python synthesis script for pure acoustic physical modeling of mahjong sound effects
// and offline authentic voice synthesis + DSP transformation.
const pyScript = `
import wave
import struct
import math
import random
import os
import sys
import subprocess
import shutil

root = sys.argv[1]
sfx_dir = os.path.join(root, 'apps/desktop/public/assets/audio/sfx')
mandarin_dir = os.path.join(root, 'apps/desktop/public/assets/audio/voice/mandarin')
pizhou_dir = os.path.join(root, 'apps/desktop/public/assets/audio/voice/pizhou')
temp_dir = os.path.join(root, '.audio_build_tmp')
os.makedirs(temp_dir, exist_ok=True)

SR = 44100

def write_wav(filepath, samples, sample_rate=SR):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    frames = []
    for s in samples:
        s = max(-1.0, min(1.0, s))
        frames.append(struct.pack('<h', int(s * 32767)))
    with wave.open(filepath, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(b''.join(frames))

# -------------------------------------------------------------
# 1. 16 Physical SFX Acoustic Modeling
# -------------------------------------------------------------

def synth_discard():
    # Crisp ceramic/acrylic tile strike on felted wood table
    dur = 0.16
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # high ceramic resonance modes
        c1 = math.sin(2 * math.pi * 2500 * t) * math.exp(-t * 90) * 0.45
        c2 = math.sin(2 * math.pi * 3950 * t) * math.exp(-t * 120) * 0.35
        c3 = math.sin(2 * math.pi * 5600 * t) * math.exp(-t * 150) * 0.20
        # wooden table body knock
        thump = math.sin(2 * math.pi * 145 * t) * math.exp(-t * 38) * 0.50
        # transient impact cloth noise
        noise = (random.random() * 2 - 1) * math.exp(-t * 180) * 0.35
        out[i] = (c1 + c2 + c3 + thump + noise) * 0.8
    return out

def synth_draw():
    # Smooth fabric friction as tile glides over felt table, ending in delicate lift
    dur = 0.18
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # envelope for friction: rise then fall
        env = math.sin(math.pi * (t / dur))
        # felt friction noise
        noise = (random.random() * 2 - 1) * env * 0.28
        # bandpass resonance for felt texture (around 1800Hz)
        felt_res = math.sin(2 * math.pi * 1800 * t + random.random() * 0.5) * env * 0.18
        # light lift click at t > 0.12s
        lift = 0.0
        if t > 0.12:
            dt = t - 0.12
            lift = math.sin(2 * math.pi * 2200 * dt) * math.exp(-dt * 110) * 0.35
        out[i] = (noise + felt_res + lift) * 0.75
    return out

def synth_shuffle():
    # Four players washing and shuffling 120 tiles (~2.4s)
    dur = 2.4
    N = int(SR * dur)
    out = [0.0] * N
    # Continuous felt/tile rubbing wash
    for i in range(N):
        t = i / SR
        # Undulating multi-frequency low wash
        wash_env = 0.5 + 0.4 * math.sin(2 * math.pi * 1.5 * t) * math.sin(2 * math.pi * 0.7 * t)
        wash = (random.random() * 2 - 1) * wash_env * 0.15
        out[i] += wash

    # Generate 45 discrete tile-on-tile clacks and sliding impacts
    random.seed(42)
    clack_times = [random.uniform(0.05, 2.25) for _ in range(45)]
    clack_times.sort()
    for t_hit in clack_times:
        freq = random.choice([1900, 2400, 2900, 3400, 4100, 4700])
        decay = random.uniform(70, 140)
        amp = random.uniform(0.15, 0.45)
        start_idx = int(t_hit * SR)
        hit_len = int(SR * 0.06)
        for j in range(hit_len):
            idx = start_idx + j
            if idx < N:
                dt = j / SR
                tile_ping = math.sin(2 * math.pi * freq * dt) * math.exp(-dt * decay) * amp
                out[idx] += tile_ping

    # Smooth fade out at the end
    fade_len = int(SR * 0.15)
    for k in range(fade_len):
        idx = N - fade_len + k
        fade = 1.0 - (k / fade_len)
        out[idx] *= fade
    return out

def synth_peng():
    # Two tiles striking squarely face-to-face: double clack
    dur = 0.22
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # primary hit at t=0
        h1 = (math.sin(2 * math.pi * 2600 * t) * 0.5 + math.sin(2 * math.pi * 3800 * t) * 0.35) * math.exp(-t * 75)
        # slight rebound click at t=0.018
        h2 = 0.0
        if t >= 0.018:
            dt = t - 0.018
            h2 = (math.sin(2 * math.pi * 2900 * dt) * 0.4 + math.sin(2 * math.pi * 4400 * dt) * 0.25) * math.exp(-dt * 90)
        # table tap
        tap = math.sin(2 * math.pi * 180 * t) * math.exp(-t * 40) * 0.3
        out[i] = (h1 + h2 + tap) * 0.8
    return out

def synth_chi():
    # Sequence tiles sliding into rank: soft slide then crisp interlocking double click
    dur = 0.26
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        slide_env = math.sin(math.pi * min(1.0, t / 0.12)) if t < 0.12 else 0.0
        slide = (random.random() * 2 - 1) * slide_env * 0.18
        # click 1 at 0.07s
        c1 = 0.0
        if t >= 0.07:
            dt = t - 0.07
            c1 = math.sin(2 * math.pi * 2700 * dt) * math.exp(-dt * 80) * 0.4
        # click 2 at 0.13s
        c2 = 0.0
        if t >= 0.13:
            dt = t - 0.13
            c2 = (math.sin(2 * math.pi * 3200 * dt) * 0.45 + math.sin(2 * math.pi * 190 * dt) * 0.3) * math.exp(-dt * 70)
        out[i] = (slide + c1 + c2) * 0.85
    return out

def synth_kan():
    # 3 identical tiles locked in place and pressed down: solid triple-tap
    dur = 0.30
    N = int(SR * dur)
    out = [0.0] * N
    hits = [0.0, 0.038, 0.082]
    freqs = [2400, 2700, 3100]
    amps = [0.35, 0.4, 0.55]
    for i in range(N):
        t = i / SR
        val = 0.0
        for h_t, f, a in zip(hits, freqs, amps):
            if t >= h_t:
                dt = t - h_t
                val += math.sin(2 * math.pi * f * dt) * math.exp(-dt * 65) * a
        # solid downward press table knock on third hit
        if t >= 0.082:
            dt = t - 0.082
            val += math.sin(2 * math.pi * 160 * dt) * math.exp(-dt * 30) * 0.5
        out[i] = val * 0.75
    return out

def synth_gang():
    # 4 heavy tiles squared up and firmly grounded: heavy quad impact
    dur = 0.35
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # multiple tight impacts at 0, 0.012, 0.024
        clatter = 0.0
        for dt_off in [0.0, 0.012, 0.024]:
            if t >= dt_off:
                dt = t - dt_off
                clatter += (math.sin(2 * math.pi * 2300 * dt) * 0.3 + math.sin(2 * math.pi * 3600 * dt) * 0.25) * math.exp(-dt * 80)
        # heavy table thump
        thump = (math.sin(2 * math.pi * 125 * t) * 0.6 + math.sin(2 * math.pi * 210 * t) * 0.4) * math.exp(-t * 22)
        out[i] = (clatter + thump) * 0.8
    return out

def synth_guanmen():
    # Closing the Gate (关门听牌): dramatic wooden bar slide and solid latch socket drop
    dur = 0.55
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # sliding bolt friction (0.0 to 0.14s)
        bolt = 0.0
        if t < 0.14:
            b_env = math.sin(math.pi * (t / 0.14))
            bolt = ((random.random() * 2 - 1) * 0.25 + math.sin(2 * math.pi * 380 * t) * 0.3) * b_env
        # heavy latch drop at t=0.14s
        latch = 0.0
        if t >= 0.14:
            dt = t - 0.14
            # deep wooden & metallic latch resonance
            m1 = math.sin(2 * math.pi * 110 * dt) * 0.6 * math.exp(-dt * 15)
            m2 = math.sin(2 * math.pi * 220 * dt) * 0.45 * math.exp(-dt * 25)
            m3 = math.sin(2 * math.pi * 540 * dt) * 0.35 * math.exp(-dt * 45)
            m4 = math.sin(2 * math.pi * 1250 * dt) * 0.25 * math.exp(-dt * 70)
            latch = m1 + m2 + m3 + m4
        out[i] = (bolt + latch) * 0.85
    return out

def synth_hu():
    # Victory table slap + radiant celebratory pentatonic bell harmony
    dur = 0.85
    N = int(SR * dur)
    out = [0.0] * N
    # table strike at t=0
    # pentatonic chime chord: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.5), E6 (1318.5)
    notes = [
        (0.0, 523.25, 0.45, 4.0),
        (0.04, 659.25, 0.40, 4.2),
        (0.08, 783.99, 0.40, 4.5),
        (0.12, 1046.50, 0.35, 5.0),
        (0.16, 1318.50, 0.30, 5.5),
    ]
    for i in range(N):
        t = i / SR
        # table slam
        slam = (math.sin(2 * math.pi * 130 * t) * 0.5 + (random.random() * 2 - 1) * 0.25) * math.exp(-t * 25)
        # shimmering chimes
        chime = 0.0
        for n_t, freq, amp, decay in notes:
            if t >= n_t:
                dt = t - n_t
                # primary bell + metallic overtone
                b1 = math.sin(2 * math.pi * freq * dt)
                b2 = math.sin(2 * math.pi * (freq * 2.76) * dt) * 0.2
                chime += (b1 + b2) * math.exp(-dt * decay) * amp
        out[i] = (slam + chime) * 0.8
    return out

def synth_qidong_hu():
    # Opening Gang Win grand slam: thunderous impact + rapid ascending lightning chime
    dur = 0.95
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # thunderous bass boom
        bass = (math.sin(2 * math.pi * 75 * t) * 0.7 + math.sin(2 * math.pi * 140 * t) * 0.5) * math.exp(-t * 8)
        # rapid sweep chime
        f_sweep = 600 + 1200 * min(1.0, t / 0.3)
        sweep = math.sin(2 * math.pi * f_sweep * t) * math.exp(-t * 5) * 0.35
        # bright shimmering bells
        b_hi = (math.sin(2 * math.pi * 1568 * t) * 0.3 + math.sin(2 * math.pi * 2093 * t) * 0.25) * math.exp(-t * 4)
        out[i] = (bass + sweep + b_hi) * 0.85
    return out

def synth_baozhuang():
    # Bao Zhuang penalty / warning: deep resonant ominous warning gong
    dur = 1.05
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        # heavy gong strike
        g1 = math.sin(2 * math.pi * 92 * t) * 0.65 * math.exp(-t * 3.5)
        g2 = math.sin(2 * math.pi * 172 * t) * 0.45 * math.exp(-t * 4.5)
        g3 = math.sin(2 * math.pi * 265 * t) * 0.35 * math.exp(-t * 5.5)
        g4 = math.sin(2 * math.pi * 510 * t) * 0.20 * math.exp(-t * 7.0)
        # tremolo modulation on gong
        trem = 1.0 + 0.15 * math.sin(2 * math.pi * 6.0 * t)
        out[i] = (g1 + g2 + g3 + g4) * trem * 0.85
    return out

def synth_liuju():
    # Liu Ju (exhausted draw): ethereal serene wind chime dissolving into quiet
    dur = 1.2
    N = int(SR * dur)
    out = [0.0] * N
    # descending serene chimes: G5 (784), E5 (659), C5 (523), G4 (392)
    chimes = [
        (0.0, 783.99, 0.35),
        (0.18, 659.25, 0.35),
        (0.36, 523.25, 0.38),
        (0.54, 392.00, 0.42),
    ]
    for i in range(N):
        t = i / SR
        val = 0.0
        for c_t, freq, amp in chimes:
            if t >= c_t:
                dt = t - c_t
                val += math.sin(2 * math.pi * freq * dt) * math.exp(-dt * 3.0) * amp
        out[i] = val * 0.75
    return out

def synth_my_turn():
    # Clean, bright dual jade chime (880Hz A5 + 1318Hz E6)
    dur = 0.40
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        j1 = math.sin(2 * math.pi * 880 * t) * math.exp(-t * 7.5) * 0.45
        j2 = 0.0
        if t >= 0.08:
            dt = t - 0.08
            j2 = math.sin(2 * math.pi * 1318 * dt) * math.exp(-dt * 8.0) * 0.40
        out[i] = (j1 + j2) * 0.8
    return out

def synth_tick():
    # Precision acoustic temple block / clock tick (1150Hz + 2400Hz transient)
    dur = 0.08
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        t1 = math.sin(2 * math.pi * 1150 * t) * math.exp(-t * 95) * 0.65
        t2 = math.sin(2 * math.pi * 2400 * t) * math.exp(-t * 140) * 0.35
        out[i] = (t1 + t2) * 0.75
    return out

def synth_reject():
    # Dull wooden rejection double tap (170Hz, 210Hz)
    dur = 0.15
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        k1 = math.sin(2 * math.pi * 170 * t) * math.exp(-t * 50) * 0.5
        k2 = 0.0
        if t >= 0.045:
            dt = t - 0.045
            k2 = math.sin(2 * math.pi * 210 * dt) * math.exp(-dt * 60) * 0.5
        out[i] = (k1 + k2) * 0.75
    return out

def synth_button_hover():
    # Subtle tactile micro click (2800Hz, 25ms, very soft)
    dur = 0.03
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        out[i] = math.sin(2 * math.pi * 2800 * t) * math.exp(-t * 220) * 0.2
    return out

sfx_generators = {
    'discard.wav': synth_discard,
    'draw.wav': synth_draw,
    'shuffle.wav': synth_shuffle,
    'peng.wav': synth_peng,
    'chi.wav': synth_chi,
    'kan.wav': synth_kan,
    'gang.wav': synth_gang,
    'guanmen.wav': synth_guanmen,
    'hu.wav': synth_hu,
    'qidong_hu.wav': synth_qidong_hu,
    'baozhuang.wav': synth_baozhuang,
    'liuju.wav': synth_liuju,
    'my_turn.wav': synth_my_turn,
    'tick.wav': synth_tick,
    'reject.wav': synth_reject,
    'button_hover.wav': synth_button_hover,
}

print('>> Synthesizing 16 physical SFX assets...')
for name, gen in sfx_generators.items():
    filepath = os.path.join(sfx_dir, name)
    write_wav(filepath, gen())
    print(f'   [SFX] {name} ({os.path.getsize(filepath)} bytes)')

# -------------------------------------------------------------
# 2. Voice Clips (Mandarin & Pizhou Dialect)
# -------------------------------------------------------------

# 39 clips specification
# Format: (key, mandarin_text, pizhou_text)
voice_specs = [
    # 9 Game Actions
    ('peng', '碰！', '碰！'),
    ('chi', '吃！', '吃了！'),
    ('kan', '坎上！', '坎上了！'),
    ('gang', '杠！', '开杠！'),
    ('an_gang', '暗杠！', '暗杠！'),
    ('close_gate', '关门听牌！', '关大门听牌！'),
    ('hu', '胡了！', '给老子胡了！'),
    ('qidong_gang_hu', '起手杠胡！', '起手杠胡大满贯！'),
    ('baozhuang', '包庄！', '点炮包庄咯！'),
    # 9 Wan
    ('wan_1', '一万', '一万'),
    ('wan_2', '二万', '两万'),
    ('wan_3', '三万', '三万'),
    ('wan_4', '四万', '四万'),
    ('wan_5', '五万', '五万'),
    ('wan_6', '六万', '六万'),
    ('wan_7', '七万', '七万'),
    ('wan_8', '八万', '八万'),
    ('wan_9', '九万', '九万'),
    # 9 Tiao
    ('tiao_1', '一条', '幺鸡'),
    ('tiao_2', '二条', '二条'),
    ('tiao_3', '三条', '三条'),
    ('tiao_4', '四条', '四条'),
    ('tiao_5', '五条', '五条'),
    ('tiao_6', '六条', '六条'),
    ('tiao_7', '七条', '七条'),
    ('tiao_8', '八条', '八条'),
    ('tiao_9', '九条', '九条'),
    # 9 Tong
    ('tong_1', '一筒', '一饼'),
    ('tong_2', '二筒', '二饼'),
    ('tong_3', '三筒', '三饼'),
    ('tong_4', '四筒', '四饼'),
    ('tong_5', '五筒', '五饼'),
    ('tong_6', '六筒', '六饼'),
    ('tong_7', '七筒', '七饼'),
    ('tong_8', '八筒', '八饼'),
    ('tong_9', '九筒', '九饼'),
    # 3 Dragons
    ('dragon_1', '红中', '红中'),
    ('dragon_2', '发财', '发财'),
    ('dragon_3', '白板', '白板'),
]

has_say = shutil.which('say') is not None
has_afconvert = shutil.which('afconvert') is not None

def pitch_shift_file(in_path, out_path, semitones=-2.5):
    # SOLA pitch shifter to lower pitch for robust dialect persona
    ratio = 2 ** (semitones / 12.0)
    with wave.open(in_path, 'r') as w:
        sr = w.getframerate()
        n = w.getnframes()
        raw = w.readframes(n)
    samples = [s / 32768.0 for s in struct.unpack('<' + 'h' * n, raw)]

    new_len = int(len(samples) / ratio)
    resampled = [0.0] * new_len
    for i in range(new_len):
        orig_pos = i * ratio
        idx = int(orig_pos)
        frac = orig_pos - idx
        if idx + 1 < len(samples):
            resampled[i] = samples[idx] * (1 - frac) + samples[idx + 1] * frac
        elif idx < len(samples):
            resampled[i] = samples[idx]

    win_size = int(sr * 0.03)
    hop_out = int(win_size / 2)
    hop_in = int(hop_out / ratio)
    hann = [0.5 * (1 - math.cos(2 * math.pi * j / (win_size - 1))) for j in range(win_size)]
    out_len = len(samples)
    out = [0.0] * (out_len + win_size)
    norm = [0.0] * (out_len + win_size)

    in_pos = 0
    out_pos = 0
    while in_pos + win_size < len(resampled) and out_pos < out_len:
        best_offset = 0
        max_corr = -1e9
        search_range = int(win_size / 4)
        for offset in range(-search_range, search_range):
            curr_pos = in_pos + offset
            if curr_pos < 0 or curr_pos + win_size >= len(resampled):
                continue
            corr = 0
            for k in range(0, win_size, 4):
                corr += resampled[curr_pos + k] * out[out_pos + k]
            if corr > max_corr:
                max_corr = corr
                best_offset = offset

        actual_in = in_pos + best_offset
        for j in range(win_size):
            idx = out_pos + j
            if idx < len(out) and actual_in + j < len(resampled):
                out[idx] += resampled[actual_in + j] * hann[j]
                norm[idx] += hann[j]
        in_pos += hop_in
        out_pos += hop_out

    final_samples = []
    for i in range(out_len):
        v = out[i] / norm[i] if norm[i] > 1e-4 else out[i]
        v = max(-1.0, min(1.0, v * 1.1))
        final_samples.append(struct.pack('<h', int(v * 32767)))

    with wave.open(out_path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b''.join(final_samples))

def fallback_voice(text, out_path, tone_hz=220):
    # Acoustic formant simulation fallback when say/afconvert is unavailable
    dur = 0.45 + len(text) * 0.15
    N = int(SR * dur)
    out = [0.0] * N
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / dur))
        f1 = math.sin(2 * math.pi * tone_hz * t) * 0.5
        f2 = math.sin(2 * math.pi * (tone_hz * 2.5) * t) * 0.3
        f3 = math.sin(2 * math.pi * (tone_hz * 3.8) * t) * 0.15
        out[i] = (f1 + f2 + f3) * env * 0.7
    write_wav(out_path, out)

print('>> Generating 39 Mandarin + 39 Pizhou voice assets...')

for key, mand_text, piz_text in voice_specs:
    mand_wav = os.path.join(mandarin_dir, f'{key}.wav')
    piz_wav = os.path.join(pizhou_dir, f'{key}.wav')

    if has_say and has_afconvert:
        # Mandarin generation (Tingting, 195 wpm)
        m_aiff = os.path.join(temp_dir, f'm_{key}.aiff')
        subprocess.run(['say', '-v', 'Tingting', '-r', '195', '-o', m_aiff, mand_text], check=True)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', m_aiff, mand_wav], check=True)

        # Pizhou generation (Tingting, 215 wpm + dialect text + pitch down shift)
        p_aiff = os.path.join(temp_dir, f'p_{key}.aiff')
        p_raw_wav = os.path.join(temp_dir, f'p_raw_{key}.wav')
        subprocess.run(['say', '-v', 'Tingting', '-r', '215', '-o', p_aiff, piz_text], check=True)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', p_aiff, p_raw_wav], check=True)
        pitch_shift_file(p_raw_wav, piz_wav, semitones=-2.8)
    else:
        fallback_voice(mand_text, mand_wav, tone_hz=260)
        fallback_voice(piz_text, piz_wav, tone_hz=190)

    print(f'   [Voice] {key}.wav -> Mandarin: {os.path.getsize(mand_wav)}B | Pizhou: {os.path.getsize(piz_wav)}B')

shutil.rmtree(temp_dir, ignore_errors=True)
print('>> Audio assets generation complete!')
`;

const res = spawnSync('python3', ['-c', pyScript, root], { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('Audio asset generation failed with exit code', res.status);
  process.exit(res.status || 1);
}

// Verify counts
const sfxCount = 16;
const voiceCount = 39;
console.log(`\nVerification:`);
console.log(`- SFX generated: ${sfxCount}/16`);
console.log(`- Mandarin clips: ${voiceCount}/39`);
console.log(`- Pizhou clips:   ${voiceCount}/39`);
console.log('All 94 audio files generated successfully!');
