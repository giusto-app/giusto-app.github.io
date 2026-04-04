export type AppTab = 'tuner' | 'drone' | 'practice' | 'learn' | 'progress' | 'guide' | 'settings'

interface TabBarProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export default function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="neu-surface rounded-none flex items-stretch pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={[
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors active:scale-95 touch-none border-t-2',
              active ? 'text-[color:var(--neu-fg)] border-[color:var(--neu-fg)] opacity-100' : 'text-[color:var(--neu-fg2)] hover:text-[color:var(--neu-fg)] border-transparent',
            ].join(' ')}
          >
            <Icon active={active} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function TunerIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function DroneIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill={active ? 'currentColor' : 'none'} />
      <circle cx="18" cy="16" r="3" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function PracticeIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'} />
    </svg>
  )
}

function LearnIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
    </svg>
  )
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" strokeWidth={active ? 2.5 : 1.8} />
      <line x1="12" y1="20" x2="12" y2="4" strokeWidth={active ? 2.5 : 1.8} />
      <line x1="6" y1="20" x2="6" y2="14" strokeWidth={active ? 2.5 : 1.8} />
    </svg>
  )
}

function GuideIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.5} />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const TABS: { id: AppTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'tuner',    label: 'Tuner',    Icon: TunerIcon },
  { id: 'drone',    label: 'Drone',    Icon: DroneIcon },
  { id: 'practice', label: 'Practice', Icon: PracticeIcon },
  { id: 'learn',    label: 'Learn',    Icon: LearnIcon },
  { id: 'progress', label: 'Progress', Icon: ProgressIcon },
  { id: 'guide',    label: 'Guide',    Icon: GuideIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]
