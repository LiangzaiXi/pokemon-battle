import type { CSSProperties } from 'react'
import { Icons } from '@pkmn/img'
function parseCssString(css: string): CSSProperties {
    const out: Record<string, string> = {}
    for (const part of css.split(';')) {
        const idx = part.indexOf(':')
        if (idx === -1) continue
        const key = part
            .slice(0, idx)
            .trim()
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        const val = part.slice(idx + 1).trim()
        if (key && val) out[key] = val
    }
    return out as CSSProperties
}
export function ItemIcon({ name, className = '' }: { name: string; className?: string }) {
    if (!name) return null
    const style = parseCssString(Icons.getItem(name).style)
    return <span style={style} className={`shrink-0 align-middle ${className}`} aria-hidden="true" />
}
export function PokemonMiniIcon({ name, className = '' }: { name: string; className?: string }) {
    if (!name) return null
    const style = parseCssString(Icons.getPokemon(name).style)
    return <span style={style} className={`shrink-0 align-middle ${className}`} aria-hidden="true" />
}