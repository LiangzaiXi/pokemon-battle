import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Dex } from '@pkmn/dex'
export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'
export type BattleFormat = 'gen9battlestadiumsingles' | 'gen9battlestadiumdoubles'
export interface PokemonMember {
    species: string
    item: string
    ability: string
    nature: string
    teraType: string
    level: number
    moves: [string, string, string, string]
    evs: Record<StatKey, number>
    ivs: Record<StatKey, number>
}
export interface SavedTeam {
    id: string
    name: string
    format: BattleFormat
    members: PokemonMember[]
}
export function createDefaultMember(species = 'Pikachu'): PokemonMember {
    const sp = Dex.species.get(species)
    const firstAbility = sp.exists ? (Object.values(sp.abilities).filter(Boolean)[0] as string) || '' : ''
    const firstType = sp.exists && sp.types[0] ? sp.types[0] : 'Normal'
    return {
        species: sp.exists ? sp.name : species,
        item: '',
        ability: firstAbility,
        nature: 'Hardy',
        teraType: firstType,
        level: 50,
        moves: ['', '', '', ''],
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    }
}
export function exportTeamToPaste(members: PokemonMember[]): string {
    const labels: Record<StatKey, string> = {
        hp: 'HP',
        atk: 'Atk',
        def: 'Def',
        spa: 'SpA',
        spd: 'SpD',
        spe: 'Spe',
    }
    return members
        .map((m) => {
            const sp = Dex.species.get(m.species)
            const fallbackAbility = sp.exists ? (Object.values(sp.abilities).filter(Boolean)[0] as string) || '' : ''
            const resolvedAbility = m.ability || fallbackAbility
            const lines: string[] = []
            lines.push(m.item ? `${m.species} @ ${m.item}` : m.species)
            if (resolvedAbility) lines.push(`Ability: ${resolvedAbility}`)
            lines.push(`Level: ${m.level}`)
            if (m.teraType) lines.push(`Tera Type: ${m.teraType}`)
            const evParts = (Object.keys(labels) as StatKey[])
                .filter((k) => m.evs[k] > 0)
                .map((k) => `${m.evs[k]} ${labels[k]}`)
            if (evParts.length > 0) lines.push(`EVs: ${evParts.join(' / ')}`)
            lines.push(`${m.nature} Nature`)
            const ivParts = (Object.keys(labels) as StatKey[])
                .filter((k) => m.ivs[k] !== 31)
                .map((k) => `${m.ivs[k]} ${labels[k]}`)
            if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(' / ')}`)
            m.moves.filter(Boolean).forEach((move) => lines.push(`- ${move}`))
            return lines.join('\n')
        })
        .join('\n\n')
}
interface TeamState {
    teams: SavedTeam[]
    activeTeamId: string | null
    saveTeam: (team: SavedTeam) => void
    deleteTeam: (id: string) => void
    setActiveTeam: (id: string | null) => void
}
export const useTeamStore = create<TeamState>()(
    persist(
        (set) => ({
            teams: [],
            activeTeamId: null,
            saveTeam: (team) =>
                set((state) => {
                    const exists = state.teams.some((t) => t.id === team.id)
                    return {
                        teams: exists ? state.teams.map((t) => (t.id === team.id ? team : t)) : [...state.teams, team],
                        activeTeamId: team.id,
                    }
                }),
            deleteTeam: (id) =>
                set((state) => ({
                    teams: state.teams.filter((t) => t.id !== id),
                    activeTeamId: state.activeTeamId === id ? null : state.activeTeamId,
                })),
            setActiveTeam: (id) => set({ activeTeamId: id }),
        }),
        { name: 'pkmn-p2p-saved-teams' }
    )
)