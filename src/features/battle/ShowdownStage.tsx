import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Dex } from '@pkmn/dex'
import {
    getAbilityEntry,
    getItemEntry,
    getMoveEntry,
    getSpeciesEntry,
    getTypeEntry,
    type LangCode,
} from '../../i18n/dexI18n'
import { playBattleSfx, playMoveSfx, playPokemonCry, unlockBattleAudio } from './showdownAssets'
export interface ShowdownStageHandle {
    pushLines: (lines: string[], seq: number) => void
    skipAnimations: () => void
    reset: (role: 'p1' | 'p2') => void
}
interface ShowdownStageProps {
    role: 'p1' | 'p2'
    muted: boolean
    lang: LangCode
    onPlaybackChange?: (playing: boolean, seq: number) => void
}
const ALL_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar',
]
const DICT_CACHE: Partial<Record<LangCode, { entities: Record<string, string>; types: Record<string, string> }>> = {}
function getStageDict(lang: LangCode) {
    const cached = DICT_CACHE[lang]
    if (cached) return cached
    const entities: Record<string, string> = {}
    const types: Record<string, string> = {}
    if (lang !== 'en') {
        for (const s of Dex.species.all()) {
            if (!s.exists || s.num <= 0) continue
            entities[s.name.toLowerCase()] = getSpeciesEntry(s.name, s.num, s.forme)[lang]
        }
        for (const a of Dex.abilities.all()) {
            if (!a.exists) continue
            entities[a.name.toLowerCase()] = getAbilityEntry(a.name)[lang]
        }
        for (const item of Dex.items.all()) {
            if (!item.exists) continue
            entities[item.name.toLowerCase()] = getItemEntry(item.name)[lang]
        }
        for (const m of Dex.moves.all()) {
            if (!m.exists) continue
            entities[m.name.toLowerCase()] = getMoveEntry(m.name)[lang]
        }
        for (const tp of ALL_TYPES) {
            const local = getTypeEntry(tp)[lang]
            types[tp] = local
            entities[tp.toLowerCase()] = local
        }
    }
    const built = { entities, types }
    DICT_CACHE[lang] = built
    return built
}
const ShowdownStage = forwardRef<ShowdownStageHandle, ShowdownStageProps>(
    function ShowdownStage({ role, muted, lang, onPlaybackChange }, ref) {
        const iframeRef = useRef<HTMLIFrameElement>(null)
        const readyRef = useRef(false)
        const pendingRef = useRef<{ lines: string[]; seq: number }[]>([])
        const roleRef = useRef(role)
        const mutedRef = useRef(muted)
        const langRef = useRef(lang)
        const onPlaybackRef = useRef(onPlaybackChange)
        const effRef = useRef<'normal' | 'super' | 'resist'>('normal')
        const critRef = useRef(false)
        const slotSpeciesRef = useRef<Record<string, string>>({})
        const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
        const [loading, setLoading] = useState(true)
        const [impactKind, setImpactKind] = useState<'none' | 'normal' | 'heavy'>('none')
        useEffect(() => {
            onPlaybackRef.current = onPlaybackChange
        }, [onPlaybackChange])
        useEffect(() => {
            langRef.current = lang
            if (readyRef.current) {
                iframeRef.current?.contentWindow?.postMessage({ type: 'I18N', lang, dict: getStageDict(lang) }, '*')
            }
        }, [lang])
        useEffect(() => {
            roleRef.current = role
            if (readyRef.current) {
                iframeRef.current?.contentWindow?.postMessage({ type: 'VIEWPOINT', role }, '*')
            }
        }, [role])
        useEffect(() => {
            mutedRef.current = muted
        }, [muted])
        useEffect(() => {
            const unlock = () => unlockBattleAudio()
            window.addEventListener('pointerdown', unlock, { passive: true })
            return () => {
                window.removeEventListener('pointerdown', unlock)
                if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
            }
        }, [])
        const triggerImpact = (heavy: boolean) => {
            if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
            setImpactKind(heavy ? 'heavy' : 'normal')
            shakeTimerRef.current = setTimeout(() => setImpactKind('none'), heavy ? 260 : 150)
        }
        useEffect(() => {
            const onMsg = (ev: MessageEvent) => {
                if (ev.source !== iframeRef.current?.contentWindow) return
                if (ev.data?.type === 'STAGE_READY') {
                    readyRef.current = true
                    setLoading(false)
                    const win = iframeRef.current?.contentWindow
                    if (win) {
                        win.postMessage({ type: 'I18N', lang: langRef.current, dict: getStageDict(langRef.current) }, '*')
                        win.postMessage({ type: 'VIEWPOINT', role: roleRef.current }, '*')
                        if (pendingRef.current.length > 0) {
                            const allLines = pendingRef.current.flatMap((b) => b.lines)
                            let maxSeq = 0
                            for (const b of pendingRef.current) {
                                if (b.seq > maxSeq) maxSeq = b.seq
                            }
                            pendingRef.current = []
                            win.postMessage({ type: 'LINES', lines: allLines, seq: maxSeq }, '*')
                        }
                    }
                } else if (ev.data?.type === 'PLAYBACK') {
                    onPlaybackRef.current?.(Boolean(ev.data.playing), Number(ev.data.seq) || 0)
                } else if (ev.data?.type === 'STAGE_EVENT') {
                    const cmd = String(ev.data.cmd || '')
                    const args = (ev.data.args || []) as string[]
                    const isStill = Boolean(ev.data.still)
                    const isMuted = mutedRef.current
                    if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
                        const slotKey = (args[1] || '').slice(0, 3)
                        const species = (args[2] || '').split(',')[0].trim()
                        if (slotKey && species) slotSpeciesRef.current[slotKey] = species
                        playBattleSfx('switch', isMuted)
                        playPokemonCry(species, false, isMuted)
                    } else if (cmd === 'move') {
                        effRef.current = 'normal'
                        critRef.current = false
                        if (!isStill) playMoveSfx(args[2] || '', isMuted)
                    } else if (cmd === '-supereffective') {
                        effRef.current = 'super'
                    } else if (cmd === '-resisted') {
                        effRef.current = 'resist'
                    } else if (cmd === '-crit') {
                        critRef.current = true
                    } else if (cmd === '-damage') {
                        const isHeavy = effRef.current === 'super' || critRef.current
                        playBattleSfx(effRef.current, isMuted)
                        if (critRef.current) playBattleSfx('crit', isMuted)
                        if (effRef.current !== 'resist') triggerImpact(isHeavy)
                        effRef.current = 'normal'
                        critRef.current = false
                    } else if (cmd === '-heal') {
                        playBattleSfx('heal', isMuted)
                    } else if (cmd === '-boost') {
                        playBattleSfx('boost', isMuted)
                    } else if (cmd === '-unboost') {
                        playBattleSfx('unboost', isMuted)
                    } else if (cmd === '-terastallize') {
                        playBattleSfx('tera', isMuted)
                    } else if (cmd === '-miss' || cmd === '-immune' || cmd === '-fail') {
                        playBattleSfx('miss', isMuted)
                    } else if (cmd === 'faint') {
                        const slotKey = (args[1] || '').slice(0, 3)
                        const species = slotSpeciesRef.current[slotKey] || (args[1] || '').split(': ')[1] || ''
                        playPokemonCry(species, true, isMuted)
                        playBattleSfx('faint', isMuted)
                        triggerImpact(true)
                    }
                }
            }
            window.addEventListener('message', onMsg)
            return () => window.removeEventListener('message', onMsg)
        }, [])
        useImperativeHandle(ref, () => ({
            pushLines(lines: string[], seq: number) {
                if (lines.length === 0) return
                if (readyRef.current && iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: 'LINES', lines, seq }, '*')
                } else {
                    pendingRef.current.push({ lines, seq })
                }
            },
            skipAnimations() {
                if (readyRef.current && iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: 'SKIP' }, '*')
                }
            },
            reset(nextRole: 'p1' | 'p2') {
                pendingRef.current = []
                effRef.current = 'normal'
                critRef.current = false
                slotSpeciesRef.current = {}
                roleRef.current = nextRole
                if (readyRef.current && iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: 'RESET', role: nextRole }, '*')
                }
            },
        }))
        return (
            <div
                className={`relative w-full h-full bg-slate-950 overflow-hidden transition-transform duration-75 ${impactKind === 'heavy'
                    ? 'translate-x-2 -translate-y-1.5 scale-[1.012]'
                    : impactKind === 'normal'
                        ? 'translate-x-1 -translate-y-0.5'
                        : ''
                    }`}
            >
                {impactKind === 'heavy' && (
                    <div className="pointer-events-none absolute inset-0 z-10 ring-4 ring-inset ring-amber-300/60 bg-white/10" />
                )}
                {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/90 text-xs text-slate-300">
                        <span className="w-6 h-6 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                        <span>Loading Pokémon Battle Arena...</span>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    title="Showdown Battle Stage"
                    src={`${import.meta.env.BASE_URL}showdown-stage.html?v=9`}
                    className="w-full h-full border-0 block"
                    allow="autoplay"
                />
            </div>
        )
    }
)
export default ShowdownStage