declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => void): void
  export function expect(actual: any): any
  export const beforeAll: any
  export const afterAll: any
}
