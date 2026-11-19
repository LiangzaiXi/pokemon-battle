import { Dex } from '@pkmn/dex'
import {
    getAbilityEntry,
    getCategoryLabel,
    getItemEntry,
    getMoveEntry,
    getTypeEntry,
    type LangCode,
} from './dexI18n'
export type DexDetailKind = 'ability' | 'item' | 'move'
export interface DexDetailInfo {
    kind: DexDetailKind
    rawName: string
    title: string
    fallbackDesc: string
    moveMeta?: {
        typeRaw: string
        typeLabel: string
        categoryRaw: string
        categoryLabel: string
        basePower: number
        accuracy: number | true
        pp: number
        priority: number
    }
}
interface PokeApiEntry {
    flavor_text?: string
    text?: string
    language?: { name?: string }
}
const CACHE_KEY = 'pkmn_dex_desc_cache_v1'
const memoryCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
let cacheLoaded = false
function ensureCacheLoaded() {
    if (cacheLoaded) return
    cacheLoaded = true
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return
        const obj = JSON.parse(raw) as Record<string, string>
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') memoryCache.set(k, v)
        }
    } catch {
        return
    }
}
function persistCache() {
    try {
        const entries = Array.from(memoryCache.entries()).slice(-600)
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch {
        return
    }
}
function toPokeApiSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
function cleanFlavorText(text: string, lang: LangCode): string {
    if (lang === 'en') return text.replace(/[\r\n\f]+/g, ' ').replace(/\s+/g, ' ').trim()
    return text.replace(/[\r\n\f]+/g, '').replace(/\s+/g, ' ').trim()
}
function pickFlavorText(entries: PokeApiEntry[], lang: LangCode): string | null {
    const targets = lang === 'zh' ? ['zh-Hans', 'zh-Hant'] : lang === 'ja' ? ['ja', 'ja-Hrkt'] : ['en']
    for (const targetLang of targets) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const item = entries[i]
            if (item.language?.name !== targetLang) continue
            const raw = item.flavor_text || item.text || ''
            const cleaned = cleanFlavorText(raw, lang)
            if (cleaned && cleaned !== '—' && cleaned !== '-') return cleaned
        }
    }
    return null
}
export function getBaseDexDetail(kind: DexDetailKind, rawName: string, lang: LangCode): DexDetailInfo | null {
    if (!rawName) return null
    if (kind === 'move') {
        const m = Dex.moves.get(rawName)
        if (!m.exists) return null
        return {
            kind,
            rawName: m.name,
            title: getMoveEntry(m.name)[lang],
            fallbackDesc: m.desc || m.shortDesc || '',
            moveMeta: {
                typeRaw: m.type,
                typeLabel: getTypeEntry(m.type)[lang],
                categoryRaw: m.category,
                categoryLabel: getCategoryLabel(m.category, lang),
                basePower: m.basePower,
                accuracy: m.accuracy,
                pp: m.pp,
                priority: m.priority,
            },
        }
    }
    if (kind === 'ability') {
        const a = Dex.abilities.get(rawName)
        if (!a.exists) return null
        return {
            kind,
            rawName: a.name,
            title: getAbilityEntry(a.name)[lang],
            fallbackDesc: a.desc || a.shortDesc || '',
        }
    }
    const it = Dex.items.get(rawName)
    if (!it.exists) return null
    return {
        kind,
        rawName: it.name,
        title: getItemEntry(it.name)[lang],
        fallbackDesc: it.desc || it.shortDesc || '',
    }
}
export function getCachedLocalizedDesc(kind: DexDetailKind, rawName: string, lang: LangCode): string | undefined {
    ensureCacheLoaded()
    return memoryCache.get(`${lang}:${kind}:${rawName}`)
}
export async function fetchLocalizedDexDesc(
    kind: DexDetailKind,
    rawName: string,
    lang: LangCode
): Promise<string | null> {
    if (lang === 'en') return null
    ensureCacheLoaded()
    const key = `${lang}:${kind}:${rawName}`
    const cached = memoryCache.get(key)
    if (cached !== undefined) return cached || null
    const pending = inflight.get(key)
    if (pending) return pending
    const slug = toPokeApiSlug(rawName)
    if (!slug) return null
    const task = (async () => {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/${kind}/${encodeURIComponent(slug)}`)
            if (!res.ok) {
                memoryCache.set(key, '')
                persistCache()
                return null
            }
            const data = (await res.json()) as { flavor_text_entries?: PokeApiEntry[] }
            const found = Array.isArray(data.flavor_text_entries)
                ? pickFlavorText(data.flavor_text_entries, lang)
                : null
            memoryCache.set(key, found || '')
            persistCache()
            return found
        } catch {
            return null
        } finally {
            inflight.delete(key)
        }
    })()
    inflight.set(key, task)
    return task
}