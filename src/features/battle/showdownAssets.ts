import { Dex } from '@pkmn/dex'
const SD_BASE = 'https://play.pokemonshowdown.com'
export interface BgmTrack {
    id: string
    file: string
    zh: string
    en: string
    ja: string
}
export const BATTLE_BGM_TRACKS: BgmTrack[] = [
    { id: 'xy-trainer', file: 'xy-trainer.mp3', zh: 'XY 训练家对战', en: 'XY Trainer', ja: 'XY トレーナー戦' },
    { id: 'sm-trainer', file: 'sm-trainer.mp3', zh: '日月 训练家对战', en: 'SM Trainer', ja: 'SM トレーナー戦' },
    { id: 'oras-trainer', file: 'oras-trainer.mp3', zh: 'ORAS 训练家对战', en: 'ORAS Trainer', ja: 'ORAS トレーナー戦' },
    { id: 'bw-rival', file: 'bw-rival.mp3', zh: '黑白 劲敌对战', en: 'BW Rival', ja: 'BW ライバル戦' },
    { id: 'bw2-kanto', file: 'bw2-kanto-gym-leader.mp3', zh: '黑白2 关都馆主', en: 'BW2 Kanto Gym', ja: 'BW2 カントージムリーダー' },
    { id: 'dpp-rival', file: 'dpp-rival.mp3', zh: '珍钻 劲敌对战', en: 'DPP Rival', ja: 'DPPt ライバル戦' },
    { id: 'hgss-johto', file: 'hgss-johto-trainer.mp3', zh: '心金魂银 城都训练家', en: 'HGSS Johto Trainer', ja: 'HGSS ジョウトトレーナー戦' },
    { id: 'hgss-kanto', file: 'hgss-kanto-trainer.mp3', zh: '心金魂银 关都训练家', en: 'HGSS Kanto Trainer', ja: 'HGSS カントートレーナー戦' },
    { id: 'spl-elite4', file: 'spl-elite4.mp3', zh: '四天王决战', en: 'Elite Four Remix', ja: '四天王戦' },
]
let bgmAudio: HTMLAudioElement | null = null
let bgmMutedState = false
let globalSfxMuted = false
const BGM_VOLUME = 0.25
let sharedCtx: AudioContext | null = null
let masterBus: DynamicsCompressorNode | null = null
let punchBus: WaveShaperNode | null = null
let reverbSend: GainNode | null = null
let noiseBufferCache: AudioBuffer | null = null
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
export function setGlobalSfxMuted(muted: boolean) {
    globalSfxMuted = muted
}
export function startBattleBgm(trackId: string, muted: boolean) {
    stopBattleBgm()
    bgmMutedState = muted
    const chosen =
        trackId === '__random__'
            ? BATTLE_BGM_TRACKS[Math.floor(Math.random() * BATTLE_BGM_TRACKS.length)]
            : BATTLE_BGM_TRACKS.find((t) => t.id === trackId) || BATTLE_BGM_TRACKS[0]
    const audio = new Audio(`${SD_BASE}/audio/${chosen.file}`)
    audio.loop = true
    audio.volume = muted ? 0 : BGM_VOLUME
    bgmAudio = audio
    if (!muted) {
        void audio.play().catch(() => { })
    }
    return chosen
}
export function setBattleBgmMuted(muted: boolean) {
    bgmMutedState = muted
    if (!bgmAudio) return
    bgmAudio.volume = muted ? 0 : BGM_VOLUME
    if (muted) {
        bgmAudio.pause()
    } else {
        void bgmAudio.play().catch(() => { })
    }
}
export function resumeBattleBgmIfNeeded() {
    if (bgmAudio && !bgmMutedState && bgmAudio.paused) {
        void bgmAudio.play().catch(() => { })
    }
}
export function stopBattleBgm() {
    if (!bgmAudio) return
    bgmAudio.pause()
    bgmAudio.currentTime = 0
    bgmAudio = null
}
function makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 256
    const curve = new Float32Array(new ArrayBuffer(n * 4))
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x))
    }
    return curve
}
function ensureAudioGraph(): { ctx: AudioContext; out: AudioNode; punch: AudioNode; fx: AudioNode } | null {
    try {
        if (!sharedCtx) {
            const AudioCtx =
                window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            sharedCtx = new AudioCtx()
            const comp = sharedCtx.createDynamicsCompressor()
            comp.threshold.value = -12
            comp.knee.value = 14
            comp.ratio.value = 8
            comp.attack.value = 0.002
            comp.release.value = 0.14
            comp.connect(sharedCtx.destination)
            masterBus = comp
            const shaper = sharedCtx.createWaveShaper()
            shaper.curve = makeDriveCurve(26)
            shaper.oversample = '2x'
            const punchGain = sharedCtx.createGain()
            punchGain.gain.value = 0.92
            shaper.connect(punchGain)
            punchGain.connect(comp)
            punchBus = shaper
            const send = sharedCtx.createGain()
            send.gain.value = 0.25
            const d1 = sharedCtx.createDelay(0.5)
            d1.delayTime.value = 0.055
            const d2 = sharedCtx.createDelay(0.5)
            d2.delayTime.value = 0.115
            const fb = sharedCtx.createGain()
            fb.gain.value = 0.24
            const lp = sharedCtx.createBiquadFilter()
            lp.type = 'lowpass'
            lp.frequency.value = 2600
            send.connect(d1)
            d1.connect(lp)
            lp.connect(d2)
            d2.connect(fb)
            fb.connect(d1)
            lp.connect(comp)
            d2.connect(comp)
            reverbSend = send
        }
        if (sharedCtx.state === 'suspended') {
            void sharedCtx.resume().catch(() => { })
        }
        return sharedCtx && masterBus && punchBus && reverbSend
            ? { ctx: sharedCtx, out: masterBus, punch: punchBus, fx: reverbSend }
            : null
    } catch {
        return null
    }
}
export function unlockBattleAudio() {
    ensureAudioGraph()
    resumeBattleBgmIfNeeded()
}
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (noiseBufferCache && noiseBufferCache.sampleRate === ctx.sampleRate) return noiseBufferCache
    const len = ctx.sampleRate * 1.2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1
    }
    noiseBufferCache = buf
    return buf
}
function spawnNoise(
    ctx: AudioContext,
    dest: AudioNode,
    startOffset: number,
    dur: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    q: number,
    peakVol: number,
    attack = 0.004
) {
    const t0 = ctx.currentTime + startOffset
    const src = ctx.createBufferSource()
    src.buffer = getNoiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.Q.value = q
    filter.frequency.setValueAtTime(Math.max(30, freqStart), t0)
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(peakVol, t0 + Math.min(attack, dur * 0.25))
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    src.start(t0)
    src.stop(t0 + dur + 0.03)
}
function spawnTone(
    ctx: AudioContext,
    dest: AudioNode,
    startOffset: number,
    dur: number,
    type: OscillatorType,
    fStart: number,
    fEnd: number,
    peakVol: number,
    attack = 0.005
) {
    const t0 = ctx.currentTime + startOffset
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(24, fStart), t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, fEnd), t0 + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(peakVol, t0 + Math.min(attack, dur * 0.35))
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(dest)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
}
function spawnFm(
    ctx: AudioContext,
    dest: AudioNode,
    startOffset: number,
    dur: number,
    carrierStart: number,
    carrierEnd: number,
    modFreq: number,
    modDepth: number,
    peakVol: number
) {
    const t0 = ctx.currentTime + startOffset
    const car = ctx.createOscillator()
    const mod = ctx.createOscillator()
    const modGain = ctx.createGain()
    const outGain = ctx.createGain()
    car.type = 'sine'
    mod.type = 'sawtooth'
    car.frequency.setValueAtTime(Math.max(40, carrierStart), t0)
    car.frequency.exponentialRampToValueAtTime(Math.max(40, carrierEnd), t0 + dur)
    mod.frequency.setValueAtTime(modFreq, t0)
    modGain.gain.setValueAtTime(modDepth, t0)
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, modDepth * 0.12), t0 + dur)
    outGain.gain.setValueAtTime(0.0001, t0)
    outGain.gain.linearRampToValueAtTime(peakVol, t0 + Math.min(0.01, dur * 0.2))
    outGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    mod.connect(modGain)
    modGain.connect(car.frequency)
    car.connect(outGain)
    outGain.connect(dest)
    car.start(t0)
    mod.start(t0)
    car.stop(t0 + dur + 0.03)
    mod.stop(t0 + dur + 0.03)
}
export function playUiSfx(kind: 'click' | 'confirm' | 'cancel' | 'tera' | 'hover') {
    if (globalSfxMuted) return
    const g = ensureAudioGraph()
    if (!g) return
    const { ctx, out, fx } = g
    if (kind === 'confirm') {
        spawnTone(ctx, out, 0, 0.055, 'triangle', 740, 820, 0.14, 0.004)
        spawnTone(ctx, fx, 0.045, 0.11, 'triangle', 1108, 1175, 0.15, 0.004)
        spawnNoise(ctx, out, 0, 0.012, 'highpass', 3600, 2400, 1.0, 0.07, 0.002)
    } else if (kind === 'cancel') {
        spawnTone(ctx, out, 0, 0.065, 'triangle', 560, 340, 0.13, 0.004)
        spawnNoise(ctx, out, 0, 0.015, 'bandpass', 1800, 900, 1.5, 0.06, 0.002)
    } else if (kind === 'tera') {
        spawnTone(ctx, fx, 0, 0.16, 'sine', 880, 1760, 0.12, 0.008)
        spawnTone(ctx, fx, 0.03, 0.18, 'sine', 1318, 2637, 0.1, 0.008)
        spawnNoise(ctx, fx, 0, 0.12, 'highpass', 4200, 6000, 1.4, 0.08, 0.01)
    } else if (kind === 'hover') {
        spawnTone(ctx, out, 0, 0.022, 'sine', 1380, 1520, 0.035, 0.002)
    } else {
        spawnTone(ctx, out, 0, 0.042, 'triangle', 840, 1080, 0.11, 0.003)
        spawnNoise(ctx, out, 0, 0.01, 'highpass', 3800, 2600, 1.0, 0.06, 0.002)
    }
}
export function playPokemonCry(speciesName: string, fainted = false, muted = false) {
    if (muted || globalSfxMuted || !speciesName) return
    try {
        const sp = Dex.species.get(speciesName)
        const baseId = sp.exists ? toId(sp.baseSpecies || sp.name) : toId(speciesName)
        const formeId = sp.exists && sp.forme ? `${baseId}-${toId(sp.forme)}` : ''
        const primary = formeId || (sp.exists ? sp.id : baseId)
        const audio = new Audio(`${SD_BASE}/audio/cries/${primary}.mp3`)
        audio.volume = fainted ? 0.3 : 0.42
        if (fainted) audio.playbackRate = 0.72
        audio.onerror = () => {
            if (primary !== baseId) {
                const fallback = new Audio(`${SD_BASE}/audio/cries/${baseId}.mp3`)
                fallback.volume = fainted ? 0.3 : 0.42
                if (fainted) fallback.playbackRate = 0.72
                void fallback.play().catch(() => { })
            }
        }
        void audio.play().catch(() => { })
    } catch {
        return
    }
}
export function playMoveSfx(moveName: string, muted = false) {
    if (muted || globalSfxMuted) return
    const g = ensureAudioGraph()
    if (!g) return
    const { ctx, out, punch, fx } = g
    const md = Dex.moves.get(moveName)
    const id = md.exists ? md.id : toId(moveName)
    const type = md.exists ? md.type : 'Normal'
    const category = md.exists ? md.category : 'Physical'
    const flags = (md.exists ? md.flags : {}) as Record<string, number | undefined>
    if (id === 'protect' || id === 'detect' || id === 'kingsshield' || id === 'spikyshield' || id === 'silktrap' || id === 'wideguard') {
        spawnFm(ctx, fx, 0, 0.28, 920, 1840, 460, 320, 0.18)
        spawnTone(ctx, out, 0.01, 0.24, 'sine', 1380, 1980, 0.14, 0.01)
        return
    }
    if (flags.slicing || id.includes('slash') || id.includes('claw') || id.includes('sword') || id.includes('blade') || id === 'kowtowcleave') {
        spawnNoise(ctx, punch, 0, 0.14, 'highpass', 3800, 1200, 2.2, 0.48, 0.002)
        spawnFm(ctx, fx, 0, 0.18, 2200, 420, 740, 620, 0.22)
        spawnTone(ctx, punch, 0.04, 0.16, 'sine', 290, 52, 0.42, 0.003)
        return
    }
    if (type === 'Fire') {
        spawnNoise(ctx, punch, 0, 0.42, 'lowpass', 1200, 220, 1.3, 0.52, 0.012)
        spawnNoise(ctx, fx, 0.04, 0.34, 'bandpass', 2200, 480, 2.0, 0.32, 0.01)
        spawnTone(ctx, punch, 0, 0.28, 'sawtooth', 175, 44, 0.24, 0.015)
        return
    }
    if (type === 'Water') {
        spawnNoise(ctx, punch, 0, 0.36, 'bandpass', 720, 3000, 2.4, 0.44, 0.01)
        spawnNoise(ctx, out, 0.11, 0.26, 'bandpass', 2600, 420, 1.8, 0.38, 0.008)
        spawnTone(ctx, punch, 0.12, 0.18, 'sine', 220, 55, 0.32, 0.005)
        return
    }
    if (type === 'Electric') {
        spawnNoise(ctx, punch, 0, 0.14, 'highpass', 3600, 1600, 1.4, 0.48, 0.002)
        spawnFm(ctx, punch, 0, 0.3, 2200, 210, 165, 1300, 0.26)
        spawnNoise(ctx, fx, 0.08, 0.26, 'bandpass', 1400, 240, 1.5, 0.36, 0.005)
        return
    }
    if (type === 'Ice') {
        spawnFm(ctx, fx, 0, 0.3, 2400, 3100, 920, 740, 0.18)
        spawnNoise(ctx, punch, 0.08, 0.22, 'highpass', 4200, 1800, 2.2, 0.38, 0.003)
        spawnTone(ctx, punch, 0.09, 0.14, 'triangle', 340, 75, 0.28, 0.003)
        return
    }
    if (type === 'Ground' || type === 'Rock') {
        spawnTone(ctx, punch, 0, 0.42, 'sine', 150, 32, 0.58, 0.004)
        spawnNoise(ctx, punch, 0, 0.44, 'lowpass', 540, 95, 1.1, 0.56, 0.008)
        spawnTone(ctx, punch, 0.13, 0.26, 'triangle', 120, 30, 0.42, 0.005)
        return
    }
    if (type === 'Psychic' || type === 'Fairy') {
        spawnFm(ctx, fx, 0, 0.36, 720, 1480, 16, 220, 0.18)
        spawnTone(ctx, fx, 0.04, 0.3, 'sine', 1046, 1568, 0.14, 0.02)
        spawnNoise(ctx, fx, 0.06, 0.22, 'highpass', 3400, 5200, 1.6, 0.16, 0.01)
        return
    }
    if (type === 'Ghost' || type === 'Dark' || type === 'Poison') {
        spawnFm(ctx, punch, 0, 0.38, 340, 130, 44, 290, 0.24)
        spawnNoise(ctx, fx, 0.03, 0.32, 'bandpass', 1100, 260, 2.6, 0.34, 0.01)
        return
    }
    if (type === 'Dragon' || category === 'Special') {
        spawnTone(ctx, punch, 0, 0.22, 'sawtooth', 190, 680, 0.22, 0.02)
        spawnFm(ctx, fx, 0.07, 0.34, 860, 210, 110, 560, 0.24)
        spawnNoise(ctx, punch, 0.1, 0.28, 'bandpass', 1800, 380, 1.6, 0.38, 0.006)
        return
    }
    if (category === 'Status') {
        spawnTone(ctx, fx, 0, 0.16, 'sine', 523, 659, 0.13, 0.015)
        spawnTone(ctx, fx, 0.07, 0.2, 'sine', 659, 987, 0.13, 0.015)
        return
    }
    spawnNoise(ctx, punch, 0, 0.02, 'highpass', 3200, 1800, 1.0, 0.42, 0.002)
    spawnTone(ctx, punch, 0, 0.16, 'sine', 240, 46, 0.52, 0.003)
    spawnNoise(ctx, punch, 0.01, 0.14, 'bandpass', 1500, 320, 1.3, 0.42, 0.003)
}
export function playBattleSfx(
    kind: 'normal' | 'super' | 'resist' | 'crit' | 'heal' | 'faint' | 'switch' | 'boost' | 'unboost' | 'tera' | 'miss',
    muted = false
) {
    if (muted || globalSfxMuted) return
    const g = ensureAudioGraph()
    if (!g) return
    const { ctx, out, punch, fx } = g
    if (kind === 'super') {
        spawnNoise(ctx, punch, 0, 0.028, 'highpass', 4200, 2200, 0.9, 0.62, 0.001)
        spawnTone(ctx, punch, 0, 0.24, 'sine', 340, 36, 0.68, 0.002)
        spawnFm(ctx, punch, 0, 0.26, 1180, 175, 220, 720, 0.32)
        spawnNoise(ctx, punch, 0.01, 0.26, 'bandpass', 2200, 260, 1.1, 0.56, 0.002)
        spawnTone(ctx, fx, 0.055, 0.22, 'triangle', 210, 42, 0.44, 0.003)
    } else if (kind === 'crit') {
        spawnNoise(ctx, punch, 0, 0.02, 'highpass', 5200, 2800, 1.0, 0.55, 0.001)
        spawnFm(ctx, fx, 0, 0.24, 1960, 880, 640, 520, 0.26)
        spawnTone(ctx, punch, 0.04, 0.18, 'sine', 320, 45, 0.52, 0.002)
    } else if (kind === 'resist') {
        spawnTone(ctx, out, 0, 0.13, 'triangle', 145, 72, 0.24, 0.004)
        spawnNoise(ctx, out, 0, 0.09, 'lowpass', 420, 180, 1.1, 0.2, 0.003)
    } else if (kind === 'heal') {
        spawnTone(ctx, fx, 0, 0.18, 'sine', 523, 523, 0.13, 0.015)
        spawnTone(ctx, fx, 0.065, 0.2, 'sine', 659, 659, 0.13, 0.015)
        spawnTone(ctx, fx, 0.13, 0.26, 'sine', 784, 1046, 0.15, 0.015)
    } else if (kind === 'boost') {
        spawnTone(ctx, fx, 0, 0.15, 'triangle', 392, 587, 0.13, 0.01)
        spawnTone(ctx, fx, 0.08, 0.2, 'triangle', 587, 880, 0.14, 0.01)
    } else if (kind === 'unboost') {
        spawnTone(ctx, fx, 0, 0.15, 'triangle', 587, 392, 0.13, 0.01)
        spawnTone(ctx, fx, 0.08, 0.2, 'triangle', 392, 220, 0.14, 0.01)
    } else if (kind === 'tera') {
        spawnFm(ctx, fx, 0, 0.52, 700, 2100, 350, 620, 0.22)
        spawnTone(ctx, fx, 0.07, 0.44, 'sine', 1046, 2793, 0.15, 0.02)
        spawnNoise(ctx, fx, 0.04, 0.42, 'highpass', 2600, 5600, 1.8, 0.24, 0.015)
    } else if (kind === 'switch') {
        spawnNoise(ctx, out, 0, 0.1, 'bandpass', 1000, 3200, 2.0, 0.2, 0.004)
        spawnTone(ctx, fx, 0.045, 0.13, 'sine', 380, 880, 0.14, 0.006)
    } else if (kind === 'miss') {
        spawnNoise(ctx, out, 0, 0.18, 'bandpass', 1300, 320, 2.4, 0.22, 0.008)
    } else if (kind === 'faint') {
        spawnTone(ctx, punch, 0.14, 0.34, 'sine', 145, 32, 0.46, 0.005)
        spawnNoise(ctx, punch, 0.14, 0.26, 'lowpass', 380, 90, 1.3, 0.34, 0.006)
    } else {
        spawnNoise(ctx, punch, 0, 0.022, 'highpass', 3600, 1800, 1.0, 0.48, 0.001)
        spawnTone(ctx, punch, 0, 0.18, 'sine', 260, 44, 0.54, 0.002)
        spawnNoise(ctx, punch, 0.008, 0.16, 'bandpass', 1400, 320, 1.3, 0.4, 0.002)
    }
}