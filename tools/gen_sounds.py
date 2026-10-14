"""Generates the built-in sound effects (synthesized). Requires numpy, scipy, ffmpeg.
Run: python3 tools/gen_sounds.py   -> writes public/sounds/*.mp3
You can replace any of the output files with real recordings using the same filename."""
import numpy as np, subprocess, os, tempfile
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')

def tt(d): return np.arange(int(SR * d)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo/(SR/2), min(hi, SR/2-100)/(SR/2)], 'band', output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f/(SR/2), 'low', output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f/(SR/2), 'high', output='sos'), x)
def saw(ph): return 2 * (ph % 1) - 1
def norm(x, p=0.88): return x / (np.max(np.abs(x)) + 1e-9) * p
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a*SR)); nr = max(1, int(r*SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr)); return e
def reverb(x, secs=0.9, mix=0.22):
    n = int(SR*secs); ir = rng.standard_normal(n) * np.exp(-np.arange(n)/(SR*secs/4))
    wet = fftconvolve(x, ir)[:len(x)]; wet = wet/(np.max(np.abs(wet))+1e-9)*np.max(np.abs(x))
    return x*(1-mix) + wet*mix
def place(buf, snd, start):
    i = int(start*SR); j = min(len(buf), i+len(snd))
    if i < len(buf): buf[i:j] += snd[:j-i]

VOWELS = {'a': [(800, 90, 1.0), (1150, 100, .5), (2900, 150, .2)],
          'e': [(500, 70, 1.0), (1850, 110, .45), (2600, 150, .2)]}
def voice(f0, vowel='a', breath=0.05):
    ph = np.cumsum(f0)/SR; src = saw(ph) + 0.3*saw(ph*2.003)
    out = sum(g*bp(src, f-bw, f+bw) for f, bw, g in VOWELS[vowel])
    return out + breath*bp(rng.standard_normal(len(f0)), 1500, 5000)

def laugh():
    buf = np.zeros(int(SR*1.7)); base = 340
    for k in range(6):
        d = 0.15 if k < 5 else 0.3
        n = int(SR*d); t = np.arange(n)/SR
        f0 = (base - k*14) * (1 - 0.18*t/d) * (1 + 0.012*np.sin(2*np.pi*40*t))
        s = voice(f0, 'a', 0.25) * np.exp(-t/(d*0.55)) * env_ar(n, 0.008, 0.03)
        place(buf, s, 0.05 + k*0.2 + (0.05 if k == 5 else 0))
    buf += 0.35*voice(np.full(len(buf), 230.0)*np.linspace(1, .8, len(buf)), 'a')*np.interp(tt(1.7), [0, .05, 1.1, 1.6], [0, 1, .6, 0])*0
    return reverb(norm(buf), 0.5, .15)

def airhorn():
    buf = np.zeros(int(SR*1.9))
    for start, d in [(0.0, 0.38), (0.48, 1.15)]:
        n = int(SR*d); t = np.arange(n)/SR
        bend = 1 - 0.035*np.clip((t-(d-0.25))/0.25, 0, 1)
        s = np.zeros(n)
        for f, g in [(415, 1), (523, .9), (622, .8), (831, .4)]:
            for det in (-1.003, 1.0, 1.004):
                s += g*saw(np.cumsum(f*det*bend)/SR)
        s = np.tanh(2.2*lp(s/10, 6500)) * env_ar(n, 0.02, 0.12)
        s *= 1 + 0.06*np.sin(2*np.pi*28*t)
        place(buf, s, start)
    return norm(reverb(buf, 0.6, .12))

def drumroll():
    buf = np.zeros(int(SR*4.3)); t = 0.0; i = 0
    while t < 2.9:
        prog = t/2.9; vel = (0.25 + 0.75*prog) * rng.uniform(.75, 1.0)
        n = int(SR*0.12); tn = np.arange(n)/SR
        hit = bp(rng.standard_normal(n), 1800, 7000)*np.exp(-tn/0.028) + 0.8*np.sin(2*np.pi*190*tn)*np.exp(-tn/0.035)
        place(buf, hit*vel, t); t += 0.115 - 0.085*prog**1.3; i += 1
    n = int(SR*1.4); tn = np.arange(n)/SR
    crash = hp(rng.standard_normal(n), 3000)*np.exp(-tn/0.5) + 0.6*np.sin(2*np.pi*170*tn)*np.exp(-tn/0.06)
    place(buf, crash*1.2, 2.95)
    return norm(reverb(buf, 0.8, .2))

def sad_violin():
    notes = [(659, .75), (622, .75), (587, .75), (554, 2.1)]
    total = sum(d for _, d in notes) + 0.6; buf = np.zeros(int(SR*total)); pos = 0.0
    for idx, (f, d) in enumerate(notes):
        n = int(SR*(d+0.25)); t = np.arange(n)/SR; last = idx == len(notes)-1
        vib = 1 + (0.006 + 0.01*np.minimum(1, t/0.6))*np.sin(2*np.pi*5.4*t)*np.clip(t/0.25, 0, 1)
        droop = 1 - (0.025*np.clip((t-0.9)/1.2, 0, 1) if last else 0)
        ph = np.cumsum(f*vib*droop)/SR
        s = sum(np.sin(2*np.pi*ph*h + h)/h**0.9 for h in range(1, 14))
        s = lp(s, 3800) + 0.25*bp(s, 250, 450) + 0.3*bp(s, 900, 1300)
        e = np.minimum(1, t/0.09) * (np.clip((d+0.25-t)/0.2, 0, 1)) * (0.85 + 0.15*np.sin(2*np.pi*2.2*t))
        place(buf, s*e, pos); pos += d - 0.04
    return norm(reverb(buf, 1.3, .3))

def applause():
    dur = 3.8; n = int(SR*dur); t = tt(dur)
    dens = np.interp(t, [0, .6, 2.6, 3.8], [0, 1, .85, 0]); buf = np.zeros(n)
    cnt = 0
    while cnt < 650:
        x = rng.uniform(0, dur)
        if rng.uniform() > dens[min(n-1, int(x*SR))]: continue
        m = int(SR*rng.uniform(.008, .022)); tn = np.arange(m)/SR
        c = bp(rng.standard_normal(m), rng.uniform(700, 1800), rng.uniform(3500, 7500))*np.exp(-tn/0.004)
        place(buf, c*rng.uniform(.3, 1), x); cnt += 1
    buf = norm(buf) + 0.18*bp(rng.standard_normal(n), 600, 6500)*dens
    return norm(reverb(buf, 1.0, .25))

def cheering():
    dur = 3.0; buf = np.zeros(int(SR*dur))
    for _ in range(18):
        start = rng.uniform(0, .5); d = rng.uniform(1.6, 2.3); n = int(SR*d); t = np.arange(n)/SR
        base = rng.choice([190, 220, 260, 330, 400]) * rng.uniform(.95, 1.05)
        f0 = base*(0.85 + 0.3*np.clip(t/0.3, 0, 1) - 0.1*np.clip((t-d+0.6)/0.6, 0, 1))
        f0 = f0*(1 + 0.02*np.sin(2*np.pi*rng.uniform(5, 7)*t + rng.uniform(0, 6)))
        v = voice(f0, rng.choice(['a', 'e']), 0.12)*env_ar(n, 0.12, 0.5)
        place(buf, v*rng.uniform(.5, 1), start)
    claps = applause()[:len(buf)]
    buf = norm(buf) + 0.35*np.pad(claps, (0, max(0, len(buf)-len(claps))))
    return norm(reverb(buf, .9, .25))

SOUNDS = dict(laugh=laugh, applause=applause, airhorn=airhorn, drumroll=drumroll, **{'sad-violin': sad_violin}, cheering=cheering)
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SOUNDS.items():
        x = fn(); assert np.isfinite(x).all()
        fade = np.ones(len(x)); k = int(.02*SR); fade[-k:] = np.linspace(1, 0, k)
        wav = os.path.join(tempfile.gettempdir(), name+'.wav')
        wavfile.write(wav, SR, (np.clip(x*fade, -1, 1)*32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-b:a', '112k', '-ac', '1', os.path.join(OUT, name+'.mp3')], check=True)
        print(name, round(len(x)/SR, 2), 's')
