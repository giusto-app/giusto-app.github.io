// Bravura, the SMuFL music font StaffView draws its noteheads, clefs and
// accidentals with.
//
// Why this exists at all: nothing in the app used to load it. The font only
// appeared as a SIDE EFFECT of lilyjs rendering a score, and lilyjs does not
// export its loader — so a player who opened the app and went straight to the
// Learn tab never rendered a lilyjs score, never got the glyphs, and sat on
// StaffView's fallback ellipses while it polled for the font every 100 ms
// forever.
//
// Why not an @font-face in index.css: Bun's CSS bundler RESOLVES url() at build
// time, and the font is a public asset copied into place, not a module in the
// source tree — declaring it there fails the build outright. Registering the
// face from JS points at the runtime URL and sidesteps the bundler entirely.

/** Served from public/lilyjs/fonts — the same file lilyjs fetches for itself. */
const BRAVURA_URL = '/lilyjs/fonts/Bravura.woff2'
const FAMILY = 'Bravura'

let pending: Promise<boolean> | null = null

/**
 * Make Bravura available, once per page. Resolves true when the glyphs can be
 * drawn, false when they cannot — callers keep their fallback rather than
 * rendering tofu.
 *
 * Safe to call from several components: the work is memoised, and a face that
 * lilyjs already registered short-circuits without a second request.
 */
export function ensureMusicFont(): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  if (document.fonts.check(`1em ${FAMILY}`)) return Promise.resolve(true)
  if (pending) return pending

  if (typeof FontFace === 'undefined') return Promise.resolve(false)

  const face = new FontFace(FAMILY, `url(${BRAVURA_URL})`, { display: 'swap' })
  document.fonts.add(face)
  pending = face
    .load()
    .then(() => true)
    .catch(() => {
      // A missing or corrupt font is a cosmetic failure, not a broken app:
      // the caller falls back to plain ellipses and the notes still read.
      document.fonts.delete(face)
      return false
    })
    .finally(() => {
      pending = null
    })
  return pending
}
