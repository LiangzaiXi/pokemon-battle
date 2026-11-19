import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { normalizeLang, type LangCode } from '../i18n/dexI18n'
import {
    fetchLocalizedDexDesc,
    getBaseDexDetail,
    getCachedLocalizedDesc,
    type DexDetailKind,
} from '../i18n/dexDetails'
import { ItemIcon } from './DexIcons'
export interface SearchOption {
    value: string
    label: string
    subLabel?: ReactNode
    searchText: string
    icon?: ReactNode
    detailKind?: DexDetailKind
}
interface SearchableSelectProps {
    options: SearchOption[]
    value: string
    onChange: (val: string) => void
    placeholder?: string
    allowEmpty?: boolean
    emptyLabel?: string
    noResultLabel?: string
}
interface HoverTarget {
    kind: DexDetailKind
    value: string
    rect: DOMRect
}
const TYPE_PILL_CLS: Record<string, string> = {
    Normal: 'bg-slate-500 text-white',
    Fire: 'bg-orange-600 text-white',
    Water: 'bg-sky-600 text-white',
    Electric: 'bg-yellow-400 text-slate-950',
    Grass: 'bg-emerald-600 text-white',
    Ice: 'bg-cyan-400 text-slate-950',
    Fighting: 'bg-red-700 text-white',
    Poison: 'bg-purple-600 text-white',
    Ground: 'bg-amber-600 text-white',
    Flying: 'bg-indigo-500 text-white',
    Psychic: 'bg-pink-600 text-white',
    Bug: 'bg-lime-600 text-white',
    Rock: 'bg-stone-500 text-white',
    Ghost: 'bg-violet-700 text-white',
    Dragon: 'bg-blue-700 text-white',
    Dark: 'bg-zinc-700 text-white',
    Steel: 'bg-slate-400 text-slate-950',
    Fairy: 'bg-rose-400 text-slate-950',
    Stellar: 'bg-gradient-to-r from-cyan-400 via-yellow-300 to-pink-400 text-slate-950',
}
const CAT_PILL_CLS: Record<string, string> = {
    Physical: 'bg-rose-600/90 text-white',
    Special: 'bg-indigo-600/90 text-white',
    Status: 'bg-slate-600/90 text-slate-100',
}
function DetailFloatingCard({ target, lang }: { target: HoverTarget; lang: LangCode }) {
    const base = useMemo(() => getBaseDexDetail(target.kind, target.value, lang), [target.kind, target.value, lang])
    const [localDesc, setLocalDesc] = useState<string | null>(() => {
        if (!base || lang === 'en') return null
        const cached = getCachedLocalizedDesc(target.kind, base.rawName, lang)
        return cached || null
    })
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        if (!base || lang === 'en') {
            setLocalDesc(null)
            setLoading(false)
            return
        }
        const cached = getCachedLocalizedDesc(target.kind, base.rawName, lang)
        if (cached !== undefined) {
            setLocalDesc(cached || null)
            setLoading(false)
            return
        }
        let cancelled = false
        setLocalDesc(null)
        setLoading(true)
        const timer = setTimeout(() => {
            void fetchLocalizedDexDesc(target.kind, base.rawName, lang).then((res) => {
                if (cancelled) return
                setLocalDesc(res)
                setLoading(false)
            })
        }, 100)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [base, target.kind, lang])
    if (!base) return null
    const cardWidth = 300
    const estHeight = base.moveMeta ? 185 : 125
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    let left = target.rect.right + 10
    if (left + cardWidth + 8 > vw) {
        left = Math.max(8, target.rect.left - cardWidth - 10)
    }
    const top = Math.max(8, Math.min(vh - estHeight - 8, target.rect.top - 4))
    const kindBadge =
        target.kind === 'ability'
            ? lang === 'zh' ? '特性' : lang === 'ja' ? '特性' : 'Ability'
            : target.kind === 'item'
                ? lang === 'zh' ? '道具' : lang === 'ja' ? '持ち物' : 'Item'
                : lang === 'zh' ? '招式' : lang === 'ja' ? '技' : 'Move'
    const descText = lang === 'en' ? base.fallbackDesc : localDesc || base.fallbackDesc
    return createPortal(
        <div
            style={{ top, left, width: cardWidth }}
            className="fixed z-[9999] pointer-events-none rounded-xl bg-slate-950/96 border border-slate-500/80 shadow-[0_12px_36px_rgba(0,0,0,0.85)] p-3 text-xs text-slate-100 space-y-2 backdrop-blur-md"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {target.kind === 'item' && <ItemIcon name={base.rawName} />}
                    <span className="font-extrabold text-sm text-white truncate">{base.title}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-amber-300 shrink-0">
                    {kindBadge}
                </span>
            </div>
            {base.moveMeta && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${TYPE_PILL_CLS[base.moveMeta.typeRaw] || 'bg-slate-600 text-white'}`}>
                            {base.moveMeta.typeLabel}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${CAT_PILL_CLS[base.moveMeta.categoryRaw] || 'bg-slate-700 text-white'}`}>
                            {base.moveMeta.categoryLabel}
                        </span>
                        {base.moveMeta.priority !== 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 border border-amber-400/50 text-amber-300">
                                {lang === 'zh' ? '优先度' : lang === 'ja' ? '優先度' : 'Prio'}{' '}
                                {base.moveMeta.priority > 0 ? `+${base.moveMeta.priority}` : base.moveMeta.priority}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2 py-1.5 text-center">
                        <div>
                            <div className="text-[10px] text-slate-400">{lang === 'zh' ? '威力' : lang === 'ja' ? '威力' : 'Power'}</div>
                            <div className="font-mono font-bold text-white">{base.moveMeta.basePower > 0 ? base.moveMeta.basePower : '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400">{lang === 'zh' ? '命中' : lang === 'ja' ? '命中' : 'Acc'}</div>
                            <div className="font-mono font-bold text-white">
                                {base.moveMeta.accuracy === true ? '—' : `${base.moveMeta.accuracy}%`}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400">PP</div>
                            <div className="font-mono font-bold text-white">{base.moveMeta.pp}</div>
                        </div>
                    </div>
                </div>
            )}
            <div className="text-[12px] leading-relaxed text-slate-200 border-t border-slate-800 pt-1.5">
                {loading ? (
                    <span className="text-slate-400">
                        {lang === 'zh' ? '正在加载中文说明…' : lang === 'ja' ? '日本語説明を読み込み中…' : 'Loading...'}
                    </span>
                ) : (
                    descText || (lang === 'zh' ? '暂无详细说明' : 'No description available.')
                )}
            </div>
        </div>,
        document.body
    )
}
export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = '',
    allowEmpty = false,
    emptyLabel = '(None)',
    noResultLabel = 'No match',
}: SearchableSelectProps) {
    const { i18n } = useTranslation()
    const lang = normalizeLang(i18n.resolvedLanguage)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value])
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter(
            (o) =>
                o.searchText.toLowerCase().includes(q) ||
                o.label.toLowerCase().includes(q) ||
                o.value.toLowerCase().includes(q)
        )
    }, [options, query])
    useEffect(() => {
        if (!open) return
        const onDocDown = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
                setQuery('')
                setHoverTarget(null)
            }
        }
        document.addEventListener('mousedown', onDocDown)
        return () => document.removeEventListener('mousedown', onDocDown)
    }, [open])
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 0)
        } else {
            setHoverTarget(null)
        }
    }, [open])
    const handleHoverOption = (opt: SearchOption, el: HTMLElement) => {
        if (!opt.detailKind) {
            setHoverTarget(null)
            return
        }
        setHoverTarget({ kind: opt.detailKind, value: opt.value, rect: el.getBoundingClientRect() })
    }
    const handleSelect = (val: string) => {
        onChange(val)
        setOpen(false)
        setQuery('')
        setHoverTarget(null)
    }
    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                onMouseEnter={(e) => {
                    if (!open && selected?.detailKind) {
                        setHoverTarget({
                            kind: selected.detailKind,
                            value: selected.value,
                            rect: e.currentTarget.getBoundingClientRect(),
                        })
                    }
                }}
                onMouseLeave={() => {
                    if (!open) setHoverTarget(null)
                }}
                className="w-full flex items-center justify-between gap-2 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-600/80 focus:border-red-400 outline-none rounded-lg px-2.5 py-2 text-sm text-left text-white cursor-pointer transition"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selected?.icon && <span className="shrink-0 flex items-center">{selected.icon}</span>}
                    <span className={`truncate ${selected ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                        {selected ? selected.label : placeholder || emptyLabel}
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl bg-slate-950 border border-slate-600/90 shadow-[0_14px_40px_rgba(0,0,0,0.85)] overflow-hidden">
                    <div className="p-1.5 border-b border-slate-800 bg-slate-900/80">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                    </div>
                    <div
                        onScroll={() => setHoverTarget(null)}
                        onMouseLeave={() => setHoverTarget(null)}
                        className="max-h-64 overflow-y-auto py-1"
                    >
                        {allowEmpty && !query.trim() && (
                            <button
                                type="button"
                                onMouseEnter={() => setHoverTarget(null)}
                                onClick={() => handleSelect('')}
                                className={`w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800/80 border-b border-slate-800/80 cursor-pointer ${value === '' ? 'bg-slate-800/70 text-amber-300 font-semibold' : ''
                                    }`}
                            >
                                {emptyLabel}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-500">{noResultLabel}</div>
                        ) : (
                            filtered.map((opt) => {
                                const active = opt.value === value
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onMouseEnter={(e) => handleHoverOption(opt, e.currentTarget)}
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-sm cursor-pointer transition ${active ? 'bg-red-950/70 text-amber-200 font-bold' : 'text-slate-100 hover:bg-slate-800/90'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
                                            <span className="truncate">{opt.label}</span>
                                        </div>
                                        {opt.subLabel && (
                                            <span className="shrink-0 text-[11px] text-slate-400 flex items-center gap-1">
                                                {opt.subLabel}
                                            </span>
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
            {hoverTarget && <DetailFloatingCard target={hoverTarget} lang={lang} />}
        </div>
    )
}