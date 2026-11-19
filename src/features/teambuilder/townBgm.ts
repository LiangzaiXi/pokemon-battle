export type BgmPlayMode = 'loop' | 'sequence' | 'shuffle'
export interface ArchiveAlbum {
    id: string
    zh: string
    en: string
    ja: string
}
export interface OnlineTownTrack {
    id: string
    albumId: string
    rawTitle: string
    url: string
    isTownOrCenter: boolean
    isCenter: boolean
}
export interface CustomTownBgm {
    id: string
    name: string
    addedAt: number
}
export const ARCHIVE_ALBUMS: ArchiveAlbum[] = [
    { id: 'pkmn-dppt-soundtrack', zh: '珍钻白金 (神奥)', en: 'Diamond / Pearl / Platinum', ja: 'ダイヤモンド・パール・プラチナ' },
    { id: 'pkmn-hgss-soundtrack', zh: '心金魂银 (城都/关都)', en: 'HeartGold / SoulSilver', ja: 'ハートゴールド・ソウルシルバー' },
    { id: 'pkmn-black-white-soundtrack', zh: '黑 / 白 (合众)', en: 'Black / White', ja: 'ブラック・ホワイト' },
    { id: 'pkmn-bw2-soundtrack', zh: '黑2 / 白2 (合众)', en: 'Black 2 / White 2', ja: 'ブラック2・ホワイト2' },
    { id: 'pkmn-xy-soundtrack', zh: 'X / Y (卡洛斯)', en: 'X / Y', ja: 'X・Y' },
    { id: 'pkmn-oras-ost', zh: '终极红宝石 / 始源蓝宝石', en: 'Omega Ruby / Alpha Sapphire', ja: 'オメガルビー・アルファサファイア' },
    { id: 'pkmn-sun-moon-ost', zh: '太阳 / 月亮 (阿罗拉)', en: 'Sun / Moon', ja: 'サン・ムーン' },
    { id: 'pkmn-frlg-soundtrack', zh: '火红 / 叶绿 (关都)', en: 'FireRed / LeafGreen', ja: 'ファイアレッド・リーフグリーン' },
    { id: 'pkmn-rse-soundtrack', zh: '红蓝绿宝石 (丰缘)', en: 'Ruby / Sapphire / Emerald', ja: 'ルビー・サファイア・エメラルド' },
    { id: 'pkmn-gsc-soundtrack', zh: '金银水晶 (城都)', en: 'Gold / Silver / Crystal', ja: '金・銀・クリスタル' },
    { id: 'pkmn-rgby-soundtrack', zh: '红绿蓝黄 (关都)', en: 'Red / Green / Blue / Yellow', ja: '赤・緑・青・ピカチュウ' },
]
const TOWN_POSITIVE_RE = /(pok[eé]mon center|pok[eé] center|center|centre|town|city|village|island|port|resort|harbor|harbour|bridge|park|square|garden|plaza|mall|mart|festival|avenue|route|road|forest|lake|grove|meadow|woods|beach|bay|cape|ranch|farm|oasis|school|academy|lab|laboratory|home|house|villa|cafe|salon|boutique|museum|theater|theatre|arcade|corner|club|lounge|lobby|hall|gate|station|pier|dock|canal|valley|path|trail|marsh|glacier|snow|frontier|tower|shrine|sanctuary|day|night)/i
const TOWN_EXCLUDE_RE = /(battle|vs\.|versus|encounter|victory|caught|fanfare|healed|healing|recovery|evolution|evolved|level up|badge|obtained|got an|got a |jingle|captured|defeated|eyes meet|trainer appears|wild |gym leader|elite four|champion|rival|team rocket|team aqua|team magma|team galactic|team plasma|team flare|team skull|aether|legendary|ultra beast|tapu|title screen|opening|ending|credits|staff roll|hall of fame|intro|demo|sound effect|se )/i
const CENTER_RE = /(pok[eé]mon\s*center|pok[eé]\s*center)/i
const ZH_PLACE_MAP: [RegExp, string][] = [
    [/Pok[eé]mon Center/gi, '宝可梦中心'],
    [/Pok[eé] Mart/gi, '友好商店'],
    [/Pallet Town/gi, '真新镇'],
    [/Viridian City/gi, '常磐市'],
    [/Pewter City/gi, '深灰市'],
    [/Cerulean City/gi, '华蓝市'],
    [/Vermilion City/gi, '枯叶市'],
    [/Lavender Town/gi, '紫苑镇'],
    [/Celadon City/gi, '玉虹市'],
    [/Fuchsia City/gi, '浅红市'],
    [/Saffron City/gi, '金黄市'],
    [/Cinnabar Island/gi, '红莲镇'],
    [/New Bark Town/gi, '若叶镇'],
    [/Cherrygrove City/gi, '吉花市'],
    [/Violet City/gi, '桔梗市'],
    [/Azalea Town/gi, '桧皮镇'],
    [/Goldenrod City/gi, '满金市'],
    [/Ecruteak City/gi, '缘朱市'],
    [/Olivine City/gi, '浅葱市'],
    [/Cianwood City/gi, '湛蓝市'],
    [/Mahogany Town/gi, '卡吉镇'],
    [/Blackthorn City/gi, '烟墨市'],
    [/National Park/gi, '自然公园'],
    [/Littleroot Town/gi, '未白镇'],
    [/Oldale Town/gi, '古玫镇'],
    [/Petalburg City/gi, '橙华市'],
    [/Rustboro City/gi, '卡那兹市'],
    [/Dewford Town/gi, '武斗镇'],
    [/Slateport City/gi, '凯那市'],
    [/Mauville City/gi, '紫堇市'],
    [/Verdanturf Town/gi, '绿荫镇'],
    [/Fallarbor Town/gi, '秋叶镇'],
    [/Lavaridge Town/gi, '釜炎镇'],
    [/Fortree City/gi, '茵郁市'],
    [/Lilycove City/gi, '水静市'],
    [/Mossdeep City/gi, '绿岭市'],
    [/Sootopolis City/gi, '琉璃市'],
    [/Pacifidlog Town/gi, '暮水镇'],
    [/Ever Grande City/gi, '彩幽市'],
    [/Twinleaf Town/gi, '双叶镇'],
    [/Sandgem Town/gi, '真砂镇'],
    [/Jubilife City/gi, '祝庆市'],
    [/Oreburgh City/gi, '黑金市'],
    [/Floaroma Town/gi, '苑之镇'],
    [/Eterna City/gi, '百代市'],
    [/Hearthome City/gi, '家缘市'],
    [/Solaceon Town/gi, '随意镇'],
    [/Veilstone City/gi, '帷幕市'],
    [/Pastoria City/gi, '湿原市'],
    [/Celestic Town/gi, '神和镇'],
    [/Canalave City/gi, '水脉市'],
    [/Snowpoint City/gi, '切锋市'],
    [/Sunyshore City/gi, '滨海市'],
    [/Pokémon League/gi, '宝可梦联盟'],
    [/Nuvema Town/gi, '鹿子镇'],
    [/Accumula Town/gi, '唐草镇'],
    [/Striaton City/gi, '三曜市'],
    [/Nacrene City/gi, '七宝市'],
    [/Castelia City/gi, '飞云市'],
    [/Nimbasa City/gi, '雷文市'],
    [/Driftveil City/gi, '帆巴市'],
    [/Mistralton City/gi, '吹寄市'],
    [/Icirrus City/gi, '雪花市'],
    [/Opelucid City/gi, '双龙市'],
    [/Undella Town/gi, '涟漪镇'],
    [/Lacunosa Town/gi, '笼目镇'],
    [/Black City/gi, '黑色城市'],
    [/White Forest/gi, '白色森林'],
    [/Village Bridge/gi, '村庄桥'],
    [/Aspertia City/gi, '桧扇市'],
    [/Floccesy Town/gi, '算木镇'],
    [/Virbank City/gi, '立涌市'],
    [/Humilau City/gi, '青海波市'],
    [/Vaniville Town/gi, '朝香镇'],
    [/Aquacorde Town/gi, '美川镇'],
    [/Santalune City/gi, '白檀市'],
    [/Lumiose City/gi, '密阿雷市'],
    [/Camphrier Town/gi, '古香镇'],
    [/Cyllage City/gi, '遥香市'],
    [/Ambrette Town/gi, '古辉镇'],
    [/Geosenge Town/gi, '石林镇'],
    [/Shalour City/gi, '娑罗市'],
    [/Coumarine City/gi, '海翼市'],
    [/Laverre City/gi, '香薰市'],
    [/Dendemille Town/gi, '连理镇'],
    [/Anistar City/gi, '百刻市'],
    [/Couriway Town/gi, '水涟镇'],
    [/Snowbelle City/gi, '映雪市'],
    [/Kiloude City/gi, '奇楠市'],
    [/Iki Town/gi, '利利小镇'],
    [/Hau'oli City/gi, '好奥乐市'],
    [/Heahea City/gi, '慷待市'],
    [/Paniola Town/gi, '欧哈纳镇'],
    [/Konikoni City/gi, '可霓可市'],
    [/Malie City/gi, '马利埃静市'],
    [/Seafolk Village/gi, '海洋居民之村'],
    [/Festival Plaza/gi, '圆庆广场'],
    [/\(Day\)/gi, '（昼）'],
    [/\(Night\)/gi, '（夜）'],
    [/\bDay\b/g, '昼'],
    [/\bNight\b/g, '夜'],
    [/\bRoute\s+(\d+)/gi, '道路 $1'],
]
const DB_NAME = 'pokemon_town_bgm_db'
const STORE_META = 'meta'
const STORE_BLOBS = 'blobs'
const AUDIO_EXT_RE = /\.(mp3|ogg|wav|m4a|flac|aac|webm)$/i
const albumTrackCache = new Map<string, OnlineTownTrack[]>()
let townAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let playToken = 0
interface ArchiveFileItem {
    name?: string
    title?: string
    length?: string | number
}
function parseLengthSec(raw: unknown): number {
    if (typeof raw === 'number') return raw
    if (typeof raw !== 'string') return 0
    if (raw.includes(':')) {
        const parts = raw.split(':').map(Number)
        if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
            return parts[0] * 60 + parts[1]
        }
    }
    const n = Number(raw)
    return Number.isNaN(n) ? 0 : n
}
function cleanFileNameToTitle(fileName: string): string {
    const base = fileName.split('/').pop() || fileName
    return base
        .replace(AUDIO_EXT_RE, '')
        .replace(/^\d+[\s._-]+(?:\d+[\s._-]+)?/, '')
        .replace(/_/g, ' ')
        .trim()
}
export function localizeTrackTitle(rawTitle: string, lang: 'zh' | 'en' | 'ja'): string {
    if (lang !== 'zh') return rawTitle
    let out = rawTitle
    for (const [re, rep] of ZH_PLACE_MAP) {
        out = out.replace(re, rep)
    }
    return out
}
export async function fetchArchiveTracks(albumId: string): Promise<OnlineTownTrack[]> {
    const cached = albumTrackCache.get(albumId)
    if (cached) return cached
    const sessionKey = `archive_bgm_v1_${albumId}`
    try {
        const rawCached = sessionStorage.getItem(sessionKey)
        if (rawCached) {
            const parsed = JSON.parse(rawCached) as OnlineTownTrack[]
            if (Array.isArray(parsed) && parsed.length > 0) {
                albumTrackCache.set(albumId, parsed)
                return parsed
            }
        }
    } catch {
        sessionStorage.removeItem(sessionKey)
    }
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(albumId)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { files?: ArchiveFileItem[] }
    const files = Array.isArray(data.files) ? data.files : []
    const mp3Files = files.filter((f) => typeof f.name === 'string' && /\.mp3$/i.test(f.name) && !/_64kb\.mp3$/i.test(f.name))
    const chosenFiles =
        mp3Files.length > 0
            ? mp3Files
            : files.filter((f) => typeof f.name === 'string' && /\.(ogg|flac)$/i.test(f.name))
    const seenTitles = new Set<string>()
    const tracks: OnlineTownTrack[] = []
    for (const f of chosenFiles) {
        const fileName = f.name || ''
        if (!fileName) continue
        const sec = parseLengthSec(f.length)
        if (sec > 0 && sec < 22) continue
        const rawTitle = (typeof f.title === 'string' && f.title.trim()) || cleanFileNameToTitle(fileName)
        if (!rawTitle) continue
        const dedupKey = rawTitle.toLowerCase()
        if (seenTitles.has(dedupKey)) continue
        seenTitles.add(dedupKey)
        const encodedPath = fileName.split('/').map((seg) => encodeURIComponent(seg)).join('/')
        const isCenter = CENTER_RE.test(rawTitle) && !TOWN_EXCLUDE_RE.test(rawTitle)
        const isTownOrCenter = isCenter || (TOWN_POSITIVE_RE.test(rawTitle) && !TOWN_EXCLUDE_RE.test(rawTitle))
        tracks.push({
            id: `archive:${albumId}:${fileName}`,
            albumId,
            rawTitle,
            url: `https://archive.org/download/${encodeURIComponent(albumId)}/${encodedPath}`,
            isTownOrCenter,
            isCenter,
        })
    }
    tracks.sort((a, b) => {
        if (a.isCenter !== b.isCenter) return a.isCenter ? -1 : 1
        return 0
    })
    albumTrackCache.set(albumId, tracks)
    try {
        sessionStorage.setItem(sessionKey, JSON.stringify(tracks))
    } catch {
        return tracks
    }
    return tracks
}
function openBgmDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' })
            if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}
export async function listCustomTownBgms(): Promise<CustomTownBgm[]> {
    try {
        const db = await openBgmDb()
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_META, 'readonly')
            const req = tx.objectStore(STORE_META).getAll()
            req.onsuccess = () => {
                const rows = (req.result as CustomTownBgm[]).sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true })
                )
                resolve(rows)
            }
            req.onerror = () => reject(req.error)
        })
    } catch {
        return []
    }
}
export async function importCustomTownBgms(files: FileList | File[]): Promise<CustomTownBgm[]> {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('audio/') || AUDIO_EXT_RE.test(f.name))
    if (validFiles.length === 0) return []
    const db = await openBgmDb()
    const created: CustomTownBgm[] = []
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
        const metaStore = tx.objectStore(STORE_META)
        const blobStore = tx.objectStore(STORE_BLOBS)
        const now = Date.now()
        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i]
            const cleanName = file.name.replace(AUDIO_EXT_RE, '').trim() || file.name
            const id = `custom:${now}-${i}-${Math.random().toString(36).slice(2, 7)}`
            const meta: CustomTownBgm = { id, name: cleanName, addedAt: now + i }
            metaStore.put(meta)
            blobStore.put({ id, blob: file })
            created.push(meta)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
    return created
}
export async function getCustomTownBgmBlob(id: string): Promise<Blob | null> {
    try {
        const db = await openBgmDb()
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_BLOBS, 'readonly')
            const req = tx.objectStore(STORE_BLOBS).get(id)
            req.onsuccess = () => resolve((req.result as { id: string; blob: Blob } | undefined)?.blob || null)
            req.onerror = () => reject(req.error)
        })
    } catch {
        return null
    }
}
export async function removeCustomTownBgm(id: string): Promise<void> {
    const db = await openBgmDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
        tx.objectStore(STORE_META).delete(id)
        tx.objectStore(STORE_BLOBS).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}
export async function clearCustomTownBgms(): Promise<void> {
    const db = await openBgmDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
        tx.objectStore(STORE_META).clear()
        tx.objectStore(STORE_BLOBS).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}
export function stopTownAudio() {
    playToken += 1
    if (townAudio) {
        townAudio.onended = null
        townAudio.onerror = null
        townAudio.pause()
        townAudio.src = ''
        townAudio = null
    }
    if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl)
        activeObjectUrl = null
    }
}
export async function playTownSource(
    source: { type: 'url'; url: string } | { type: 'custom'; id: string },
    options: {
        volume: number
        muted: boolean
        loop: boolean
        onEnded: () => void
        onError: () => void
    }
): Promise<boolean> {
    stopTownAudio()
    const myToken = playToken
    let src = ''
    if (source.type === 'custom') {
        const blob = await getCustomTownBgmBlob(source.id)
        if (myToken !== playToken) return false
        if (!blob) {
            options.onError()
            return false
        }
        activeObjectUrl = URL.createObjectURL(blob)
        src = activeObjectUrl
    } else {
        src = source.url
    }
    const audio = new Audio(src)
    audio.loop = options.loop
    audio.volume = options.muted ? 0 : options.volume
    audio.onended = () => {
        if (myToken === playToken) options.onEnded()
    }
    audio.onerror = () => {
        if (myToken === playToken) options.onError()
    }
    townAudio = audio
    try {
        await audio.play()
        return myToken === playToken
    } catch {
        return false
    }
}
export function pauseTownAudio() {
    townAudio?.pause()
}
export async function resumeTownAudio(): Promise<boolean> {
    if (!townAudio) return false
    try {
        await townAudio.play()
        return true
    } catch {
        return false
    }
}
export function setTownAudioVolume(volume: number, muted: boolean) {
    if (!townAudio) return
    townAudio.volume = muted ? 0 : volume
}
export function setTownAudioLoop(loop: boolean) {
    if (!townAudio) return
    townAudio.loop = loop
}