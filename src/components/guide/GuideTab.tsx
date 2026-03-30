// ── GuideTab — How to practice with Giusto ───────────────────────────────────
// Content is grounded in peer-reviewed research and the consensus of major
// violin pedagogues (Galamian, Flesch, Fischer, Suzuki, Rolland).

export default function GuideTab() {
  return (
    <div className="min-h-full overflow-y-auto px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 mb-1">
          Guide
        </h1>
        <p className="text-gray-500 text-sm">
          How to improve your intonation — backed by research.
        </p>
      </header>

      <div className="flex flex-col gap-6">

        {/* Recommended workflow */}
        <Section title="Recommended Practice Workflow">
          <p className="text-gray-400 text-sm mb-3">
            Violin pedagogy research (Galamian, Fischer, Zabanal 2019) points to a consistent sequence:
          </p>
          <ol className="flex flex-col gap-2">
            <Step n={1} title="Warm up — Tuner tab">
              Play long tones on each open string. Watch the meter. This calibrates your ear before technical work begins.
            </Step>
            <Step n={2} title="Drone practice — coming soon">
              Set a drone on your scale's tonic and play scales above it, listening for acoustic beating. Peer-reviewed research (Zabanal 2019) showed measurable improvement from even short-term drone practice.
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

        {/* Temperament guide */}
        <Section title="Which Temperament Should I Use?">
          <p className="text-gray-400 text-sm mb-3">
            No single temperament is correct for all situations. Great string players switch contextually.
          </p>
          <div className="flex flex-col gap-2">
            <TemperamentCard
              name="Pythagorean"
              badge="Melodic"
              badgeColor="bg-blue-900/50 text-blue-300"
              description="Use for single-note scale work and melodic passages. Your open strings are already tuned in Pythagorean perfect fifths (3:2 ratio). This system raises leading tones slightly — the 'expressive' intonation you hear from great soloists."
            />
            <TemperamentCard
              name="Just"
              badge="Chords & Double Stops"
              badgeColor="bg-emerald-900/50 text-emerald-300"
              description="Use when practicing double stops and sustained chords in chamber music. Pure thirds (5:4 ratio) and fifths (3:2) produce zero acoustic beating — the 'ringing' sound string quartets aim for. Note: a just major third is 14¢ lower than equal temperament."
            />
            <TemperamentCard
              name="Equal"
              badge="With Piano / Ensemble"
              badgeColor="bg-gray-700 text-gray-300"
              description="Use when practicing alongside piano or fixed-pitch instruments. Gives you a consistent reference across all 12 keys but none of the intervals are acoustically pure."
            />
            <TemperamentCard
              name="Meantone"
              badge="Baroque"
              badgeColor="bg-amber-900/50 text-amber-300"
              description="Use for Baroque repertoire (Bach, Telemann, Vivaldi). Quarter-comma meantone gives pure major thirds and was the standard keyboard tuning from ~1500–1800."
            />
          </div>
        </Section>

        {/* Sympathetic resonance */}
        <Section title="Listen for the Ring">
          <p className="text-gray-400 text-sm mb-3">
            The violin has a built-in feedback mechanism that no app can replace: <strong className="text-gray-200">sympathetic resonance</strong>. When a stopped note perfectly matches the pitch of an open string, that open string vibrates on its own, producing an audible bloom in the sound.
          </p>
          <p className="text-gray-400 text-sm mb-3">
            Teachers describe this resonant spot as "only the size of a pencil point" — training to find it consistently builds exceptional precision.
          </p>
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-3">Key resonance notes (violin)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { note: 'G3 / G4', rings: 'G string' },
                { note: 'D4 / D5', rings: 'D string' },
                { note: 'A4 / A5', rings: 'A string' },
                { note: 'E4 / E5', rings: 'E string' },
              ].map(({ note, rings }) => (
                <div key={note} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm text-gray-300 font-mono">{note}</span>
                  <span className="text-xs text-gray-600">→ {rings}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-2">
            When the Tuner shows 0¢ on one of these notes, stop and listen — you should hear the open string join in.
          </p>
        </Section>

        {/* Common problems */}
        <Section title="Common Intonation Problems">
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

        {/* Reading the results */}
        <Section title="Reading Your Practice Results">
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
          <p className="text-gray-600 text-xs mt-3">
            The cents value below each note head is your average deviation over the note's full duration. A −8¢ on F# means you're consistently playing it slightly flat — a hand-frame issue, not a random error.
          </p>
        </Section>

        {/* Research credits */}
        <div className="border-t border-gray-800 pt-4 mt-2">
          <p className="text-xs text-gray-700 text-center">
            Practice methodology based on research by Galamian, Flesch, Simon Fischer, Suzuki, and Paul Rolland, and peer-reviewed studies by Zabanal (2019) and Frontiers in Psychology (2019, 2021).
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-200 mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-200">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{children}</p>
      </div>
    </li>
  )
}

function TemperamentCard({
  name, badge, badgeColor, description,
}: {
  name: string; badge: string; badgeColor: string; description: string
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-200">{name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  )
}

function Problem({ title, fix }: { title: string; fix: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <p className="text-sm text-gray-300 mb-1">{title}</p>
      <p className="text-xs text-gray-500"><span className="text-emerald-600 font-medium">Fix: </span>{fix}</p>
    </div>
  )
}

function InfoRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className={`w-3 h-3 rounded-full ${color} shrink-0 mt-1`} />
      <div>
        <p className="text-sm font-medium text-gray-300">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  )
}
