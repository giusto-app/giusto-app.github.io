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

  const result = await Bun.build({
    entrypoints: ['./index.html'],
    outdir,
    minify,
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
