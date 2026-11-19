import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dex } from '@pkmn/dex'
import { Sprites } from '@pkmn/img'
import ShowdownStage, { type ShowdownStageHandle } from './ShowdownStage'
import { CPU_TEAM_PRESETS, pickCpuTeamPaste } from './cpuTeams'
import {
    BATTLE_BGM_TRACKS,
    setBattleBgmMuted,
    setGlobalSfxMuted,
    startBattleBgm,
    stopBattleBgm,
} from './showdownAssets'
import { ItemIcon } from '../../components/DexIcons'
import { connectP2PRoom, startRandomMatchmaking, type P2PSession } from '../../network/p2p'
import {
    getAbilityEntry,
    getCategoryLabel,
    getItemEntry,
    getMoveEntry,
    getSpeciesEntry,
    getTypeEntry,
    normalizeLang,
    type LangCode,
} from '../../i18n/dexI18n'
import { exportTeamToPaste, useTeamStore, type BattleFormat } from '../../store/teamStore'
type OnlineStatus = 'idle' | 'matching' | 'waiting' | 'playing' | 'disconnected'
interface TrackedMon {
    species: string
    teraType: string
    fainted: boolean
}
interface MoveOption {
    move: string
    id: string
    pp?: number
    maxpp?: number
    target?: string
    disabled?: boolean
}
interface ActiveSlotReq {
    moves: MoveOption[]
    trapped?: boolean
    canTerastallize?: string
}
interface SideMonReq {
    ident: string
    details: string
    condition: string
    active: boolean
    stats: Record<string, number>
    moves: string[]
    item: string
    ability: string
    teraType?: string
}
interface BattleRequest {
    wait?: boolean
    teamPreview?: boolean
    maxChosenTeamSize?: number
    forceSwitch?: boolean[]
    active?: (ActiveSlotReq | null)[]
    side: {
        name: string
        id: 'p1' | 'p2'
        pokemon: SideMonReq[]
    }
}
interface LogItem {
    text: string
    tone: 'normal' | 'turn' | 'super' | 'resist' | 'crit' | 'faint' | 'info' | 'error'
}
const RENTAL_TEAM_PASTE = [
    'Flutter Mane @ Booster Energy\nAbility: Protosynthesis\nLevel: 50\nTera Type: Fairy\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Moonblast\n- Shadow Ball\n- Dazzling Gleam\n- Protect',
    'Garchomp @ Life Orb\nAbility: Rough Skin\nLevel: 50\nTera Type: Fire\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Rock Slide\n- Protect',
    'Incineroar @ Sitrus Berry\nAbility: Intimidate\nLevel: 50\nTera Type: Grass\nEVs: 244 HP / 4 Atk / 100 Def / 156 SpD / 4 Spe\nCareful Nature\n- Flare Blitz\n- Knock Off\n- Fake Out\n- Parting Shot',
    'Rillaboom @ Assault Vest\nAbility: Grassy Surge\nLevel: 50\nTera Type: Fire\nEVs: 252 HP / 116 Atk / 4 Def / 132 SpD / 4 Spe\nAdamant Nature\n- Wood Hammer\n- Grassy Glide\n- U-turn\n- Fake Out',
    'Dragonite @ Choice Band\nAbility: Multiscale\nLevel: 50\nTera Type: Normal\nEVs: 4 HP / 252 Atk / 252 Spe\nAdamant Nature\n- Extreme Speed\n- Outrage\n- Earthquake\n- Ice Spinner',
    'Urshifu-Rapid-Strike @ Focus Sash\nAbility: Unseen Fist\nLevel: 50\nTera Type: Water\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Surging Strikes\n- Close Combat\n- Aqua Jet\n- Detect',
].join('\n\n')
const TYPE_BTN_STYLES: Record<string, string> = {
    Normal: 'border-slate-300/60 bg-slate-700/55 hover:bg-slate-600/85',
    Fire: 'border-orange-400/75 bg-orange-700/55 hover:bg-orange-600/85',
    Water: 'border-sky-400/75 bg-sky-700/55 hover:bg-sky-600/85',
    Electric: 'border-yellow-300/75 bg-amber-600/55 hover:bg-amber-500/85',
    Grass: 'border-emerald-400/75 bg-emerald-700/55 hover:bg-emerald-600/85',
    Ice: 'border-cyan-300/75 bg-cyan-700/55 hover:bg-cyan-600/85',
    Fighting: 'border-red-400/75 bg-red-700/55 hover:bg-red-600/85',
    Poison: 'border-purple-400/75 bg-purple-700/55 hover:bg-purple-600/85',
    Ground: 'border-amber-400/75 bg-amber-700/55 hover:bg-amber-600/85',
    Flying: 'border-indigo-300/75 bg-indigo-700/55 hover:bg-indigo-600/85',
    Psychic: 'border-pink-400/75 bg-pink-700/55 hover:bg-pink-600/85',
    Bug: 'border-lime-400/75 bg-lime-700/55 hover:bg-lime-600/85',
    Rock: 'border-stone-300/70 bg-stone-600/55 hover:bg-stone-500/85',
    Ghost: 'border-violet-400/75 bg-violet-800/55 hover:bg-violet-700/85',
    Dragon: 'border-blue-400/75 bg-blue-700/55 hover:bg-blue-600/85',
    Dark: 'border-zinc-400/65 bg-zinc-800/60 hover:bg-zinc-700/85',
    Steel: 'border-slate-300/70 bg-slate-600/55 hover:bg-slate-500/85',
    Fairy: 'border-rose-300/75 bg-rose-600/55 hover:bg-rose-500/85',
    Stellar: 'border-cyan-300/80 bg-indigo-700/60 hover:bg-indigo-600/85',
}
const STATUS_NAMES: Record<string, Record<LangCode, string>> = {
    brn: { zh: '灼伤', en: 'Burn', ja: 'やけど' },
    par: { zh: '麻痹', en: 'Paralysis', ja: 'まひ' },
    psn: { zh: '中毒', en: 'Poison', ja: 'どく' },
    tox: { zh: '剧毒', en: 'Toxic', ja: 'もうどく' },
    slp: { zh: '睡眠', en: 'Sleep', ja: 'ねむり' },
    frz: { zh: '冰冻', en: 'Freeze', ja: 'こおり' },
}
const BOOST_NAMES: Record<string, Record<LangCode, string>> = {
    atk: { zh: '攻击', en: 'Atk', ja: '攻撃' },
    def: { zh: '防御', en: 'Def', ja: '防御' },
    spa: { zh: '特攻', en: 'SpA', ja: '特攻' },
    spd: { zh: '特防', en: 'SpD', ja: '特防' },
    spe: { zh: '速度', en: 'Spe', ja: '素早' },
    accuracy: { zh: '命中', en: 'Acc', ja: '命中' },
    evasion: { zh: '闪避', en: 'Eva', ja: '回避' },
}
const CANT_REASONS: Record<string, Record<LangCode, string>> = {
    flinch: { zh: '因畏缩而无法行动！', en: 'flinched and could not move!', ja: 'ひるんで動けない！' },
    slp: { zh: '正在呼呼大睡…', en: 'is fast asleep...', ja: 'ぐうぐう眠っている…' },
    par: { zh: '因麻痹而无法行动！', en: 'is paralyzed! It cannot move!', ja: 'しびれて動けない！' },
    frz: { zh: '被冻住而无法行动！', en: 'is frozen solid!', ja: '凍って動けない！' },
}
function parseDetails(details: string) {
    const parts = details.split(',').map((s) => s.trim())
    const species = parts[0] || 'Pikachu'
    const teraPart = parts.slice(1).find((p) => p.startsWith('tera:'))
    const teraType = teraPart ? teraPart.slice(5).trim() : ''
    return { species, teraType }
}
function parseCondition(cond: string) {
    const clean = cond.trim()
    if (clean === '0 fnt' || clean.endsWith('fnt')) return { fainted: true }
    const [hpPart] = clean.split(' ')
    const [curStr] = hpPart.split('/')
    return { fainted: (Number(curStr) || 0) <= 0 }
}
function parseSlotFromIdent(ident: string): { side: 'p1' | 'p2'; slot: number } {
    const side: 'p1' | 'p2' = ident.startsWith('p2') ? 'p2' : 'p1'
    const slot = ident[2] === 'b' ? 1 : 0
    return { side, slot }
}
function stripPrefix(raw: string): string {
    return raw.replace(/^(move|ability|item|p1a|p1b|p2a|p2b):\s*/i, '').trim()
}
function displaySpecies(species: string, lang: LangCode) {
    const sp = Dex.species.get(species)
    if (!sp.exists) return species
    return getSpeciesEntry(sp.name, sp.num, sp.forme)[lang]
}
function calcEffectiveness(moveType: string, category: string, defender: TrackedMon | null): number | null {
    if (!defender || defender.fainted || category === 'Status') return null
    if (moveType === 'Stellar') return defender.teraType ? 2 : 1
    const defTypes = defender.teraType ? [defender.teraType] : Dex.species.get(defender.species).types || ['Normal']
    let mult = 1
    for (const dt of defTypes) {
        const tObj = Dex.types.get(dt)
        const taken = (tObj.damageTaken as Record<string, number> | undefined)?.[moveType] ?? 0
        if (taken === 1) mult *= 2
        else if (taken === 2) mult *= 0.5
        else if (taken === 3) mult *= 0
    }
    return mult
}
function formatEffTag(eff: number | null, lang: LangCode) {
    if (eff === null) return null
    if (eff === 0) return { text: lang === 'zh' ? '无效' : '0x', cls: 'bg-slate-950/90 text-slate-400' }
    if (eff > 1) return { text: lang === 'zh' ? `绝佳 ${eff}x` : `${eff}x`, cls: 'bg-amber-400 text-slate-950' }
    if (eff < 1) return { text: lang === 'zh' ? `微弱 ${eff}x` : `${eff}x`, cls: 'bg-slate-950/80 text-slate-300' }
    return null
}
function hasAnimLines(lines: string[]): boolean {
    for (const line of lines) {
        if (!line.startsWith('|')) continue
        const cmd = line.split('|')[1]
        if (
            cmd === 'move' ||
            cmd === 'switch' ||
            cmd === 'drag' ||
            cmd === 'replace' ||
            cmd === 'faint' ||
            cmd === 'cant' ||
            cmd === 'swap' ||
            cmd === '-damage' ||
            cmd === '-heal' ||
            cmd === '-terastallize' ||
            cmd === 'win' ||
            cmd === 'tie'
        ) {
            return true
        }
    }
    return false
}
export default function BattleArena({
    format,
    mode = 'offline',
}: {
    format: BattleFormat
    mode?: 'offline' | 'online'
}) {
    const { i18n } = useTranslation()
    const lang = normalizeLang(i18n.resolvedLanguage)
    const { teams, activeTeamId } = useTeamStore()
    const isDoubles = format.includes('doubles')
    const [selectedTeamId, setSelectedTeamId] = useState<string>(activeTeamId || '__rental__')
    const [cpuPresetId, setCpuPresetId] = useState<string>('__random__')
    const [cpuTeamLabel, setCpuTeamLabel] = useState<{ zh: string; en: string; ja: string } | null>(null)
    const [bgmTrackId, setBgmTrackId] = useState<string>('__random__')
    const [bgmMuted, setBgmMuted] = useState<boolean>(false)
    const [sfxMuted, setSfxMuted] = useState<boolean>(false)
    const [showLog, setShowLog] = useState<boolean>(false)
    const [hudMinimized, setHudMinimized] = useState<boolean>(false)
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
    const [started, setStarted] = useState(false)
    const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>('idle')
    const [roomCodeInput, setRoomCodeInput] = useState('')
    const [activeRoomCode, setActiveRoomCode] = useState('')
    const [roomMode, setRoomMode] = useState<'create' | 'join'>('create')
    const [onlineError, setOnlineError] = useState('')
    const [myRole, setMyRole] = useState<'p1' | 'p2'>('p1')
    const [pickedLimit, setPickedLimit] = useState<number>(isDoubles ? 4 : 3)
    const [stagePlaying, setStagePlaying] = useState<boolean>(false)
    const [pendingRequest, setPendingRequest] = useState<BattleRequest | null>(null)
    const [pendingWinner, setPendingWinner] = useState<string | null>(null)
    const [logs, setLogs] = useState<LogItem[]>([])
    const [myPreview, setMyPreview] = useState<string[]>([])
    const [foePreview, setFoePreview] = useState<string[]>([])
    const [myActive, setMyActive] = useState<(TrackedMon | null)[]>([null, null])
    const [foeActive, setFoeActive] = useState<(TrackedMon | null)[]>([null, null])
    const [previewOrder, setPreviewOrder] = useState<number[]>([])
    const [pendingChoices, setPendingChoices] = useState<string[]>([])
    const [activeSlotCursor, setActiveSlotCursor] = useState(0)
    const [choosingTargetFor, setChoosingTargetFor] = useState<{
        moveNum: number
        moveId: string
        targetType: string
        tera: boolean
    } | null>(null)
    const [wantTera, setWantTera] = useState(false)
    const [hoveredMove, setHoveredMove] = useState<string | null>(null)
    const arenaRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<ShowdownStageHandle>(null)
    const workerRef = useRef<Worker | null>(null)
    const p2pSessionRef = useRef<P2PSession | null>(null)
    const matchCancelRef = useRef<(() => void) | null>(null)
    const lastActionableReqRef = useRef<BattleRequest | null>(null)
    const submittedReqRef = useRef<BattleRequest | null>(null)
    const animSeqRef = useRef<number>(0)
    const battleCountRef = useRef<number>(0)
    const teraMemoryRef = useRef<Record<string, string>>({})
    const logEndRef = useRef<HTMLDivElement>(null)
    const langRef = useRef<LangCode>(lang)
    const mySideRef = useRef<'p1' | 'p2'>('p1')
    const myNameRef = useRef<string>('Player')
    const bgmTrackRef = useRef<string>(bgmTrackId)
    const bgmMutedRef = useRef<boolean>(bgmMuted)
    const activeMirrorRef = useRef<{ my: (TrackedMon | null)[]; foe: (TrackedMon | null)[] }>({
        my: [null, null],
        foe: [null, null],
    })
    const visibleWinner = !stagePlaying ? pendingWinner : null
    const visibleRequest =
        !pendingWinner && pendingRequest && !pendingRequest.wait && (pendingRequest.teamPreview || !stagePlaying)
            ? pendingRequest
            : null
    useEffect(() => {
        langRef.current = lang
    }, [lang])
    useEffect(() => {
        bgmTrackRef.current = bgmTrackId
        if (started && !visibleWinner) {
            startBattleBgm(bgmTrackId, bgmMutedRef.current)
        }
    }, [bgmTrackId])
    useEffect(() => {
        bgmMutedRef.current = bgmMuted
        setBattleBgmMuted(bgmMuted)
    }, [bgmMuted])
    useEffect(() => {
        setGlobalSfxMuted(sfxMuted)
    }, [sfxMuted])
    useEffect(() => {
        if (visibleWinner) {
            stopBattleBgm()
        }
    }, [visibleWinner])
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs, showLog])
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        document.addEventListener('fullscreenchange', onFsChange)
        return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [])
    useEffect(() => {
        if (!visibleRequest) return
        setPendingChoices([])
        setChoosingTargetFor(null)
        setWantTera(false)
        setHudMinimized(false)
        if (visibleRequest.active) {
            const firstIdx = visibleRequest.active.findIndex(
                (s, idx) => s !== null && visibleRequest.side.pokemon[idx] && !visibleRequest.side.pokemon[idx].condition.endsWith('fnt')
            )
            setActiveSlotCursor(firstIdx >= 0 ? firstIdx : 0)
        } else if (visibleRequest.forceSwitch) {
            const firstIdx = visibleRequest.forceSwitch.findIndex(Boolean)
            setActiveSlotCursor(firstIdx >= 0 ? firstIdx : 0)
        }
    }, [visibleRequest])
    const cleanupAll = () => {
        matchCancelRef.current?.()
        matchCancelRef.current = null
        p2pSessionRef.current?.leave()
        p2pSessionRef.current = null
        workerRef.current?.terminate()
        workerRef.current = null
        stopBattleBgm()
    }
    useEffect(() => {
        return () => {
            cleanupAll()
        }
    }, [])
    const selectedTeam = useMemo(() => teams.find((tm) => tm.id === selectedTeamId) || null, [teams, selectedTeamId])
    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else if (arenaRef.current) await arenaRef.current.requestFullscreen()
        } catch {
            return
        }
    }
    const handlePlaybackChange = useCallback((playing: boolean, seq: number) => {
        if (!playing && seq !== animSeqRef.current) return
        setStagePlaying(playing)
    }, [])
    const getValidatedMyPaste = (): string | null => {
        const minRequired = isDoubles ? 4 : 3
        if (!selectedTeam) return RENTAL_TEAM_PASTE
        if (selectedTeam.members.length < minRequired) {
            alert(
                lang === 'zh'
                    ? `当前赛制至少需要 ${minRequired} 只宝可梦，请先去队伍编辑补充或选择租借队。`
                    : `This format requires at least ${minRequired} Pokemon.`
            )
            return null
        }
        const nums = selectedTeam.members.map((m) => Dex.species.get(m.species).num).filter((n) => n > 0)
        if (new Set(nums).size !== nums.length) {
            alert(
                lang === 'zh'
                    ? '所选队伍中存在重复的宝可梦（图鉴编号相同），请先在队伍编辑中修改。'
                    : 'Duplicate Pokemon species are not allowed in the same team.'
            )
            return null
        }
        const missingMoves = selectedTeam.members.some((m) => m.moves.filter(Boolean).length === 0)
        if (missingMoves) {
            alert(
                lang === 'zh'
                    ? '队伍中有宝可梦未配置任何招式，请先在队伍编辑中至少为其选择 1 个招式。'
                    : 'Every Pokemon in your team must have at least 1 move.'
            )
            return null
        }
        return exportTeamToPaste(selectedTeam.members)
    }
    const resetBattleBoard = (role: 'p1' | 'p2') => {
        setPickedLimit(isDoubles ? 4 : 3)
        setStagePlaying(false)
        setPendingRequest(null)
        setPendingWinner(null)
        setLogs([])
        setMyPreview([])
        setFoePreview([])
        setMyActive([null, null])
        setFoeActive([null, null])
        setPreviewOrder([])
        setPendingChoices([])
        setChoosingTargetFor(null)
        setWantTera(false)
        setHudMinimized(false)
        activeMirrorRef.current = { my: [null, null], foe: [null, null] }
        teraMemoryRef.current = {}
        lastActionableReqRef.current = null
        submittedReqRef.current = null
        animSeqRef.current += 1
        if (battleCountRef.current > 0) {
            stageRef.current?.reset(role)
        }
        battleCountRef.current += 1
    }
    const appendLog = (text: string, tone: LogItem['tone'] = 'normal') => {
        setLogs((prev) => [...prev.slice(-140), { text, tone }])
    }
    const toRelSide = (rawSide: 'p1' | 'p2'): 'my' | 'foe' => (rawSide === mySideRef.current ? 'my' : 'foe')
    const updateTrackedMon = (relSide: 'my' | 'foe', slot: number, updater: (m: TrackedMon | null) => TrackedMon | null) => {
        const nextMon = updater(activeMirrorRef.current[relSide][slot])
        activeMirrorRef.current[relSide][slot] = nextMon
        const setter = relSide === 'my' ? setMyActive : setFoeActive
        setter((prev) => prev.map((m, idx) => (idx === slot ? nextMon : m)))
    }
    const handleProtocolChunk = (chunk: string) => {
        const lines = chunk.split('\n').filter(Boolean)
        const stageLines = lines.filter((l) => !l.startsWith('|request|') && !l.startsWith('|error|'))
        const curLang = langRef.current
        let receivedRequest: BattleRequest | null = null
        let receivedError = false
        let receivedWin: string | null = null
        for (const line of lines) {
            if (!line.startsWith('|')) continue
            const parts = line.split('|')
            const cmd = parts[1]
            if (cmd === 'request') {
                const raw = parts.slice(2).join('|')
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw) as BattleRequest
                        receivedRequest = parsed
                        if (!parsed.wait) lastActionableReqRef.current = parsed
                    } catch {
                        continue
                    }
                }
            } else if (cmd === 'error') {
                receivedError = true
                const msg = parts.slice(2).join(' ')
                appendLog(curLang === 'zh' ? `⚠️ 操作无效，请重新选择：${msg}` : `⚠️ ${msg}`, 'error')
            } else if (cmd === 'teampreview') {
                const num = Number(parts[2])
                if (num > 0) setPickedLimit(num)
            } else if (cmd === 'poke') {
                const rawSide = parts[2] === 'p2' ? 'p2' : 'p1'
                const { species } = parseDetails(parts[3] || '')
                if (toRelSide(rawSide) === 'my') setMyPreview((prev) => [...prev, species])
                else setFoePreview((prev) => [...prev, species])
            } else if (cmd === 'turn') {
                const num = Number(parts[2]) || 1
                appendLog(curLang === 'zh' ? `第 ${num} 回合` : curLang === 'ja' ? `${num} ターン目` : `Turn ${num}`, 'turn')
            } else if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const { species, teraType } = parseDetails(parts[3] || '')
                const cond = parseCondition(parts[4] || '100/100')
                const savedTera = teraType || teraMemoryRef.current[`${rel}:${species}`] || ''
                updateTrackedMon(rel, parsed.slot, () => ({ species, teraType: savedTera, fainted: cond.fainted }))
                const spName = displaySpecies(species, curLang)
                appendLog(
                    rel === 'my'
                        ? curLang === 'zh' ? `我方派出 ${spName}！` : curLang === 'ja' ? `${spName} をくりだした！` : `Go! ${spName}!`
                        : curLang === 'zh' ? `对手派出 ${spName}！` : curLang === 'ja' ? `相手は ${spName} をくりだした！` : `Foe sent out ${spName}!`,
                    'info'
                )
            } else if (cmd === 'swap') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const a = activeMirrorRef.current[rel][0]
                const b = activeMirrorRef.current[rel][1]
                activeMirrorRef.current[rel] = [b, a]
                if (rel === 'my') setMyActive([b, a])
                else setFoeActive([b, a])
            } else if (cmd === 'detailschange' || cmd === '-formechange') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const { species } = parseDetails(parts[3] || '')
                updateTrackedMon(rel, parsed.slot, (m) => (m ? { ...m, species } : m))
            } else if (cmd === 'move') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const moveName = parts[3] || ''
                const localMove = getMoveEntry(moveName)[curLang]
                const mon = activeMirrorRef.current[rel][parsed.slot]
                const spName = displaySpecies(mon?.species || (parts[2] || '').split(': ')[1] || '', curLang)
                appendLog(
                    curLang === 'zh'
                        ? `${rel === 'foe' ? '对手的 ' : ''}${spName} 使用了【${localMove}】！`
                        : curLang === 'ja'
                            ? `${rel === 'foe' ? '相手の ' : ''}${spName} の ${localMove}！`
                            : `${rel === 'foe' ? 'Foe ' : ''}${spName} used ${localMove}!`
                )
            } else if (cmd === 'cant') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const reasonKey = parts[3] || ''
                const mon = activeMirrorRef.current[rel][parsed.slot]
                const spName = displaySpecies(mon?.species || (parts[2] || '').split(': ')[1] || '', curLang)
                const reasonText =
                    CANT_REASONS[reasonKey]?.[curLang] || (curLang === 'zh' ? `无法行动 (${reasonKey})` : `couldn't move (${reasonKey})`)
                appendLog(`${rel === 'foe' && curLang === 'zh' ? '对手的 ' : ''}${spName} ${reasonText}`, 'info')
            } else if (cmd === '-terastallize') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const teraType = parts[3] || 'Normal'
                const curMon = activeMirrorRef.current[rel][parsed.slot]
                if (curMon) teraMemoryRef.current[`${rel}:${curMon.species}`] = teraType
                updateTrackedMon(rel, parsed.slot, (m) => (m ? { ...m, teraType } : m))
                const typeLocal = getTypeEntry(teraType)[curLang]
                appendLog(
                    curLang === 'zh'
                        ? `💎 发动太晶化！属性变为【${typeLocal}】！`
                        : curLang === 'ja'
                            ? `💎 テラスタル発動！タイプが ${typeLocal} になった！`
                            : `💎 Terastallized into ${typeLocal} type!`,
                    'super'
                )
            } else if (cmd === '-boost' || cmd === '-unboost') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const stat = parts[3] || ''
                const amount = Number(parts[4]) || 1
                const mon = activeMirrorRef.current[rel][parsed.slot]
                const spName = displaySpecies(mon?.species || '', curLang)
                const statLabel = BOOST_NAMES[stat]?.[curLang] || stat
                appendLog(
                    curLang === 'zh'
                        ? `${rel === 'foe' ? '对手的 ' : ''}${spName} 的${statLabel}${cmd === '-boost' ? '提升' : '下降'}了 ${amount} 级！`
                        : `${spName}'s ${statLabel} ${cmd === '-boost' ? `+${amount}` : `-${amount}`}!`,
                    'info'
                )
            } else if (cmd === '-ability') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const abLocal = getAbilityEntry(parts[3] || '')[curLang]
                const mon = activeMirrorRef.current[rel][parsed.slot]
                const spName = displaySpecies(mon?.species || '', curLang)
                appendLog(curLang === 'zh' ? `[特性] ${spName} 的【${abLocal}】发动了！` : `[Ability] ${spName}'s ${abLocal}!`, 'info')
            } else if (cmd === '-enditem') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const itemLocal = getItemEntry(parts[3] || '')[curLang]
                const mon = activeMirrorRef.current[rel][parsed.slot]
                const spName = displaySpecies(mon?.species || '', curLang)
                appendLog(curLang === 'zh' ? `[道具] ${spName} 消耗了【${itemLocal}】！` : `[Item] ${spName} used ${itemLocal}!`, 'info')
            } else if (cmd === '-status') {
                const stLabel = STATUS_NAMES[parts[3] || '']?.[curLang] || parts[3] || ''
                appendLog(curLang === 'zh' ? `陷入了【${stLabel}】状态！` : `Inflicted with ${stLabel}!`, 'info')
            } else if (cmd === '-supereffective') {
                appendLog(curLang === 'zh' ? '效果绝佳！' : curLang === 'ja' ? '効果はバツグンだ！' : "It's super effective!", 'super')
            } else if (cmd === '-resisted') {
                appendLog(curLang === 'zh' ? '效果不好…' : curLang === 'ja' ? '効果はいまひとつのようだ…' : "It's not very effective...", 'resist')
            } else if (cmd === '-immune') {
                appendLog(curLang === 'zh' ? '好像没有效果…' : curLang === 'ja' ? '効果がないようだ…' : "It doesn't affect the target...", 'resist')
            } else if (cmd === '-crit') {
                appendLog(curLang === 'zh' ? '击中了要害！' : curLang === 'ja' ? '急所に当たった！' : 'A critical hit!', 'crit')
            } else if (cmd === '-miss') {
                appendLog(curLang === 'zh' ? '攻击没有命中！' : curLang === 'ja' ? '攻撃は外れた！' : 'The attack missed!', 'resist')
            } else if (cmd === '-activate') {
                const effRaw = stripPrefix(parts[3] || '')
                if (effRaw === 'Protect') {
                    appendLog(curLang === 'zh' ? '守住了攻击！' : curLang === 'ja' ? '攻撃を守った！' : 'Protected itself!', 'info')
                }
            } else if (cmd === 'faint') {
                const parsed = parseSlotFromIdent(parts[2] || '')
                const rel = toRelSide(parsed.side)
                const mon = activeMirrorRef.current[rel][parsed.slot]
                updateTrackedMon(rel, parsed.slot, (m) => (m ? { ...m, fainted: true } : m))
                const spName = displaySpecies(mon?.species || (parts[2] || '').split(': ')[1] || '', curLang)
                appendLog(
                    curLang === 'zh' ? `${rel === 'foe' ? '对手的 ' : ''}${spName} 倒下了！` : curLang === 'ja' ? `${spName} は倒れた！` : `${spName} fainted!`,
                    'faint'
                )
            } else if (cmd === 'win') {
                receivedWin = parts[2] || 'Unknown'
                appendLog(
                    curLang === 'zh' ? `🏆 对战结束！胜者：${receivedWin}` : curLang === 'ja' ? `🏆 対戦終了！勝者：${receivedWin}` : `🏆 Winner: ${receivedWin}`,
                    'super'
                )
            } else if (cmd === 'tie') {
                receivedWin = '__TIE__'
                appendLog(curLang === 'zh' ? '🤝 对战平局！' : curLang === 'ja' ? '🤝 引き分け！' : '🤝 Draw!', 'super')
            }
        }
        if (stageLines.length > 0) {
            const animated = hasAnimLines(stageLines)
            const seq = animated ? ++animSeqRef.current : 0
            if (animated) setStagePlaying(true)
            stageRef.current?.pushLines(stageLines, seq)
        }
        if (receivedWin) {
            setPendingWinner(receivedWin)
            setPendingRequest(null)
            return
        }
        if (receivedError && lastActionableReqRef.current) {
            submittedReqRef.current = null
            setStagePlaying(false)
            setPendingRequest({ ...lastActionableReqRef.current })
            return
        }
        if (receivedRequest) {
            setPendingRequest(receivedRequest)
        }
    }
    const startOfflineBattle = () => {
        const myPaste = getValidatedMyPaste()
        if (!myPaste) return
        cleanupAll()
        const pickedCpu = pickCpuTeamPaste(cpuPresetId)
        setCpuTeamLabel(pickedCpu.label)
        mySideRef.current = 'p1'
        myNameRef.current = 'Player'
        setMyRole('p1')
        resetBattleBoard('p1')
        if (!started) setStarted(true)
        startBattleBgm(bgmTrackRef.current, bgmMutedRef.current)
        const worker = new Worker(new URL('../../engine/battle.worker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker
        worker.onmessage = (e: MessageEvent) => {
            if (e.data?.type === 'PROTOCOL') handleProtocolChunk(e.data.chunk as string)
        }
        worker.postMessage({ type: 'START_OFFLINE', formatId: format, p1Paste: myPaste, p2Paste: pickedCpu.paste })
    }
    const formatLabel = (fmt: string) =>
        fmt.includes('doubles')
            ? langRef.current === 'zh' ? '64 双打' : langRef.current === 'ja' ? '64 ダブル' : '64 Doubles'
            : langRef.current === 'zh' ? '63 单打' : langRef.current === 'ja' ? '63 シングル' : '63 Singles'
    const joinOnlineRoom = (code: string, joinType: 'create' | 'join' = 'join') => {
        const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        if (!cleanCode) return
        const myPaste = getValidatedMyPaste()
        if (!myPaste) return
        cleanupAll()
        setStarted(false)
        setOnlineError('')
        setRoomMode(joinType)
        setActiveRoomCode(cleanCode)
        setOnlineStatus('waiting')
        const session = connectP2PRoom(cleanCode, format, myPaste, {
            onRoleAssigned(role) {
                mySideRef.current = role
                myNameRef.current = role === 'p1' ? 'Host' : 'Guest'
                setMyRole(role)
                resetBattleBoard(role)
                setOnlineStatus('playing')
                setStarted(true)
                startBattleBgm(bgmTrackRef.current, bgmMutedRef.current)
            },
            onGuestTeam(guestPaste) {
                const worker = new Worker(new URL('../../engine/battle.worker.ts', import.meta.url), { type: 'module' })
                workerRef.current = worker
                worker.onmessage = (e: MessageEvent) => {
                    if (e.data?.type === 'PROTOCOL') handleProtocolChunk(e.data.chunk as string)
                    else if (e.data?.type === 'P2_PROTOCOL') p2pSessionRef.current?.sendProtocolToGuest(e.data.chunk as string)
                }
                worker.postMessage({ type: 'START_P2P_HOST', formatId: format, p1Paste: myPaste, p2Paste: guestPaste })
            },
            onGuestChoice(choice) {
                workerRef.current?.postMessage({ type: 'CHOICE_P2', choice })
            },
            onProtocol(chunk) {
                handleProtocolChunk(chunk)
            },
            onFormatMismatch(peerFormat) {
                cleanupAll()
                setStarted(false)
                setActiveRoomCode('')
                setOnlineStatus('idle')
                setOnlineError(
                    langRef.current === 'zh'
                        ? `⚠️ 双方赛制不一致：你当前是【${formatLabel(format)}】，对方是【${formatLabel(peerFormat)}】，请切换到同一赛制后再加入。`
                        : `⚠️ Format mismatch: you are in ${formatLabel(format)}, opponent is in ${formatLabel(peerFormat)}.`
                )
            },
            onOpponentLeft() {
                setOnlineStatus('disconnected')
                stopBattleBgm()
                appendLog(langRef.current === 'zh' ? '⚠️ 对手已断开连接。' : '⚠️ Opponent disconnected.', 'error')
            },
        })
        p2pSessionRef.current = session
    }
    const handleStartRandomMatch = () => {
        const myPaste = getValidatedMyPaste()
        if (!myPaste) return
        cleanupAll()
        setStarted(false)
        setOnlineError('')
        setActiveRoomCode('')
        setOnlineStatus('matching')
        const handle = startRandomMatchmaking(format, (matchedRoomId) => {
            matchCancelRef.current = null
            joinOnlineRoom(matchedRoomId, 'join')
        })
        matchCancelRef.current = handle.cancel
    }
    const handleCreatePrivateRoom = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)]
        }
        setRoomCodeInput(code)
        joinOnlineRoom(code, 'create')
    }
    const handleLeaveOnline = () => {
        cleanupAll()
        setStarted(false)
        setOnlineError('')
        setActiveRoomCode('')
        setOnlineStatus('idle')
    }
    const sendChoice = (choice: string) => {
        if (!visibleRequest || submittedReqRef.current === visibleRequest) return
        submittedReqRef.current = visibleRequest
        setPendingRequest(null)
        setPendingChoices([])
        setChoosingTargetFor(null)
        setWantTera(false)
        if (mode === 'online' && mySideRef.current === 'p2') {
            p2pSessionRef.current?.sendChoiceToHost(choice)
        } else {
            workerRef.current?.postMessage({ type: 'CHOICE', choice })
        }
    }
    const togglePreviewIndex = (idx1: number) => {
        const maxPick = visibleRequest?.maxChosenTeamSize || pickedLimit
        setPreviewOrder((prev) => {
            if (prev.includes(idx1)) return prev.filter((x) => x !== idx1)
            if (prev.length >= maxPick) return prev
            return [...prev, idx1]
        })
    }
    const commitSlotChoice = (choiceText: string) => {
        if (!visibleRequest) return
        if (visibleRequest.forceSwitch) {
            const next = [...pendingChoices]
            next[activeSlotCursor] = choiceText
            const availableBenchCount = visibleRequest.side.pokemon.filter((p) => !p.active && !p.condition.endsWith('fnt')).length
            const pickedSwitchCount = next.filter((c) => c && c.startsWith('switch ')).length
            let nextIdx = -1
            if (pickedSwitchCount < availableBenchCount) {
                for (let i = activeSlotCursor + 1; i < visibleRequest.forceSwitch.length; i++) {
                    if (visibleRequest.forceSwitch[i]) {
                        nextIdx = i
                        break
                    }
                }
            }
            if (nextIdx === -1) {
                const finalParts = visibleRequest.forceSwitch.map((need, i) => (need ? next[i] || 'pass' : 'pass'))
                sendChoice(finalParts.join(', '))
            } else {
                setPendingChoices(next)
                setActiveSlotCursor(nextIdx)
            }
            return
        }
        if (visibleRequest.active) {
            const next = [...pendingChoices]
            next[activeSlotCursor] = choiceText
            let nextIdx = -1
            for (let i = activeSlotCursor + 1; i < visibleRequest.active.length; i++) {
                const slot = visibleRequest.active[i]
                const poke = visibleRequest.side.pokemon[i]
                if (slot && poke && !poke.condition.endsWith('fnt')) {
                    nextIdx = i
                    break
                }
            }
            if (nextIdx === -1) {
                const finalParts = visibleRequest.active.map((slot, i) => {
                    const poke = visibleRequest.side.pokemon[i]
                    if (!slot || !poke || poke.condition.endsWith('fnt')) return 'pass'
                    return next[i] || 'default'
                })
                sendChoice(finalParts.join(', '))
            } else {
                setPendingChoices(next)
                setActiveSlotCursor(nextIdx)
                setChoosingTargetFor(null)
                setWantTera(false)
            }
        }
    }
    const handleStepBack = () => {
        if (!visibleRequest?.active) return
        for (let i = activeSlotCursor - 1; i >= 0; i--) {
            const slot = visibleRequest.active[i]
            const poke = visibleRequest.side.pokemon[i]
            if (slot && poke && !poke.condition.endsWith('fnt')) {
                setPendingChoices((prev) => prev.slice(0, i))
                setActiveSlotCursor(i)
                setChoosingTargetFor(null)
                setWantTera(false)
                return
            }
        }
    }
    const handleMoveClick = (move: MoveOption, moveNum: number) => {
        const teraSuffix = wantTera ? ' terastallize' : ''
        const md = Dex.moves.get(move.id || move.move)
        const tgt = move.target || (md.exists ? md.target : 'self')
        if (!isDoubles) {
            commitSlotChoice(`move ${moveNum}${teraSuffix}`)
            return
        }
        const moveCount = currentActiveReq?.moves.length || 0
        if (moveCount === 1 && (tgt === 'self' || tgt === 'randomNormal' || tgt === 'scripted')) {
            commitSlotChoice(`move ${moveNum}${teraSuffix}`)
            return
        }
        if (
            tgt === 'normal' ||
            tgt === 'any' ||
            tgt === 'adjacentFoe' ||
            tgt === 'adjacentAlly' ||
            tgt === 'adjacentAllyOrSelf'
        ) {
            setChoosingTargetFor({ moveNum, moveId: move.id || move.move, targetType: tgt, tera: wantTera })
        } else {
            commitSlotChoice(`move ${moveNum}${teraSuffix}`)
        }
    }
    const currentActiveReq = visibleRequest?.active?.[activeSlotCursor] || null
    const currentSideMon = visibleRequest?.side.pokemon[activeSlotCursor] || null
    const alreadyPickedSwitches = new Set(pendingChoices)
    const teraQueuedEarlier = pendingChoices.some((c, idx) => idx < activeSlotCursor && c?.includes('terastallize'))
    const firstActiveIdx = visibleRequest?.active
        ? visibleRequest.active.findIndex((s, i) => s !== null && visibleRequest.side.pokemon[i] && !visibleRequest.side.pokemon[i].condition.endsWith('fnt'))
        : 0
    const hoveredMoveData = hoveredMove ? Dex.moves.get(hoveredMove) : null
    const targetMoveData = choosingTargetFor ? Dex.moves.get(choosingTargetFor.moveId) : null
    const teamCap = visibleRequest?.maxChosenTeamSize || pickedLimit
    const iWon = visibleWinner === myNameRef.current
    const hasActionHud = Boolean(
        visibleRequest && (visibleRequest.teamPreview || visibleRequest.forceSwitch || (currentActiveReq && currentSideMon))
    )
    return (
        <div ref={arenaRef} className={`flex flex-col gap-1.5 ${isFullscreen ? 'bg-slate-950 p-1.5 h-screen' : ''}`}>
            <div className="bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-700/80 space-y-2 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                            disabled={mode === 'online' && onlineStatus !== 'idle'}
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-100 disabled:opacity-50"
                        >
                            <option value="__rental__">
                                {lang === 'zh' ? '⭐ 我方：热门租借队 (6只)' : lang === 'ja' ? '⭐ レンタルパーティ' : '⭐ Meta Rental Team'}
                            </option>
                            {teams.map((tm) => (
                                <option key={tm.id} value={tm.id}>
                                    {tm.name} ({tm.members.length}/6)
                                </option>
                            ))}
                        </select>
                        {mode === 'offline' && (
                            <select
                                value={cpuPresetId}
                                onChange={(e) => setCpuPresetId(e.target.value)}
                                className="bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-xs font-semibold text-amber-200"
                            >
                                <option value="__random__">
                                    {lang === 'zh' ? '🎲 电脑：每局随机队伍' : lang === 'ja' ? '🎲 CPU：毎回ランダム' : '🎲 CPU: Random Every Match'}
                                </option>
                                {CPU_TEAM_PRESETS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p[lang]}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select
                            value={bgmTrackId}
                            onChange={(e) => setBgmTrackId(e.target.value)}
                            className="bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-xs text-cyan-200"
                        >
                            <option value="__random__">{lang === 'zh' ? '🎵 BGM：随机官方曲目' : '🎵 BGM: Random'}</option>
                            {BATTLE_BGM_TRACKS.map((tr) => (
                                <option key={tr.id} value={tr.id}>
                                    🎵 {tr[lang]}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => setBgmMuted((m) => !m)}
                            className={`border rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer transition ${bgmMuted ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200'
                                }`}
                        >
                            {bgmMuted ? '🔇 BGM' : '🎵 BGM'}
                        </button>
                        <button
                            onClick={() => setSfxMuted((m) => !m)}
                            className={`border rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer transition ${sfxMuted ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                                }`}
                        >
                            {sfxMuted ? '🔇 SFX' : '🔊 SFX'}
                        </button>
                        {mode === 'offline' && started && cpuTeamLabel && (
                            <span className="hidden xl:inline-flex px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-[11px] font-semibold text-amber-200">
                                {cpuTeamLabel[lang]}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {started && (
                            <>
                                <button
                                    onClick={() => setShowLog((v) => !v)}
                                    className={`border rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${showLog ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                                        }`}
                                >
                                    📜 {lang === 'zh' ? '战报' : lang === 'ja' ? 'ログ' : 'Log'} ({logs.length})
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-100 cursor-pointer"
                                >
                                    {isFullscreen ? (lang === 'zh' ? '退出全屏' : 'Exit FS') : lang === 'zh' ? '⛶ 全屏' : '⛶ Fullscreen'}
                                </button>
                            </>
                        )}
                        {mode === 'offline' ? (
                            <button
                                data-sfx="confirm"
                                onClick={startOfflineBattle}
                                className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white px-3.5 py-1 rounded-lg font-bold text-xs shadow cursor-pointer transition"
                            >
                                {started
                                    ? lang === 'zh' ? '⚡ 换队重开' : lang === 'ja' ? '⚡ 再戦' : '⚡ Rematch'
                                    : lang === 'zh' ? '⚔️ 开始对战' : lang === 'ja' ? '⚔️ バトル開始' : '⚔️ Start Battle'}
                            </button>
                        ) : (
                            onlineStatus !== 'idle' && (
                                <button
                                    data-sfx="cancel"
                                    onClick={handleLeaveOnline}
                                    className="bg-rose-600 hover:bg-rose-500 px-3 py-1 rounded-lg font-bold text-xs text-white cursor-pointer"
                                >
                                    {lang === 'zh' ? '退出房间' : lang === 'ja' ? '退室' : 'Leave'}
                                </button>
                            )
                        )}
                    </div>
                </div>
                {mode === 'online' && onlineStatus === 'idle' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
                        <button
                            data-sfx="confirm"
                            onClick={handleStartRandomMatch}
                            className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 px-4 py-1.5 rounded-lg font-bold text-xs text-white shadow cursor-pointer"
                        >
                            {lang === 'zh'
                                ? `🌐 开始 ${isDoubles ? '64 双打' : '63 单打'} 随机匹配`
                                : lang === 'ja'
                                    ? `🌐 ${isDoubles ? '64 ダブル' : '63 シングル'} ランダムマッチ`
                                    : `🌐 Random ${isDoubles ? '64 Doubles' : '63 Singles'} Match`}
                        </button>
                        <span className="text-slate-500 text-xs">{lang === 'zh' ? '或好友约战：' : 'Or Friend Room:'}</span>
                        <button
                            data-sfx="confirm"
                            onClick={handleCreatePrivateRoom}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer"
                        >
                            {lang === 'zh' ? '创建房间码' : lang === 'ja' ? '部屋を作成' : 'Create Room'}
                        </button>
                        <div className="flex items-center gap-1.5">
                            <input
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') joinOnlineRoom(roomCodeInput, 'join')
                                }}
                                placeholder={lang === 'zh' ? '输入房间码...' : 'Room code...'}
                                className="bg-slate-950 border border-slate-600 rounded-lg px-2.5 py-1 text-xs w-32 uppercase text-white"
                            />
                            <button
                                data-sfx="confirm"
                                onClick={() => joinOnlineRoom(roomCodeInput, 'join')}
                                className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                                {lang === 'zh' ? '加入' : lang === 'ja' ? '参加' : 'Join'}
                            </button>
                        </div>
                    </div>
                )}
                {mode === 'online' && onlineStatus === 'matching' && (
                    <div className="text-xs text-cyan-300 bg-cyan-950/50 border border-cyan-700/60 rounded-lg px-3 py-1.5">
                        {lang === 'zh'
                            ? `⏳ 正在 ${isDoubles ? '64 双打' : '63 单打'} P2P 大厅中寻找对手…`
                            : `⏳ Searching for an opponent in P2P ${isDoubles ? '64 Doubles' : '63 Singles'} lobby...`}
                    </div>
                )}
                {mode === 'online' && onlineError && (
                    <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-600/70 rounded-lg px-3 py-1.5 font-semibold">
                        {onlineError}
                    </div>
                )}
                {mode === 'online' && onlineStatus === 'waiting' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-700/60 rounded-lg px-3 py-1.5">
                        <span>
                            {roomMode === 'create'
                                ? lang === 'zh'
                                    ? `🏠 房间码：${activeRoomCode}，等待对手加入（当前赛制：${formatLabel(format)}）…`
                                    : `🏠 Room Code: ${activeRoomCode} — Waiting for opponent (${formatLabel(format)})...`
                                : lang === 'zh'
                                    ? `🔗 正在连接房间：${activeRoomCode}（当前赛制：${formatLabel(format)}）…`
                                    : `🔗 Connecting to Room: ${activeRoomCode} (${formatLabel(format)})...`}
                        </span>
                        <button
                            onClick={() => navigator.clipboard.writeText(activeRoomCode)}
                            className="text-xs bg-emerald-700 hover:bg-emerald-600 px-2.5 py-0.5 rounded text-white cursor-pointer"
                        >
                            {lang === 'zh' ? '复制房间码' : 'Copy Code'}
                        </button>
                    </div>
                )}
                {mode === 'online' && onlineStatus === 'playing' && (
                    <div className="text-xs text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                            {lang === 'zh'
                                ? `P2P 直连成功 · 房间 ${activeRoomCode} · ${myRole === 'p1' ? '房主' : '客机'}`
                                : `P2P Connected · Room ${activeRoomCode} · ${myRole === 'p1' ? 'Host' : 'Guest'}`}
                        </span>
                    </div>
                )}
                {mode === 'online' && onlineStatus === 'disconnected' && (
                    <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-700/60 rounded-lg px-3 py-1.5">
                        {lang === 'zh' ? '⚠️ 对手已离开或网络断开。' : '⚠️ Opponent disconnected.'}
                    </div>
                )}
            </div>
            <div
                className={`relative w-full rounded-2xl overflow-hidden border border-slate-700/90 shadow-[0_14px_48px_rgba(0,0,0,0.75)] bg-slate-950 ${!started
                    ? 'h-0 border-0 opacity-0 pointer-events-none'
                    : isFullscreen
                        ? 'flex-1 min-h-0'
                        : 'h-[calc(100vh-116px)] min-h-[540px]'
                    }`}
            >
                <ShowdownStage
                    ref={stageRef}
                    role={myRole}
                    muted={sfxMuted}
                    lang={lang}
                    onPlaybackChange={handlePlaybackChange}
                />
                {started && showLog && (
                    <aside className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-slate-950/82 backdrop-blur-md border-l border-white/15 z-40 flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-xs font-bold text-amber-300">
                            <span>📜 {lang === 'zh' ? '对战战报' : lang === 'ja' ? 'バトルログ' : 'Battle Log'}</span>
                            <button data-sfx="cancel" onClick={() => setShowLog(false)} className="text-slate-300 hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5 p-3 text-xs">
                            {logs.map((item, i) => (
                                <div
                                    key={i}
                                    className={
                                        item.tone === 'turn'
                                            ? 'text-center font-bold text-amber-300 border-y border-white/10 py-1 my-1'
                                            : item.tone === 'super'
                                                ? 'text-amber-300 font-semibold'
                                                : item.tone === 'crit'
                                                    ? 'text-orange-400 font-semibold'
                                                    : item.tone === 'faint'
                                                        ? 'text-rose-400 font-semibold'
                                                        : item.tone === 'info'
                                                            ? 'text-cyan-300'
                                                            : item.tone === 'error'
                                                                ? 'text-rose-500 font-bold'
                                                                : item.tone === 'resist'
                                                                    ? 'text-slate-400'
                                                                    : 'text-slate-100'
                                    }
                                >
                                    {item.text}
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </aside>
                )}
                {started && visibleWinner && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 backdrop-blur-[3px]">
                        <div className="bg-slate-950/85 border border-amber-400/50 rounded-2xl px-8 py-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                            <div className="text-2xl font-black text-amber-300 drop-shadow">
                                {visibleWinner === '__TIE__'
                                    ? lang === 'zh' ? '🤝 双方平局！' : lang === 'ja' ? '🤝 引き分け！' : '🤝 Draw!'
                                    : iWon
                                        ? lang === 'zh' ? '🏆 恭喜获胜！' : lang === 'ja' ? '🏆 勝利しました！' : '🏆 You Win!'
                                        : lang === 'zh' ? '对局结束，下次加油！' : lang === 'ja' ? '敗北しました…' : 'You Lost!'}
                            </div>
                            <button
                                data-sfx="confirm"
                                onClick={mode === 'offline' ? startOfflineBattle : handleLeaveOnline}
                                className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 px-6 py-2.5 rounded-xl font-bold text-sm text-white cursor-pointer shadow-lg transition"
                            >
                                {mode === 'offline'
                                    ? lang === 'zh' ? '⚡ 再来一局（换新对手）' : lang === 'ja' ? '⚡ もう一戦' : '⚡ Play Again'
                                    : lang === 'zh' ? '返回大厅' : lang === 'ja' ? 'ロビーへ戻る' : 'Back to Lobby'}
                            </button>
                        </div>
                    </div>
                )}
                {started && !visibleWinner && !hasActionHud && (
                    <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-sm border border-white/15 text-[11px] font-semibold text-slate-100 shadow">
                            {stagePlaying
                                ? lang === 'zh' ? '⚡ 战斗演出中…' : lang === 'ja' ? '⚡ バトル進行中…' : '⚡ Battle in progress...'
                                : mode === 'online' || pendingRequest?.wait
                                    ? lang === 'zh' ? '⏳ 等待对手选择操作…' : lang === 'ja' ? '⏳ 相手の選択待ち…' : '⏳ Waiting for opponent...'
                                    : lang === 'zh' ? '⏳ 准备中…' : lang === 'ja' ? '⏳ 準備中…' : '⏳ Preparing...'}
                        </div>
                        {stagePlaying && (
                            <button
                                onClick={() => stageRef.current?.skipAnimations()}
                                className="px-3 py-1 rounded-full bg-slate-900/75 hover:bg-slate-800 backdrop-blur-sm border border-white/25 text-[11px] font-bold text-amber-200 shadow cursor-pointer transition"
                            >
                                ⏩ {lang === 'zh' ? '跳过动画' : lang === 'ja' ? 'スキップ' : 'Skip'}
                            </button>
                        )}
                    </div>
                )}
                {started && hasActionHud && hudMinimized && (
                    <div className="absolute bottom-3 right-3 z-30">
                        <button
                            onClick={() => setHudMinimized(false)}
                            className="px-4 py-2 rounded-full bg-red-600/80 hover:bg-red-500 backdrop-blur border border-white/30 text-xs font-bold text-white shadow-xl cursor-pointer"
                        >
                            ⚔️ {lang === 'zh' ? '展开操作面板' : lang === 'ja' ? 'コマンドを表示' : 'Show Controls'}
                        </button>
                    </div>
                )}
                {started && hasActionHud && !hudMinimized && (
                    <div
                        className={`pointer-events-none absolute bottom-2 sm:bottom-3 z-30 max-w-[calc(100%-1rem)] transition-all ${showLog ? 'right-2 lg:right-[21rem]' : 'right-2 sm:right-3'
                            }`}
                    >
                        <div className="pointer-events-auto w-[340px] sm:w-[440px] max-w-full rounded-2xl bg-slate-950/42 hover:bg-slate-950/75 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-2.5 transition-colors">
                            {visibleRequest?.teamPreview && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-bold text-amber-300 drop-shadow truncate">
                                            {lang === 'zh'
                                                ? `选出 ${teamCap} 只（${previewOrder.length}/${teamCap}）`
                                                : lang === 'ja'
                                                    ? `選出 ${teamCap} 匹（${previewOrder.length}/${teamCap}）`
                                                    : `Pick ${teamCap} (${previewOrder.length}/${teamCap})`}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => setHudMinimized(true)}
                                                className="text-[11px] px-2 py-1 rounded-lg bg-slate-900/55 hover:bg-slate-800/80 border border-white/15 text-slate-100 cursor-pointer"
                                            >
                                                👁️ {lang === 'zh' ? '收起' : 'Hide'}
                                            </button>
                                            <button
                                                data-sfx="confirm"
                                                disabled={previewOrder.length !== teamCap}
                                                onClick={() => sendChoice(`team ${previewOrder.join('')}`)}
                                                className="bg-gradient-to-r from-red-600/90 to-rose-500/90 disabled:from-slate-700/70 disabled:to-slate-700/70 disabled:text-slate-400 px-3.5 py-1 rounded-lg text-xs font-bold text-white cursor-pointer shadow"
                                            >
                                                {lang === 'zh' ? '确认出战' : lang === 'ja' ? '選出決定' : 'Confirm'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="bg-slate-950/40 border border-white/10 rounded-xl p-1.5">
                                            <div className="text-[10px] font-semibold text-rose-300 mb-1">
                                                {lang === 'zh' ? '对手队伍' : lang === 'ja' ? '相手のパーティ' : "Opponent's Team"}
                                            </div>
                                            <div className="grid grid-cols-6 gap-1">
                                                {foePreview.map((sp, i) => (
                                                    <div key={i} className="bg-slate-900/55 border border-white/10 rounded-lg p-1 text-center">
                                                        <img src={Sprites.getDexPokemon(sp).url} alt={sp} className="w-7 h-7 object-contain mx-auto" />
                                                        <div className="text-[9px] truncate text-slate-200">{displaySpecies(sp, lang)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-950/40 border border-white/10 rounded-xl p-1.5">
                                            <div className="text-[10px] font-semibold text-cyan-300 mb-1">
                                                {lang === 'zh' ? '我方队伍（点击按顺序选出）' : lang === 'ja' ? '自分のパーティ（クリックで選出）' : 'Your Team (Click in Order)'}
                                            </div>
                                            <div className="grid grid-cols-6 gap-1">
                                                {myPreview.map((sp, i) => {
                                                    const orderPos = previewOrder.indexOf(i + 1)
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => togglePreviewIndex(i + 1)}
                                                            className={`relative p-1 rounded-lg border text-center cursor-pointer transition ${orderPos >= 0
                                                                ? 'bg-red-500/45 border-amber-400 shadow-[0_0_10px_rgba(250,204,21,0.35)]'
                                                                : 'bg-slate-900/55 border-white/15 hover:border-white/45'
                                                                }`}
                                                        >
                                                            {orderPos >= 0 && (
                                                                <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center shadow">
                                                                    {orderPos + 1}
                                                                </span>
                                                            )}
                                                            <img src={Sprites.getDexPokemon(sp).url} alt={sp} className="w-7 h-7 object-contain mx-auto" />
                                                            <div className="text-[9px] truncate text-white">{displaySpecies(sp, lang)}</div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {visibleRequest?.forceSwitch && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-bold text-amber-300 truncate">
                                            {lang === 'zh'
                                                ? `选择替补上场（${isDoubles ? (activeSlotCursor === 0 ? '左' : '右') : '出战位'}）`
                                                : `Switch in (Slot ${activeSlotCursor + 1})`}
                                        </div>
                                        <button
                                            onClick={() => setHudMinimized(true)}
                                            className="text-[11px] px-2 py-0.5 rounded bg-slate-900/55 border border-white/15 text-slate-200 cursor-pointer shrink-0"
                                        >
                                            👁️ {lang === 'zh' ? '收起' : 'Hide'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                        {visibleRequest.side.pokemon.map((poke, idx) => {
                                            const { species } = parseDetails(poke.details)
                                            const cond = parseCondition(poke.condition)
                                            const choiceKey = `switch ${idx + 1}`
                                            const disabled = poke.active || cond.fainted || alreadyPickedSwitches.has(choiceKey)
                                            return (
                                                <button
                                                    key={idx}
                                                    data-sfx="confirm"
                                                    disabled={disabled}
                                                    onClick={() => commitSlotChoice(choiceKey)}
                                                    className="flex items-center gap-1.5 p-1.5 rounded-xl border border-white/15 bg-slate-900/55 hover:bg-slate-800/85 hover:border-amber-400 disabled:opacity-35 cursor-pointer text-left transition"
                                                >
                                                    <img src={Sprites.getDexPokemon(species).url} alt={species} className="w-7 h-7 object-contain shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold truncate text-white flex items-center gap-1">
                                                            <span className="truncate">{displaySpecies(species, lang)}</span>
                                                            {poke.item && <ItemIcon name={poke.item} />}
                                                        </div>
                                                        <div className="text-[10px] text-slate-200">{cond.fainted ? 'FNT' : poke.condition}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                            {currentActiveReq && currentSideMon && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            <span className="text-xs sm:text-sm font-black text-white drop-shadow truncate">
                                                {displaySpecies(parseDetails(currentSideMon.details).species, lang)}
                                                {isDoubles && ` (${activeSlotCursor === 0 ? (lang === 'zh' ? '左' : 'L') : lang === 'zh' ? '右' : 'R'})`}
                                            </span>
                                            {currentSideMon.item && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900/65 border border-white/15 text-amber-200">
                                                    <ItemIcon name={currentSideMon.item} />
                                                    <span className="max-w-20 truncate">{getItemEntry(currentSideMon.item)[lang]}</span>
                                                </span>
                                            )}
                                            {activeSlotCursor > firstActiveIdx && (
                                                <button
                                                    data-sfx="cancel"
                                                    onClick={handleStepBack}
                                                    className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                                                >
                                                    {lang === 'zh' ? '← 上一只' : '← Back'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {currentActiveReq.canTerastallize && !teraQueuedEarlier && (
                                                <button
                                                    data-sfx="tera"
                                                    onClick={() => setWantTera((v) => !v)}
                                                    className={`text-[11px] px-2.5 py-0.5 rounded-full border font-bold cursor-pointer transition ${wantTera
                                                        ? 'bg-cyan-400/90 text-slate-950 border-white shadow-[0_0_14px_rgba(34,211,238,0.8)]'
                                                        : 'bg-slate-900/60 text-cyan-200 border-cyan-400/70 hover:bg-cyan-950/70'
                                                        }`}
                                                >
                                                    💎 {lang === 'zh' ? '太晶' : lang === 'ja' ? 'テラス' : 'Tera'} ({getTypeEntry(currentActiveReq.canTerastallize)[lang]})
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setHudMinimized(true)}
                                                className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/55 hover:bg-slate-800/80 border border-white/15 text-slate-200 cursor-pointer"
                                            >
                                                👁️
                                            </button>
                                        </div>
                                    </div>
                                    {hoveredMoveData?.exists && !choosingTargetFor && (
                                        <div className="text-[11px] text-slate-100 bg-slate-950/75 border border-white/15 rounded-lg px-2 py-1 leading-snug">
                                            {hoveredMoveData.shortDesc} · {lang === 'zh' ? '命中' : 'Acc'}:{' '}
                                            {hoveredMoveData.accuracy === true ? '—' : `${hoveredMoveData.accuracy}%`}
                                        </div>
                                    )}
                                    {choosingTargetFor ? (
                                        <div className="space-y-1.5 bg-slate-950/50 p-2 rounded-xl border border-white/15">
                                            <div className="flex items-center justify-between text-xs text-slate-100">
                                                <span className="font-bold">{lang === 'zh' ? '选择攻击目标：' : lang === 'ja' ? '対象を選択：' : 'Choose Target:'}</span>
                                                <button
                                                    data-sfx="cancel"
                                                    onClick={() => setChoosingTargetFor(null)}
                                                    className="text-rose-300 hover:underline cursor-pointer font-semibold"
                                                >
                                                    {lang === 'zh' ? '返回' : 'Back'}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {(choosingTargetFor.targetType === 'normal' ||
                                                    choosingTargetFor.targetType === 'any' ||
                                                    choosingTargetFor.targetType === 'adjacentFoe') &&
                                                    [1, 0].map((slot) => {
                                                        const mon = foeActive[slot]
                                                        if (!mon || mon.fainted) {
                                                            return (
                                                                <div key={`foe-${slot}`} className="p-2 rounded-lg border border-white/10 text-xs text-slate-400 text-center">
                                                                    {lang === 'zh' ? '对手空位' : 'Empty'}
                                                                </div>
                                                            )
                                                        }
                                                        const eff = targetMoveData?.exists
                                                            ? calcEffectiveness(targetMoveData.type, targetMoveData.category, mon)
                                                            : null
                                                        const tag = formatEffTag(eff, lang)
                                                        return (
                                                            <button
                                                                key={`foe-${slot}`}
                                                                data-sfx="confirm"
                                                                onClick={() =>
                                                                    commitSlotChoice(
                                                                        `move ${choosingTargetFor.moveNum} +${slot + 1}${choosingTargetFor.tera ? ' terastallize' : ''}`
                                                                    )
                                                                }
                                                                className="p-2 rounded-xl bg-rose-800/60 hover:bg-rose-700/85 border border-rose-400/80 text-xs font-bold text-white cursor-pointer flex items-center justify-between gap-1.5 transition"
                                                            >
                                                                <span className="truncate">
                                                                    {lang === 'zh' ? (slot === 1 ? '对手左' : '对手右') : slot === 1 ? 'Foe L' : 'Foe R'}: {displaySpecies(mon.species, lang)}
                                                                </span>
                                                                {tag && <span className={`text-[10px] px-1 py-0.5 rounded font-bold shrink-0 ${tag.cls}`}>{tag.text}</span>}
                                                            </button>
                                                        )
                                                    })}
                                                {(choosingTargetFor.targetType === 'adjacentAlly' ||
                                                    choosingTargetFor.targetType === 'adjacentAllyOrSelf' ||
                                                    choosingTargetFor.targetType === 'normal' ||
                                                    choosingTargetFor.targetType === 'any') &&
                                                    [0, 1].map((slot) => {
                                                        if (
                                                            (choosingTargetFor.targetType === 'adjacentAlly' ||
                                                                choosingTargetFor.targetType === 'normal' ||
                                                                choosingTargetFor.targetType === 'any') &&
                                                            slot === activeSlotCursor
                                                        ) {
                                                            return (
                                                                <div key={`ally-${slot}`} className="p-2 rounded-lg border border-white/5 bg-slate-900/25 text-[11px] text-slate-500 text-center">
                                                                    {lang === 'zh' ? '当前行动' : 'Active'}
                                                                </div>
                                                            )
                                                        }
                                                        const mon = myActive[slot]
                                                        if (!mon || mon.fainted) return <div key={`ally-${slot}`} />
                                                        return (
                                                            <button
                                                                key={`ally-${slot}`}
                                                                data-sfx="confirm"
                                                                onClick={() =>
                                                                    commitSlotChoice(
                                                                        `move ${choosingTargetFor.moveNum} -${slot + 1}${choosingTargetFor.tera ? ' terastallize' : ''}`
                                                                    )
                                                                }
                                                                className="p-2 rounded-xl bg-sky-800/60 hover:bg-sky-700/85 border border-sky-400/80 text-xs font-bold text-white cursor-pointer truncate transition"
                                                            >
                                                                {lang === 'zh' ? (slot === 0 ? '我方左' : '我方右') : slot === 0 ? 'Ally L' : 'Ally R'}: {displaySpecies(mon.species, lang)}
                                                            </button>
                                                        )
                                                    })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {currentActiveReq.moves.map((mv, idx) => {
                                                    const md = Dex.moves.get(mv.id || mv.move)
                                                    const typeName = md.exists ? getTypeEntry(md.type)[lang] : ''
                                                    const catLabel = md.exists ? getCategoryLabel(md.category, lang) : ''
                                                    const btnCls = TYPE_BTN_STYLES[md.type] || TYPE_BTN_STYLES.Normal
                                                    const eff = !isDoubles && md.exists ? calcEffectiveness(md.type, md.category, foeActive[0]) : null
                                                    const effTag = formatEffTag(eff, lang)
                                                    return (
                                                        <button
                                                            key={idx}
                                                            data-sfx="confirm"
                                                            disabled={mv.disabled}
                                                            onMouseEnter={() => setHoveredMove(mv.id || mv.move)}
                                                            onMouseLeave={() => setHoveredMove(null)}
                                                            onClick={() => handleMoveClick(mv, idx + 1)}
                                                            className={`px-2.5 py-1.5 rounded-xl border backdrop-blur-sm text-left cursor-pointer transition shadow-md disabled:opacity-35 ${btnCls}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="font-extrabold text-xs sm:text-sm text-white drop-shadow truncate">
                                                                    {getMoveEntry(mv.move)[lang]}
                                                                </span>
                                                                {effTag && (
                                                                    <span className={`text-[10px] px-1 py-0.5 rounded font-bold shrink-0 ${effTag.cls}`}>
                                                                        {effTag.text}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] text-white/90 mt-0.5">
                                                                <span className="truncate">
                                                                    {typeName} · {catLabel}
                                                                    {md.basePower > 0 ? ` · ${md.basePower}` : ''}
                                                                </span>
                                                                {typeof mv.pp === 'number' && (
                                                                    <span className="font-mono font-bold shrink-0 ml-1">
                                                                        {mv.pp}/{mv.maxpp}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {!currentActiveReq.trapped && (
                                                <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-white/10">
                                                    <span className="text-[10px] font-bold text-slate-300 shrink-0">
                                                        {lang === 'zh' ? '换人：' : lang === 'ja' ? '交代：' : 'Switch:'}
                                                    </span>
                                                    {visibleRequest?.side.pokemon.map((poke, idx) => {
                                                        if (poke.active) return null
                                                        const { species } = parseDetails(poke.details)
                                                        const cond = parseCondition(poke.condition)
                                                        const choiceKey = `switch ${idx + 1}`
                                                        const disabled = cond.fainted || alreadyPickedSwitches.has(choiceKey)
                                                        return (
                                                            <button
                                                                key={idx}
                                                                data-sfx="confirm"
                                                                disabled={disabled}
                                                                onClick={() => commitSlotChoice(choiceKey)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/15 bg-slate-900/50 hover:bg-slate-800/85 hover:border-emerald-400 disabled:opacity-35 cursor-pointer transition"
                                                            >
                                                                <img src={Sprites.getDexPokemon(species).url} alt={species} className="w-5 h-5 object-contain" />
                                                                <span className="text-[11px] font-bold text-white">{displaySpecies(species, lang)}</span>
                                                                {poke.item && <ItemIcon name={poke.item} />}
                                                                <span className="text-[10px] font-mono text-slate-300">{cond.fainted ? 'FNT' : poke.condition}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}