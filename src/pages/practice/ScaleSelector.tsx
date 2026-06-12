import { useState } from 'react'
import {
  CIRCLE_OF_FIFTHS,
  COMMON_VIOLIN_MAJOR_KEYS,
  COMMON_VIOLIN_MINOR_KEYS,
  GYPSY_SCALES,
  PENTATONIC_SCALES,
  SCALES,
  type ScaleKey,
} from '../../utils/scaleDefinitions'

interface ScaleSelectorProps {
  value: ScaleKey
  onChange: (key: ScaleKey) => void
}

type SelectorTab = 'common' | 'full' | 'special'

function deriveInitialTab(value: ScaleKey): SelectorTab {
  if (value === 'free') return 'common'
  if ((PENTATONIC_SCALES as readonly ScaleKey[]).includes(value)) return 'special'
  if ((GYPSY_SCALES as readonly ScaleKey[]).includes(value)) return 'special'
  if ((COMMON_VIOLIN_MAJOR_KEYS as readonly ScaleKey[]).includes(value)) return 'common'
  if ((COMMON_VIOLIN_MINOR_KEYS as readonly ScaleKey[]).includes(value)) return 'common'
  return 'full'
}

function gridLabel(key: ScaleKey): string {
  const def = SCALES[key]
  if (def.scaleType === 'gypsy' || def.scaleType === 'pentatonic-major' || def.scaleType === 'pentatonic-minor') {
    return def.shortLabel
  }
  return def.shortLabel.replace(' Maj', '').replace(' Min', 'm')
}

function scaleButtonClass(key: ScaleKey, selected: boolean): string {
  const def = SCALES[key]
  const base = 'py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 touch-none w-full neu-btn'
  if (!selected) {
    const dim = def.scaleType === 'minor' || def.scaleType === 'pentatonic-minor'
      ? 'text-[color:var(--neu-fg2)] opacity-70 hover:opacity-100'
      : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]'
    return `${base} ${dim}`
  }
  switch (def.scaleType) {
    case 'pentatonic-major': return `${base} neu-pill-active text-violet-300`
    case 'pentatonic-minor': return `${base} neu-pill-active text-violet-400`
    case 'gypsy':            return `${base} neu-pill-active text-amber-300`
    case 'minor':            return `${base} neu-pill-active text-blue-300`
    default:                 return `${base} neu-pill-active text-[color:var(--neu-fg)]`
  }
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function CommonPanel({ value, onChange }: { value: ScaleKey; onChange: (k: ScaleKey) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {COMMON_VIOLIN_MAJOR_KEYS.map(key => (
          <div key={key} className="flex-1">
            <button onClick={() => onChange(key)} className={scaleButtonClass(key, value === key)}>
              {gridLabel(key)}
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {COMMON_VIOLIN_MINOR_KEYS.map(key => (
          <div key={key} className="flex-1">
            <button onClick={() => onChange(key)} className={scaleButtonClass(key, value === key)}>
              {gridLabel(key)}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FullCirclePanel({ value, onChange }: { value: ScaleKey; onChange: (k: ScaleKey) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {CIRCLE_OF_FIFTHS.map((row, rowIdx) => (
        <div key={rowIdx} className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            {row.map(pair => (
              <div key={pair.major} className="flex flex-col gap-1 w-12 shrink-0">
                <button onClick={() => onChange(pair.major)} className={scaleButtonClass(pair.major, value === pair.major)}>
                  {gridLabel(pair.major)}
                </button>
                <button onClick={() => onChange(pair.minor)} className={scaleButtonClass(pair.minor, value === pair.minor)}>
                  {gridLabel(pair.minor)}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SpecialPanel({ value, onChange }: { value: ScaleKey; onChange: (k: ScaleKey) => void }) {
  const pentMajor = PENTATONIC_SCALES.slice(0, 3)
  const pentMinor = PENTATONIC_SCALES.slice(3)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-600 mb-1.5">
          Pentatonic
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            {pentMajor.map(key => (
              <div key={key} className="flex-1">
                <button onClick={() => onChange(key)} className={scaleButtonClass(key, value === key)}>
                  {gridLabel(key)}
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {pentMinor.map(key => (
              <div key={key} className="flex-1">
                <button onClick={() => onChange(key)} className={scaleButtonClass(key, value === key)}>
                  {gridLabel(key)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-600 mb-1.5">
          Gypsy / Hungarian
        </p>
        <div className="flex gap-1.5">
          {GYPSY_SCALES.map(key => (
            <div key={key} className="flex-1">
              <button onClick={() => onChange(key)} className={scaleButtonClass(key, value === key)}>
                {gridLabel(key)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ScaleSelector({ value, onChange }: ScaleSelectorProps) {
  const isFree = value === 'free'
  const [tab, setTab] = useState<SelectorTab>(() => deriveInitialTab(value))

  function handleScalesClick() {
    if (isFree) {
      onChange('d-major')
      setTab('common')
    }
  }

  const SUB_TABS: { id: SelectorTab; label: string }[] = [
    { id: 'common', label: 'Common' },
    { id: 'full',   label: 'Full Circle' },
    { id: 'special', label: 'Gypsy & ♩' },
  ]

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top toggle: Free Play vs Scales */}
      <div className="flex rounded-xl neu-inset p-1 gap-1">
        <button
          onClick={() => onChange('free')}
          className={[
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95 touch-none',
            isFree ? 'neu-pill-active text-[color:var(--neu-fg)]' : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
          ].join(' ')}
        >
          Free Play
        </button>
        <button
          onClick={handleScalesClick}
          className={[
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all active:scale-95 touch-none',
            !isFree ? 'neu-pill-active text-[color:var(--neu-fg)]' : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
          ].join(' ')}
        >
          Scales
        </button>
      </div>

      {/* Sub-tab bar + grid (only when Scales active) */}
      {!isFree && (
        <>
          <div className="flex rounded-lg neu-inset p-0.5 gap-0.5">
            {SUB_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all touch-none',
                  tab === t.id ? 'neu-pill-active text-[color:var(--neu-fg)]' : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'common'  && <CommonPanel  value={value} onChange={onChange} />}
          {tab === 'full'    && <FullCirclePanel value={value} onChange={onChange} />}
          {tab === 'special' && <SpecialPanel value={value} onChange={onChange} />}
        </>
      )}

      {/* Description — always shown */}
      <p className="text-xs text-gray-400 leading-snug h-8 overflow-hidden">
        {SCALES[value].description}
      </p>
    </div>
  )
}
