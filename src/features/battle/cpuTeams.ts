export interface CpuTeamPreset {
    id: string
    zh: string
    en: string
    ja: string
    paste: string
}
const META_SETS: { num: number; paste: string }[] = [
    { num: 887, paste: 'Dragapult @ Choice Specs\nAbility: Clear Body\nLevel: 50\nTera Type: Ghost\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Shadow Ball\n- Draco Meteor\n- Flamethrower\n- U-turn' },
    { num: 983, paste: 'Kingambit @ Black Glasses\nAbility: Defiant\nLevel: 50\nTera Type: Dark\nEVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n- Kowtow Cleave\n- Sucker Punch\n- Iron Head\n- Protect' },
    { num: 591, paste: 'Amoonguss @ Rocky Helmet\nAbility: Regenerator\nLevel: 50\nTera Type: Water\nEVs: 244 HP / 156 Def / 108 SpD\nBold Nature\n- Spore\n- Pollen Puff\n- Rage Powder\n- Protect' },
    { num: 1000, paste: 'Gholdengo @ Leftovers\nAbility: Good as Gold\nLevel: 50\nTera Type: Steel\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Make It Rain\n- Shadow Ball\n- Nasty Plot\n- Protect' },
    { num: 645, paste: 'Landorus-Therian @ Choice Scarf\nAbility: Intimidate\nLevel: 50\nTera Type: Flying\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- U-turn\n- Rock Slide\n- Tera Blast' },
    { num: 1002, paste: 'Chien-Pao @ Focus Sash\nAbility: Sword of Ruin\nLevel: 50\nTera Type: Ghost\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Icicle Crash\n- Sucker Punch\n- Sacred Sword\n- Protect' },
    { num: 987, paste: 'Flutter Mane @ Booster Energy\nAbility: Protosynthesis\nLevel: 50\nTera Type: Fairy\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Moonblast\n- Shadow Ball\n- Dazzling Gleam\n- Protect' },
    { num: 727, paste: 'Incineroar @ Sitrus Berry\nAbility: Intimidate\nLevel: 50\nTera Type: Grass\nEVs: 244 HP / 4 Atk / 100 Def / 156 SpD / 4 Spe\nCareful Nature\n- Flare Blitz\n- Knock Off\n- Fake Out\n- Parting Shot' },
    { num: 812, paste: 'Rillaboom @ Assault Vest\nAbility: Grassy Surge\nLevel: 50\nTera Type: Fire\nEVs: 252 HP / 116 Atk / 4 Def / 132 SpD / 4 Spe\nAdamant Nature\n- Wood Hammer\n- Grassy Glide\n- U-turn\n- Fake Out' },
    { num: 149, paste: 'Dragonite @ Choice Band\nAbility: Multiscale\nLevel: 50\nTera Type: Normal\nEVs: 4 HP / 252 Atk / 252 Spe\nAdamant Nature\n- Extreme Speed\n- Outrage\n- Earthquake\n- Ice Spinner' },
    { num: 892, paste: 'Urshifu-Rapid-Strike @ Mystic Water\nAbility: Unseen Fist\nLevel: 50\nTera Type: Water\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Surging Strikes\n- Close Combat\n- Aqua Jet\n- Detect' },
    { num: 1018, paste: 'Archaludon @ Assault Vest\nAbility: Stamina\nLevel: 50\nTera Type: Grass\nEVs: 252 HP / 4 Def / 116 SpA / 132 SpD / 4 Spe\nModest Nature\n- Electro Shot\n- Flash Cannon\n- Draco Meteor\n- Body Press' },
    { num: 279, paste: 'Pelipper @ Focus Sash\nAbility: Drizzle\nLevel: 50\nTera Type: Ghost\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Weather Ball\n- Hurricane\n- Tailwind\n- Wide Guard' },
    { num: 902, paste: 'Basculegion @ Choice Band\nAbility: Swift Swim\nLevel: 50\nTera Type: Water\nEVs: 4 HP / 252 Atk / 252 Spe\nAdamant Nature\n- Wave Crash\n- Last Respects\n- Aqua Jet\n- Flip Turn' },
    { num: 324, paste: 'Torkoal @ Charcoal\nAbility: Drought\nLevel: 50\nTera Type: Fire\nEVs: 252 HP / 252 SpA / 4 SpD\nQuiet Nature\nIVs: 0 Spe\n- Eruption\n- Heat Wave\n- Earth Power\n- Protect' },
    { num: 1021, paste: 'Raging Bolt @ Life Orb\nAbility: Protosynthesis\nLevel: 50\nTera Type: Electric\nEVs: 188 HP / 252 SpA / 68 Spe\nModest Nature\n- Thunderclap\n- Thunderbolt\n- Draco Meteor\n- Protect' },
    { num: 1004, paste: 'Chi-Yu @ Choice Scarf\nAbility: Beads of Ruin\nLevel: 50\nTera Type: Ghost\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Heat Wave\n- Dark Pulse\n- Overheat\n- Snarl' },
    { num: 981, paste: 'Farigiraf @ Throat Spray\nAbility: Armor Tail\nLevel: 50\nTera Type: Fairy\nEVs: 252 HP / 252 SpA / 4 SpD\nQuiet Nature\nIVs: 0 Spe\n- Trick Room\n- Hyper Voice\n- Psychic\n- Protect' },
    { num: 901, paste: 'Ursaluna-Bloodmoon @ Life Orb\nAbility: Mind\'s Eye\nLevel: 50\nTera Type: Normal\nEVs: 252 HP / 252 SpA / 4 SpD\nQuiet Nature\nIVs: 0 Spe\n- Blood Moon\n- Earth Power\n- Hyper Voice\n- Protect' },
    { num: 992, paste: 'Iron Hands @ Assault Vest\nAbility: Quark Drive\nLevel: 50\nTera Type: Water\nEVs: 140 HP / 252 Atk / 116 SpD\nBrave Nature\nIVs: 0 Spe\n- Fake Out\n- Drain Punch\n- Wild Charge\n- Heavy Slam' },
    { num: 641, paste: 'Tornadus @ Covert Cloak\nAbility: Prankster\nLevel: 50\nTera Type: Steel\nEVs: 252 HP / 4 SpA / 252 Spe\nTimid Nature\n- Tailwind\n- Bleakwind Storm\n- Taunt\n- Rain Dance' },
    { num: 1017, paste: 'Ogerpon-Hearthflame @ Hearthflame Mask\nAbility: Mold Breaker\nLevel: 50\nTera Type: Fire\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Ivy Cudgel\n- Horn Leech\n- Follow Me\n- Spiky Shield' },
    { num: 445, paste: 'Garchomp @ Life Orb\nAbility: Rough Skin\nLevel: 50\nTera Type: Fire\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Rock Slide\n- Protect' },
    { num: 248, paste: 'Tyranitar @ Assault Vest\nAbility: Sand Stream\nLevel: 50\nTera Type: Flying\nEVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n- Rock Slide\n- Knock Off\n- Low Kick\n- Tera Blast' },
    { num: 530, paste: 'Excadrill @ Clear Amulet\nAbility: Sand Rush\nLevel: 50\nTera Type: Ground\nEVs: 4 HP / 252 Atk / 252 Spe\nAdamant Nature\n- High Horsepower\n- Iron Head\n- Rock Slide\n- Protect' },
    { num: 970, paste: 'Glimmora @ Focus Sash\nAbility: Toxic Debris\nLevel: 50\nTera Type: Grass\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Sludge Bomb\n- Power Gem\n- Earth Power\n- Spiky Shield' },
    { num: 977, paste: 'Dondozo @ Leftovers\nAbility: Unaware\nLevel: 50\nTera Type: Grass\nEVs: 252 HP / 252 Def / 4 SpD\nImpish Nature\n- Wave Crash\n- Body Press\n- Yawn\n- Protect' },
    { num: 1005, paste: 'Roaring Moon @ Booster Energy\nAbility: Protosynthesis\nLevel: 50\nTera Type: Flying\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Acrobatics\n- Knock Off\n- Tailwind\n- Protect' },
    { num: 991, paste: 'Iron Bundle @ Booster Energy\nAbility: Quark Drive\nLevel: 50\nTera Type: Ice\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Freeze-Dry\n- Hydro Pump\n- Icy Wind\n- Protect' },
    { num: 38, paste: 'Ninetales-Alola @ Light Clay\nAbility: Snow Warning\nLevel: 50\nTera Type: Water\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Blizzard\n- Moonblast\n- Aurora Veil\n- Protect' },
]
function pickByNums(nums: number[]): string {
    return nums
        .map((n) => META_SETS.find((s) => s.num === n)?.paste)
        .filter(Boolean)
        .join('\n\n')
}
export const CPU_TEAM_PRESETS: CpuTeamPreset[] = [
    { id: 'rain', zh: '🌧️ 铝钢桥龙雨天队', en: 'Rain Archaludon', ja: '雨ブリジュラス', paste: pickByNums([279, 1018, 902, 812, 727, 641]) },
    { id: 'sun', zh: '☀️ 猛雷鼓晴天队', en: 'Sun Protosynthesis', ja: '晴れタケルライコ', paste: pickByNums([324, 987, 1021, 1004, 1017, 1005]) },
    { id: 'trickroom', zh: '🌀 赫月熊空间队', en: 'Trick Room Bloodmoon', ja: 'トリルガチグマ', paste: pickByNums([981, 901, 324, 992, 591, 983]) },
    { id: 'sand', zh: '🌪️ 班基拉斯沙暴队', en: 'Sandstorm Balance', ja: '砂パバランス', paste: pickByNums([248, 530, 445, 1000, 727, 970]) },
    { id: 'snow', zh: '❄️ 阿罗拉九尾雪天队', en: 'Snow Aurora Veil', ja: '雪オーロラベール', paste: pickByNums([38, 991, 1002, 892, 645, 1000]) },
    { id: 'offense', zh: '⚔️ 多龙巴鲁托强攻队', en: 'Hyper Offense', ja: '対面ハイパーオフェンス', paste: pickByNums([887, 1002, 149, 892, 987, 983]) },
]
export function pickCpuTeamPaste(presetId: string): { paste: string; label: { zh: string; en: string; ja: string } } {
    if (presetId !== '__random__') {
        const found = CPU_TEAM_PRESETS.find((p) => p.id === presetId)
        if (found) return { paste: found.paste, label: { zh: found.zh, en: found.en, ja: found.ja } }
    }
    if (Math.random() < 0.45) {
        const preset = CPU_TEAM_PRESETS[Math.floor(Math.random() * CPU_TEAM_PRESETS.length)]
        return { paste: preset.paste, label: { zh: preset.zh, en: preset.en, ja: preset.ja } }
    }
    const pool = [...META_SETS]
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = pool[i]
        pool[i] = pool[j]
        pool[j] = tmp
    }
    const picked = pool.slice(0, 6)
    return {
        paste: picked.map((p) => p.paste).join('\n\n'),
        label: { zh: '🎲 随机竞技混搭队', en: 'Random Meta Squad', ja: 'ランダムガチパ' },
    }
}