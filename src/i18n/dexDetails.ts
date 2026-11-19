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
    short_effect?: string
    effect?: string
    language?: { name?: string }
}
const OLD_CACHE_KEY = 'pkmn_dex_desc_cache_v1'
const CACHE_KEY = 'pkmn_dex_desc_cache_v2'
const memoryCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
let cacheLoaded = false
const LOCAL_ZH_FALLBACK: Record<string, string> = {
    'item:Ability Shield': '携带后，自己的特性不会被对手的招式或特性改变或无效化。',
    'item:Booster Energy': '携带它的宝可梦若特性为古代活性或夸克充能，出场时会消耗该道具并发动特性。',
    'item:Clear Amulet': '携带后，不会因对手的招式或特性而降低能力。',
    'item:Covert Cloak': '携带后，不会受到对手招式的追加效果影响。',
    'item:Loaded Dice': '携带后，使用连续招式时更容易打出较多的次数（2~5次招式至少命中4次）。',
    'item:Mirror Herb': '对手提高能力时，仅限1次，携带该道具的宝可梦也会同样提高对应能力。',
    'item:Punching Glove': '携带后，拳类招式的威力提高1.1倍，且变为不直接接触对手。',
    'item:Fairy Feather': '携带后，妖精属性招式的威力提高1.2倍。',
    'item:Hearthflame Mask': '厄诡椪携带后会变为火灶面具形态，且所有招式威力提高1.2倍。',
    'item:Wellspring Mask': '厄诡椪携带后会变为水井面具形态，且所有招式威力提高1.2倍。',
    'item:Cornerstone Mask': '厄诡椪携带后会变为础石面具形态，且所有招式威力提高1.2倍。',
    'item:Adamant Crystal': '帝牙卢卡携带后会变为起源形态，且龙与钢属性招式威力提高1.2倍。',
    'item:Lustrous Globe': '帕路奇亚携带后会变为起源形态，且龙与水属性招式威力提高1.2倍。',
    'item:Griseous Core': '骑拉帝纳携带后会变为起源形态，且龙与幽灵属性招式威力提高1.2倍。',
    'ability:Protosynthesis': '大晴天或携带驱劲能量时，自身最高的一项能力（除HP外）会提高（速度1.5倍，其余1.3倍）。',
    'ability:Quark Drive': '电气场地或携带驱劲能量时，自身最高的一项能力（除HP外）会提高（速度1.5倍，其余1.3倍）。',
    'ability:Good as Gold': '不会受到对手的变化招式影响。',
    'ability:Supreme Overlord': '出场时，队伍中每有1只已濒死的同伴，自身招式威力提高10%（最高50%）。',
    'ability:Sword of Ruin': '在场时，降低除自身外所有宝可梦25%的防御。',
    'ability:Beads of Ruin': '在场时，降低除自身外所有宝可梦25%的特防。',
    'ability:Tablets of Ruin': '在场时，降低除自身外所有宝可梦25%的攻击。',
    'ability:Vessel of Ruin': '在场时，降低除自身外所有宝可梦25%的特攻。',
    'ability:Orichalcum Pulse': '出场时将天气变为大晴天；大晴天状态下自身的攻击提高约1.33倍。',
    'ability:Hadron Engine': '出场时布下电气场地；电气场地状态下自身的特攻提高约1.33倍。',
    'ability:Armor Tail': '在场时，对手无法对我方宝可梦使出先制招式。',
    'ability:Purifying Salt': '不会陷入异常状态，且受到的幽灵属性招式伤害减半。',
    'ability:Thermal Exchange': '受到火属性招式攻击时攻击提高1级，且不会陷入灼伤状态。',
    'ability:Well-Baked Body': '受到火属性招式攻击时无效化，并使自身防御提高2级。',
    'ability:Earth Eater': '受到地面属性招式攻击时无效化，并回复自身最大HP的1/4。',
    'ability:Wind Rider': '顺风发动或受到风类招式攻击时，不受伤害且自身攻击提高1级。',
    'ability:Sharpness': '切割类招式的威力提高1.5倍。',
    'ability:Toxic Debris': '受到物理招式伤害时，会在对手场地脚下撒下1层毒菱。',
    'ability:Commander': '若我方场上有吃吼霸，会钻进其口中合体并大幅提升吃吼霸全能力。',
    'ability:Zero to Hero': '替换回同行队伍后再次出场时，会变身为全能形态。',
    'ability:Poison Puppeteer': '因自身招式陷入中毒或剧毒状态的对手也会同时陷入混乱。',
    'ability:Tera Shell': 'HP全满时，受到对手的所有属性攻击伤害均变为效果不好（0.5倍）。',
    'move:Tera Blast': '太晶化时变为与太晶属性相同的属性，并按自身攻击和特攻较高的一项计算伤害。',
    'move:Make It Rain': '攻击对手全体，使用后自身特攻降低1级。',
    'move:Kowtow Cleave': '必定命中对手的恶属性物理攻击。',
    'move:Ice Spinner': '攻击对手并消除当前场上的场地状态（如青草/电气/精神/薄雾场地）。',
    'move:Flower Trick': '必定命中且必定击中要害的草属性物理攻击。',
    'move:Torch Song': '攻击对手的同时，必定使自身特攻提高1级。',
    'move:Aqua Step': '攻击对手的同时，必定使自身速度提高1级。',
    'move:Salt Cure': '攻击后让对手每回合损失最大HP的1/8（钢与水属性目标损失1/4）。',
    'move:Rage Fist': '本局对战中自身每受到1次攻击，该招式威力就会永久增加50（最高350）。',
    'move:Last Respects': '同行队伍中每有1只宝可梦曾濒死，该招式威力增加50。',
    'move:Population Bomb': '最多连续攻击10次，每次单独判定命中。',
    'move:Jet Punch': '先制攻击（优先度+1）的水属性物理招式。',
    'move:Wave Crash': '高威力水属性冲撞攻击，自身会承受造成伤害1/3的反作用力。',
    'move:Headlong Rush': '高威力地面属性攻击，使用后自身防御和特防各降低1级。',
    'move:Armor Cannon': '高威力火属性特殊攻击，使用后自身防御和特防各降低1级。',
    'move:Bitter Blade': '火属性切割攻击，回复造成伤害一半的HP。',
    'move:Glaive Rush': '超高威力龙属性攻击，但下一回合行动前对手对自己的攻击必定命中且伤害翻倍。',
    'move:Shed Tail': '削减自身一半HP制造替身，然后立即与后备宝可梦替换。',
    'move:Revival Blessing': '使同行队伍中1只陷入濒死的宝可梦复活并回复一半HP。',
    'move:Mortal Spin': '攻击对手全体并令其中毒，同时清除我方场地的撒菱、隐形岩等障碍与束缚状态。',
    'move:Blood Moon': '高威力一般属性特殊攻击，但无法连续两个回合使用。',
    'move:Ivy Cudgel': '容易击中要害的物理攻击，属性会随厄诡椪携带的面具而改变。',
    'move:Matcha Gotcha': '攻击对手全体，回复造成伤害一半的HP，并有20%几率使目标灼伤。',
    'move:Electro Shot': '第1回合提升特攻并蓄力、第2回合发射电击；下雨天气下无需蓄力直接发射。',
    'move:Thunderclap': '先制电属性特殊攻击（优先度+1），若对手未准备使用攻击招式则会失败。',
    'move:Burning Bulwark': '先制保护自己不受攻击招式伤害，且使直接接触攻击的对手陷入灼伤状态。',
    'move:Tachyon Cutter': '必定命中且连续攻击2次的钢属性特殊招式。',
    'move:Mighty Cleave': '能够无视守住、看穿等防护招式造成伤害的岩石属性物理攻击。',
    'move:Trailblaze': '草属性攻击，命中后必定使自身速度提高1级。',
    'move:Chilling Water': '水属性攻击，命中后必定使对手攻击降低1级。',
}
function ensureCacheLoaded() {
    if (cacheLoaded) return
    cacheLoaded = true
    try {
        localStorage.removeItem(OLD_CACHE_KEY)
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return
        const obj = JSON.parse(raw) as Record<string, string>
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && v) memoryCache.set(k, v)
        }
    } catch {
        return
    }
}
function persistCache() {
    try {
        const entries = Array.from(memoryCache.entries()).filter(([, v]) => Boolean(v)).slice(-800)
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
function pickLocalizedText(entries: PokeApiEntry[], lang: LangCode): string | null {
    const targets = lang === 'zh' ? ['zh-hans', 'zh-hant'] : lang === 'ja' ? ['ja', 'ja-hrkt'] : ['en']
    for (const targetLang of targets) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const item = entries[i]
            const entryLang = (item.language?.name || '').toLowerCase()
            if (entryLang !== targetLang) continue
            const raw = item.flavor_text || item.text || item.short_effect || item.effect || ''
            const cleaned = cleanFlavorText(raw, lang)
            if (cleaned && cleaned !== '—' && cleaned !== '-') return cleaned
        }
    }
    return null
}
function getStaticFallback(kind: DexDetailKind, rawName: string, lang: LangCode): string | null {
    if (lang !== 'zh') return null
    return LOCAL_ZH_FALLBACK[`${kind}:${rawName}`] || null
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
    const key = `${lang}:${kind}:${rawName}`
    const cached = memoryCache.get(key)
    if (cached !== undefined) return cached
    const fallback = getStaticFallback(kind, rawName, lang)
    if (fallback) return fallback
    return undefined
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
    const staticHit = getStaticFallback(kind, rawName, lang)
    if (staticHit) return staticHit
    const pending = inflight.get(key)
    if (pending) return pending
    const slug = toPokeApiSlug(rawName)
    if (!slug) return null
    const task = (async () => {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/${kind}/${encodeURIComponent(slug)}`)
            if (!res.ok) return null
            const data = (await res.json()) as {
                flavor_text_entries?: PokeApiEntry[]
                effect_entries?: PokeApiEntry[]
            }
            const fromFlavor = Array.isArray(data.flavor_text_entries)
                ? pickLocalizedText(data.flavor_text_entries, lang)
                : null
            const fromEffect =
                !fromFlavor && Array.isArray(data.effect_entries)
                    ? pickLocalizedText(data.effect_entries, lang)
                    : null
            const found = fromFlavor || fromEffect
            if (found) {
                memoryCache.set(key, found)
                persistCache()
            }
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