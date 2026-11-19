import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LangCode } from '../../i18n/dexI18n'
import {
    ARCHIVE_ALBUMS,
    clearCustomTownBgms,
    fetchArchiveTracks,
    importCustomTownBgms,
    listCustomTownBgms,
    localizeTrackTitle,
    pauseTownAudio,
    playTownSource,
    removeCustomTownBgm,
    resumeTownAudio,
    setTownAudioLoop,
    setTownAudioVolume,
    stopTownAudio,
    type BgmPlayMode,
    type CustomTownBgm,
    type OnlineTownTrack,
} from './townBgm'
const STORAGE_KEY = 'pokemon_town_bgm_online_v3'
interface SavedPrefs {
    albumId: string
    trackId: string
    townOnly: boolean
    volume: number
    muted: boolean
    mode: BgmPlayMode
    autoPlay: boolean
}
interface PlayableItem {
    id: string
    label: string
    url?: string
    isCustom?: boolean
}
function loadPrefs(): SavedPrefs {
    const fallback: SavedPrefs = {
        albumId: ARCHIVE_ALBUMS[0].id,
        trackId: '',
        townOnly: true,
        volume: 0.35,
        muted: false,
        mode: 'loop',
        autoPlay: true,
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return fallback
        const p = JSON.parse(raw) as Partial<SavedPrefs>
        return {
            albumId: typeof p.albumId === 'string' && p.albumId ? p.albumId : fallback.albumId,
            trackId: typeof p.trackId === 'string' ? p.trackId : '',
            townOnly: typeof p.townOnly === 'boolean' ? p.townOnly : true,
            volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.35,
            muted: Boolean(p.muted),
            mode: p.mode === 'sequence' || p.mode === 'shuffle' ? p.mode : 'loop',
            autoPlay: typeof p.autoPlay === 'boolean' ? p.autoPlay : true,
        }
    } catch {
        return fallback
    }
}
export default function TownBgmBar({ lang }: { lang: LangCode }) {
    const initial = useMemo(() => loadPrefs(), [])
    const [albumId, setAlbumId] = useState<string>(initial.albumId)
    const [townOnly, setTownOnly] = useState<boolean>(initial.townOnly)
    const [onlineTracks, setOnlineTracks] = useState<OnlineTownTrack[]>([])
    const [customTracks, setCustomTracks] = useState<CustomTownBgm[]>([])
    const [trackId, setTrackId] = useState<string>(initial.trackId)
    const [loadingAlbum, setLoadingAlbum] = useState<boolean>(false)
    const [volume, setVolume] = useState<number>(initial.volume)
    const [muted, setMuted] = useState<boolean>(initial.muted)
    const [playMode, setPlayMode] = useState<BgmPlayMode>(initial.mode)
    const [wantPlay, setWantPlay] = useState<boolean>(initial.autoPlay)
    const [isPlaying, setIsPlaying] = useState<boolean>(false)
    const [statusMsg, setStatusMsg] = useState<string>('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const playModeRef = useRef<BgmPlayMode>(playMode)
    const volumeRef = useRef<number>(volume)
    const mutedRef = useRef<boolean>(muted)
    const wantPlayRef = useRef<boolean>(wantPlay)
    const isPlayingRef = useRef<boolean>(isPlaying)
    const itemsRef = useRef<PlayableItem[]>([])
    const trackIdRef = useRef<string>(trackId)
    const mountedRef = useRef<boolean>(true)
    const playableItems = useMemo<PlayableItem[]>(() => {
        if (albumId === '__custom__') {
            return customTracks.map((c) => ({ id: c.id, label: `♪ ${c.name}`, isCustom: true }))
        }
        const filtered = townOnly ? onlineTracks.filter((t) => t.isTownOrCenter) : onlineTracks
        const list = filtered.length > 0 ? filtered : onlineTracks
        return list.map((t) => ({
            id: t.id,
            label: `${t.isCenter ? '🏥 ' : '🏙️ '}${localizeTrackTitle(t.rawTitle, lang)}`,
            url: t.url,
        }))
    }, [albumId, customTracks, onlineTracks, townOnly, lang])
    useEffect(() => {
        itemsRef.current = playableItems
    }, [playableItems])
    useEffect(() => {
        playModeRef.current = playMode
        setTownAudioLoop(playMode === 'loop')
    }, [playMode])
    useEffect(() => {
        volumeRef.current = volume
        mutedRef.current = muted
        setTownAudioVolume(volume, muted)
    }, [volume, muted])
    useEffect(() => {
        wantPlayRef.current = wantPlay
    }, [wantPlay])
    useEffect(() => {
        isPlayingRef.current = isPlaying
    }, [isPlaying])
    useEffect(() => {
        trackIdRef.current = trackId
    }, [trackId])
    useEffect(() => {
        try {
            const next: SavedPrefs = {
                albumId,
                trackId,
                townOnly,
                volume,
                muted,
                mode: playMode,
                autoPlay: wantPlay,
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
            return
        }
    }, [albumId, trackId, townOnly, volume, muted, playMode, wantPlay])
    const playItem = useCallback(
        async (item: PlayableItem) => {
            setTrackId(item.id)
            setStatusMsg('')
            const source = item.isCustom ? ({ type: 'custom', id: item.id } as const) : ({ type: 'url', url: item.url || '' } as const)
            const ok = await playTownSource(source, {
                volume: volumeRef.current,
                muted: mutedRef.current,
                loop: playModeRef.current === 'loop',
                onEnded: () => {
                    if (!mountedRef.current || playModeRef.current === 'loop') return
                    const list = itemsRef.current
                    if (list.length === 0) return
                    const idx = list.findIndex((x) => x.id === trackIdRef.current)
                    const nextIdx =
                        playModeRef.current === 'shuffle' && list.length > 1
                            ? (Math.max(0, idx) + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
                            : (Math.max(0, idx) + 1) % list.length
                    void playItem(list[nextIdx])
                },
                onError: () => {
                    if (!mountedRef.current) return
                    setIsPlaying(false)
                    setStatusMsg(
                        lang === 'zh'
                            ? '音频加载失败（可能网络波动或曲目暂不可用），可点 ⏭ 切下一首或导入本地音频。'
                            : 'Failed to load this track. Try skipping to the next track.'
                    )
                },
            })
            if (mountedRef.current) {
                setIsPlaying(ok)
            }
        },
        [lang]
    )
    useEffect(() => {
        mountedRef.current = true
        void listCustomTownBgms().then((rows) => {
            if (!mountedRef.current) return
            setCustomTracks(rows)
            if (albumId === '__custom__' && rows.length > 0 && wantPlayRef.current) {
                const target = rows.find((r) => r.id === trackIdRef.current) || rows[0]
                void playItem({ id: target.id, label: target.name, isCustom: true })
            }
        })
        return () => {
            mountedRef.current = false
            stopTownAudio()
        }
    }, [])
    useEffect(() => {
        if (albumId === '__custom__') {
            setLoadingAlbum(false)
            return
        }
        let cancelled = false
        setLoadingAlbum(true)
        setStatusMsg('')
        void fetchArchiveTracks(albumId)
            .then((tracks) => {
                if (cancelled || !mountedRef.current) return
                setOnlineTracks(tracks)
                setLoadingAlbum(false)
                const pool = townOnly ? tracks.filter((t) => t.isTownOrCenter) : tracks
                const finalPool = pool.length > 0 ? pool : tracks
                const existing = finalPool.find((t) => t.id === trackIdRef.current)
                const target = existing || finalPool[0]
                if (target) {
                    setTrackId(target.id)
                    if (wantPlayRef.current) {
                        void playItem({
                            id: target.id,
                            label: localizeTrackTitle(target.rawTitle, lang),
                            url: target.url,
                        })
                    }
                }
            })
            .catch(() => {
                if (cancelled || !mountedRef.current) return
                setOnlineTracks([])
                setLoadingAlbum(false)
                setStatusMsg(
                    lang === 'zh'
                        ? '无法连接 archive.org 在线曲库，请检查网络或使用右侧「导入本地」播放。'
                        : 'Unable to reach archive.org track list. Check network or import local audio.'
                )
            })
        return () => {
            cancelled = true
        }
    }, [albumId])
    useEffect(() => {
        if (!wantPlay || isPlaying || loadingAlbum || statusMsg) return
        const onInteract = (e: Event) => {
            if (!wantPlayRef.current || isPlayingRef.current) return
            const target = e.target as HTMLElement | null
            if (target?.closest('[data-bgm-toggle]')) return
            void resumeTownAudio().then((ok) => {
                if (ok && mountedRef.current) {
                    setIsPlaying(true)
                } else {
                    const current = itemsRef.current.find((x) => x.id === trackIdRef.current) || itemsRef.current[0]
                    if (current) void playItem(current)
                }
            })
        }
        window.addEventListener('pointerdown', onInteract)
        window.addEventListener('keydown', onInteract)
        return () => {
            window.removeEventListener('pointerdown', onInteract)
            window.removeEventListener('keydown', onInteract)
        }
    }, [wantPlay, isPlaying, loadingAlbum, statusMsg, playItem])
    const handleTogglePlay = async () => {
        if (isPlaying) {
            setWantPlay(false)
            pauseTownAudio()
            setIsPlaying(false)
            return
        }
        setWantPlay(true)
        const resumed = await resumeTownAudio()
        if (resumed) {
            setIsPlaying(true)
            return
        }
        const current = playableItems.find((x) => x.id === trackId) || playableItems[0]
        if (current) {
            await playItem(current)
        }
    }
    const handleStep = (delta: number) => {
        if (playableItems.length === 0) return
        setWantPlay(true)
        const curIdx = playableItems.findIndex((x) => x.id === trackId)
        const baseIdx = curIdx >= 0 ? curIdx : 0
        const nextIdx =
            playMode === 'shuffle' && playableItems.length > 1
                ? (baseIdx + 1 + Math.floor(Math.random() * (playableItems.length - 1))) % playableItems.length
                : (baseIdx + delta + playableItems.length) % playableItems.length
        void playItem(playableItems[nextIdx])
    }
    const handleSelectAlbum = (nextAlbum: string) => {
        setAlbumId(nextAlbum)
        if (nextAlbum === '__custom__' && customTracks.length > 0 && wantPlayRef.current) {
            void playItem({ id: customTracks[0].id, label: customTracks[0].name, isCustom: true })
        }
    }
    const handleSelectTrack = (nextId: string) => {
        setWantPlay(true)
        const found = playableItems.find((x) => x.id === nextId)
        if (found) void playItem(found)
    }
    const handleCycleMode = () => {
        setPlayMode((prev) => (prev === 'loop' ? 'sequence' : prev === 'sequence' ? 'shuffle' : 'loop'))
    }
    const handleImportFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        const added = await importCustomTownBgms(files)
        if (added.length === 0) return
        const latest = await listCustomTownBgms()
        setCustomTracks(latest)
        setAlbumId('__custom__')
        setWantPlay(true)
        setStatusMsg(lang === 'zh' ? `已导入 ${added.length} 首本地曲目` : `Imported ${added.length} local tracks`)
        void playItem({ id: added[0].id, label: added[0].name, isCustom: true })
    }
    const handleRemoveCurrentCustom = async () => {
        if (albumId !== '__custom__' || !trackId.startsWith('custom:')) return
        await removeCustomTownBgm(trackId)
        const latest = await listCustomTownBgms()
        setCustomTracks(latest)
        stopTownAudio()
        setIsPlaying(false)
        if (latest.length > 0) {
            setTrackId(latest[0].id)
        } else {
            setAlbumId(ARCHIVE_ALBUMS[0].id)
        }
    }
    const handleClearCustom = async () => {
        await clearCustomTownBgms()
        setCustomTracks([])
        if (albumId === '__custom__') {
            stopTownAudio()
            setIsPlaying(false)
            setAlbumId(ARCHIVE_ALBUMS[0].id)
        }
    }
    const modeLabel =
        playMode === 'loop'
            ? lang === 'zh' ? '🔂 单曲' : lang === 'ja' ? '🔂 1曲' : '🔂 Loop'
            : playMode === 'sequence'
                ? lang === 'zh' ? '🔁 顺序' : lang === 'ja' ? '🔁 順番' : '🔁 List'
                : lang === 'zh' ? '🔀 随机' : lang === 'ja' ? '🔀 シャッフル' : '🔀 Shuffle'
    return (
        <div className="bg-slate-950/75 border border-slate-700/80 rounded-xl px-3 py-2 space-y-1.5 shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className={`text-sm ${isPlaying ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`}>🎵</span>
                    <select
                        value={albumId}
                        onChange={(e) => handleSelectAlbum(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-200 max-w-[180px]"
                    >
                        {ARCHIVE_ALBUMS.map((al) => (
                            <option key={al.id} value={al.id}>
                                💿 {al[lang]}
                            </option>
                        ))}
                        {customTracks.length > 0 && (
                            <option value="__custom__">
                                📁 {lang === 'zh' ? `本地导入 (${customTracks.length})` : `Local (${customTracks.length})`}
                            </option>
                        )}
                    </select>
                    <button
                        type="button"
                        disabled={loadingAlbum || playableItems.length === 0}
                        onClick={() => handleStep(-1)}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 cursor-pointer"
                    >
                        ⏮
                    </button>
                    <button
                        type="button"
                        data-bgm-toggle="1"
                        disabled={loadingAlbum || playableItems.length === 0}
                        onClick={() => void handleTogglePlay()}
                        className={`border rounded-md px-2.5 py-1 text-xs font-bold disabled:opacity-40 cursor-pointer transition ${isPlaying
                                ? 'bg-emerald-600/80 hover:bg-emerald-500 border-emerald-400 text-white'
                                : 'bg-red-600/85 hover:bg-red-500 border-red-400 text-white'
                            }`}
                    >
                        {loadingAlbum ? '⏳' : isPlaying ? '⏸' : '▶'}
                    </button>
                    <button
                        type="button"
                        disabled={loadingAlbum || playableItems.length === 0}
                        onClick={() => handleStep(1)}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 cursor-pointer"
                    >
                        ⏭
                    </button>
                    <select
                        disabled={loadingAlbum || playableItems.length === 0}
                        value={playableItems.some((x) => x.id === trackId) ? trackId : playableItems[0]?.id || ''}
                        onChange={(e) => handleSelectTrack(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-amber-200 max-w-[230px] sm:max-w-[300px] disabled:opacity-50"
                    >
                        {loadingAlbum ? (
                            <option value="">{lang === 'zh' ? '正在在线加载该世代曲目…' : 'Loading soundtrack...'}</option>
                        ) : playableItems.length === 0 ? (
                            <option value="">{lang === 'zh' ? '暂无可用曲目' : 'No tracks'}</option>
                        ) : (
                            playableItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.label}
                                </option>
                            ))
                        )}
                    </select>
                    {albumId !== '__custom__' && (
                        <button
                            type="button"
                            onClick={() => setTownOnly((v) => !v)}
                            className={`border rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer transition ${townOnly
                                    ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                                    : 'bg-slate-800 border-slate-600 text-slate-300'
                                }`}
                        >
                            {townOnly
                                ? lang === 'zh' ? '🏙️ 仅城市/中心' : lang === 'ja' ? '🏙️ 街・センター' : '🏙️ Towns & Centers'
                                : lang === 'zh' ? '💿 该代全曲' : lang === 'ja' ? '💿 全曲' : '💿 Full OST'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleCycleMode}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-[11px] font-semibold text-cyan-200 cursor-pointer"
                    >
                        {modeLabel}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setMuted((m) => !m)}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs cursor-pointer"
                    >
                        {muted || volume === 0 ? '🔇' : '🔊'}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => {
                            const v = Number(e.target.value)
                            setVolume(v)
                            if (v > 0 && muted) setMuted(false)
                        }}
                        className="w-16 accent-amber-400"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac"
                        onChange={(e) => {
                            void handleImportFiles(e.target.files)
                            e.target.value = ''
                        }}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-md px-2 py-1 text-[11px] cursor-pointer"
                    >
                        📂 {lang === 'zh' ? '导入本地' : 'Local'}
                    </button>
                    {albumId === '__custom__' && trackId.startsWith('custom:') && (
                        <button
                            type="button"
                            onClick={() => void handleRemoveCurrentCustom()}
                            className="bg-slate-800 hover:bg-rose-900/70 border border-slate-600 text-rose-300 rounded-md px-2 py-1 text-[11px] cursor-pointer"
                        >
                            {lang === 'zh' ? '删此曲' : 'Del'}
                        </button>
                    )}
                    {albumId === '__custom__' && customTracks.length > 0 && (
                        <button
                            type="button"
                            onClick={() => void handleClearCustom()}
                            className="bg-slate-800 hover:bg-rose-900/70 border border-slate-600 text-slate-300 rounded-md px-2 py-1 text-[11px] cursor-pointer"
                        >
                            {lang === 'zh' ? '清空' : 'Clear'}
                        </button>
                    )}
                </div>
            </div>
            {statusMsg && <div className="text-[11px] text-amber-300/90 px-1">{statusMsg}</div>}
        </div>
    )
}