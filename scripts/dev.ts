import { buildApp } from './buildApp'
import { watch } from 'node:fs'

const port = Number(process.env.PORT ?? 5151)
const outdir = './.bun-dev'
const devRoot = new URL('../.bun-dev/', import.meta.url)
const publicRoot = new URL('../public/', import.meta.url)

await buildApp({ outdir, minify: false, copyPublic: false })

let rebuildTimer: Timer | undefined
let rebuilding = false

function scheduleRebuild() {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(async () => {
    if (rebuilding) return scheduleRebuild()

    rebuilding = true
    try {
      await buildApp({ outdir, minify: false })
      console.log('Rebuilt app')
    } catch (error) {
      console.error(error)
    } finally {
      rebuilding = false
    }
  }, 100)
}

for (const path of ['index.html', 'src', 'packages', 'public']) {
  watch(path, { recursive: true }, scheduleRebuild)
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = decodeURIComponent(url.pathname)
    const filePath = pathname === '/' ? 'index.html' : pathname.slice(1)

    if (filePath.includes('..')) {
      return new Response('Not found', { status: 404 })
    }

    const file = Bun.file(new URL(filePath, devRoot))
    if (await file.exists()) {
      return new Response(file)
    }

    const publicFile = Bun.file(new URL(filePath, publicRoot))
    if (await publicFile.exists()) {
      return new Response(publicFile)
    }

    return new Response(Bun.file(new URL('index.html', devRoot)), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  },
})

console.log(`Dev server listening on ${server.url}`)
