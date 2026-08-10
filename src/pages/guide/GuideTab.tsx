// ── GuideTab — How to practice with Giusto ───────────────────────────────────
// Content is grounded in peer-reviewed research and the consensus of major
// violin pedagogues (Galamian, Flesch, Fischer, Suzuki, Rolland).

import { APP_VERSION } from '../../appVersion'

export default function GuideTab() {
  return (
    <div className="min-h-full overflow-y-auto px-4 md:px-10 py-6">

      {/* Hero */}
      <div className="neu-surface rounded-2xl px-5 py-5 mb-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
            stroke="#60a5fa" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">Giusto</h1>
            {/* Worth showing: this is a PWA, so a stale service worker can leave
                someone on an old build, and "which version are you on?" is the
                first question when a bug report won't reproduce. */}
            <span className="text-xs text-gray-500 tabular-nums">v{APP_VERSION}</span>
          </div>
          <p className="text-sm text-gray-400">Practice & Intonation trainer for bowed string players</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">

        {/* Recommended workflow */}
        <Section title="Recommended Practice Workflow" icon={
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }>
          <p className="text-gray-300 text-sm mb-3">
            Violin pedagogy research (Galamian, Fischer, Zabanal 2019) points to a consistent sequence:
          </p>
          <ol className="flex flex-col gap-2">
            <Step n={1} title="Tune your instrument — Tuner tab">
              Play long tones on each open string. Watch the meter. This calibrates your ear before technical work begins.
            </Step>
            <Step n={2} title="Play a drone — Tuner or Practice tab">
              <ol className="list-decimal list-inside flex flex-col gap-1 mt-1">
                <li><strong className="text-gray-300">Start with open strings.</strong> Before touching the fingerboard, play each open string against the drone on the same pitch. Zero beating is your reference — memorize that sound.</li>
                <li><strong className="text-gray-300">Choose the right interval.</strong> Use <span className="font-mono text-gray-300">5th</span> to drone two open strings at once (e.g. D+A), like a teacher's drone bow. Use <span className="font-mono text-gray-300">·</span> (unison) for single-note scale work.</li>
                <li><strong className="text-gray-300">Hold each note until the beating stops.</strong> The faster the pulsing, the further you are from the pitch. Don't move on until it's steady.</li>
                <li><strong className="text-gray-300">Trust the ear, not the meter.</strong> The goal is to internalize the sound of in-tune so you eventually don't need the app at all.</li>
              </ol>
              <p className="mt-1.5">In the Practice tab the drone tonic is set automatically when you select a scale.</p>
            </Step>
            <Step n={3} title="Record a scale — Practice tab">
              Select your scale, set a duration (30s or 60s for a full scale), and record. Play slowly — speed is the enemy of accurate intonation formation.
            </Step>
            <Step n={4} title="Study the results">
              Look at the staff and the note table. Which notes are consistently amber or red? Those are your targets for the next session.
            </Step>
            <Step n={5} title="Track over time — Progress tab">
              Save every session. The bar chart shows your trend. Look for which notes improve and which stay stubbornly flat or sharp.
            </Step>
          </ol>
        </Section>

        <Divider />

        {/* Temperament guide */}
        <Section title="Which Temperament Should I Use?" icon={
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        }>
          <p className="text-gray-300 text-sm mb-3">
            No single temperament is correct for all situations. Great string players switch contextually.
          </p>
          <div className="flex flex-col gap-2">
            <TemperamentCard
              name="Pythagorean"
              badge="Melodic"
              borderColor="border-blue-500/60"
              description="Use for single-note scale work and melodic passages. Your open strings are already tuned in Pythagorean perfect fifths (3:2 ratio). This system raises leading tones slightly — the 'expressive' intonation you hear from great soloists."
            />
            <TemperamentCard
              name="Just"
              badge="Chords & Double Stops"
              borderColor="border-teal-500/60"
              description="Use when practicing double stops and sustained chords in chamber music. Pure thirds (5:4 ratio) and fifths (3:2) produce zero acoustic beating — the 'ringing' sound string quartets aim for. Note: a just major third is 14¢ lower than equal temperament."
            />
            <TemperamentCard
              name="Equal"
              badge="With Piano / Ensemble"
              borderColor="border-gray-500/60"
              description="Use when practicing alongside piano or fixed-pitch instruments. Gives you a consistent reference across all 12 keys but none of the intervals are acoustically pure."
            />
            <TemperamentCard
              name="Meantone"
              badge="Baroque"
              borderColor="border-amber-500/60"
              description="Use for Baroque repertoire (Bach, Telemann, Vivaldi). Quarter-comma meantone gives pure major thirds and was the standard keyboard tuning from ~1500–1800."
            />
          </div>
        </Section>

        <Divider />

        {/* Sympathetic resonance */}
        <Section title="Listen for the Ring" icon={
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M6.3 6.3a8 8 0 0 0 0 11.4" />
            <path d="M17.7 6.3a8 8 0 0 1 0 11.4" />
            <path d="M3.5 3.5a14 14 0 0 0 0 17" />
            <path d="M20.5 3.5a14 14 0 0 1 0 17" />
          </svg>
        }>
          <p className="text-gray-300 text-sm mb-3">
            The violin has a built-in feedback mechanism that no app can replace: <strong className="text-gray-200">sympathetic resonance</strong>. When a stopped note perfectly matches the pitch of an open string, that open string vibrates on its own, producing an audible bloom in the sound.
          </p>
          <p className="text-gray-300 text-sm mb-3">
            Teachers describe this resonant spot as "only the size of a pencil point" — training to find it consistently builds exceptional precision.
          </p>
          <div className="bg-amber-900/15 border border-amber-700/25 rounded-xl p-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-amber-400/70 mb-3">Key resonance notes (violin)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { note: 'G3 / G4', rings: 'G string' },
                { note: 'D4 / D5', rings: 'D string' },
                { note: 'A4 / A5', rings: 'A string' },
                { note: 'E4 / E5', rings: 'E string' },
              ].map(({ note, rings }) => (
                <div key={note} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60 shrink-0" />
                  <span className="text-sm text-gray-300 font-mono">{note}</span>
                  <span className="text-xs text-gray-500">→ {rings}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            When the Tuner shows 0¢ on one of these notes, stop and listen — you should hear the open string join in.
          </p>
        </Section>

        <Divider />

        {/* Common problems */}
        <Section title="Common Intonation Problems" icon={
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }>
          <div className="flex flex-col gap-2">
            <Problem
              title="The note is always in the same direction (always sharp or always flat)"
              fix="This is a hand frame issue. Your finger spacing is consistent but shifted. Check your thumb position and left-hand geometry in a mirror."
            />
            <Problem
              title="Notes are fine on one string but drift on another"
              fix="Check for tension in your left shoulder and upper arm. A stiff shoulder changes how the hand sits across strings. Rolland's approach: balance the arm naturally, don't grip."
            />
            <Problem
              title="Intonation is fine slowly but falls apart at tempo"
              fix="Speed before accuracy forms muscle memory of the wrong position. Practice at the speed where every note is conscious. Fischer: isolate the problematic interval and drill it in slow motion first."
            />
            <Problem
              title="Shifting lands off"
              fix="Use a guide finger — keep one finger lightly on the string as you shift, so there's a tactile bridge between positions. Sing the destination note in your head before shifting."
            />
            <Problem
              title="Double stops sound 'off' even when single notes are in tune"
              fix="Switch to Just temperament and listen for beating. A pure major third requires lowering the upper note by ~14¢ from equal. The ear tunes double stops harmonically, not melodically."
            />
          </div>
        </Section>

        <Divider />

        {/* Reading the results */}
        <Section title="Reading Your Practice Results" icon={
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        }>
          <div className="flex flex-col gap-3">
            <InfoRow
              color="bg-emerald-500"
              label="Green note head (0–10¢)"
              desc="In tune. The note is within the Just Noticeable Difference range for trained ears (~5–6¢)."
            />
            <InfoRow
              color="bg-amber-500"
              label="Amber note head (10–25¢)"
              desc="Close. Perceptible to most listeners. A few sessions of focused slow practice should fix this."
            />
            <InfoRow
              color="bg-red-500"
              label="Red note head (>25¢)"
              desc="Out of tune. Audible to everyone. This note needs isolation and slow drill — don't practice it fast until it's green slowly."
            />
          </div>
          <p className="text-gray-500 text-xs mt-3">
            The cents value below each note head is your average deviation over the note's full duration. A −8¢ on F# means you're consistently playing it slightly flat — a hand-frame issue, not a random error.
          </p>
        </Section>

        <Divider />

        {/* About */}
        <div className="neu-surface rounded-2xl px-5 py-5 flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">About</p>
          <p className="text-sm text-gray-300">
            Real-time intonation trainer for violin and bowed string players, built on the Web Audio API and the McLeod pitch detection algorithm.
          </p>
          <p className="text-sm text-gray-400">
            Made by <span className="text-white font-medium">Marc Mouriès</span>
          </p>
          <div className="text-xs text-gray-600 mt-2 flex flex-col gap-1">
            <p>Practice methodology based on:</p>
            <ul className="flex flex-col gap-0.5 pl-2">
              <li><RefLink href="https://en.wikipedia.org/wiki/Ivan_Galamian">Galamian — Principles of Violin Playing and Teaching</RefLink></li>
              <li><RefLink href="https://en.wikipedia.org/wiki/Carl_Flesch">Flesch — The Art of Violin Playing / Scale System</RefLink></li>
              <li><RefLink href="https://www.simonfischeronline.com/store/p3/BASICS.html">Simon Fischer — Basics (Peters Edition)</RefLink></li>
              <li><RefLink href="https://en.wikipedia.org/wiki/Paul_Rolland">Paul Rolland — The Teaching of Action in String Playing</RefLink></li>
              <li><RefLink href="https://journals.sagepub.com/doi/10.1177/1948499219851407">Zabanal (2019) — Effects of Drone Practice on Violin/Viola Intonation</RefLink></li>
              <li><RefLink href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00627/full">Pardue &amp; McPherson (2019) — Real-Time Feedback for Violin Intonation</RefLink></li>
              <li><RefLink href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.684693/full">Blanco et al. (2021) — Visual and Auditory Feedback in Pitch Matching</RefLink></li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <hr style={{ borderColor: 'var(--neu-sh)' }} />
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {icon && (
          <span className="text-blue-400 shrink-0">{icon}</span>
        )}
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="text-xs text-gray-400 mt-0.5">{children}</div>
      </div>
    </li>
  )
}

function TemperamentCard({
  name, badge, borderColor, description,
}: {
  name: string; badge: string; borderColor: string; description: string
}) {
  return (
    <div className={`neu-surface rounded-xl p-3 pl-4 flex flex-col gap-1.5 border-l-2 ${borderColor}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[color:var(--neu-fg)]">{name}</span>
        <span className="neu-inset text-xs px-2 py-0.5 rounded-full font-medium text-[color:var(--neu-fg2)]">{badge}</span>
      </div>
      <p className="text-xs text-[color:var(--neu-fg2)]">{description}</p>
    </div>
  )
}

function Problem({ title, fix }: { title: string; fix: string }) {
  return (
    <div className="neu-surface rounded-xl p-3 pl-4 border-l-2 border-red-500/40">
      <p className="text-sm text-gray-300 mb-1">{title}</p>
      <p className="text-xs text-gray-400"><span className="text-blue-500 font-medium">Fix: </span>{fix}</p>
    </div>
  )
}

function RefLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-blue-400/70 hover:text-blue-300 transition-colors underline underline-offset-2">
      {children}
    </a>
  )
}

function InfoRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className={`w-3 h-3 rounded-full ${color} shrink-0 mt-1`} />
      <div>
        <p className="text-sm font-medium text-gray-300">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  )
}
