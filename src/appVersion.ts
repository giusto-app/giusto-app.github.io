/**
 * The running build's version, for display.
 *
 * `__APP_VERSION__` is replaced at build time from package.json — see the
 * `define` in scripts/buildApp.ts.
 *
 * The `typeof` guard is not paranoia. A bare identifier that the bundler did
 * not replace throws a ReferenceError and takes down whatever page renders it:
 * a dev server started before the define existed keeps rebuilding without it,
 * and so would any bundling path that misses it. A cosmetic version label must
 * never be able to break a tab, so it degrades to "dev" instead.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
