import rawData from './pokemonData.json'
export type LangCode = 'zh' | 'en' | 'ja'
interface Entry {
    en: string
    zh: string
    ja: string
}
interface DexI18nData {
    speciesByNum: Record<string, Entry>
    species: Record<string, Entry>
    moves: Record<string, Entry>
    items: Record<string, Entry>
    abilities: Record<string, Entry>
    natures: Record<string, Entry>
    types: Record<string, Entry>
}
const data = rawData as DexI18nData
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const FORM_LABELS: Record<string, Entry> = {
    alola: { en: 'Alola', zh: '阿罗拉', ja: 'アローラ' },
    galar: { en: 'Galar', zh: '伽勒尔', ja: 'ガラル' },
    hisui: { en: 'Hisui', zh: '洗翠', ja: 'ヒスイ' },
    paldea: { en: 'Paldea', zh: '帕底亚', ja: 'パルデア' },
    mega: { en: 'Mega', zh: '超级', ja: 'メガ' },
    megax: { en: 'Mega X', zh: '超级X', ja: 'メガX' },
    megay: { en: 'Mega Y', zh: '超级Y', ja: 'メガY' },
    gmax: { en: 'G-Max', zh: '超极巨化', ja: 'キョダイマックス' },
    therian: { en: 'Therian', zh: '灵兽', ja: 'れいじゅう' },
    origin: { en: 'Origin', zh: '起源', ja: 'オリジン' },
    wash: { en: 'Wash', zh: '清洗', ja: 'ウォッシュ' },
    heat: { en: 'Heat', zh: '加热', ja: 'ヒート' },
    mow: { en: 'Mow', zh: '切割', ja: 'カット' },
    frost: { en: 'Frost', zh: '结冰', ja: 'フロスト' },
    fan: { en: 'Fan', zh: '旋转', ja: 'スピン' },
    rapidstrike: { en: 'Rapid-Strike', zh: '连击流', ja: 'れんげき' },
    crowned: { en: 'Crowned', zh: '剑/盾之王', ja: 'おう' },
    ice: { en: 'Ice Rider', zh: '骑白马', ja: 'はくば' },
    shadow: { en: 'Shadow Rider', zh: '骑黑马', ja: 'こくば' },
    wellspring: { en: 'Wellspring', zh: '水井面具', ja: 'いどのめん' },
    hearthflame: { en: 'Hearthflame', zh: '火灶面具', ja: 'かまどのめん' },
    cornerstone: { en: 'Cornerstone', zh: '础石面具', ja: 'いしずえのめん' },
    bloodmoon: { en: 'Bloodmoon', zh: '赫月', ja: 'アカツキ' },
    dusk: { en: 'Dusk', zh: '黄昏', ja: 'たそがれ' },
    midnight: { en: 'Midnight', zh: '黑夜', ja: 'まよなか' },
    attack: { en: 'Attack', zh: '攻击', ja: 'アタック' },
    defense: { en: 'Defense', zh: '防御', ja: 'ディフェンス' },
    speed: { en: 'Speed', zh: '速度', ja: 'スピード' },
    f: { en: 'Female', zh: '雌性', ja: 'メス' },
}
const CATEGORY_LABELS: Record<string, Entry> = {
    Physical: { en: 'Phys', zh: '物理', ja: '物理' },
    Special: { en: 'Spec', zh: '特殊', ja: '特殊' },
    Status: { en: 'Stat', zh: '变化', ja: '変化' },
}
export function normalizeLang(lang?: string): LangCode {
    if (!lang) return 'en'
    if (lang.startsWith('zh')) return 'zh'
    if (lang.startsWith('ja')) return 'ja'
    return 'en'
}
function lookup(dict: Record<string, Entry>, name: string): Entry {
    const found = dict[toId(name)]
    return found || { en: name, zh: name, ja: name }
}
export function getSpeciesEntry(speciesName: string, num: number, forme?: string): Entry {
    const direct = data.species[toId(speciesName)]
    if (direct) return direct
    const base = data.speciesByNum[String(num)]
    if (!base) return { en: speciesName, zh: speciesName, ja: speciesName }
    if (!forme) return base
    const suffix = FORM_LABELS[toId(forme)]
    return {
        en: speciesName,
        zh: `${base.zh}-${suffix ? suffix.zh : forme}`,
        ja: `${base.ja}(${suffix ? suffix.ja : forme})`,
    }
}
export function getMoveEntry(name: string): Entry {
    return lookup(data.moves, name)
}
export function getItemEntry(name: string): Entry {
    return lookup(data.items, name)
}
export function getAbilityEntry(name: string): Entry {
    return lookup(data.abilities, name)
}
export function getNatureEntry(name: string): Entry {
    return lookup(data.natures, name)
}
export function getTypeEntry(name: string): Entry {
    return lookup(data.types, name)
}
export function getCategoryLabel(category: string, lang: LangCode): string {
    return CATEGORY_LABELS[category]?.[lang] || category
}
export function buildSearchText(entry: Entry, extra = ''): string {
    return `${entry.zh} ${entry.ja} ${entry.en} ${extra}`.toLowerCase()
}