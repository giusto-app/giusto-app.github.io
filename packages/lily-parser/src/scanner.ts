/**
 * Character-level scanner for LilyPond source text.
 * No regex used for music token recognition — pure character inspection.
 */

export type TokenKind =
  | 'note'        // note name + accidental: c cs cf d ds df e ef f fs g gs gf a as af b bf
  | 'rest'        // r or s (spacer)
  | 'tie'         // ~
  | 'barcheck'    // |
  | 'open'        // {
  | 'close'       // }
  | 'chord_open'  // <
  | 'chord_close' // >
  | 'slur_open'   // (
  | 'slur_close'  // )
  | 'command'     // \word
  | 'string'      // "..."
  | 'number'      // bare integer
  | 'slash'       // /
  | 'equals'      // =
  | 'word'        // bare identifier
  | 'markup_above' // ^ — markup/chord symbol above the note
  | 'markup_below' // _ — markup/chord symbol below the note
  | 'eof'

export interface Token {
  kind: TokenKind
  value: string
  pos: number
}

const NOTE_BASES = new Set(['c', 'd', 'e', 'f', 'g', 'a', 'b'])

function isDigit(ch: string): boolean { return ch >= '0' && ch <= '9' }
function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
}
function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch) || ch === '_'
}

export class Scanner {
  readonly src: string
  pos: number = 0

  constructor(src: string) { this.src = src }

  get done(): boolean { return this.pos >= this.src.length }

  peek(offset = 0): string { return this.src[this.pos + offset] ?? '' }

  advance(): string { return this.src[this.pos++] ?? '' }

  skipWhitespace(): void {
    while (!this.done && (this.peek() === ' ' || this.peek() === '\t' ||
           this.peek() === '\n' || this.peek() === '\r')) {
      this.advance()
    }
  }

  skipLineComment(): void {
    while (!this.done && this.peek() !== '\n') this.advance()
  }

  skipBlockComment(): void {
    // already consumed '%{'
    let depth = 1
    while (!this.done && depth > 0) {
      if (this.peek() === '%' && this.peek(1) === '{') { this.advance(); this.advance(); depth++ }
      else if (this.peek() === '%' && this.peek(1) === '}') { this.advance(); this.advance(); depth-- }
      else { this.advance() }
    }
  }

  readWhile(pred: (ch: string) => boolean): string {
    let s = ''
    while (!this.done && pred(this.peek())) s += this.advance()
    return s
  }

  readQuotedString(): string {
    let s = ''
    while (!this.done && this.peek() !== '"') {
      if (this.peek() === '\\') this.advance() // skip escape
      s += this.advance()
    }
    if (this.peek() === '"') this.advance()
    return s
  }

  nextToken(): Token {
    for (;;) {
      this.skipWhitespace()
      if (this.done) return { kind: 'eof', value: '', pos: this.pos }

      const start = this.pos
      const ch = this.peek()

      // Comments
      if (ch === '%') {
        if (this.peek(1) === '{') { this.advance(); this.advance(); this.skipBlockComment(); continue }
        this.advance(); this.skipLineComment(); continue
      }

      // Single-char structural tokens
      if (ch === '{') { this.advance(); return { kind: 'open',     value: '{', pos: start } }
      if (ch === '}') { this.advance(); return { kind: 'close',    value: '}', pos: start } }
      if (ch === '|') { this.advance(); return { kind: 'barcheck', value: '|', pos: start } }
      if (ch === '~') { this.advance(); return { kind: 'tie',      value: '~', pos: start } }
      if (ch === '=') { this.advance(); return { kind: 'equals',   value: '=', pos: start } }
      if (ch === '/') { this.advance(); return { kind: 'slash',    value: '/', pos: start } }

      // Chord and simultaneous delimiters
      if (ch === '<') {
        if (this.peek(1) === '<') { this.advance(); this.advance(); return { kind: 'open',        value: '<<', pos: start } }
        this.advance(); return { kind: 'chord_open',  value: '<', pos: start }
      }
      if (ch === '>') {
        if (this.peek(1) === '>') { this.advance(); this.advance(); return { kind: 'close',       value: '>>', pos: start } }
        this.advance(); return { kind: 'chord_close', value: '>', pos: start }
      }

      // Octave modifiers (standalone — normally consumed inside note token)
      if (ch === "'") { this.advance(); return { kind: 'note', value: `|'|`, pos: start } }

      // Quoted string
      if (ch === '"') { this.advance(); return { kind: 'string', value: this.readQuotedString(), pos: start } }

      // Backslash command
      if (ch === '\\') {
        this.advance()
        if (!this.done && this.peek() === '(') { this.advance(); return { kind: 'slur_open',  value: '\\(', pos: start } }
        if (!this.done && this.peek() === ')') { this.advance(); return { kind: 'slur_close', value: '\\)', pos: start } }
        if (this.done || !isAlpha(this.peek())) { continue }
        const name = this.readWhile(isAlphaNum)
        return { kind: 'command', value: name, pos: start }
      }

      // Numbers (consume trailing dots so "4." parses as dotted duration)
      if (isDigit(ch)) {
        const digits = this.readWhile(isDigit)
        const dots   = this.readWhile(c => c === '.')
        return { kind: 'number', value: digits + dots, pos: start }
      }

      // Note names (a-g), rests (r, s, R), or bare words
      if (isAlpha(ch)) {

        // ── Note base (a single lowercase a-g char) ─────────────────────────
        if (NOTE_BASES.has(ch)) {
          this.advance() // consume note base

          // Accidental: s/ss (sharp/double-sharp) or f/ff (flat/double-flat)
          // Rule: consume immediately following 's' or 'f' chars as accidental,
          // since there is no whitespace between the base and its accidental.
          let acc = ''
          const p1 = this.peek()
          if (p1 === 's') {
            this.advance(); acc = 's'
            if (this.peek() === 's') { this.advance(); acc = 'ss' }
          } else if (p1 === 'f') {
            // 'f' after a note base is ALWAYS a flat accidental (no whitespace = same token).
            // Two consecutive 'f's = double flat.
            this.advance(); acc = 'f'
            if (this.peek() === 'f') { this.advance(); acc = 'ff' }
          }
          const noteName = ch + acc

          // Octave modifiers: any run of ' and ,
          let octaveStr = ''
          while (this.peek() === "'" || this.peek() === ',') octaveStr += this.advance()

          // Duration: digits then dots (no ~ consumption — ~ is its own token)
          let durStr = ''
          if (isDigit(this.peek())) {
            durStr = this.readWhile(isDigit)
            durStr += this.readWhile(c => c === '.')
          }

          // Fingering: -N or _N suffix (e.g. a8-3, a-1, e8_2)
          // '-' = default/stem-side position; '_' = explicitly below (preserved as prefix)
          let fingeringStr = ''
          if ((this.peek() === '-' || this.peek() === '_') && isDigit(this.peek(1))) {
            const prefix = this.advance() // consume '-' or '_'
            const digits = this.readWhile(isDigit)
            fingeringStr = prefix === '_' ? `_${digits}` : digits
          }

          return { kind: 'note', value: `${noteName}|${octaveStr}|${durStr}|${fingeringStr}`, pos: start }
        }

        // ── Rest: r, s (spacer), R (multi-measure) ───────────────────────────
        if (ch === 'r' || ch === 's' || ch === 'R') {
          this.advance()
          let durStr = ''
          if (isDigit(this.peek())) {
            durStr = this.readWhile(isDigit)
            durStr += this.readWhile(c => c === '.')
          }
          // skip *N repetition count (e.g. R1*4)
          if (this.peek() === '*') { this.advance(); this.readWhile(isDigit) }
          return { kind: 'rest', value: durStr, pos: start }
        }

        // ── Bare word (identifier) ────────────────────────────────────────────
        const word = this.readWhile(isAlphaNum)

        return { kind: 'word', value: word, pos: start }
      }

      // Slur markers
      if (ch === '(') { this.advance(); return { kind: 'slur_open',  value: '(', pos: start } }
      if (ch === ')') { this.advance(); return { kind: 'slur_close', value: ')', pos: start } }

      // Markup prefix: ^ (above) and _ (below) — used for ^"chord" and _"text"
      if (ch === '^') { this.advance(); return { kind: 'markup_above', value: '^', pos: start } }
      if (ch === '_') {
        // '_' is also consumed inside note tokens for fingering (_N). Here it appears
        // standalone (not followed by a digit) — treat as markup_below.
        if (!isDigit(this.peek(1))) { this.advance(); return { kind: 'markup_below', value: '_', pos: start } }
      }

      // Everything else (articulation marks, etc.) — skip
      this.advance()
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    for (;;) {
      const t = this.nextToken()
      tokens.push(t)
      if (t.kind === 'eof') break
    }
    return tokens
  }
}
