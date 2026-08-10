declare module '*.css'
declare module '*.html'

/**
 * The app version, replaced at build time from package.json (see
 * scripts/buildApp.ts). Injected rather than imported so the number shown in
 * the UI cannot drift from the one npm/bun considers authoritative.
 */
declare const __APP_VERSION__: string
