export type AppTab = 'tuner' | 'practice' | 'progress' | 'guide'

interface TabBarProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export default function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="flex bg-white/12 backdrop-blur-xl border-t border-white/15 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={[
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors active:scale-95 touch-none border-t-2',
              active ? 'text-blue-400 border-blue-500' : 'text-gray-500 hover:text-gray-300 border-transparent',
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
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#60a5fa' : 'currentColor'} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PracticeIcon({ active }: { active: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#60a5fa' : 'currentColor'} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill={active ? '#60a5fa' : 'currentColor'} stroke="none" />
    </svg>
  )
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#60a5fa' : 'currentColor'} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function GuideIcon({ active }: { active: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#60a5fa' : 'currentColor'} strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.5} />
    </svg>
  )
}

const TABS: { id: AppTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'tuner', label: 'Tuner', Icon: TunerIcon },
  { id: 'practice', label: 'Practice', Icon: PracticeIcon },
  { id: 'progress', label: 'Progress', Icon: ProgressIcon },
  { id: 'guide', label: 'Guide', Icon: GuideIcon },
]
