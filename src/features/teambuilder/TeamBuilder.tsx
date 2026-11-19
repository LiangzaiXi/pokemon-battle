import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dex } from '@pkmn/dex'
import { Generations, type StatID } from '@pkmn/data'
import { Sprites } from '@pkmn/img'
import SearchableSelect, { type SearchOption } from '../../components/SearchableSelect'
import { ItemIcon, PokemonMiniIcon } from '../../components/DexIcons'
import TownBgmBar from './TownBgmBar'
import { playPokemonCry } from '../battle/showdownAssets'
import { resolveMoveType } from '../../utils/moveType'
import {
    buildSearchText,
    getAbilityEntry,
    getCategoryLabel,
    getItemEntry,
    getMoveEntry,
    getNatureEntry,
    getSpeciesEntry,
    getTypeEntry,
    normalizeLang,
} from '../../i18n/dexI18n'
import {
    useTeamStore,
    createDefaultMember,
    exportTeamToPaste,
    type BattleFormat,
    type PokemonMember,
    type SavedTeam,
    type StatKey,
} from '../../store/teamStore'
const gens = new Generations(Dex, (d) => Boolean(d.exists))
const gen = gens.get(9)
const ALL_SPECIES = Array.from(gen.species)
    .filter((s) => s.num > 0 && !s.battleOnly && s.isNonstandard !== 'CAP' && s.isNonstandard !== 'Custom')
    .sort((a, b) => a.num - b.num)
const ALL_ITEMS = Array.from(gen.items)
    .filter((i) => i.isNonstandard !== 'CAP' && i.isNonstandard !== 'Custom')
    .sort((a, b) => a.name.localeCompare(b.name))
const ALL_NATURES = Array.from(gen.natures).sort((a, b) => a.name.localeCompare(b.name))
const ALL_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar',
]
const TYPE_BADGE_CLS: Record<string, string> = {
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
const ADD_DEFAULTS = ['Flutter Mane', 'Incineroar', 'Rillaboom', 'Dragonite', 'Urshifu-Rapid-Strike', 'Gholdengo', 'Kingambit', 'Chien-Pao']
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
function getSpriteUrl(speciesName: string, fallback = false) {
    const sprite = fallback ? Sprites.getDexPokemon(speciesName) : Sprites.getPokemon(speciesName)
    return sprite.url
}
function getSpeciesNum(name: string): number {
    const sp = gen.species.get(name)
    return sp ? sp.num : 0
}
function getStatBarColor(val: number): string {
    if (val >= 190) return 'from-cyan-400 to-emerald-400'
    if (val >= 145) return 'from-emerald-400 to-lime-400'
    if (val >= 105) return 'from-amber-400 to-yellow-300'
    return 'from-rose-500 to-orange-400'
}
export default function TeamBuilder({ format }: { format: BattleFormat }) {
    const { t, i18n } = useTranslation()
    const lang = normalizeLang(i18n.resolvedLanguage)
    const { teams, activeTeamId, saveTeam, deleteTeam, setActiveTeam } = useTeamStore()
    const [editingTeam, setEditingTeam] = useState<SavedTeam>(() => {
        const existing = teams.find((tm) => tm.id === activeTeamId) || teams[0]
        if (existing) return existing
        return {
            id: crypto.randomUUID(),
            name: 'My Team 1',
            format,
            members: [createDefaultMember('Garchomp')],
        }
    })
    const [slotIndex, setSlotIndex] = useState(0)
    const [learnableMoveNames, setLearnableMoveNames] = useState<string[]>([])
    const [spriteFallback, setSpriteFallback] = useState(false)
    const [copied, setCopied] = useState(false)
    const [notice, setNotice] = useState('')
    const currentMember = editingTeam.members[slotIndex] || editingTeam.members[0]
    const currentSpecies = useMemo(
        () => gen.species.get(currentMember?.species || 'Pikachu') || ALL_SPECIES[0],
        [currentMember?.species]
    )
    const otherUsedNums = useMemo(() => {
        const set = new Set<number>()
        editingTeam.members.forEach((m, idx) => {
            if (idx !== slotIndex) {
                const num = getSpeciesNum(m.species)
                if (num > 0) set.add(num)
            }
        })
        return set
    }, [editingTeam.members, slotIndex])
    const abilities = useMemo(
        () => Object.values(currentSpecies.abilities).filter(Boolean) as string[],
        [currentSpecies]
    )
    useEffect(() => {
        let cancelled = false
        setSpriteFallback(false)
        async function loadMoves() {
            const moveSet = new Set<string>()
            try {
                for await (const ls of gen.learnsets.all(currentSpecies)) {
                    if (ls.learnset) {
                        for (const moveId of Object.keys(ls.learnset)) {
                            const m = gen.moves.get(moveId)
                            if (m && m.exists && m.isNonstandard !== 'CAP') moveSet.add(m.name)
                        }
                    }
                }
            } catch {
                moveSet.clear()
            }
            if (moveSet.size === 0) {
                for (const m of gen.moves) {
                    if (m.exists && m.isNonstandard !== 'CAP') moveSet.add(m.name)
                }
            }
            if (!cancelled) {
                setLearnableMoveNames(Array.from(moveSet).sort((a, b) => a.localeCompare(b)))
            }
        }
        void loadMoves()
        return () => {
            cancelled = true
        }
    }, [currentSpecies])
    const showToast = (msg: string) => {
        setNotice(msg)
        setTimeout(() => setNotice(''), 2200)
    }
    const speciesOptions = useMemo<SearchOption[]>(() => {
        return ALL_SPECIES.filter((s) => !otherUsedNums.has(s.num)).map((s) => {
            const entry = getSpeciesEntry(s.name, s.num, s.forme)
            return {
                value: s.name,
                label: `#${s.num} ${entry[lang]}`,
                subLabel: (
                    <span className="flex items-center gap-1">
                        {s.types.map((tp) => (
                            <span
                                key={tp}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${TYPE_BADGE_CLS[tp] || 'bg-slate-600 text-white'}`}
                            >
                                {getTypeEntry(tp)[lang]}
                            </span>
                        ))}
                    </span>
                ),
                searchText: buildSearchText(entry, `#${s.num} ${s.num} ${s.types.join(' ')}`),
                icon: <PokemonMiniIcon name={s.name} />,
            }
        })
    }, [lang, otherUsedNums])
    const itemOptions = useMemo<SearchOption[]>(() => {
        return ALL_ITEMS.map((item) => {
            const entry = getItemEntry(item.name)
            return {
                value: item.name,
                label: entry[lang],
                searchText: buildSearchText(entry),
                icon: <ItemIcon name={item.name} />,
                detailKind: 'item',
            }
        })
    }, [lang])
    const abilityOptions = useMemo<SearchOption[]>(() => {
        return abilities.map((ab) => {
            const entry = getAbilityEntry(ab)
            return {
                value: ab,
                label: entry[lang],
                searchText: buildSearchText(entry),
                detailKind: 'ability',
            }
        })
    }, [abilities, lang])
    const natureOptions = useMemo<SearchOption[]>(() => {
        return ALL_NATURES.map((n) => {
            const entry = getNatureEntry(n.name)
            const modText = n.plus && n.minus ? `+${t(`stats.${n.plus}`)} / -${t(`stats.${n.minus}`)}` : ''
            return {
                value: n.name,
                label: modText ? `${entry[lang]} (${modText})` : entry[lang],
                searchText: buildSearchText(entry, `${modText} ${n.plus || ''} ${n.minus || ''}`),
            }
        })
    }, [lang, t])
    const typeOptions = useMemo<SearchOption[]>(() => {
        return ALL_TYPES.map((tp) => {
            const entry = getTypeEntry(tp)
            return {
                value: tp,
                label: entry[lang],
                searchText: buildSearchText(entry),
                icon: <span className={`w-3 h-3 rounded-full inline-block ${TYPE_BADGE_CLS[tp] || 'bg-slate-500'}`} />,
            }
        })
    }, [lang])
    const moveOptions = useMemo<SearchOption[]>(() => {
        return learnableMoveNames.map((moveName) => {
            const entry = getMoveEntry(moveName)
            const m = gen.moves.get(moveName)
            const effType = m
                ? resolveMoveType(m.name, {
                    species: currentSpecies.name,
                    item: currentMember.item,
                    ability: currentMember.ability,
                })
                : 'Normal'
            const typeEntry = m ? getTypeEntry(effType) : { en: '', zh: '', ja: '' }
            const cat = m ? getCategoryLabel(m.category, lang) : ''
            const bp = m && m.basePower > 0 ? ` ${m.basePower}` : ''
            return {
                value: moveName,
                label: entry[lang],
                subLabel: m ? `${cat}${bp}` : undefined,
                searchText: buildSearchText(entry, `${typeEntry.zh} ${typeEntry.ja} ${typeEntry.en} ${cat}`),
                icon: m ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${TYPE_BADGE_CLS[effType] || 'bg-slate-600 text-white'}`}>
                        {typeEntry[lang]}
                    </span>
                ) : undefined,
                detailKind: 'move',
            }
        })
    }, [learnableMoveNames, lang, currentSpecies.name, currentMember.item, currentMember.ability])
    const updateMember = (patch: Partial<PokemonMember>) => {
        setEditingTeam((prev) => ({
            ...prev,
            members: prev.members.map((m, i) => (i === slotIndex ? { ...m, ...patch } : m)),
        }))
    }
    const handleSelectSpecies = (speciesName: string) => {
        const sp = gen.species.get(speciesName)
        if (!sp) return
        if (otherUsedNums.has(sp.num)) {
            showToast(lang === 'zh' ? '同队不能选择两只相同的宝可梦（图鉴编号重复）！' : 'Duplicate Pokemon species are not allowed!')
            return
        }
        const firstAbility = (Object.values(sp.abilities).filter(Boolean)[0] as string) || ''
        const patch: Partial<PokemonMember> = {
            species: sp.name,
            ability: firstAbility,
            teraType: sp.types[0] || 'Normal',
            moves: ['', '', '', ''],
        }
        if (sp.requiredItem) {
            patch.item = sp.requiredItem
        }
        updateMember(patch)
        playPokemonCry(sp.name)
    }
    const handleSelectItem = (itemName: string) => {
        const patch: Partial<PokemonMember> = { item: itemName }
        const itemObj = itemName ? gen.items.get(itemName) : undefined
        const forcedName = itemObj?.forcedForme
        if (forcedName) {
            const forcedSp = gen.species.get(forcedName)
            if (forcedSp && !forcedSp.battleOnly && forcedSp.baseSpecies === currentSpecies.baseSpecies) {
                patch.species = forcedSp.name
                const firstAb = (Object.values(forcedSp.abilities).filter(Boolean)[0] as string) || ''
                if (firstAb) patch.ability = firstAb
            }
        } else if (currentSpecies.requiredItem && currentSpecies.requiredItem !== itemName) {
            const baseSp = gen.species.get(currentSpecies.baseSpecies)
            if (baseSp) {
                patch.species = baseSp.name
                const firstAb = (Object.values(baseSp.abilities).filter(Boolean)[0] as string) || ''
                if (firstAb) patch.ability = firstAb
            }
        }
        updateMember(patch)
    }
    const handleEvChange = (stat: StatKey, rawValue: number) => {
        const val = Math.max(0, Math.min(252, Number.isNaN(rawValue) ? 0 : rawValue))
        const otherTotal = STAT_KEYS.reduce((sum, k) => (k === stat ? sum : sum + currentMember.evs[k]), 0)
        const clamped = Math.min(val, 510 - otherTotal)
        updateMember({ evs: { ...currentMember.evs, [stat]: clamped } })
    }
    const handleIvChange = (stat: StatKey, rawValue: number) => {
        const val = Math.max(0, Math.min(31, Number.isNaN(rawValue) ? 0 : rawValue))
        updateMember({ ivs: { ...currentMember.ivs, [stat]: val } })
    }
    const totalEvs = STAT_KEYS.reduce((sum, k) => sum + currentMember.evs[k], 0)
    const selectedNature = gen.natures.get(currentMember.nature)
    const bst = Object.values(currentSpecies.baseStats).reduce((a, b) => a + b, 0)
    const handleAddSlot = () => {
        if (editingTeam.members.length >= 6) return
        const usedAll = new Set(editingTeam.members.map((m) => getSpeciesNum(m.species)))
        const candidate =
            ADD_DEFAULTS.find((name) => !usedAll.has(getSpeciesNum(name))) ||
            ALL_SPECIES.find((s) => !usedAll.has(s.num))?.name ||
            'Pikachu'
        const nextMembers = [...editingTeam.members, createDefaultMember(candidate)]
        setEditingTeam({ ...editingTeam, members: nextMembers })
        setSlotIndex(nextMembers.length - 1)
        playPokemonCry(candidate)
    }
    const handleRemoveSlot = (idx: number) => {
        if (editingTeam.members.length <= 1) return
        const nextMembers = editingTeam.members.filter((_, i) => i !== idx)
        setEditingTeam({ ...editingTeam, members: nextMembers })
        setSlotIndex(Math.max(0, Math.min(slotIndex, nextMembers.length - 1)))
    }
    const handleNewTeam = () => {
        const fresh: SavedTeam = {
            id: crypto.randomUUID(),
            name: `Team ${teams.length + 1}`,
            format,
            members: [createDefaultMember('Dragonite')],
        }
        setEditingTeam(fresh)
        setSlotIndex(0)
    }
    const handleSave = () => {
        const nums = editingTeam.members.map((m) => getSpeciesNum(m.species)).filter((n) => n > 0)
        if (new Set(nums).size !== nums.length) {
            showToast(lang === 'zh' ? '保存失败：队伍中存在重复的宝可梦！' : 'Cannot save: duplicate Pokemon in team!')
            return
        }
        saveTeam({ ...editingTeam, format })
        showToast(lang === 'zh' ? '队伍已保存到本地！' : 'Team saved!')
    }
    const handleCopyPaste = async () => {
        await navigator.clipboard.writeText(exportTeamToPaste(editingTeam.members))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }
    const currentSpeciesDisplay = getSpeciesEntry(currentSpecies.name, currentSpecies.num, currentSpecies.forme)[lang]
    return (
        <div className="space-y-4">
            <TownBgmBar lang={lang} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <aside className="lg:col-span-3 space-y-3 border-b lg:border-b-0 lg:border-r border-slate-700/70 pb-4 lg:pb-0 lg:pr-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <h2 className="font-bold text-slate-100 tracking-wide">
                                {t('myTeams')} ({teams.length})
                            </h2>
                        </div>
                        <button
                            onClick={handleNewTeam}
                            className="text-xs font-bold bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white px-3 py-1.5 rounded-full shadow cursor-pointer transition"
                        >
                            {t('newTeam')}
                        </button>
                    </div>
                    <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                        {teams.length === 0 && (
                            <div className="p-4 rounded-xl bg-slate-900/70 border border-dashed border-slate-700 text-xs text-slate-400 leading-relaxed">
                                {t('noSavedTeams')}
                            </div>
                        )}
                        {teams.map((team) => (
                            <div
                                key={team.id}
                                onClick={() => {
                                    setEditingTeam(team)
                                    setActiveTeam(team.id)
                                    setSlotIndex(0)
                                }}
                                className={`p-3 rounded-xl border cursor-pointer transition ${editingTeam.id === team.id
                                    ? 'bg-gradient-to-r from-red-950/60 to-slate-900 border-red-500/80 shadow-[0_0_16px_rgba(239,68,68,0.18)]'
                                    : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-sm truncate text-white">{team.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteTeam(team.id)
                                        }}
                                        className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                                <div className="flex items-center gap-0.5 mt-1.5 overflow-hidden">
                                    {team.members.map((m, idx) => (
                                        <PokemonMiniIcon key={idx} name={m.species} className="scale-90 -mx-0.5" />
                                    ))}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                                    <span>{team.members.length}/6</span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                        {team.format.includes('doubles') ? t('doubles64') : t('singles63')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
                <section className="lg:col-span-9 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-700/80">
                        <div className="flex items-center gap-3 flex-wrap">
                            <input
                                value={editingTeam.name}
                                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                                placeholder={t('teamNamePlaceholder')}
                                className="bg-slate-950/80 border border-slate-600 focus:border-amber-400 outline-none rounded-lg px-3 py-1.5 text-sm font-bold text-white w-56"
                            />
                            {notice && <span className="text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-full">{notice}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyPaste}
                                className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg cursor-pointer transition"
                            >
                                {copied ? t('copied') : t('copyPaste')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 px-4 py-2 rounded-lg shadow cursor-pointer transition"
                            >
                                {t('saveTeam')}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {editingTeam.members.map((m, idx) => {
                            const sp = gen.species.get(m.species)
                            const displayName = sp ? getSpeciesEntry(sp.name, sp.num, sp.forme)[lang] : m.species
                            const active = slotIndex === idx
                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setSlotIndex(idx)
                                        playPokemonCry(m.species)
                                    }}
                                    className={`relative p-2.5 rounded-xl border text-center cursor-pointer transition group ${active
                                        ? 'bg-gradient-to-b from-red-950/70 via-slate-900 to-slate-950 border-amber-400 shadow-[0_0_18px_rgba(250,204,21,0.2)] -translate-y-0.5'
                                        : 'bg-slate-900/70 border-slate-700/80 hover:border-slate-500'
                                        }`}
                                >
                                    <span className="absolute top-1.5 left-2 text-[10px] font-mono text-slate-500">0{idx + 1}</span>
                                    {editingTeam.members.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveSlot(idx)
                                            }}
                                            className="absolute top-1 right-1.5 text-sm text-slate-500 hover:text-rose-400 cursor-pointer"
                                        >
                                            ×
                                        </button>
                                    )}
                                    <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                                        <img src={getSpriteUrl(m.species, true)} alt={displayName} className="w-13 h-13 object-contain drop-shadow" />
                                        {m.item && (
                                            <span
                                                title={getItemEntry(m.item)[lang]}
                                                className="absolute -bottom-1 -right-1 bg-slate-950/90 border border-slate-600 rounded-full p-0.5 shadow"
                                            >
                                                <ItemIcon name={m.item} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs font-bold truncate mt-1 text-slate-100">{displayName}</div>
                                </div>
                            )
                        })}
                        {editingTeam.members.length < 6 && (
                            <button
                                onClick={handleAddSlot}
                                className="p-2.5 rounded-xl border-2 border-dashed border-slate-700 hover:border-amber-400 bg-slate-900/40 text-slate-400 hover:text-amber-300 flex flex-col items-center justify-center min-h-[100px] cursor-pointer transition"
                            >
                                <span className="text-2xl font-light">+</span>
                                <span className="text-xs font-semibold">{t('addPokemon')}</span>
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                        <div className="md:col-span-4 space-y-3">
                            <div className="relative h-48 rounded-xl border border-slate-700/90 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.18),rgba(15,23,42,0.95))] flex flex-col items-center justify-center p-3 overflow-hidden">
                                <span className="absolute top-2 left-2.5 text-xs font-mono font-bold text-slate-400">#{String(currentSpecies.num).padStart(4, '0')}</span>
                                {currentMember.item && (
                                    <div className="absolute top-2 right-2.5 flex items-center gap-1 bg-slate-950/85 border border-slate-600 rounded-full px-2 py-0.5 text-[11px] text-amber-200">
                                        <ItemIcon name={currentMember.item} />
                                        <span className="max-w-24 truncate">{getItemEntry(currentMember.item)[lang]}</span>
                                    </div>
                                )}
                                <img
                                    src={getSpriteUrl(currentSpecies.name, spriteFallback)}
                                    onError={() => setSpriteFallback(true)}
                                    onClick={() => playPokemonCry(currentSpecies.name)}
                                    alt={currentSpeciesDisplay}
                                    className="max-h-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.7)] cursor-pointer hover:scale-105 transition-transform"
                                />
                                <div className="text-base font-extrabold mt-2 text-white tracking-wide">{currentSpeciesDisplay}</div>
                                <div className="flex gap-1.5 mt-1.5">
                                    {currentSpecies.types.map((tp) => (
                                        <span key={tp} className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow ${TYPE_BADGE_CLS[tp] || 'bg-slate-700 text-white'}`}>
                                            {getTypeEntry(tp)[lang]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-300">{t('speciesLabel')}</label>
                                <SearchableSelect
                                    options={speciesOptions}
                                    value={currentSpecies.name}
                                    onChange={handleSelectSpecies}
                                    placeholder={t('searchSpecies')}
                                    noResultLabel={t('noMatch')}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-8 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('ability')}</label>
                                    <SearchableSelect
                                        options={abilityOptions}
                                        value={currentMember.ability || abilities[0] || ''}
                                        onChange={(val) => updateMember({ ability: val })}
                                        placeholder={t('searchAbility')}
                                        noResultLabel={t('noMatch')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('item')}</label>
                                    <SearchableSelect
                                        options={itemOptions}
                                        value={currentMember.item}
                                        onChange={handleSelectItem}
                                        placeholder={t('searchItem')}
                                        allowEmpty
                                        emptyLabel={t('noItem')}
                                        noResultLabel={t('noMatch')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('nature')}</label>
                                    <SearchableSelect
                                        options={natureOptions}
                                        value={currentMember.nature}
                                        onChange={(val) => updateMember({ nature: val })}
                                        placeholder={t('searchNature')}
                                        noResultLabel={t('noMatch')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('teraType')}</label>
                                    <SearchableSelect
                                        options={typeOptions}
                                        value={currentMember.teraType}
                                        onChange={(val) => updateMember({ teraType: val })}
                                        placeholder={t('searchType')}
                                        noResultLabel={t('noMatch')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('level')}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={currentMember.level}
                                        onChange={(e) => updateMember({ level: Math.max(1, Math.min(100, Number(e.target.value) || 50)) })}
                                        className="w-full bg-slate-900/90 border border-slate-600/80 focus:border-red-400 outline-none rounded-lg px-2.5 py-2 text-sm text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    {t('movesLabel', { count: learnableMoveNames.length })}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {[0, 1, 2, 3].map((mIdx) => (
                                        <SearchableSelect
                                            key={mIdx}
                                            options={moveOptions}
                                            value={currentMember.moves[mIdx]}
                                            onChange={(val) => {
                                                const nextMoves = [...currentMember.moves] as [string, string, string, string]
                                                nextMoves[mIdx] = val
                                                updateMember({ moves: nextMoves })
                                            }}
                                            placeholder={t('movePlaceholder', { index: mIdx + 1 })}
                                            allowEmpty
                                            emptyLabel={t('noMove')}
                                            noResultLabel={t('noMatch')}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 space-y-3 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-bold text-slate-100">{t('statsTitle', { bst })}</span>
                            <span
                                className={`text-xs font-bold px-3 py-1 rounded-full ${totalEvs === 510 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800 text-amber-200 border border-slate-700'
                                    }`}
                            >
                                {t('remainingEvs', { left: 510 - totalEvs })}
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {STAT_KEYS.map((key) => {
                                const base = currentSpecies.baseStats[key]
                                const ev = currentMember.evs[key]
                                const iv = currentMember.ivs[key]
                                const finalStat =
                                    currentSpecies.id === 'shedinja' && key === 'hp'
                                        ? 1
                                        : gen.stats.calc(key as StatID, base, iv, ev, currentMember.level, selectedNature)
                                const isPlus = selectedNature?.plus === key
                                const isMinus = selectedNature?.minus === key
                                return (
                                    <div key={key} className="grid grid-cols-12 items-center gap-2 text-sm">
                                        <div className="col-span-3 sm:col-span-2 flex items-center justify-between">
                                            <span className={isPlus ? 'text-rose-400 font-bold' : isMinus ? 'text-sky-400 font-bold' : 'text-slate-300 font-medium'}>
                                                {t(`stats.${key}`)}
                                                {isPlus ? '▲' : isMinus ? '▼' : ''}
                                            </span>
                                            <span className="text-xs font-mono text-slate-400">{base}</span>
                                        </div>
                                        <div className="hidden sm:block sm:col-span-3 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                                            <div
                                                className={`h-full bg-gradient-to-r ${getStatBarColor(finalStat)} transition-all`}
                                                style={{ width: `${Math.min(100, (finalStat / 260) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
                                            <input
                                                type="range"
                                                min={0}
                                                max={252}
                                                step={4}
                                                value={ev}
                                                onChange={(e) => handleEvChange(key, Number(e.target.value))}
                                                className="w-full accent-red-500"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                max={252}
                                                value={ev}
                                                onChange={(e) => handleEvChange(key, Number(e.target.value))}
                                                className="w-14 bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-xs text-center font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 justify-end">
                                            <span className="text-[11px] text-slate-400">IV</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={31}
                                                value={iv}
                                                onChange={(e) => handleIvChange(key, Number(e.target.value))}
                                                className="w-12 bg-slate-950 border border-slate-700 rounded-md px-1 py-0.5 text-xs text-center font-mono"
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 text-right font-extrabold font-mono text-white">{finalStat}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}