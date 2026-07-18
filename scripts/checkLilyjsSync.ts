import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface UpstreamMetadata {
  repository: string
  tag: string | null
  commit: string
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lilyjsDir = process.env.LILYJS_DIR
  ? resolve(process.env.LILYJS_DIR)
  : resolve(repoRoot, '../lilyJS')
const metadataPath = resolve(repoRoot, 'packages/lilyjs/upstream.json')

function git(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(['git', '-C', cwd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = new TextDecoder().decode(result.stdout).trim()
  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim()
    throw new Error(stderr || `git ${args.join(' ')} failed`)
  }
  return stdout
}

function fail(message: string): never {
  console.error(`\nlilyJS pre-push check failed: ${message}\n`)
  process.exit(1)
}

try {
  if (!(await Bun.file(resolve(lilyjsDir, 'package.json')).exists())) {
    fail(`local lilyJS repository not found at ${lilyjsDir}`)
  }

  const tags = git(lilyjsDir, ['tag', '--list', 'v[0-9]*', '--sort=-version:refname'])
    .split('\n')
    .filter(Boolean)
  const latestTag = tags[0]
  if (!latestTag) fail(`no version tags found in ${lilyjsDir}`)

  const metadata = await Bun.file(metadataPath).json() as UpstreamMetadata
  const latestCommit = git(lilyjsDir, ['rev-list', '-n', '1', latestTag])

  if (metadata.tag !== latestTag || metadata.commit !== latestCommit) {
    fail([
      `Giusto records ${metadata.tag ?? 'no lilyJS tag'} (${metadata.commit || 'no commit'}),`,
      `but the latest local release is ${latestTag} (${latestCommit}).`,
      '',
      'Run in the Giusto repository:',
      '  bun run sync:lilyjs',
      '  bun test',
      '  bun run build',
      '  git add packages/lilyjs public/lilyjs',
      `  git commit -m "chore(vendor): sync lilyjs ${latestTag}"`,
    ].join('\n'))
  }

  const vendorStatus = git(repoRoot, [
    'status', '--porcelain', '--untracked-files=all', '--',
    'packages/lilyjs/lilyjs.esm.js',
    'packages/lilyjs/upstream.json',
    'public/lilyjs/fonts',
  ])
  if (vendorStatus) {
    fail(`the synchronized lilyJS files have uncommitted changes:\n${vendorStatus}`)
  }

  console.log(`lilyJS sync check passed: ${latestTag} (${latestCommit.slice(0, 8)})`)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
