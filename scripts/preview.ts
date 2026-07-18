const dist = new URL('../dist/', import.meta.url)
const port = Number(process.env.PORT ?? 4173)

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = decodeURIComponent(url.pathname)
    const filePath = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = Bun.file(new URL(filePath, dist))

    if (await file.exists()) {
      return new Response(file)
    }

    if (req.mode !== 'navigate') {
      return new Response('Not found', { status: 404 })
    }

    return new Response(Bun.file(new URL('index.html', dist)), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  },
})

console.log(`Preview server listening on http://localhost:${port}`)
