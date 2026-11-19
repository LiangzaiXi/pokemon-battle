import { Dex } from '@pkmn/dex'
export interface MoveTypeContext {
    species?: string
    item?: string
    ability?: string
    teraType?: string
}
const ATE_ABILITIES: Record<string, string> = {
    pixilate: 'Fairy',
    aerilate: 'Flying',
    refrigerate: 'Ice',
    galvanize: 'Electric',
}
export function resolveMoveType(moveNameOrId: string, ctx: MoveTypeContext): string {
    const move = Dex.moves.get(moveNameOrId)
    if (!move.exists) return 'Normal'
    const item = ctx.item ? Dex.items.get(ctx.item) : null
    const species = ctx.species ? Dex.species.get(ctx.species) : null
    const abilityId = ctx.ability ? Dex.abilities.get(ctx.ability).id : ''
    if (move.id === 'judgment' && item?.exists && item.onPlate) {
        return item.onPlate
    }
    if (move.id === 'multiattack' && item?.exists && item.onMemory) {
        return item.onMemory
    }
    if (move.id === 'technoblast' && item?.exists && item.onDrive) {
        return item.onDrive
    }
    if (move.id === 'ivycudgel') {
        const spId = species?.id || ''
        const itId = item?.id || ''
        if (spId === 'ogerponwellspring' || spId === 'ogerponwellspringtera' || itId === 'wellspringmask') return 'Water'
        if (spId === 'ogerponhearthflame' || spId === 'ogerponhearthflametera' || itId === 'hearthflamemask') return 'Fire'
        if (spId === 'ogerponcornerstone' || spId === 'ogerponcornerstonetera' || itId === 'cornerstonemask') return 'Rock'
        return 'Grass'
    }
    if (move.id === 'ragingbull') {
        const spId = species?.id || ''
        if (spId === 'taurospaldeacombat') return 'Fighting'
        if (spId === 'taurospaldeablaze') return 'Fire'
        if (spId === 'taurospaldeaaqua') return 'Water'
        return 'Normal'
    }
    if (move.id === 'revelationdance') {
        if (ctx.teraType) return ctx.teraType
        if (species?.exists && species.types[0]) return species.types[0]
        return 'Normal'
    }
    if (move.id === 'terablast' && ctx.teraType) {
        return ctx.teraType
    }
    if (move.id === 'terastarstorm' && ctx.teraType && species?.baseSpecies === 'Terapagos') {
        return 'Stellar'
    }
    if (abilityId === 'normalize') {
        return 'Normal'
    }
    if (move.type === 'Normal' && ATE_ABILITIES[abilityId]) {
        return ATE_ABILITIES[abilityId]
    }
    if (abilityId === 'liquidvoice' && move.flags.sound) {
        return 'Water'
    }
    return move.type
}