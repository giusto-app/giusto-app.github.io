import tailwind from 'bun-plugin-tailwind'

export async function buildApp({
  outdir,
  minify,
  copyPublic = true,
}: {
  outdir: string
  minify: boolean
  copyPublic?: boolean
}) {
  await Bun.$`rm -rf ${outdir}`
  if (copyPublic) {
    await Bun.$`cp -R public/. ${outdir}`
  }

  // Single source of truth for the version shown in the UI: package.json.
  // Injected at build time rather than imported, so nothing can display a
  // number that disagrees with the manifest.
  const pkg = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as { version?: string }

  const result = await Bun.build({
    entrypoints: ['./index.html'],
    outdir,
    minify,
    define: { __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0') },
    // Required for the dynamic import in main.tsx to become its own chunk.
    // Without it Bun inlines dynamic imports, and the dev-only `?compare` page
    // rides along in the main bundle — 2.0 MB of 3.6 MB shipped to everyone.
    splitting: true,
    external: ['../../../generated/smufl/*'],
    plugins: [tailwind],
  })

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }
}
