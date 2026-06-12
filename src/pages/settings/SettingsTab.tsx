import TemperamentSelector from '../../components/TemperamentSelector'
import ConcertPitchSelector from '../../components/ConcertPitchSelector'
import WakeLockToggle from '../../components/WakeLockToggle'
import { useWakeLock } from '../../hooks/useWakeLock'
import { type TemperamentKey } from '../../utils/temperaments'
import { type ConcertPitchHz } from '../../utils/concertPitch'

interface SettingsTabProps {
  temperamentKey: TemperamentKey
  onTemperamentChange: (key: TemperamentKey) => void
  concertPitch: ConcertPitchHz
  onConcertPitchChange: (hz: ConcertPitchHz) => void
}

export default function SettingsTab({
  temperamentKey, onTemperamentChange, concertPitch, onConcertPitchChange,
}: SettingsTabProps) {
  const { active: wakeLockActive, toggle: wakeLockToggle, supported: wakeLockSupported } = useWakeLock()

  return (
    <div className="min-h-full overflow-y-auto px-4 md:px-10 py-6">
      <div className="max-w-sm md:max-w-md mx-auto flex flex-col gap-6">

        <header>
          <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--neu-fg2)]">
            Settings
          </h1>
        </header>

        {/* Temperament */}
        <section className="neu-surface rounded-2xl px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--neu-fg2)]">
            Temperament
          </p>
          <TemperamentSelector value={temperamentKey} onChange={onTemperamentChange} />
        </section>

        {/* Concert Pitch */}
        <section className="neu-surface rounded-2xl px-4 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--neu-fg2)]">
            Concert Pitch
          </p>
          <ConcertPitchSelector value={concertPitch} onChange={onConcertPitchChange} />
        </section>

        {/* Wake Lock */}
        {wakeLockSupported && (
          <section className="neu-surface rounded-2xl px-4 py-4">
            <WakeLockToggle active={wakeLockActive} toggle={wakeLockToggle} />
          </section>
        )}

      </div>
    </div>
  )
}
