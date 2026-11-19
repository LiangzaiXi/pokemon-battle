import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv'
const toId = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/)
    const headers = lines[0].split(',')
    return lines.slice(1).map((line) => {
        const cols = []
        let cur = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') {
                inQuotes = !inQuotes
            } else if (ch === ',' && !inQuotes) {
                cols.push(cur)
                cur = ''
            } else {
                cur += ch
            }
        }
        cols.push(cur)
        const obj = {}
        headers.forEach((h, idx) => {
            obj[h] = cols[idx] ?? ''
        })
        return obj
    })
}
async function fetchTable(file, idCol) {
    const res = await fetch(`${BASE}/${file}`)
    if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`)
    const rows = parseCsv(await res.text())
    const byEntity = {}
    for (const row of rows) {
        const eid = row[idCol]
        const lid = row.local_language_id
        if (!byEntity[eid]) byEntity[eid] = {}
        if (lid === '9') byEntity[eid].en = row.name
        else if (lid === '12') byEntity[eid].zh = row.name
        else if (lid === '11') byEntity[eid].ja = row.name
        else if (lid === '1' && !byEntity[eid].ja) byEntity[eid].ja = row.name
    }
    const map = {}
    for (const entry of Object.values(byEntity)) {
        if (!entry.en) continue
        map[toId(entry.en)] = {
            en: entry.en,
            zh: entry.zh || entry.en,
            ja: entry.ja || entry.en,
        }
    }
    return { byEntity, map }
}
async function main() {
    console.log('Downloading official ZH/JA/EN dictionaries...')
    const [speciesRes, movesRes, itemsRes, abilitiesRes, naturesRes, typesRes] = await Promise.all([
        fetchTable('pokemon_species_names.csv', 'pokemon_species_id'),
        fetchTable('move_names.csv', 'move_id'),
        fetchTable('item_names.csv', 'item_id'),
        fetchTable('ability_names.csv', 'ability_id'),
        fetchTable('nature_names.csv', 'nature_id'),
        fetchTable('type_names.csv', 'type_id'),
    ])
    const speciesByNum = {}
    for (const [num, entry] of Object.entries(speciesRes.byEntity)) {
        if (!entry.en) continue
        speciesByNum[num] = {
            en: entry.en,
            zh: entry.zh || entry.en,
            ja: entry.ja || entry.en,
        }
    }
    if (!typesRes.map.stellar) {
        typesRes.map.stellar = { en: 'Stellar', zh: '星晶', ja: 'ステラ' }
    }
    const output = {
        speciesByNum,
        species: speciesRes.map,
        moves: movesRes.map,
        items: itemsRes.map,
        abilities: abilitiesRes.map,
        natures: naturesRes.map,
        types: typesRes.map,
    }
    const outPath = 'src/i18n/pokemonData.json'
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, JSON.stringify(output), 'utf-8')
    console.log(`Done! Saved to ${outPath}`)
}
main().catch((err) => {
    console.error(err)
    process.exit(1)
})