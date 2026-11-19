import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TeamBuilder from './features/teambuilder/TeamBuilder'
import BattleArena from './features/battle/BattleArena'
import { playUiSfx, unlockBattleAudio } from './features/battle/showdownAssets'
import type { BattleFormat } from './store/teamStore'
type Tab = 'teambuilder' | 'offline' | 'online'
function PokeballEmblem() {
  return (
    <svg viewBox="0 0 40 40" className="w-8 h-8 shrink-0 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]">
      <circle cx="20" cy="20" r="18" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2.5" />
      <path d="M 2 20 A 18 18 0 0 1 38 20 Z" fill="#ef4444" />
      <path d="M 2 20 A 18 18 0 0 0 38 20 Z" fill="#f8fafc" />
      <rect x="2" y="18" width="36" height="4" fill="#0f172a" />
      <circle cx="20" cy="20" r="6" fill="#0f172a" />
      <circle cx="20" cy="20" r="3.5" fill="#facc15" />
    </svg>
  )
}
export default function App() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('teambuilder')
  const [format, setFormat] = useState<BattleFormat>('gen9battlestadiumsingles')
  const isBattleTab = tab === 'offline' || tab === 'online'
  useEffect(() => {
    const onGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const btn = target?.closest('button')
      if (!btn || btn.disabled) return
      unlockBattleAudio()
      const sfx = btn.getAttribute('data-sfx')
      if (sfx === 'none') return
      if (sfx === 'confirm' || sfx === 'cancel' || sfx === 'tera') {
        playUiSfx(sfx)
      } else {
        playUiSfx('click')
      }
    }
    const onGlobalChange = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target && target.tagName === 'SELECT') {
        unlockBattleAudio()
        playUiSfx('click')
      }
    }
    document.addEventListener('click', onGlobalClick)
    document.addEventListener('change', onGlobalChange)
    return () => {
      document.removeEventListener('click', onGlobalClick)
      document.removeEventListener('change', onGlobalChange)
    }
  }, [])
  return (
    <div
      className="min-h-screen text-slate-100 bg-slate-950"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 0%, rgba(239,68,68,0.16), transparent 36%), radial-gradient(circle at 88% 8%, rgba(6,182,212,0.14), transparent 34%), linear-gradient(180deg, #090d1a 0%, #020617 100%)',
      }}
    >
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-amber-400 to-cyan-400" />
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/90">
        <div className={`mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 ${isBattleTab ? 'max-w-none' : 'max-w-7xl'}`}>
          <div className="flex items-center gap-2.5">
            <PokeballEmblem />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-white via-amber-200 to-red-400 bg-clip-text text-transparent">
                {t('title')}
              </h1>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400">
                BATTLE STADIUM · P2P EDITION
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setTab('teambuilder')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${tab === 'teambuilder'
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
            >
              🎒 {t('teamBuilder')}
            </button>
            <button
              onClick={() => setTab('offline')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${tab === 'offline'
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
            >
              ⚔️ {t('startOffline')}
            </button>
            <button
              onClick={() => setTab('online')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${tab === 'online'
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
            >
              🌐 {t('findMatch')}
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs font-bold">
              <button
                onClick={() => setFormat('gen9battlestadiumsingles')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition ${format === 'gen9battlestadiumsingles' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
              >
                {t('singles63')}
              </button>
              <button
                onClick={() => setFormat('gen9battlestadiumdoubles')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition ${format === 'gen9battlestadiumdoubles' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
              >
                {t('doubles64')}
              </button>
            </div>
            <select
              value={i18n.resolvedLanguage || 'en'}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-100"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>
      </header>
      <main className={`mx-auto ${isBattleTab ? 'max-w-none px-2 sm:px-3 py-2' : 'max-w-7xl px-3 sm:px-5 py-4'}`}>
        <div
          className={
            isBattleTab
              ? ''
              : 'bg-slate-900/65 backdrop-blur rounded-2xl p-5 sm:p-6 border border-slate-800/90 shadow-2xl'
          }
        >
          {tab === 'teambuilder' && <TeamBuilder format={format} />}
          {tab === 'offline' && <BattleArena key={`offline-${format}`} format={format} mode="offline" />}
          {tab === 'online' && <BattleArena key={`online-${format}`} format={format} mode="online" />}
        </div>
      </main>
    </div>
  )
}