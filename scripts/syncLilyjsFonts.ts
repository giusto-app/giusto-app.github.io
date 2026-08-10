// Copy lilyJS's music/text fonts out of the installed package into public/.
//
// These used to be copied from a SIBLING CHECKOUT by scripts/sync-lilyjs.sh,
// which is why updating lilyJS needed a local clone of it. Now they come from
// node_modules, so the fonts can never be a different version from the bundle
// that expects them — a skew the vendored setup could not detect.
//
// Only the faces the app actually serves are copied; the package also ships
// Leipzig, Petaluma and PetalumaScript, which Giusto does not use.
import { mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const SRC = 'node_modules/lilyjs/dist/fonts'
const DEST = 'public/lilyjs/fonts'

const FACES = [
  'Bravura.woff2',
  'Academico.woff2',
  'TeXGyreSchola-Regular.woff2',
  'TeXGyreSchola-Bold.woff2',
  'TeXGyreSchola-Italic.woff2',
  'TeXGyreSchola-BoldItalic.woff2',
]

if (!existsSync(SRC)) {
  console.error(
    `${SRC} not found — is lilyjs installed? ` +
      'It is a private package on GitHub Packages; see .npmrc for the token setup.',
  )
  process.exit(1)
}

await mkdir(DEST, { recursive: true })
for (const face of FACES) {
  const from = `${SRC}/${face}`
  if (!existsSync(from)) {
    console.error(`${from} missing from the lilyjs package — did its font set change?`)
    process.exit(1)
  }
  await copyFile(from, `${DEST}/${face}`)
}
console.log(`Synced ${FACES.length} lilyJS fonts into ${DEST}/`)
