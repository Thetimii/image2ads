"""Synthesize royalty-free SFX + a lo-fi beat for the reels. Output: public/sfx/*.wav"""
import numpy as np, os
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 48000
OUT = "public/sfx"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(d):
    return np.linspace(0, d, int(SR * d), endpoint=False)


def env(n, a=0.002, d=0.1, curve=3.0):
    x = np.linspace(0, 1, n)
    att = np.clip(x / max(a, 1e-6), 0, 1)
    dec = np.exp(-curve * x / max(d, 1e-6))
    return att * dec


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return lfilter(b, a, x)


def lp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2))
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), btype="high")
    return lfilter(b, a, x)


def save(name, x, gain=0.9):
    x = np.asarray(x, dtype=np.float64)
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    wavfile.write(f"{OUT}/{name}.wav", SR, (x * 32767).astype(np.int16))
    print(name, f"{len(x)/SR:.2f}s")


# ---- whoosh: noise, bandpass sweeping up, swell envelope
def whoosh(d=0.45, f0=300, f1=2500, rev=False):
    n = int(SR * d)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunk = 512
    for i in range(0, n, chunk):
        p = i / n
        if rev:
            p = 1 - p
        fc = f0 * (f1 / f0) ** p
        seg = noise[i : i + chunk]
        out[i : i + chunk] = bp(seg, fc * 0.6, fc * 1.6)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * e


save("whoosh", whoosh())
save("whoosh_rev", whoosh(0.5, 400, 3000, rev=True))
save("whoosh_short", whoosh(0.25, 500, 4000))

# ---- click: tiny noise burst + sine tick
n = int(SR * 0.06)
click = hp(rng.standard_normal(n), 2000) * env(n, 0.0005, 0.02, 6) + 0.5 * np.sin(
    2 * np.pi * 1800 * t(0.06)
) * env(n, 0.0005, 0.01, 8)
save("click", click)

# ---- tick (UI counter)
n = int(SR * 0.03)
tick = np.sin(2 * np.pi * 3200 * t(0.03)) * env(n, 0.0003, 0.006, 8)
save("tick", tick, 0.6)

# ---- pop (text appears)
n = int(SR * 0.12)
f = 900 * np.exp(-np.linspace(0, 1, n) * 4) + 250
pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.05, 5)
save("pop", pop, 0.7)

# ---- bass hit: pitch-dropping sine + sub + noise transient
def bass_hit(d=0.7, f0=180, f1=45):
    n = int(SR * d)
    x = np.linspace(0, 1, n)
    f = f1 + (f0 - f1) * np.exp(-x * 14)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env(n, 0.001, 0.35, 3.5)
    body += 0.4 * np.sin(ph * 0.5) * env(n, 0.001, 0.5, 3)
    trans = lp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.015, 8) * 0.6
    y = np.tanh((body + trans) * 2.2)
    return y


save("bass_hit", bass_hit())
save("bass_hit_big", bass_hit(1.1, 220, 40))

# ---- thud (drop)
n = int(SR * 0.3)
x = np.linspace(0, 1, n)
f = 60 + 120 * np.exp(-x * 20)
thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.12, 4) + 0.3 * lp(
    rng.standard_normal(n), 800
) * env(n, 0.0005, 0.02, 8)
save("thud", thud)

# ---- ding / success: major chord bell
def bell(freqs, d=1.2):
    n = int(SR * d)
    tt = t(d)
    y = np.zeros(n)
    for i, f in enumerate(freqs):
        y += np.sin(2 * np.pi * f * tt) * env(n, 0.002, 0.45 - i * 0.05, 3) * (0.8 ** i)
        y += 0.3 * np.sin(2 * np.pi * f * 2.01 * tt) * env(n, 0.002, 0.2, 4) * (0.8 ** i)
    return y


save("ding", bell([1318.5, 1661.2, 1975.5]))  # E6 G#6 B6
save("success", bell([659.3, 830.6, 987.8, 1318.5], 1.6))

# ---- riser: noise with rising bandpass + rising sine, 1.5s
def riser(d=1.5):
    n = int(SR * d)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunk = 512
    for i in range(0, n, chunk):
        p = i / n
        fc = 200 * (6000 / 200) ** p
        out[i : i + chunk] = bp(noise[i : i + chunk], fc * 0.7, fc * 1.5)
    x = np.linspace(0, 1, n)
    tone = np.sin(2 * np.pi * np.cumsum(80 + 400 * x**2) / SR) * 0.5
    e = x**2
    return (out + tone) * e


save("riser", riser())
save("riser_long", riser(2.5))

# ---- shutter
n = int(SR * 0.18)
sh = hp(rng.standard_normal(n), 1200) * (env(n, 0.0005, 0.02, 8) + 0.6 * np.roll(env(n, 0.0005, 0.02, 8), int(SR * 0.07)))
save("shutter", sh)

# ---- key press (typing)
n = int(SR * 0.05)
key = hp(rng.standard_normal(n), 1500) * env(n, 0.0003, 0.012, 8) + 0.3 * np.sin(2 * np.pi * 2400 * t(0.05)) * env(n, 0.0003, 0.008, 9)
save("key", key, 0.5)

# ---- scan beep (short soft blip)
n = int(SR * 0.09)
beep = np.sin(2 * np.pi * 1200 * t(0.09)) * env(n, 0.003, 0.03, 5)
save("beep", lp(beep, 4000), 0.5)

# ---- slot-machine roll stop (metallic clack)
n = int(SR * 0.08)
clack = bp(rng.standard_normal(n), 1500, 6000) * env(n, 0.0005, 0.02, 8)
save("clack", clack, 0.7)

# ---- notification (iOS-ish tri-tone)
def tri():
    parts = []
    for f, d in [(1046.5, 0.12), (1318.5, 0.12), (1568, 0.3)]:
        n = int(SR * d)
        parts.append(np.sin(2 * np.pi * f * t(d)) * env(n, 0.003, 0.5, 2.5))
    return np.concatenate(parts)


save("notify", tri(), 0.7)

# ---- lo-fi beat loop, 100 BPM, 16 s (20 bars of 4/4 @ 100bpm = 48s; make 16s)
def beat(d=16.0, bpm=100):
    n = int(SR * d)
    y = np.zeros(n)
    spb = 60 / bpm  # seconds per beat
    nb = int(d / spb)
    # kick
    kl = int(SR * 0.35)
    x = np.linspace(0, 1, kl)
    kf = 50 + 110 * np.exp(-x * 18)
    kick = np.sin(2 * np.pi * np.cumsum(kf) / SR) * env(kl, 0.001, 0.18, 4)
    # snare
    sl = int(SR * 0.22)
    snare = (bp(rng.standard_normal(sl), 800, 5000) * 0.7 + np.sin(2 * np.pi * 190 * t(0.22)) * 0.5) * env(sl, 0.001, 0.09, 5)
    # hat
    hl = int(SR * 0.06)
    hat = hp(rng.standard_normal(hl), 7000) * env(hl, 0.0005, 0.02, 6)
    # bass note pattern (A1, A1, C2, G1)
    bass_notes = [55.0, 55.0, 65.4, 49.0]
    for b in range(nb):
        s = int(b * spb * SR)
        bar = b // 4
        beat_in_bar = b % 4
        if beat_in_bar in (0, 2):
            y[s : s + kl] += kick[: max(0, min(kl, n - s))] * 0.9
        if beat_in_bar in (1, 3):
            y[s : s + sl] += snare[: max(0, min(sl, n - s))] * 0.45
        for h in range(2):
            hs = s + int(h * spb / 2 * SR)
            if hs + hl < n:
                y[hs : hs + hl] += hat * (0.25 if h == 0 else 0.15)
        # bass
        f = bass_notes[bar % 4]
        bl = int(spb * SR * 0.9)
        if s + bl < n:
            bass = np.sin(2 * np.pi * f * t(bl / SR)) * env(bl, 0.005, 0.6, 2)
            y[s : s + bl] += lp(bass, 300) * 0.5
    # lo-fi: lowpass + soft clip
    y = lp(y, 6000)
    y = np.tanh(y * 1.4)
    return y


save("beat", beat(), 0.8)
print("done")
