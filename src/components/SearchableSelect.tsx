import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
export interface SearchOption {
    value: string
    label: string
    subLabel?: string
    searchText: string
    icon?: ReactNode
}
interface SearchableSelectProps {
    options: SearchOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    allowEmpty?: boolean
    emptyLabel?: string
    noResultLabel?: string
}
export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = '',
    allowEmpty = false,
    emptyLabel = '',
    noResultLabel = 'No matches',
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const boxRef = useRef<HTMLDivElement>(null)
    const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options.slice(0, 80)
        const parts = q.split(/\s+/)
        return options.filter((opt) => parts.every((p) => opt.searchText.includes(p))).slice(0, 80)
    }, [options, query])
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setOpen(false)
                setQuery('')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    return (
        <div ref={boxRef} className="relative">
            <div className="relative flex items-center bg-slate-900/90 border border-slate-600/80 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400/50 rounded-lg transition">
                {!open && selected?.icon && <div className="pl-2 flex items-center shrink-0">{selected.icon}</div>}
                <input
                    value={open ? query : selected ? selected.label : ''}
                    onFocus={() => {
                        setOpen(true)
                        setQuery('')
                    }}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        if (!open) setOpen(true)
                    }}
                    placeholder={open ? placeholder : selected ? selected.label : emptyLabel || placeholder}
                    className="w-full bg-transparent outline-none px-2.5 py-2 pr-7 text-sm text-slate-100 placeholder:text-slate-500"
                />
                {allowEmpty && value && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('')
                            setQuery('')
                            setOpen(false)
                        }}
                        className="absolute right-2 text-slate-400 hover:text-rose-400 text-base leading-none cursor-pointer"
                    >
                        ×
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto bg-slate-950/95 backdrop-blur border border-slate-600 rounded-xl shadow-2xl">
                    {allowEmpty && !query && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange('')
                                setOpen(false)
                                setQuery('')
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/80 cursor-pointer border-b border-slate-800"
                        >
                            {emptyLabel || '-'}
                        </button>
                    )}
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-slate-400">{noResultLabel}</div>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value)
                                    setOpen(false)
                                    setQuery('')
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 cursor-pointer transition ${opt.value === value
                                        ? 'bg-red-500/20 text-amber-200 border-l-2 border-red-400'
                                        : 'hover:bg-slate-800/90 text-slate-100'
                                    }`}
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
                                    <span className="truncate">{opt.label}</span>
                                </span>
                                {opt.subLabel && <span className="text-[11px] text-slate-400 shrink-0">{opt.subLabel}</span>}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}