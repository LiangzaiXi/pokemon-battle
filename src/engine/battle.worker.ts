import { BattleStreams, Dex, Teams } from '@pkmn/sim'
interface MoveReq {
    move: string
    id: string
    disabled?: boolean
    target?: string
}
interface ActiveReq {
    moves: MoveReq[]
    trapped?: boolean
}
interface SidePoke {
    active: boolean
    condition: string
}
interface BattleRequest {
    wait?: boolean
    teamPreview?: boolean
    maxChosenTeamSize?: number
    forceSwitch?: boolean[]
    active?: (ActiveReq | null)[]
    side: { pokemon: SidePoke[] }
}
let streams: ReturnType<typeof BattleStreams.getPlayerStreams> | null = null
function resolveSimFormat(formatId: string): string {
    if (formatId.includes('doubles')) {
        return 'gen9doublescustomgame@@@Picked Team Size = 4,Adjust Level = 50,HP Percentage Mod'
    }
    return 'gen9customgame@@@Picked Team Size = 3,Adjust Level = 50,HP Percentage Mod'
}
function buildCpuChoice(req: BattleRequest): string {
    if (req.wait) return ''
    if (req.teamPreview) {
        const count = req.maxChosenTeamSize || Math.min(3, req.side.pokemon.length)
        const indices = req.side.pokemon.map((_, i) => i + 1)
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const tmp = indices[i]
            indices[i] = indices[j]
            indices[j] = tmp
        }
        return `team ${indices.slice(0, count).join('')}`
    }
    const availableBench = req.side.pokemon
        .map((p, idx) => ({ p, slot: idx + 1 }))
        .filter((x) => !x.p.active && !x.p.condition.endsWith('fnt'))
    if (req.forceSwitch) {
        const used = new Set<number>()
        return req.forceSwitch
            .map((need) => {
                if (!need) return 'pass'
                const pick = availableBench.find((b) => !used.has(b.slot))
                if (!pick) return 'pass'
                used.add(pick.slot)
                return `switch ${pick.slot}`
            })
            .join(', ')
    }
    if (req.active) {
        const isDoubles = req.active.length > 1
        return req.active
            .map((slot, idx) => {
                const poke = req.side.pokemon[idx]
                if (!slot || !poke || poke.condition.endsWith('fnt')) return 'pass'
                const validMoves = slot.moves
                    .map((m, mIdx) => ({ m, num: mIdx + 1 }))
                    .filter((x) => !x.m.disabled)
                if (validMoves.length === 0) return 'default'
                const picked = validMoves[Math.floor(Math.random() * validMoves.length)]
                if (!isDoubles) return `move ${picked.num}`
                const moveObj = Dex.moves.get(picked.m.id || picked.m.move)
                const tgt = picked.m.target || (moveObj.exists ? moveObj.target : 'self')
                if (slot.moves.length === 1 && (tgt === 'self' || tgt === 'randomNormal' || tgt === 'scripted')) {
                    return `move ${picked.num}`
                }
                if (tgt === 'normal' || tgt === 'any' || tgt === 'adjacentFoe') {
                    return `move ${picked.num} +${Math.random() < 0.5 ? 1 : 2}`
                }
                if (tgt === 'adjacentAlly') {
                    return `move ${picked.num} -${idx === 0 ? 2 : 1}`
                }
                if (tgt === 'adjacentAllyOrSelf') {
                    return `move ${picked.num} -${idx + 1}`
                }
                return `move ${picked.num}`
            })
            .join(', ')
    }
    return 'default'
}
self.onmessage = async (event: MessageEvent) => {
    const { type, formatId, p1Paste, p2Paste, choice } = event.data
    if (type === 'START_OFFLINE') {
        const battleStream = new BattleStreams.BattleStream()
        streams = BattleStreams.getPlayerStreams(battleStream)
        const p1Sets = Teams.import(p1Paste) || []
        const p2Sets = Teams.import(p2Paste) || []
        const spec = { formatid: resolveSimFormat(formatId) }
        const p1spec = { name: 'Player', team: Teams.pack(p1Sets) }
        const p2spec = { name: 'CPU', team: Teams.pack(p2Sets) }
            ; (async () => {
                if (!streams) return
                for await (const chunk of streams.p2) {
                    for (const line of chunk.split('\n')) {
                        if (line.startsWith('|error|')) {
                            void streams.p2.write('default')
                        } else if (line.startsWith('|request|')) {
                            const raw = line.slice('|request|'.length)
                            if (raw) {
                                try {
                                    const req = JSON.parse(raw) as BattleRequest
                                    const cpuMove = buildCpuChoice(req)
                                    if (cpuMove) void streams.p2.write(cpuMove)
                                } catch {
                                    void streams.p2.write('default')
                                }
                            }
                        }
                    }
                }
            })()
            ; (async () => {
                if (!streams) return
                for await (const chunk of streams.p1) {
                    self.postMessage({ type: 'PROTOCOL', chunk })
                }
            })()
        void streams.omniscient.write(
            `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`
        )
    } else if (type === 'START_P2P_HOST') {
        const battleStream = new BattleStreams.BattleStream()
        streams = BattleStreams.getPlayerStreams(battleStream)
        const p1Sets = Teams.import(p1Paste) || []
        const p2Sets = Teams.import(p2Paste) || []
        const spec = { formatid: resolveSimFormat(formatId) }
        const p1spec = { name: 'Host', team: Teams.pack(p1Sets) }
        const p2spec = { name: 'Guest', team: Teams.pack(p2Sets) }
            ; (async () => {
                if (!streams) return
                for await (const chunk of streams.p1) {
                    self.postMessage({ type: 'PROTOCOL', chunk })
                }
            })()
            ; (async () => {
                if (!streams) return
                for await (const chunk of streams.p2) {
                    self.postMessage({ type: 'P2_PROTOCOL', chunk })
                }
            })()
        void streams.omniscient.write(
            `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`
        )
    } else if (type === 'CHOICE' && streams) {
        void streams.p1.write(choice)
    } else if (type === 'CHOICE_P2' && streams) {
        void streams.p2.write(choice)
    }
}