// src/debug/lilyLog.ts
var CHANNELS = {
  "parser.scanning": { prefix: "[lily-Parser]", label: "scanning" },
  "parser.parse": { prefix: "[lily-Parser]", label: "parse" },
  "viewer.rendering": { prefix: "[lily-viewer]", label: "rendering" },
  "viewer.selection": { prefix: "[lily-viewer]", label: "selection" },
  "editor.selection": { prefix: "[lily-editor]", label: "selected" }
};
var LILY_LOG_CHANNELS = Object.keys(CHANNELS);
var DEFAULT_ENABLED = {
  "parser.scanning": false,
  "parser.parse": false,
  "viewer.rendering": false,
  "viewer.selection": false,
  "editor.selection": false
};
function isBrowser() {
  return typeof window !== "undefined";
}
function readStoredConfig() {
  if (!isBrowser())
    return {};
  try {
    const ls = window.localStorage;
    if (!ls)
      return {};
    const raw = ls.getItem("lily-log");
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      return {};
    return parsed;
  } catch {
    return {};
  }
}
var cachedStored = {};
var cachedMerged = { ...DEFAULT_ENABLED };
function recomputeCachedMerged() {
  const merged = { ...DEFAULT_ENABLED };
  for (const key of Object.keys(cachedStored)) {
    if (cachedStored[key] != null)
      merged[key] = Boolean(cachedStored[key]);
  }
  cachedMerged = merged;
}
function loadStoredIntoCache() {
  cachedStored = readStoredConfig();
  recomputeCachedMerged();
}
loadStoredIntoCache();
if (isBrowser()) {
  window.addEventListener("storage", (e) => {
    if (e.key === "lily-log")
      loadStoredIntoCache();
  });
}
function isLilyLogEnabled(channel) {
  const runtime = isBrowser() ? window.__LILY_LOG__ : undefined;
  const override = runtime?.[channel];
  if (override != null)
    return Boolean(override);
  return cachedMerged[channel];
}
function lilyLog(channel, ...args) {
  if (!isLilyLogEnabled(channel))
    return;
  const spec = CHANNELS[channel];
  console.log(`${spec.prefix} ${spec.label}:`, ...args);
}

// src/music-input/lilypond/scanner.ts
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}
function isAlpha(ch) {
  return ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z";
}
function isAlphaNum(ch) {
  return isAlpha(ch) || isDigit(ch) || ch === "_" || ch === "-";
}
function isCommandChar(ch) {
  return isAlpha(ch) || isDigit(ch) || ch === "-" || ch === "_";
}
var SUPPORTED_LY_LANGUAGES = [
  "english",
  "italiano",
  "francais",
  "espanol",
  "portugues",
  "nederlands",
  "deutsch"
];
function normalizeLyLanguage(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "français")
    return "francais";
  if (normalized === "español")
    return "espanol";
  if (normalized === "português")
    return "portugues";
  return SUPPORTED_LY_LANGUAGES.includes(normalized) ? normalized : undefined;
}
function parseAccEnglish(src, pos) {
  const a = src[pos] ?? "";
  const b = src[pos + 1] ?? "";
  if (a === "s")
    return b === "s" ? { acc: "ss", consumed: 2 } : { acc: "s", consumed: 1 };
  if (a === "f")
    return b === "f" ? { acc: "ff", consumed: 2 } : { acc: "f", consumed: 1 };
  return { acc: "", consumed: 0 };
}
function parseAccIsEs(src, pos) {
  if (src.startsWith("isis", pos))
    return { acc: "ss", consumed: 4 };
  if (src.startsWith("eses", pos))
    return { acc: "ff", consumed: 4 };
  if (src.startsWith("is", pos))
    return { acc: "s", consumed: 2 };
  if (src.startsWith("es", pos))
    return { acc: "f", consumed: 2 };
  return { acc: "", consumed: 0 };
}
function parseAccDb(src, pos) {
  const a = src[pos] ?? "";
  const b = src[pos + 1] ?? "";
  if (a === "d")
    return b === "d" ? { acc: "ss", consumed: 2 } : { acc: "s", consumed: 1 };
  if (a === "b")
    return b === "b" ? { acc: "ff", consumed: 2 } : { acc: "f", consumed: 1 };
  return { acc: "", consumed: 0 };
}
function parseAccSb(src, pos) {
  const a = src[pos] ?? "";
  const b = src[pos + 1] ?? "";
  if (a === "s")
    return b === "s" ? { acc: "ss", consumed: 2 } : { acc: "s", consumed: 1 };
  if (a === "x")
    return { acc: "ss", consumed: 1 };
  if (a === "b")
    return b === "b" ? { acc: "ff", consumed: 2 } : { acc: "f", consumed: 1 };
  return { acc: "", consumed: 0 };
}
function parseSymbolAccidental(src, pos, opts) {
  const a = src[pos] ?? "";
  if (a === "♮")
    return { acc: "", consumed: 1 };
  if (a === "#" || a === "♯") {
    let consumed = 0;
    while (src[pos + consumed] === "#" || src[pos + consumed] === "♯")
      consumed++;
    return { acc: consumed >= 2 ? "ss" : "s", consumed };
  }
  if (a === "♭" || opts.allowAsciiFlat && a === "b") {
    let consumed = 0;
    while (src[pos + consumed] === "♭" || opts.allowAsciiFlat && src[pos + consumed] === "b")
      consumed++;
    return { acc: consumed >= 2 ? "ff" : "f", consumed };
  }
  return { acc: "", consumed: 0 };
}
var LATIN_BASES = [
  { name: "sol", base: "g" },
  { name: "do", base: "c" },
  { name: "re", base: "d" },
  { name: "mi", base: "e" },
  { name: "fa", base: "f" },
  { name: "la", base: "a" },
  { name: "si", base: "b" }
];
var LANGUAGE_SPECS = {
  english: {
    bases: [
      { name: "c", base: "c" },
      { name: "d", base: "d" },
      { name: "e", base: "e" },
      { name: "f", base: "f" },
      { name: "g", base: "g" },
      { name: "a", base: "a" },
      { name: "b", base: "b" }
    ],
    parseAccidental: parseAccEnglish
  },
  nederlands: {
    bases: [
      { name: "c", base: "c" },
      { name: "d", base: "d" },
      { name: "e", base: "e" },
      { name: "f", base: "f" },
      { name: "g", base: "g" },
      { name: "a", base: "a" },
      { name: "b", base: "b" }
    ],
    parseAccidental: parseAccIsEs
  },
  deutsch: {
    bases: [
      { name: "h", base: "b" },
      { name: "b", base: "b", implicitAcc: "f" },
      { name: "c", base: "c" },
      { name: "d", base: "d" },
      { name: "e", base: "e" },
      { name: "f", base: "f" },
      { name: "g", base: "g" },
      { name: "a", base: "a" }
    ],
    parseAccidental: parseAccIsEs
  },
  italiano: {
    bases: LATIN_BASES,
    parseAccidental: parseAccDb
  },
  francais: {
    bases: [
      { name: "sol", base: "g" },
      { name: "do", base: "c" },
      { name: "ré", base: "d" },
      { name: "re", base: "d" },
      { name: "mi", base: "e" },
      { name: "fa", base: "f" },
      { name: "la", base: "a" },
      { name: "si", base: "b" }
    ],
    parseAccidental: parseAccDb
  },
  espanol: {
    bases: LATIN_BASES,
    parseAccidental: parseAccSb
  },
  portugues: {
    bases: LATIN_BASES,
    parseAccidental: parseAccSb
  }
};

class Scanner {
  src;
  language;
  pos = 0;
  offset;
  _pending = null;
  _expectLanguageString = false;
  constructor(src, opts) {
    this.src = src;
    this.language = opts?.language ?? "english";
    this.offset = opts?.offset ?? 0;
  }
  get done() {
    return this.pos >= this.src.length;
  }
  peek(offset = 0) {
    return this.src[this.pos + offset] ?? "";
  }
  advance() {
    return this.src[this.pos++] ?? "";
  }
  skipWhitespace() {
    while (!this.done && (this.peek() === " " || this.peek() === "\t" || this.peek() === `
` || this.peek() === "\r")) {
      this.advance();
    }
  }
  skipLineComment() {
    while (!this.done && this.peek() !== `
`)
      this.advance();
  }
  skipBlockComment() {
    let depth = 1;
    while (!this.done && depth > 0) {
      if (this.peek() === "%" && this.peek(1) === "{") {
        this.advance();
        this.advance();
        depth++;
      } else if (this.peek() === "%" && this.peek(1) === "}") {
        this.advance();
        this.advance();
        depth--;
      } else {
        this.advance();
      }
    }
  }
  readWhile(pred) {
    let s = "";
    while (!this.done && pred(this.peek()))
      s += this.advance();
    return s;
  }
  readQuotedString() {
    let s = "";
    const startPos = this.pos - 1;
    let unclosed = false;
    while (!this.done && this.peek() !== '"') {
      if (this.peek() === "\\" && this.peek(1) === '"') {
        this.advance();
        s += this.advance();
        continue;
      }
      const ch = this.peek();
      if (ch === `
` || ch === "\r") {
        const before = this.src.substring(Math.max(0, startPos - 100), startPos);
        const inHeaderOrPaper = /\\(?:header|paper)\s*\{[^}]*$/.test(before);
        if (inHeaderOrPaper) {
          unclosed = true;
          break;
        }
      }
      s += this.advance();
    }
    if (this.peek() === '"') {
      this.advance();
    } else if (!unclosed) {
      unclosed = true;
    }
    return { value: s, unclosed };
  }
  readSchemeBlockToken(start) {
    this.advance();
    if (this.peek() === "'")
      this.advance();
    if (this.peek() !== "(") {
      return { kind: "scheme_block", value: this.src.slice(start, this.pos), pos: start, end: this.pos };
    }
    this.advance();
    let depth = 1;
    while (!this.done && depth > 0) {
      if (this.peek() === '"') {
        this.advance();
        this.readQuotedString();
        continue;
      }
      if (this.peek() === "%" && this.peek(1) === "{") {
        this.advance();
        this.advance();
        this.skipBlockComment();
        continue;
      }
      if (this.peek() === "%") {
        this.advance();
        this.skipLineComment();
        continue;
      }
      if (this.peek() === "#" && this.peek(1) === "{") {
        this.readEmbeddedLilyBlock();
        continue;
      }
      const ch = this.advance();
      if (ch === "(")
        depth++;
      else if (ch === ")")
        depth--;
    }
    return { kind: "scheme_block", value: this.src.slice(start, this.pos), pos: start, end: this.pos };
  }
  readEmbeddedLilyBlock() {
    this.advance();
    this.advance();
    let depth = 1;
    while (!this.done && depth > 0) {
      if (this.peek() === '"') {
        this.advance();
        this.readQuotedString();
        continue;
      }
      if (this.peek() === "%" && this.peek(1) === "{") {
        this.advance();
        this.advance();
        this.skipBlockComment();
        continue;
      }
      if (this.peek() === "%") {
        this.advance();
        this.skipLineComment();
        continue;
      }
      if (this.peek() === "#" && this.peek(1) === "{") {
        this.advance();
        this.advance();
        depth++;
        continue;
      }
      if (this.peek() === "#" && this.peek(1) === "}") {
        this.advance();
        this.advance();
        depth--;
        continue;
      }
      this.advance();
    }
  }
  nextToken() {
    if (this._pending) {
      const t = this._pending;
      this._pending = null;
      return t;
    }
    for (;; ) {
      this.skipWhitespace();
      if (this.done)
        return { kind: "eof", value: "", pos: this.pos, end: this.pos };
      const start = this.pos;
      const ch = this.peek();
      if (ch === "%") {
        if (this.peek(1) === "{") {
          this.advance();
          this.advance();
          this.skipBlockComment();
          continue;
        }
        this.advance();
        this.skipLineComment();
        continue;
      }
      if (ch === "{") {
        this.advance();
        return { kind: "open", value: "{", pos: start, end: this.pos };
      }
      if (ch === "}") {
        this.advance();
        return { kind: "close", value: "}", pos: start, end: this.pos };
      }
      if (ch === "|") {
        this.advance();
        return { kind: "barcheck", value: "|", pos: start, end: this.pos };
      }
      if (ch === "~") {
        this.advance();
        return { kind: "tie", value: "~", pos: start, end: this.pos };
      }
      if (ch === "=") {
        this.advance();
        return { kind: "equals", value: "=", pos: start, end: this.pos };
      }
      if (ch === "/") {
        this.advance();
        return { kind: "slash", value: "/", pos: start, end: this.pos };
      }
      if (ch === "-" && this.peek(1) === "-") {
        this.advance();
        this.advance();
        return { kind: "lyric_hyphen", value: "--", pos: start, end: this.pos };
      }
      if (ch === "_" && this.peek(1) === "_") {
        this.advance();
        this.advance();
        return { kind: "lyric_extender", value: "__", pos: start, end: this.pos };
      }
      if ((ch === "-" || ch === "_" || ch === "^") && isDigit(this.peek(1) ?? "")) {
        const prefix = ch;
        this.advance();
        const digits = this.readWhile(isDigit);
        const value = prefix === "-" ? digits : `${prefix}${digits}`;
        return { kind: "fingering", value, pos: start, end: this.pos };
      }
      if (ch === "<") {
        if (this.peek(1) === "<") {
          this.advance();
          this.advance();
          return { kind: "open", value: "<<", pos: start, end: this.pos };
        }
        this.advance();
        return { kind: "chord_open", value: "<", pos: start, end: this.pos };
      }
      if (ch === ">") {
        if (this.peek(1) === ">") {
          this.advance();
          this.advance();
          return { kind: "close", value: ">>", pos: start, end: this.pos };
        }
        this.advance();
        return { kind: "chord_close", value: ">", pos: start, end: this.pos };
      }
      if (ch === "'") {
        this.advance();
        continue;
      }
      if (ch === '"') {
        this.advance();
        const result = this.readQuotedString();
        if (this._expectLanguageString) {
          this._expectLanguageString = false;
          const nextLanguage = normalizeLyLanguage(result.value);
          if (nextLanguage)
            this.language = nextLanguage;
        }
        return {
          kind: "string",
          value: result.value,
          pos: start,
          end: this.pos,
          ...result.unclosed ? { unclosed: true } : {}
        };
      }
      if (ch === "\\") {
        this.advance();
        if (!this.done && this.peek() === "(") {
          this.advance();
          return { kind: "slur_open", value: "\\(", pos: start, end: this.pos };
        }
        if (!this.done && this.peek() === ")") {
          this.advance();
          return { kind: "slur_close", value: "\\)", pos: start, end: this.pos };
        }
        if (!this.done && this.peek() === "<") {
          this.advance();
          return { kind: "command", value: "hairpinCresc", pos: start, end: this.pos };
        }
        if (!this.done && this.peek() === ">") {
          this.advance();
          return { kind: "command", value: "hairpinDecresc", pos: start, end: this.pos };
        }
        if (!this.done && this.peek() === "!") {
          this.advance();
          return { kind: "command", value: "hairpinStop", pos: start, end: this.pos };
        }
        if (this.done || !isAlpha(this.peek())) {
          continue;
        }
        const name = this.readWhile(isCommandChar);
        if (name === "language")
          this._expectLanguageString = true;
        return { kind: "command", value: name, pos: start, end: this.pos };
      }
      if (isDigit(ch)) {
        const digits = this.readWhile(isDigit);
        if (this.peek() === "." && isDigit(this.peek(1) ?? "")) {
          this.advance();
          const frac = this.readWhile(isDigit);
          return { kind: "number", value: `${digits}.${frac}`, pos: start, end: this.pos };
        }
        const dots = this.readWhile((c) => c === ".");
        return { kind: "number", value: digits + dots, pos: start, end: this.pos };
      }
      if (isAlpha(ch)) {
        const spec = LANGUAGE_SPECS[this.language];
        const lower = this.src.toLowerCase();
        for (const baseSpec of spec.bases) {
          if (!lower.startsWith(baseSpec.name, start))
            continue;
          let p = start + baseSpec.name.length;
          const { acc: parsedAcc, consumed } = spec.parseAccidental(lower, p);
          p += consumed;
          let acc = parsedAcc;
          if (!acc && baseSpec.implicitAcc)
            acc = baseSpec.implicitAcc;
          if (!acc) {
            const rawBase = this.src[start] ?? "";
            const isUpperLetterNote = rawBase >= "A" && rawBase <= "G";
            const symbolAcc = parseSymbolAccidental(this.src, p, { allowAsciiFlat: isUpperLetterNote });
            acc = symbolAcc.acc;
            p += symbolAcc.consumed;
          }
          let octaveStr = "";
          while (lower[p] === "'" || lower[p] === ",") {
            octaveStr += lower[p];
            p++;
          }
          let durStr = "";
          if (isDigit(lower[p] ?? "")) {
            while (isDigit(lower[p] ?? "")) {
              durStr += lower[p];
              p++;
            }
            while ((lower[p] ?? "") === ".") {
              durStr += lower[p];
              p++;
            }
          }
          let fingeringStr = "";
          if (((lower[p] ?? "") === "-" || (lower[p] ?? "") === "_" || (lower[p] ?? "") === "^") && isDigit(lower[p + 1] ?? "")) {
            const prefix = lower[p];
            p++;
            let digits = "";
            while (isDigit(lower[p] ?? "")) {
              digits += lower[p];
              p++;
            }
            fingeringStr = prefix === "_" ? `_${digits}` : prefix === "^" ? `^${digits}` : digits;
          }
          const nextCh = lower[p] ?? "";
          if (isAlpha(nextCh) || isDigit(nextCh) || nextCh === "_" && isAlpha(lower[p + 1] ?? "")) {
            continue;
          }
          this.pos = p;
          const noteName = baseSpec.base + acc;
          return { kind: "note", value: `${noteName}|${octaveStr}|${durStr}|${fingeringStr}`, pos: start, end: this.pos };
        }
        if ((ch === "r" || ch === "s" || ch === "R") && !isAlpha(this.peek(1))) {
          this.advance();
          let durStr = "";
          if (isDigit(this.peek())) {
            durStr = this.readWhile(isDigit);
            durStr += this.readWhile((c) => c === ".");
          }
          let repeatSuffix = "";
          if (this.peek() === "*") {
            this.advance();
            const n = this.readWhile(isDigit);
            if (ch === "R" && n)
              repeatSuffix = "*" + n;
          }
          return { kind: "rest", value: durStr + repeatSuffix, pos: start, end: this.pos, restKind: ch };
        }
        const word = this.readWhile(isAlphaNum);
        return { kind: "word", value: word, pos: start, end: this.pos };
      }
      if (ch === "(") {
        this.advance();
        return { kind: "slur_open", value: "(", pos: start, end: this.pos };
      }
      if (ch === ")") {
        this.advance();
        return { kind: "slur_close", value: ")", pos: start, end: this.pos };
      }
      if (ch === "[") {
        this.advance();
        return { kind: "beam_open", value: "[", pos: start, end: this.pos };
      }
      if (ch === "]") {
        this.advance();
        return { kind: "beam_close", value: "]", pos: start, end: this.pos };
      }
      if (ch === "^") {
        this.advance();
        return { kind: "markup_above", value: "^", pos: start, end: this.pos };
      }
      if (ch === "_") {
        if (!isDigit(this.peek(1))) {
          this.advance();
          return { kind: "markup_below", value: "_", pos: start, end: this.pos };
        }
      }
      if (ch === "#") {
        if (this.peek(1) === "(" || this.peek(1) === "'" && this.peek(2) === "(") {
          return this.readSchemeBlockToken(start);
        }
        this.advance();
        if (!this.done && this.peek() === "#") {
          this.advance();
          const b = this.peek();
          if (b === "t" || b === "f") {
            this.advance();
            return { kind: "command", value: `#${b}`, pos: start, end: this.pos };
          }
          continue;
        }
        const negative = !this.done && this.peek() === "-";
        if (negative)
          this.advance();
        if (!this.done && isDigit(this.peek())) {
          const intPart = this.readWhile(isDigit);
          let fracPart = "";
          if (!this.done && this.peek() === "." && isDigit(this.peek(1) ?? "")) {
            this.advance();
            fracPart = "." + this.readWhile(isDigit);
          }
          const value = (negative ? "-" : "") + intPart + fracPart;
          return { kind: "number", value, pos: start, end: this.pos };
        }
        if (!this.done && isAlpha(this.peek())) {
          const symStart = this.pos;
          while (!this.done) {
            const c = this.peek();
            if (isAlphaNum(c) || c === ":") {
              this.advance();
              continue;
            }
            break;
          }
          const value = this.src.slice(symStart, this.pos);
          return { kind: "scheme_symbol", value, pos: start, end: this.pos };
        }
        continue;
      }
      this.advance();
    }
  }
  tokenize() {
    lilyLog("parser.scanning", { language: this.language, srcLen: this.src.length });
    const tokens = [];
    for (;; ) {
      const t = this.nextToken();
      tokens.push(t);
      if (t.kind === "eof")
        break;
    }
    if (this.offset > 0) {
      for (const t of tokens) {
        t.pos += this.offset;
        if (t.end !== undefined)
          t.end += this.offset;
      }
    }
    lilyLog("parser.scanning", { language: this.language, tokenCount: tokens.length });
    return tokens;
  }
}
// src/music-input/lilypond/lexer.ts
function tokenize(src, opts) {
  return new Scanner(src, {
    language: opts?.language ?? "english",
    offset: opts?.offset ?? 0
  }).tokenize();
}

// src/music-input/errors.ts
class ParseError extends Error {
  message;
  loc;
  severity;
  recoverable;
  suggestion;
  raw;
  constructor(opts) {
    super(opts.message);
    this.message = opts.message;
    this.loc = opts.loc;
    this.severity = opts.severity ?? "error";
    this.recoverable = opts.recoverable ?? true;
    this.suggestion = opts.suggestion;
    this.raw = opts.raw;
  }
  toString() {
    const pos = `line ${this.loc.line}, col ${this.loc.column}`;
    const sev = this.severity === "error" ? "Error" : "Warning";
    let s = `${sev} at ${pos}: ${this.message}`;
    if (this.suggestion)
      s += `
  Suggestion: ${this.suggestion}`;
    if (this.raw)
      s += `
  Near: "${this.raw.substring(0, 40)}${this.raw.length > 40 ? "..." : ""}"`;
    return s;
  }
  toBlock() {
    return {
      type: this.severity,
      message: this.message,
      range: { pos: this.loc.offset, end: this.loc.endOffset ?? this.loc.offset }
    };
  }
}

class ErrorCollection {
  errors = [];
  add(error) {
    this.errors.push(error);
  }
  getAll() {
    return this.errors;
  }
  getErrors() {
    return this.errors.filter((e) => e.severity === "error");
  }
  getWarnings() {
    return this.errors.filter((e) => e.severity === "warning");
  }
  hasFatalError() {
    return this.errors.some((e) => e.severity === "error" && !e.recoverable);
  }
  isEmpty() {
    return this.errors.length === 0;
  }
  count() {
    return {
      errors: this.errors.filter((e) => e.severity === "error").length,
      warnings: this.errors.filter((e) => e.severity === "warning").length
    };
  }
  clear() {
    this.errors = [];
  }
}
var SYNC_TOKENS = new Set([
  "\\",
  "{",
  "}",
  "|",
  "<",
  ">"
]);
function createRecoveryState(maxRecoveries = 10) {
  return {
    recoveryCount: 0,
    maxRecoveries,
    lastRecoveryOffset: -1
  };
}
// src/music-model/staffSize.ts
var DEFAULT_GLOBAL_STAFF_SIZE = 20;
function validStaffSize(value) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}
function validGlobalStaffSize(value) {
  return validStaffSize(value);
}
// src/music-input/lilypond/helpers/globalStaffSize.ts
function findGlobalStaffSize(src) {
  let found;
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.split("%", 1)[0]?.trim() ?? "";
    const match = line.match(/^#\(\s*set-global-staff-size\s+([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/i);
    if (!match?.[1])
      continue;
    const value = validGlobalStaffSize(Number.parseFloat(match[1]));
    if (value !== undefined)
      found = value;
  }
  return found;
}
function extractGlobalStaffSize(src) {
  return findGlobalStaffSize(src) ?? DEFAULT_GLOBAL_STAFF_SIZE;
}

// src/music-input/lilypond/phases/01-lexer.ts
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      out += src[i++];
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          out += src[i++];
          out += src[i++];
        } else {
          out += src[i++];
        }
      }
      if (i < src.length)
        out += src[i++];
      continue;
    }
    if (src[i] === "%" && src[i + 1] === "{") {
      out += "  ";
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "%" && src[i + 1] === "{") {
          depth++;
          out += "  ";
          i += 2;
        } else if (src[i] === "%" && src[i + 1] === "}") {
          depth--;
          out += "  ";
          i += 2;
        } else {
          out += src[i] === `
` || src[i] === "\r" ? src[i] : " ";
          i++;
        }
      }
      continue;
    }
    if (src[i] === "%") {
      out += " ";
      i++;
      while (i < src.length && src[i] !== `
` && src[i] !== "\r") {
        out += " ";
        i++;
      }
      continue;
    }
    out += src[i++];
  }
  return out;
}
function lex(source, defaultLanguage) {
  const cleanSource = stripComments(source);
  const tokens = tokenize(cleanSource, { language: defaultLanguage ?? "english" });
  return {
    tokens,
    errors: []
  };
}

// src/music-input/lilypond/phases/parser/state.ts
function isIdentStart(ch) {
  return ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "_";
}
function isIdentChar(ch) {
  return isIdentStart(ch) || ch >= "0" && ch <= "9" || ch === "-";
}
function extractAliases(source) {
  const aliases = new Map;
  if (!source)
    return aliases;
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? ""))
      i++;
    if (i >= source.length)
      break;
    if (!isIdentStart(source[i] ?? "")) {
      i++;
      continue;
    }
    const nameStart = i;
    while (i < source.length && isIdentChar(source[i] ?? ""))
      i++;
    const name = source.slice(nameStart, i);
    while (i < source.length && (source[i] === " " || source[i] === "\t"))
      i++;
    if (source[i] !== "=")
      continue;
    i++;
    while (i < source.length && /\s/.test(source[i] ?? ""))
      i++;
    if (source[i] === "#" && source[i + 1] === "(") {
      let depth = 0;
      const start = i;
      let j = i;
      while (j < source.length) {
        if (source[j] === "(")
          depth++;
        else if (source[j] === ")") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }
      const schemeBody = source.slice(start, j);
      const m = schemeBody.match(/\\tuplet\s+(\d+)\s*\/\s*(\d+)/);
      if (m) {
        aliases.set(name, {
          target: "tuplet",
          actual: Number.parseInt(m[1] ?? "3", 10),
          normal: Number.parseInt(m[2] ?? "2", 10)
        });
      }
      i = j;
      continue;
    }
    if (source[i] === "\\") {
      i++;
      const cmdStart = i;
      while (i < source.length && isIdentChar(source[i] ?? ""))
        i++;
      const target = source.slice(cmdStart, i);
      if (target.length > 0)
        aliases.set(name, { target });
    }
  }
  return aliases;
}
function createState(tokens, source, language = "english") {
  return {
    tokens,
    source,
    pos: 0,
    errors: new ErrorCollection,
    recovery: createRecoveryState(),
    variables: new Map,
    schemeFunctions: new Map,
    aliases: extractAliases(source),
    language
  };
}
function current(state) {
  return state.tokens[state.pos] ?? state.tokens[state.tokens.length - 1];
}
function peek(state, offset = 0) {
  const index = state.pos + offset;
  if (index < 0 || index >= state.tokens.length)
    return;
  return state.tokens[index];
}
function isAtEnd(state) {
  return current(state).kind === "eof";
}
function advance(state) {
  const token = current(state);
  if (!isAtEnd(state))
    state.pos++;
  return token;
}
function check(state, kind) {
  if (isAtEnd(state))
    return false;
  return current(state).kind === kind;
}
function match(state, ...kinds) {
  for (const kind of kinds) {
    if (check(state, kind)) {
      return advance(state);
    }
  }
  return null;
}
function expect(state, kind, message) {
  if (check(state, kind)) {
    return advance(state);
  }
  const token = current(state);
  state.errors.add(new ParseError({
    message: `${message} but found ${token.kind}`,
    loc: tokenToLoc(token),
    recoverable: true
  }));
  return null;
}
function tokenToLoc(token) {
  return {
    offset: token.pos,
    line: 1,
    column: token.pos,
    endOffset: token.end
  };
}

// src/music-input/lilypond/phases/parser/markup.ts
function parseTopLevelMarkup(state, cmdToken) {
  const rawTokenText = (tok) => {
    if (!state.source)
      return;
    if (tok.end === undefined || tok.end <= tok.pos)
      return;
    return state.source.slice(tok.pos, tok.end);
  };
  let sourceCursor = cmdToken.end ?? cmdToken.pos;
  const pushGap = (into, uptoPos) => {
    if (!state.source)
      return;
    if (uptoPos <= sourceCursor)
      return;
    const rawGap = state.source.slice(sourceCursor, uptoPos);
    const gap = rawGap.replace(/%\{[\s\S]*?%\}/g, "").replace(/%[^\n]*/g, "");
    if (gap.length > 0) {
      into.push({
        type: "markupText",
        text: gap,
        loc: {
          offset: sourceCursor,
          line: 1,
          column: sourceCursor,
          endOffset: uptoPos
        }
      });
    }
    sourceCursor = uptoPos;
  };
  const consume = () => {
    const tok = advance(state);
    sourceCursor = Math.max(sourceCursor, tok.end ?? tok.pos);
    return tok;
  };
  const consumeUntilSourcePos = (endPos) => {
    while (!isAtEnd(state) && current(state).pos < endPos)
      consume();
    sourceCursor = Math.max(sourceCursor, endPos);
  };
  const textNodeFromRaw = (text, start, end) => ({
    type: "markupText",
    text,
    loc: {
      offset: start,
      line: 1,
      column: start,
      endOffset: end
    }
  });
  const parseFilledBoxArgsFromSource = (startPos) => {
    if (!state.source)
      return null;
    let i = skipMarkupWhitespaceAndComments(state.source, startPos);
    const x = readSchemePairLiteral(state.source, i);
    if (!x)
      return null;
    i = skipMarkupWhitespaceAndComments(state.source, x.endPos);
    const y = readSchemePairLiteral(state.source, i);
    if (!y)
      return null;
    i = skipMarkupWhitespaceAndComments(state.source, y.endPos);
    const blot = readSchemeNumberLiteral(state.source, i);
    if (!blot)
      return null;
    return {
      args: [
        textNodeFromRaw(x.text, x.startPos, x.endPos),
        textNodeFromRaw(y.text, y.startPos, y.endPos),
        textNodeFromRaw(blot.text, blot.startPos, blot.endPos)
      ],
      endPos: blot.endPos
    };
  };
  const parseNumberArgFromSource = (startPos) => {
    if (!state.source)
      return null;
    const parsed = readSchemeNumberLiteral(state.source, skipMarkupWhitespaceAndComments(state.source, startPos));
    return parsed ? { arg: textNodeFromRaw(parsed.text, parsed.startPos, parsed.endPos), endPos: parsed.endPos } : null;
  };
  const parseMarkupExpr = () => {
    if (isAtEnd(state))
      return null;
    const tok = current(state);
    if (isTextLikeMarkupToken(tok.kind)) {
      consume();
      const text = tok.kind === "note" || tok.kind === "rest" ? rawTokenText(tok) ?? tok.value : tok.kind === "scheme_block" ? rawTokenText(tok) ?? tok.value : tok.value;
      return {
        type: "markupText",
        text,
        loc: tokenToLoc(tok)
      };
    }
    if (tok.kind === "open") {
      const openTok = consume();
      const inner = [];
      while (!isAtEnd(state) && !check(state, "close")) {
        const curTok = current(state);
        pushGap(inner, curTok.pos);
        const child = parseMarkupExpr();
        if (child)
          inner.push(child);
      }
      if (!isAtEnd(state) && check(state, "close")) {
        pushGap(inner, current(state).pos);
      }
      if (check(state, "close")) {
        consume();
      } else {
        expect(state, "close", "Expected } in markup expression");
      }
      return {
        type: "markupBlock",
        children: inner,
        loc: tokenToLoc(openTok)
      };
    }
    if (tok.kind === "command") {
      const cmdTok = consume();
      if (cmdTok.value === "markuplist") {
        if (check(state, "open")) {
          const openTok = consume();
          const items = [];
          while (!isAtEnd(state) && !check(state, "close")) {
            const item = parseMarkupExpr();
            if (item)
              items.push(item);
            else if (!isAtEnd(state) && !check(state, "close"))
              consume();
          }
          if (check(state, "close"))
            consume();
          return { type: "markupList", items, loc: tokenToLoc(openTok) };
        }
        return null;
      }
      const args = [];
      if (cmdTok.value === "filled-box") {
        const parsed = parseFilledBoxArgsFromSource(sourceCursor);
        if (parsed) {
          consumeUntilSourcePos(parsed.endPos);
          return {
            type: "markupCommand",
            command: cmdTok.value,
            args: parsed.args,
            loc: { ...tokenToLoc(cmdTok), endOffset: parsed.endPos }
          };
        }
      }
      if (cmdTok.value === "hspace" || cmdTok.value === "vspace" || cmdTok.value === "fontsize" || cmdTok.value === "raise" || cmdTok.value === "lower") {
        const parsed = parseNumberArgFromSource(sourceCursor);
        if (parsed) {
          consumeUntilSourcePos(parsed.endPos);
          args.push(parsed.arg);
        }
      }
      const argTarget = markupCommandArgTarget(cmdTok.value);
      while (args.length < argTarget && !isAtEnd(state) && canStartMarkupExpr(state)) {
        const arg = parseMarkupExpr();
        if (arg)
          args.push(arg);
        else
          break;
      }
      return {
        type: "markupCommand",
        command: cmdTok.value,
        args,
        loc: tokenToLoc(cmdTok)
      };
    }
    consume();
    return null;
  };
  const children = [];
  if (check(state, "open") || canStartMarkupExpr(state)) {
    const curTok = current(state);
    pushGap(children, curTok.pos);
    const root = parseMarkupExpr();
    if (root)
      children.push(root);
  }
  return {
    type: "markupBlock",
    children,
    loc: tokenToLoc(cmdToken)
  };
}
function canStartMarkupExpr(state) {
  return check(state, "open") || isTextLikeMarkupToken(current(state).kind) || check(state, "command");
}
function isTextLikeMarkupToken(kind) {
  return kind === "string" || kind === "word" || kind === "number" || kind === "scheme_block" || kind === "note" || kind === "rest" || kind === "tie" || kind === "slur_open" || kind === "slur_close" || kind === "beam_open" || kind === "beam_close" || kind === "barcheck" || kind === "slash" || kind === "equals";
}
function markupCommandArgTarget(command) {
  if (command === "filled-box")
    return 3;
  if (command === "hspace" || command === "vspace")
    return 1;
  if (command === "with-color" || command === "fontsize" || command === "combine" || command === "raise" || command === "lower") {
    return 2;
  }
  return 1;
}
function skipMarkupWhitespaceAndComments(src, startPos) {
  let i = startPos;
  for (;; ) {
    while (i < src.length && /\s/.test(src[i]))
      i++;
    if (src.startsWith("%{", i)) {
      const end = src.indexOf("%}", i + 2);
      i = end >= 0 ? end + 2 : src.length;
      continue;
    }
    if (src[i] === "%") {
      while (i < src.length && src[i] !== `
`)
        i++;
      continue;
    }
    return i;
  }
}
function readSchemePairLiteral(src, startPos) {
  let i = startPos;
  if (src.startsWith("#'", i))
    i += 2;
  else if (src[i] === "#")
    i++;
  if (src[i] !== "(")
    return null;
  let depth = 0;
  const pairStart = i;
  while (i < src.length) {
    if (src[i] === "(")
      depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) {
        i++;
        return {
          text: src.slice(pairStart, i),
          startPos,
          endPos: i
        };
      }
    }
    i++;
  }
  return null;
}
function readSchemeNumberLiteral(src, startPos) {
  let i = startPos;
  if (src[i] === "#")
    i++;
  const numberStart = i;
  if (src[i] === "+" || src[i] === "-")
    i++;
  let sawDigit = false;
  while (i < src.length && src[i] >= "0" && src[i] <= "9") {
    sawDigit = true;
    i++;
  }
  if (src[i] === ".") {
    i++;
    while (i < src.length && src[i] >= "0" && src[i] <= "9") {
      sawDigit = true;
      i++;
    }
  }
  if (!sawDigit)
    return null;
  return {
    text: src.slice(numberStart, i),
    startPos,
    endPos: i
  };
}

// src/music-input/lilypond/phases/parser/commands.ts
function skipBalancedBlock(state) {
  if (!check(state, "open"))
    return;
  advance(state);
  let depth = 1;
  while (!isAtEnd(state) && depth > 0) {
    if (check(state, "open"))
      depth++;
    else if (check(state, "close"))
      depth--;
    advance(state);
  }
}
function parseHeader(state) {
  if (!expect(state, "open", "Expected { for \\header"))
    return null;
  const startToken = state.tokens[state.pos - 1];
  const fields = new Map;
  let syncBreak = false;
  while (!check(state, "close") && !isAtEnd(state)) {
    const tok = current(state);
    if (tok.kind === "command") {
      const topLevel = [
        "header",
        "paper",
        "score",
        "book",
        "bookpart",
        "relative",
        "version",
        "language",
        "lyricmode",
        "lyrics",
        "addlyrics"
      ];
      if (topLevel.includes(tok.value)) {
        state.errors.add(new ParseError({
          message: `Expected } before \\${tok.value} (missing closing brace in \\header block)`,
          loc: tokenToLoc(tok),
          recoverable: true,
          severity: "error"
        }));
        syncBreak = true;
        break;
      }
    }
    if (tok.kind === "note" || tok.kind === "rest") {
      state.errors.add(new ParseError({
        message: `Expected } before music (missing closing brace in \\header block)`,
        loc: tokenToLoc(tok),
        recoverable: true,
        severity: "error"
      }));
      syncBreak = true;
      break;
    }
    const keyToken = match(state, "word");
    if (!keyToken) {
      advance(state);
      continue;
    }
    if (!expect(state, "equals", `Expected = after ${keyToken.value}`))
      continue;
    const valueTok = current(state);
    const isValidHeaderValue = valueTok.kind === "string" || valueTok.kind === "word" || valueTok.kind === "command" && (valueTok.value === "#f" || valueTok.value === "#t");
    const valueToken = isValidHeaderValue ? match(state, "string", "word", "command") : null;
    if (!valueToken) {
      state.errors.add(new ParseError({
        message: `Expected value for ${keyToken.value} in \\header block`,
        loc: tokenToLoc(current(state)),
        recoverable: true
      }));
      advance(state);
      continue;
    }
    if (valueToken.kind === "string" && valueToken.unclosed) {
      state.errors.add(new ParseError({
        message: `Unclosed string for ${keyToken.value} in \\header block (missing closing quote)`,
        loc: tokenToLoc(valueToken),
        recoverable: true,
        severity: "warning"
      }));
    }
    let value = valueToken.value;
    if (valueToken.kind === "command" && valueToken.value === "#f") {
      value = false;
    } else if (valueToken.kind === "command" && valueToken.value === "#t") {
      value = true;
    }
    fields.set(keyToken.value, value);
  }
  if (!syncBreak && !expect(state, "close", "Expected } for \\header")) {}
  const endToken = state.tokens[state.pos - 1] || startToken;
  return {
    type: "header",
    fields,
    loc: {
      offset: startToken.pos,
      line: 1,
      column: startToken.pos,
      endOffset: endToken.end ?? endToken.pos
    }
  };
}
function parsePaper(state) {
  if (!expect(state, "open", "Expected { for \\paper"))
    return null;
  const startToken = state.tokens[state.pos - 1];
  const settings = new Map;
  while (!check(state, "close") && !isAtEnd(state)) {
    const keyToken = match(state, "word");
    if (!keyToken) {
      state.errors.add(new ParseError({
        message: "Expected property name in \\paper block",
        loc: tokenToLoc(current(state)),
        recoverable: true
      }));
      advance(state);
      continue;
    }
    const keyParts = [keyToken.value];
    while (!check(state, "equals") && current(state).kind === "word") {
      keyParts.push(advance(state).value);
    }
    const key = keyParts.join(".");
    if (check(state, "equals")) {
      advance(state);
      const valueToken = match(state, "number", "string", "word", "command", "scheme_block", "scheme_symbol");
      if (valueToken) {
        let value = valueToken.value;
        if (valueToken.kind === "number") {
          value = parseFloat(valueToken.value);
          if (check(state, "command")) {
            const unitTok = advance(state);
            value = `${value}\\${unitTok.value}`;
          }
        } else if (valueToken.kind === "command") {
          if (valueToken.value === "#t") {
            value = true;
          } else if (valueToken.value === "#f") {
            value = false;
          } else {
            const unit = valueToken.value;
            const prevValue = settings.get(key);
            if (typeof prevValue === "number") {
              value = `${prevValue}\\${unit}`;
            } else {
              value = `\\${unit}`;
            }
          }
        } else if (valueToken.kind === "scheme_symbol") {
          value = `#${valueToken.value}`;
        }
        settings.set(key, value);
      } else {
        if (check(state, "close") || check(state, "eof")) {
          continue;
        }
        state.errors.add(new ParseError({
          message: `Expected value for ${keyToken.value} in \\paper block`,
          loc: tokenToLoc(current(state)),
          recoverable: true
        }));
        advance(state);
        continue;
      }
    } else {
      settings.set(key, true);
    }
  }
  if (!expect(state, "close", "Expected } for \\paper")) {}
  const endToken = state.tokens[state.pos - 1] || startToken;
  return {
    type: "paper",
    settings,
    loc: {
      offset: startToken.pos,
      line: 1,
      column: startToken.pos,
      endOffset: endToken.end ?? endToken.pos
    }
  };
}
function parseLayout(state) {
  if (!expect(state, "open", "Expected { for \\layout"))
    return null;
  const startToken = state.tokens[state.pos - 1];
  const settings = new Map;
  const readLayoutValue = () => {
    const valTok = current(state);
    if (valTok.kind === "number") {
      advance(state);
      return parseFloat(valTok.value);
    }
    if (valTok.kind === "command") {
      advance(state);
      if (valTok.value === "#t")
        return true;
      if (valTok.value === "#f")
        return false;
      return `\\${valTok.value}`;
    }
    if (valTok.kind === "scheme_symbol") {
      advance(state);
      return `#${valTok.value}`;
    }
    if (valTok.kind === "word" || valTok.kind === "string" || valTok.kind === "scheme_block") {
      advance(state);
      return valTok.value;
    }
    return;
  };
  const settingKey = (parts, contextName) => {
    if (!contextName)
      return parts.join(".");
    if (parts[0]?.toLowerCase() === contextName.toLowerCase())
      return parts.join(".");
    return [contextName, ...parts].join(".");
  };
  const parseOverrideSetting = (contextName) => {
    advance(state);
    const pathParts = [];
    while (!isAtEnd(state) && !check(state, "close")) {
      const t = current(state);
      if (t.kind === "word") {
        pathParts.push(t.value);
        advance(state);
        if (check(state, "equals"))
          break;
      } else if (t.kind === "equals") {
        break;
      } else {
        break;
      }
    }
    if (!check(state, "equals"))
      return;
    advance(state);
    const value = readLayoutValue();
    if (value !== undefined && pathParts.length > 0) {
      settings.set(settingKey(pathParts, contextName), value);
    } else if (value === undefined && !check(state, "close") && !check(state, "eof")) {
      advance(state);
    }
  };
  const parseWordSetting = (contextName) => {
    const keyParts = [advance(state).value];
    while (!check(state, "equals") && current(state).kind === "word") {
      keyParts.push(advance(state).value);
    }
    if (check(state, "equals")) {
      advance(state);
      const value = readLayoutValue();
      if (value !== undefined) {
        settings.set(settingKey(keyParts, contextName), value);
      }
    } else {
      settings.set(settingKey(keyParts, contextName), true);
    }
  };
  const parseContextBlock = () => {
    advance(state);
    if (!expect(state, "open", "Expected { for \\context"))
      return;
    let contextName;
    while (!check(state, "close") && !isAtEnd(state)) {
      const tok = current(state);
      if (tok.kind === "command" && tok.value !== "override" && tok.value !== "context") {
        contextName = tok.value;
        advance(state);
        continue;
      }
      if (tok.kind === "command" && tok.value === "override") {
        parseOverrideSetting(contextName);
        continue;
      }
      if (tok.kind === "command" && tok.value === "context") {
        parseContextBlock();
        continue;
      }
      if (tok.kind === "word") {
        parseWordSetting(contextName);
        continue;
      }
      if (tok.kind === "open") {
        skipBalancedBlock(state);
        continue;
      }
      advance(state);
    }
    if (check(state, "close"))
      advance(state);
  };
  while (!check(state, "close") && !isAtEnd(state)) {
    const tok = current(state);
    if (tok.kind === "command" && tok.value === "context") {
      parseContextBlock();
      continue;
    }
    if (tok.kind === "command" && tok.value === "override") {
      parseOverrideSetting();
      continue;
    }
    if (tok.kind === "word") {
      parseWordSetting();
      continue;
    }
    if (tok.kind === "open") {
      skipBalancedBlock(state);
      continue;
    }
    advance(state);
  }
  if (check(state, "close"))
    advance(state);
  const endToken = state.tokens[state.pos - 1] || startToken;
  return {
    type: "layout",
    settings,
    loc: { offset: startToken.pos, line: 1, column: startToken.pos, endOffset: endToken.end ?? endToken.pos }
  };
}

// src/music-input/lilypond/phases/parser/repeats.ts
function parseRepeatCommand(state, cmdToken, parseMusic) {
  const variantTok = match(state, "word", "command");
  const variant = variantTok?.value ?? "volta";
  const countTok = match(state, "number");
  const count = countTok ? parseInt(countTok.value, 10) : 2;
  const body = parseMusic(state);
  if (!body)
    return null;
  let alternatives;
  if (check(state, "command") && current(state).value === "alternative") {
    advance(state);
    alternatives = parseAlternativeList(state, parseMusic);
  }
  return {
    type: "repeat",
    variant,
    count: Number.isFinite(count) && count >= 0 ? count : 1,
    body,
    ...alternatives && alternatives.length > 0 ? { alternatives } : {},
    loc: tokenToLoc(cmdToken)
  };
}
function parseAlternativeList(state, parseMusic) {
  const out = [];
  if (!check(state, "open"))
    return out;
  if (!expect(state, "open", "Expected { after \\alternative"))
    return out;
  while (!isAtEnd(state) && !check(state, "close")) {
    if (check(state, "command") && current(state).value === "volta") {
      advance(state);
      if (check(state, "number"))
        advance(state);
      const vBody = parseMusic(state);
      if (vBody)
        out.push(vBody);
      continue;
    }
    const element = parseMusic(state);
    if (element)
      out.push(element);
  }
  expect(state, "close", "Expected } after \\alternative");
  return out;
}

// src/music-input/lilypond/phases/parser/relative.ts
function parseRelativeOrFixedCommand(state, cmdToken, parseMusic) {
  let startPitch;
  if (check(state, "note")) {
    const pitchToken = advance(state);
    const parts = pitchToken.value.split("|");
    const noteName = parts[0];
    const octaveStr = parts[1] ?? "";
    startPitch = {
      base: noteName[0] ?? "c",
      accidental: noteName.substring(1) || undefined,
      octave: octaveStr
    };
  }
  const body = parseMusic(state);
  if (!body)
    return null;
  return {
    type: cmdToken.value,
    startPitch,
    body,
    loc: tokenToLoc(cmdToken)
  };
}

// src/music-input/lilypond/phases/parser/lyrics.ts
function parseLyricSyllable(state) {
  const tok = current(state);
  if (tok.kind !== "word" && tok.kind !== "note")
    return null;
  const wordTok = advance(state);
  const raw = wordTok.value;
  let text = tok.kind === "note" ? raw.split("|")[0] ?? raw : raw;
  if (state.source != null) {
    const lyricPunctuation = new Set(["!", ".", ",", "?", ";", ":"]);
    let p = wordTok.end ?? 0;
    while (p < state.source.length && lyricPunctuation.has(state.source[p])) {
      text += state.source[p];
      p++;
    }
  }
  let hyphen;
  let extender;
  if (check(state, "lyric_hyphen")) {
    hyphen = advance(state).value;
  } else if (check(state, "lyric_extender")) {
    extender = advance(state).value;
  }
  return {
    type: "lyricSyllable",
    text,
    ...hyphen && { hyphen },
    ...extender && { extender },
    loc: tokenToLoc(tok)
  };
}
function parseLyricsBlock(state, parseCommand) {
  if (!expect(state, "open", "Expected { for lyrics block"))
    return null;
  const elements = [];
  const startToken = state.tokens[state.pos - 1];
  let syncBreak = false;
  while (!check(state, "close") && !isAtEnd(state)) {
    const tok = current(state);
    const nextTok = peek(state, 1);
    if (tok.kind === "word" && nextTok?.kind === "equals") {
      state.errors.add(new ParseError({
        message: `Expected } before variable assignment "${tok.value}" (missing closing brace in lyrics block)`,
        loc: tokenToLoc(tok),
        recoverable: true,
        severity: "error"
      }));
      syncBreak = true;
      break;
    }
    if (tok.kind === "command") {
      const topLevel = ["header", "paper", "score", "book", "bookpart"];
      if (topLevel.includes(tok.value)) {
        state.errors.add(new ParseError({
          message: `Expected } before \\${tok.value} (missing closing brace in lyrics block)`,
          loc: tokenToLoc(tok),
          recoverable: true,
          severity: "error"
        }));
        syncBreak = true;
        break;
      }
    }
    if (tok.kind === "word" || tok.kind === "note") {
      const syllable = parseLyricSyllable(state);
      if (syllable)
        elements.push(syllable);
    } else if (tok.kind === "string") {
      const strTok = advance(state);
      let hyphen;
      let extender;
      if (check(state, "lyric_hyphen"))
        hyphen = advance(state).value;
      else if (check(state, "lyric_extender"))
        extender = advance(state).value;
      elements.push({
        type: "lyricSyllable",
        text: strTok.value,
        ...hyphen && { hyphen },
        ...extender && { extender },
        loc: tokenToLoc(strTok)
      });
    } else if (tok.kind === "markup_below") {
      advance(state);
      elements.push({
        type: "lyricSyllable",
        text: "",
        skip: true,
        loc: tokenToLoc(tok)
      });
    } else if (tok.kind === "command") {
      const cmd = parseCommand(state);
      if (cmd)
        elements.push(cmd);
    } else if (tok.kind === "lyric_hyphen" || tok.kind === "lyric_extender") {
      advance(state);
    } else {
      state.errors.add(new ParseError({
        message: `Unexpected token in lyrics block: ${tok.kind}`,
        loc: tokenToLoc(tok),
        recoverable: true
      }));
      advance(state);
    }
  }
  if (syncBreak) {} else if (check(state, "close") && current(state).value === ">>") {
    const alreadyReported = state.errors.getAll().some((e) => e.message.includes("before >>"));
    if (!alreadyReported) {
      state.errors.add(new ParseError({
        message: "Expected } before >> (missing closing brace in lyrics block)",
        loc: tokenToLoc(current(state)),
        recoverable: true,
        severity: "error"
      }));
    }
  } else if (!expect(state, "close", "Expected } for lyrics block")) {}
  const endToken = state.tokens[state.pos - 1] || startToken;
  return {
    type: "sequential",
    elements,
    loc: {
      offset: startToken.pos,
      line: 1,
      column: startToken.pos,
      endOffset: endToken.end ?? endToken.pos
    }
  };
}

// src/music-input/lilypond/phases/parser/primitives/noteToken.ts
function parseNoteValue(value) {
  const parts = value.split("|");
  return {
    noteName: parts[0] ?? "",
    octaveStr: parts[1] ?? "",
    durationStr: parts[2] ?? "",
    fingering: parts[3] ?? ""
  };
}
function parsePitch(noteName, octaveStr) {
  const base = noteName[0] ?? "c";
  const accidental = noteName.slice(1);
  return {
    base,
    accidental: accidental || undefined,
    octave: octaveStr
  };
}
function parseDuration(durationStr) {
  if (!durationStr)
    return;
  let digitEnd = 0;
  while (digitEnd < durationStr.length) {
    const ch = durationStr[digitEnd];
    if (ch < "0" || ch > "9")
      break;
    digitEnd++;
  }
  if (digitEnd === 0)
    return;
  const value = parseInt(durationStr.slice(0, digitEnd), 10);
  let dots = 0;
  for (let i = digitEnd;i < durationStr.length && durationStr[i] === "."; i++) {
    dots++;
  }
  return { value, dots: dots > 0 ? dots : undefined };
}
function tokenToLoc2(token) {
  return {
    offset: token.pos,
    line: 1,
    column: token.pos,
    endOffset: token.end
  };
}
function parseNoteToken(token) {
  const components = parseNoteValue(token.value);
  const pitch2 = parsePitch(components.noteName, components.octaveStr);
  const duration2 = parseDuration(components.durationStr);
  return {
    type: "note",
    pitch: pitch2,
    loc: tokenToLoc2(token),
    ...duration2 ? { duration: duration2 } : {},
    ...components.fingering ? { fingering: components.fingering } : {}
  };
}

// src/music-input/lilypond/phases/parser/primitives/notes.ts
function parseNote(token) {
  return parseNoteToken(token);
}
function parseRest(token) {
  const [durationStr, barCountStr] = token.value.split("*");
  const barCount = barCountStr ? parseInt(barCountStr, 10) : undefined;
  const durationValue = durationStr ? parseInt(durationStr, 10) : 0;
  const dots = durationStr ? (durationStr.match(/\./g) || []).length : 0;
  const restKind = token.restKind ?? "r";
  if (restKind === "R" || barCount && barCount > 0) {
    return {
      type: "multiRest",
      barCount: barCount ?? 1,
      loc: tokenToLoc(token),
      ...durationValue > 0 && {
        duration: {
          value: durationValue,
          dots
        }
      }
    };
  }
  return {
    type: restKind === "s" ? "spacer" : "rest",
    loc: tokenToLoc(token),
    ...durationValue > 0 && {
      duration: {
        value: durationValue,
        dots
      }
    }
  };
}
function parsePitchFromNoteToken(token) {
  const { noteName, octaveStr } = parseNoteValue(token.value);
  return parsePitch(noteName || "c", octaveStr);
}
function clonePitch(pitch2) {
  return {
    base: pitch2.base,
    accidental: pitch2.accidental,
    octave: pitch2.octave
  };
}
function parseDurationToken(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0)
    return null;
  return {
    value: n,
    dots: (value.match(/\./g) || []).length
  };
}
function noteDisplayForEnglish(base, accidental) {
  const up = base.toUpperCase();
  if (accidental === "s")
    return `${up}#`;
  if (accidental === "ss")
    return `${up}##`;
  if (accidental === "f")
    return `${up}b`;
  if (accidental === "ff")
    return `${up}bb`;
  return up;
}
function parseUnsupportedEnglishAccidentalWord(state, tok) {
  if (state.language !== "english")
    return null;
  const m = tok.value.toLowerCase().match(/^([cdefgab])(isis|eses|is|es)(\d+\.{0,4})?$/);
  if (!m)
    return null;
  const base = m[1];
  const syll = m[2];
  const dur = m[3] ?? "";
  const replacement = syll === "is" ? "s" : syll === "isis" ? "ss" : syll === "es" ? "f" : "ff";
  const expectedLy = `${base}${replacement}`;
  const expectedDisplay = noteDisplayForEnglish(base, replacement);
  const found = `${base}${syll}`;
  state.errors.add(new ParseError({
    message: `Unknown text found "${found}". Did you mean to use ${expectedLy} (${expectedDisplay})? Replaced with "?".`,
    loc: tokenToLoc(tok),
    recoverable: true
  }));
  const duration2 = dur ? parseDurationToken(dur) : null;
  return {
    type: "sequential",
    elements: [
      {
        type: "rest",
        ...duration2 ? { duration: duration2 } : {},
        loc: tokenToLoc(tok)
      },
      {
        type: "attachedText",
        position: "above",
        text: "?",
        color: "red",
        loc: tokenToLoc(tok)
      }
    ],
    loc: tokenToLoc(tok)
  };
}
// src/music-input/lilypond/phases/parser/primitives/chordMode.ts
function chordRootDisplay(ly) {
  const lower = ly.toLowerCase();
  const base = lower[0] ?? "c";
  const acc = lower.slice(1);
  const baseOut = base.toUpperCase();
  if (acc === "s" || acc === "is")
    return `${baseOut}#`;
  if (acc === "ss" || acc === "isis")
    return `${baseOut}##`;
  if (acc === "f" || acc === "es")
    return `${baseOut}b`;
  if (acc === "ff" || acc === "eses")
    return `${baseOut}bb`;
  return baseOut;
}
function durationStrToQN(durationStr, prevDuration) {
  if (!durationStr)
    return prevDuration;
  const value = Number.parseInt(durationStr, 10);
  if (!Number.isFinite(value) || value <= 0)
    return prevDuration;
  const dots = (durationStr.match(/\./g) || []).length;
  let qn = 4 / value;
  let add = qn / 2;
  for (let i = 0;i < dots; i++) {
    qn += add;
    add /= 2;
  }
  return qn;
}
function normalizeChordQuality(raw) {
  const q = raw.startsWith(":") ? raw.slice(1) : raw;
  if (!q)
    return "";
  if (q === "maj")
    return "maj";
  if (q === "min")
    return "m";
  if (q === "dim")
    return "°";
  if (q === "aug")
    return "aug";
  return q;
}
function parseChordModeCommand(state, cmdToken) {
  if (!expect(state, "open", "Expected { after \\chordmode"))
    return null;
  const chords = [];
  let prevDuration = 4;
  let prevChordName = "C";
  let prevChordRoot = "C";
  const startLoc = tokenToLoc(cmdToken);
  while (!isAtEnd(state) && !check(state, "close")) {
    const tok = current(state);
    if (tok.kind === "note") {
      const parts = tok.value.split("|");
      const lyName = parts[0] ?? "c";
      const durationStr = parts[2] ?? "";
      prevDuration = durationStrToQN(durationStr, prevDuration);
      advance(state);
      let quality = "";
      if (check(state, "word") || check(state, "number")) {
        const qualTok = advance(state);
        quality = normalizeChordQuality(qualTok.value);
      }
      const root = chordRootDisplay(lyName);
      const name = `${root}${quality}`;
      chords.push({
        name,
        duration: prevDuration
      });
      prevChordName = name;
      prevChordRoot = root;
      continue;
    }
    if (tok.kind === "number") {
      prevDuration = durationStrToQN(tok.value, prevDuration);
      advance(state);
      let quality = "";
      if (check(state, "word") || check(state, "number")) {
        const qualTok = advance(state);
        quality = normalizeChordQuality(qualTok.value);
      }
      const name = quality ? `${prevChordRoot}${quality}` : prevChordName;
      chords.push({
        name,
        duration: prevDuration
      });
      prevChordName = name;
      continue;
    }
    if (tok.kind === "rest") {
      prevDuration = durationStrToQN(tok.value, prevDuration);
      advance(state);
      chords.push({
        name: "",
        duration: prevDuration
      });
      continue;
    }
    if (tok.kind === "command" && tok.value === "partial") {
      advance(state);
      if (check(state, "number"))
        advance(state);
      continue;
    }
    if (tok.kind === "command" && tok.value === "repeat") {
      advance(state);
      const variantTok = match(state, "word");
      const countTok = match(state, "number");
      const repeatCount = countTok ? Math.max(0, Number.parseInt(countTok.value, 10) || 0) : 0;
      const variant = variantTok?.value ?? "";
      if (check(state, "open")) {
        const nested = parseChordModeCommand(state, cmdToken);
        if (nested && nested.type === "chordMode") {
          const alternatives = [];
          if (check(state, "command") && current(state).value === "alternative") {
            advance(state);
            if (check(state, "open")) {
              expect(state, "open", "Expected { after \\alternative");
              while (!isAtEnd(state) && !check(state, "close")) {
                if (check(state, "open")) {
                  const altBlock = parseChordModeCommand(state, cmdToken);
                  if (altBlock && altBlock.type === "chordMode") {
                    alternatives.push(altBlock.chords);
                  }
                  continue;
                }
                advance(state);
              }
              expect(state, "close", "Expected } after \\alternative");
            }
          }
          let emittedLast;
          if (alternatives.length > 0) {
            if (variant === "unfold") {
              const times = Math.max(1, repeatCount);
              for (let i = 0;i < times; i++) {
                chords.push(...nested.chords);
                emittedLast = nested.chords[nested.chords.length - 1] ?? emittedLast;
                const alt = alternatives[Math.min(i, alternatives.length - 1)];
                if (alt && alt.length > 0) {
                  chords.push(...alt);
                  emittedLast = alt[alt.length - 1] ?? emittedLast;
                }
              }
            } else {
              chords.push(...nested.chords);
              emittedLast = nested.chords[nested.chords.length - 1] ?? emittedLast;
              for (const alt of alternatives) {
                chords.push(...alt);
                emittedLast = alt[alt.length - 1] ?? emittedLast;
              }
            }
          } else if (variant === "unfold") {
            for (let i = 0;i < repeatCount; i++) {
              chords.push(...nested.chords);
              emittedLast = nested.chords[nested.chords.length - 1] ?? emittedLast;
            }
          } else {
            chords.push(...nested.chords);
            emittedLast = nested.chords[nested.chords.length - 1] ?? emittedLast;
          }
          const last = emittedLast ?? nested.chords[nested.chords.length - 1];
          if (last) {
            prevDuration = last.duration;
            prevChordName = last.name;
            const m = last.name.match(/^([A-G](?:#|b)?)/);
            if (m?.[1])
              prevChordRoot = m[1];
          }
        }
      }
      continue;
    }
    if (tok.kind === "open") {
      const nested = parseChordModeCommand(state, cmdToken);
      if (nested && nested.type === "chordMode") {
        chords.push(...nested.chords);
        const last = nested.chords[nested.chords.length - 1];
        if (last) {
          prevDuration = last.duration;
          prevChordName = last.name;
        }
      }
      continue;
    }
    advance(state);
  }
  expect(state, "close", "Expected } after \\chordmode");
  return {
    type: "chordMode",
    chords,
    loc: startLoc
  };
}
// src/music-input/lilypond/phases/parser/primitives/balanced.ts
function skipBalancedBlock2(state) {
  if (!match(state, "open"))
    return;
  let depth = 1;
  while (depth > 0 && !isAtEnd(state)) {
    const tok = advance(state);
    if (tok.kind === "open")
      depth++;
    if (tok.kind === "close")
      depth--;
  }
}
function skipOneArgument(state) {
  const tok = current(state);
  if (tok.kind === "open") {
    skipBalancedBlock2(state);
    return;
  }
  if (!isAtEnd(state) && tok.kind !== "close") {
    advance(state);
  }
}
// src/music-input/lilypond/phases/parser/primitives/assignments.ts
function parseSetLikeAssignment(state) {
  while (!isAtEnd(state)) {
    const tok = current(state);
    if (tok.kind === "equals") {
      advance(state);
      break;
    }
    if (tok.kind === "close" || tok.kind === "barcheck")
      return;
    if (tok.kind === "open") {
      skipBalancedBlock2(state);
      return;
    }
    if (tok.kind === "command")
      return;
    advance(state);
  }
  if (isAtEnd(state))
    return;
  const rhs = current(state);
  if (rhs.kind === "open") {
    skipBalancedBlock2(state);
    return;
  }
  if (rhs.kind === "word" || rhs.kind === "number" || rhs.kind === "string" || rhs.kind === "command" || rhs.kind === "note") {
    advance(state);
  }
}
function tokenValueForContextOperation(tok) {
  if (tok.kind === "number") {
    const n = Number.parseFloat(tok.value);
    return Number.isFinite(n) ? n : tok.value;
  }
  if (tok.kind === "command") {
    if (tok.value === "#t")
      return true;
    if (tok.value === "#f")
      return false;
  }
  return tok.value;
}
function parseContextOperationAssignment(state, cmdToken, kind) {
  const pathParts = [];
  while (!isAtEnd(state)) {
    const tok = current(state);
    if (tok.kind === "equals") {
      advance(state);
      break;
    }
    if (tok.kind === "close" || tok.kind === "barcheck" || tok.kind === "open")
      return null;
    if (tok.kind === "command")
      return null;
    if (tok.kind === "word" || tok.kind === "note" || tok.kind === "number") {
      pathParts.push(tok.value.split("|")[0] ?? tok.value);
    }
    advance(state);
  }
  if (pathParts.length === 0 || isAtEnd(state))
    return null;
  const rhs = current(state);
  if (rhs.kind === "open") {
    skipBalancedBlock2(state);
    return null;
  }
  if (rhs.kind !== "word" && rhs.kind !== "number" && rhs.kind !== "string" && rhs.kind !== "command" && rhs.kind !== "note") {
    return null;
  }
  advance(state);
  const loc = {
    ...tokenToLoc(cmdToken),
    endOffset: rhs.end ?? rhs.pos
  };
  if (kind === "set") {
    return {
      type: "set",
      property: pathParts.join("."),
      value: tokenValueForContextOperation(rhs),
      loc
    };
  }
  const property = pathParts[pathParts.length - 1] ?? "";
  const grob = pathParts.slice(0, -1).join(".");
  if (!grob || !property)
    return null;
  return {
    type: "override",
    grob,
    property,
    value: String(tokenValueForContextOperation(rhs)),
    loc
  };
}
function parseAutoBeamingSetAssignment(state, cmdToken) {
  const tok0 = state.tokens[state.pos];
  const tok1 = state.tokens[state.pos + 1];
  const tok2 = state.tokens[state.pos + 2];
  const tok3 = state.tokens[state.pos + 3];
  if (tok0?.kind === "word" && tok0.value === "Staff" && tok1?.kind === "word" && tok1.value === "autoBeaming" && tok2?.kind === "equals" && tok3?.kind === "command") {
    const valueTok = tok3;
    if (valueTok.value === "#t" || valueTok.value === "#f") {
      advance(state);
      advance(state);
      advance(state);
      advance(state);
      return {
        type: "beamMode",
        enabled: valueTok.value === "#t",
        loc: tokenToLoc(cmdToken)
      };
    }
  }
  return null;
}
function parseStanzaSetAssignment(state, cmdToken) {
  const tok0 = state.tokens[state.pos];
  const tok1 = state.tokens[state.pos + 1];
  const tok2 = state.tokens[state.pos + 2];
  if (tok0?.kind === "word" && tok0.value === "stanza" && tok1?.kind === "equals" && (tok2?.kind === "string" || tok2?.kind === "number" || tok2?.kind === "word")) {
    advance(state);
    advance(state);
    const valueTok = advance(state);
    return {
      type: "set",
      property: "stanza",
      value: valueTok.value,
      loc: tokenToLoc(cmdToken)
    };
  }
  return null;
}
// src/music-input/lilypond/markup-payload/nodeUtils.ts
function unescapeMarkupString(s) {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
function isMeaningfulMarkupNode(node) {
  return !(node.type === "markupText" && node.text.trim().length === 0);
}
function isMarkupBlockNode(node) {
  return node.type === "markupBlock";
}

// src/music-input/lilypond/markup-payload/textHelpers.ts
function shouldInsertSpace(prev, next) {
  if (!prev || !next)
    return false;
  if (prev.endsWith(`
`) || next.startsWith(`
`))
    return false;
  if (/\s$/.test(prev) || /^\s/.test(next))
    return false;
  if (/^\\[A-Za-z][A-Za-z-]*$/.test(prev) && /^[)\]}'":;,.!?]/.test(next))
    return true;
  if (/[0-9]$/.test(prev) && /^[A-Za-z]/.test(next))
    return false;
  if (/[A-Za-z]$/.test(prev) && /^[♮♯♭]/.test(next))
    return false;
  if (/[([{'"\-–—/\\]$/.test(prev))
    return false;
  if (/^[)\]}'":;,.!?]/.test(next))
    return false;
  return true;
}
function columnBlockFromTypewriterArg(arg) {
  if (arg.type === "markupCommand" && arg.command === "column") {
    return arg.args.find(isMarkupBlockNode) ?? null;
  }
  if (arg.type !== "markupBlock")
    return null;
  const inner = arg.children.filter((child) => !(child.type === "markupText" && child.text.trim().length === 0));
  return inner.length === 1 && inner[0]?.type === "markupCommand" && inner[0].command === "column" ? inner[0].args.find(isMarkupBlockNode) ?? null : null;
}
function parseOverrideText(text) {
  const match2 = text.match(/\(\s*([A-Za-z-]+)\s*\.\s*([-+]?\d+(?:\.\d+)?)\s*\)/);
  if (!match2)
    return null;
  const prop = match2[1];
  const value = Number(match2[2]);
  if (!Number.isFinite(value))
    return null;
  if (prop === "box-padding")
    return { boxPadding: value };
  if (prop === "thickness")
    return { thickness: value };
  if (prop === "corner-radius")
    return { cornerRadius: value };
  return null;
}
function parseOverrideFromChildren(children, index) {
  const first = children[index];
  if (first?.type !== "markupCommand" || first.command !== "override")
    return null;
  let text = "";
  for (const arg of first.args) {
    if (arg.type === "markupText")
      text += arg.text;
  }
  let nextIndex = index + 1;
  while (nextIndex < children.length && !text.includes(")")) {
    const child = children[nextIndex];
    if (child.type !== "markupText")
      break;
    text += child.text;
    nextIndex++;
  }
  const styleOverride = parseOverrideText(text);
  return styleOverride ? { style: styleOverride, nextIndex } : null;
}
function collectNodeText(node) {
  if (!node)
    return "";
  if (node.type === "markupText")
    return node.text;
  if (node.type === "markupBlock")
    return node.children.map(collectNodeText).join(" ");
  if (node.type === "markupList")
    return node.items.map(collectNodeText).join(" ");
  return [node.command, ...node.args.map(collectNodeText)].join(" ");
}
function drawLineTokenFromNode(node) {
  if (!node || node.type !== "markupCommand")
    return null;
  if (node.command === "lower" || node.command === "raise") {
    const n = node.args[0]?.type === "markupText" ? Number(node.args[0].text.trim()) : 0;
    const dy = Number.isFinite(n) ? node.command === "lower" ? n : -n : 0;
    const inner = node.args.find((arg) => arg.type === "markupCommand" && arg.command === "draw-line");
    const innerToken = drawLineTokenFromNode(inner);
    if (!innerToken)
      return null;
    return innerToken.replace(/#[-+]?\d+(?:\.\d+)?$/, `#${dy}`);
  }
  if (node.command !== "draw-line")
    return null;
  const numbers = collectNodeText(node).match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  const width = numbers[0] ?? 0;
  if (width === 0)
    return null;
  return `\\drawline#${width}#0`;
}
function colorFromNode(node) {
  if (!node)
    return;
  if (node.type === "markupText")
    return unescapeMarkupString(node.text.replace(/^"|"$/g, ""));
  if (node.type === "markupBlock") {
    const first = node.children[0];
    return first ? colorFromNode(first) : undefined;
  }
  if (node.type === "markupCommand")
    return colorFromNode(node.args[0]);
  return;
}
function fillLineCommandFromNode(node) {
  if (!node)
    return null;
  if (node.type === "markupCommand" && node.command === "fill-line")
    return node;
  if (node.type !== "markupBlock")
    return null;
  const meaningful = node.children.filter((child) => !(child.type === "markupText" && child.text.trim().length === 0));
  return meaningful.length === 1 ? fillLineCommandFromNode(meaningful[0]) : null;
}

// src/music-input/lilypond/markup-payload/graphics.ts
function meaningfulNodes(nodes) {
  return nodes.filter((node) => !(node.type === "markupText" && node.text.trim().length === 0));
}
function markupCommandItems(node) {
  const blockArg = node.args.find(isMarkupBlockNode);
  return blockArg ? blockArg.children : node.args;
}
function parseMarkupNumber(text) {
  if (!text)
    return;
  const n = Number(text.replace(/^#/, "").trim());
  return Number.isFinite(n) ? n : undefined;
}
function parsePairLiteral(text) {
  if (!text)
    return null;
  const numbers = text.match(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/g)?.map(Number).filter(Number.isFinite);
  return numbers && numbers.length >= 2 ? [numbers[0], numbers[1]] : null;
}
function shiftGraphics(graphics, dx) {
  if (dx === 0)
    return graphics;
  return graphics.map((graphic) => graphic.type === "filledBox" ? { ...graphic, x0: graphic.x0 + dx, x1: graphic.x1 + dx } : graphic);
}
function shiftPayload(payload, dx) {
  if (!payload)
    return;
  return {
    ...payload,
    textOffsetXStaffSpaces: (payload.textOffsetXStaffSpaces ?? 0) + dx
  };
}
function mergePayload(a, b) {
  if (!a)
    return b;
  if (!b)
    return a;
  const lineGapBeforeStaffSpaces = [
    ...a.lineGapBeforeStaffSpaces ?? [],
    ...b.lineGapBeforeStaffSpaces ?? []
  ];
  const lineGapAfterStaffSpaces = [
    ...a.lineGapAfterStaffSpaces ?? [],
    ...b.lineGapAfterStaffSpaces ?? []
  ];
  return {
    text: [a.text, b.text].filter((text) => text.length > 0).join(`
`),
    style: a.style,
    ...a.runs || b.runs ? { runs: [...a.runs ?? [{ text: a.text }], { text: `
` }, ...b.runs ?? [{ text: b.text }]] } : {},
    ...a.graphics || b.graphics ? { graphics: [...a.graphics ?? [], ...b.graphics ?? []] } : {},
    ...lineGapBeforeStaffSpaces.some((gap) => gap !== 0) ? { lineGapBeforeStaffSpaces } : {},
    ...lineGapAfterStaffSpaces.some((gap) => gap !== 0) ? { lineGapAfterStaffSpaces } : {},
    textOffsetXStaffSpaces: a.textOffsetXStaffSpaces,
    textOffsetYStaffSpaces: a.textOffsetYStaffSpaces
  };
}
function composeGraphicalMarkupNode(node, extractPlainPayload, ctx = {}) {
  if (node.type === "markupText")
    return null;
  if (node.type === "markupList") {
    const items = meaningfulNodes(node.items);
    return items.length === 1 ? composeGraphicalMarkupNode(items[0], extractPlainPayload, ctx) : null;
  }
  if (node.type === "markupBlock") {
    const items = meaningfulNodes(node.children);
    if (items.length === 0)
      return { graphics: [], widthStaffSpaces: 0 };
    if (items.length === 1)
      return composeGraphicalMarkupNode(items[0], extractPlainPayload, ctx);
    return composeConcatItems(items, extractPlainPayload, ctx);
  }
  const cmd = node.command;
  if (cmd === "with-color") {
    const color = colorFromNode(node.args[0]);
    const content = meaningfulNodes(node.args.slice(1));
    const nextCtx = { ...ctx, ...color ? { color } : {} };
    if (content.length === 0)
      return null;
    if (content.length === 1)
      return composeGraphicalMarkupNode(content[0], extractPlainPayload, nextCtx);
    return composeConcatItems(content, extractPlainPayload, nextCtx);
  }
  if (cmd === "filled-box") {
    const xPair = parsePairLiteral(node.args[0]?.type === "markupText" ? node.args[0].text : undefined);
    const yPair = parsePairLiteral(node.args[1]?.type === "markupText" ? node.args[1].text : undefined);
    const blot = parseMarkupNumber(node.args[2]?.type === "markupText" ? node.args[2].text : undefined) ?? 0;
    if (!xPair || !yPair)
      return null;
    const [x0, x1] = xPair;
    const [y0, y1] = yPair;
    return {
      graphics: [{ type: "filledBox", x0, x1, y0, y1, blot, ...ctx.color ? { color: ctx.color } : {} }],
      widthStaffSpaces: Math.max(0, x1 - x0)
    };
  }
  if (cmd === "hspace") {
    const amount = parseMarkupNumber(node.args[0]?.type === "markupText" ? node.args[0].text : undefined) ?? 0;
    return { graphics: [], widthStaffSpaces: amount };
  }
  if (cmd === "concat" || cmd === "line") {
    return composeConcatItems(meaningfulNodes(markupCommandItems(node)), extractPlainPayload, ctx);
  }
  if (cmd === "combine") {
    let graphics = [];
    let payload;
    let widthStaffSpaces = 0;
    for (const arg of node.args) {
      const composed = composeGraphicalMarkupNode(arg, extractPlainPayload, ctx);
      if (!composed)
        continue;
      graphics = graphics.concat(composed.graphics);
      payload = mergePayload(payload, composed.payload);
      widthStaffSpaces = Math.max(widthStaffSpaces, composed.widthStaffSpaces);
    }
    return graphics.length > 0 || payload ? { graphics, ...payload ? { payload } : {}, widthStaffSpaces } : null;
  }
  if (cmd === "column" || cmd === "typewriter" || cmd === "bold" || cmd === "italic" || cmd === "smallCaps" || cmd === "fontsize" || cmd === "larger" || cmd === "smaller" || cmd === "small" || cmd === "wordwrap") {
    const payload = extractPlainPayload([node]);
    return payload.text.trim().length > 0 ? { graphics: [], payload, widthStaffSpaces: 0 } : { graphics: [], widthStaffSpaces: 0 };
  }
  return null;
}
function composeConcatItems(items, extractPlainPayload, ctx) {
  let cursorX = 0;
  let graphics = [];
  let payload;
  for (const item of items) {
    const composed = composeGraphicalMarkupNode(item, extractPlainPayload, ctx);
    if (!composed)
      continue;
    graphics = graphics.concat(shiftGraphics(composed.graphics, cursorX));
    payload = mergePayload(payload, shiftPayload(composed.payload, cursorX));
    cursorX += composed.widthStaffSpaces;
  }
  return graphics.length > 0 || payload ? { graphics, ...payload ? { payload } : {}, widthStaffSpaces: cursorX } : null;
}
function extractGraphicalMarkupPayload(children, extractPlainPayload) {
  const roots = meaningfulNodes(children);
  if (roots.length !== 1)
    return null;
  const composed = composeGraphicalMarkupNode(roots[0], extractPlainPayload);
  if (!composed || composed.graphics.length === 0)
    return null;
  return {
    text: composed.payload?.text ?? "",
    style: composed.payload?.style ?? {},
    ...composed.payload?.runs ? { runs: composed.payload.runs } : {},
    graphics: composed.graphics,
    ...composed.payload?.textOffsetXStaffSpaces != null ? { textOffsetXStaffSpaces: composed.payload.textOffsetXStaffSpaces } : {},
    ...composed.payload?.textOffsetYStaffSpaces != null ? { textOffsetYStaffSpaces: composed.payload.textOffsetYStaffSpaces } : {}
  };
}

// src/music-input/lilypond/markup-payload/runs.ts
var MIN_FONT_SCALE = Math.pow(2, -10 / 6);
function styleFromContext(ctx) {
  return {
    ...ctx.bold ? { bold: true } : {},
    ...ctx.italic ? { italic: true } : {},
    ...ctx.color ? { color: ctx.color } : {},
    ...ctx.code ? { code: true } : {},
    ...ctx.smallCaps ? { smallCaps: true } : {},
    ...ctx.fontSizeScale != null ? { fontSizeScale: ctx.fontSizeScale } : {}
  };
}
function musicGlyphChar(glyphName) {
  const glyphs = {
    keyboardPedalPed: "",
    keyboardPedalUp: "",
    "accidentals.sharp": "♯",
    "accidentals.flat": "♭",
    "accidentals.natural": "♮",
    "accidentals.doubleSharp": "\uD834\uDD2A",
    "accidentals.flatflat": "\uD834\uDD2B"
  };
  return glyphs[glyphName];
}
function hasRunUnsupportedCommand(node) {
  if (node.type === "markupText")
    return false;
  if (node.type === "markupBlock")
    return node.children.some(hasRunUnsupportedCommand);
  if (node.type === "markupList")
    return node.items.some(hasRunUnsupportedCommand);
  const supported = new Set([
    "bold",
    "italic",
    "typewriter",
    "smallCaps",
    "wordwrap",
    "justify",
    "large",
    "huge",
    "larger",
    "smaller",
    "small",
    "fontsize",
    "with-color",
    "line",
    "concat",
    "fill-line",
    "column",
    "center-column",
    "right-column",
    "left-column",
    "vcenter",
    "vspace",
    "musicglyph"
  ]);
  return !supported.has(node.command) || node.args.some(hasRunUnsupportedCommand);
}
function trimRuns(runs) {
  const out = runs.slice();
  while (out.length > 0 && out[0].text.trim().length === 0)
    out.shift();
  while (out.length > 0 && out[out.length - 1].text.trim().length === 0)
    out.pop();
  return out;
}
function normalizeRunsAgainstGlobalStyle(runs, style) {
  const normalized = trimRuns(runs).map((run) => {
    const next = { ...run };
    if (style.bold)
      delete next.bold;
    if (style.italic)
      delete next.italic;
    if (style.code)
      delete next.code;
    if (style.smallCaps)
      delete next.smallCaps;
    if (style.color && next.color === style.color)
      delete next.color;
    if (style.fontSizeScale != null && next.fontSizeScale != null && Math.abs(next.fontSizeScale - style.fontSizeScale) < 0.000000001) {
      delete next.fontSizeScale;
    }
    return next;
  });
  const hasScopedStyle = normalized.some((run) => Boolean(run.bold || run.italic || run.code || run.smallCaps || run.color || run.fontSizeScale != null || run.musicGlyph || run.wordwrapLine || run.wordwrapUnit));
  return hasScopedStyle ? normalized : undefined;
}
function extractScopedMarkupRuns(children, style) {
  if (children.some(hasRunUnsupportedCommand))
    return;
  const runs = [];
  let lastChunk = "";
  const appendRun = (raw, ctx) => {
    if (raw.length === 0)
      return;
    const unescaped = unescapeMarkupString(raw);
    const isWordwrapUnit = Boolean(ctx.wordwrap && /\S\s+\S/.test(unescaped.trim()));
    const text = isWordwrapUnit ? unescaped.trim() : unescaped;
    if (text.trim().length === 0)
      return;
    if (shouldInsertSpace(lastChunk, text)) {
      runs.push({ text: " " });
      lastChunk = " ";
    }
    runs.push({ text, ...isWordwrapUnit ? { wordwrapUnit: true } : {}, ...styleFromContext(ctx) });
    lastChunk = text;
  };
  const appendNewline = () => {
    if (runs.length === 0 || lastChunk.endsWith(`
`))
      return;
    runs.push({ text: `
` });
    lastChunk = `
`;
  };
  const visitList = (nodes, ctx) => {
    for (const node of nodes)
      visit(node, ctx);
  };
  const visitColumnArgs = (args, ctx) => {
    const blockArg = args.find(isMarkupBlockNode);
    const items = blockArg?.children ?? args;
    let first = true;
    for (const item of items) {
      if (item.type === "markupText" && item.text.trim().length === 0)
        continue;
      if (!first)
        appendNewline();
      visit(item, ctx);
      first = false;
    }
  };
  const visit = (node, ctx) => {
    if (node.type === "markupText") {
      appendRun(node.text, ctx);
      return;
    }
    if (node.type === "markupBlock") {
      visitList(node.children, ctx);
      return;
    }
    if (node.type === "markupList") {
      let first = true;
      for (const item of node.items) {
        if (!first)
          appendNewline();
        visit(item, ctx);
        first = false;
      }
      return;
    }
    const cmd = node.command;
    if (cmd === "bold")
      return visitList(node.args, { ...ctx, bold: true });
    if (cmd === "italic")
      return visitList(node.args, { ...ctx, italic: true });
    if (cmd === "typewriter")
      return visitList(node.args, { ...ctx, code: true });
    if (cmd === "smallCaps")
      return visitList(node.args, { ...ctx, smallCaps: true });
    if (cmd === "wordwrap" || cmd === "justify")
      return visitList(node.args, { ...ctx, wordwrap: true });
    if (cmd === "large")
      return visitList(node.args, { ...ctx, fontSizeScale: (ctx.fontSizeScale ?? 1) * 1.2 });
    if (cmd === "huge")
      return visitList(node.args, { ...ctx, fontSizeScale: (ctx.fontSizeScale ?? 1) * 1.44 });
    if (cmd === "larger")
      return visitList(node.args, { ...ctx, fontSizeScale: (ctx.fontSizeScale ?? 1) * Math.pow(2, 1 / 6) });
    if (cmd === "smaller" || cmd === "small") {
      return visitList(node.args, {
        ...ctx,
        fontSizeScale: Math.max((ctx.fontSizeScale ?? 1) * Math.pow(2, -1 / 6), MIN_FONT_SCALE)
      });
    }
    if (cmd === "fontsize") {
      const numArg = node.args[0];
      const contentArgs = node.args.slice(1);
      const n = numArg?.type === "markupText" ? parseFloat(numArg.text) : NaN;
      const scale = Number.isFinite(n) ? Math.max((ctx.fontSizeScale ?? 1) * Math.pow(2, n / 6), MIN_FONT_SCALE) : ctx.fontSizeScale ?? 1;
      return visitList(contentArgs, { ...ctx, fontSizeScale: scale });
    }
    if (cmd === "with-color") {
      const color = colorFromNode(node.args[0]);
      return visitList(node.args.slice(1), { ...ctx, ...color ? { color } : {} });
    }
    if (cmd === "column" || cmd === "center-column" || cmd === "right-column" || cmd === "left-column") {
      return visitColumnArgs(node.args, ctx);
    }
    if (cmd === "vcenter") {
      return visitList(node.args, ctx);
    }
    if (cmd === "vspace") {
      appendNewline();
      return;
    }
    if (cmd === "musicglyph") {
      const nameArg = node.args[0];
      const glyphName = nameArg?.type === "markupText" ? nameArg.text.replace(/^"|"$/g, "") : "";
      const glyph = musicGlyphChar(glyphName);
      if (!glyph)
        return;
      if (shouldInsertSpace(lastChunk, glyph)) {
        runs.push({ text: " " });
        lastChunk = " ";
      }
      runs.push({ text: glyph, musicGlyph: true, ...styleFromContext(ctx) });
      lastChunk = glyph;
      return;
    }
    visitList(node.args, ctx);
  };
  visitList(children, {});
  return normalizeRunsAgainstGlobalStyle(runs, style);
}

// src/music-input/lilypond/markup-payload/text.ts
var SUBSCRIPT_SHIFT_STAFF_SPACES = 2.2 * 0.25;
function extractMarkupPayload(children, opts = {}) {
  if (!opts.skipGraphical) {
    const graphicalPayload = extractGraphicalMarkupPayload(children, (nodes) => extractMarkupPayload(nodes, { skipGraphical: true }));
    if (graphicalPayload)
      return graphicalPayload;
  }
  const out = [], style = {};
  let lastChunk = "";
  let meaningfulTextNodeCount = 0, codeMeaningfulTextNodeCount = 0, italicMeaningfulTextNodeCount = 0, boldMeaningfulTextNodeCount = 0;
  let coloredMeaningfulTextNodeCount = 0, largeMeaningfulTextNodeCount = 0, hugeMeaningfulTextNodeCount = 0, smallCapsMeaningfulTextNodeCount = 0;
  let lastMeaningfulText = "";
  let uniformColor, uniformFontSizeScale;
  let mixedColor = false, mixedFontSizeScale = false;
  const appendText = (raw) => {
    if (raw.length === 0)
      return;
    const text2 = unescapeMarkupString(raw);
    if (text2.trim().length === 0 && lastChunk.length === 0)
      return;
    if (text2.trim().length === 0 && lastChunk.length > 0 && lastChunk[lastChunk.length - 1] <= " ")
      return;
    if (shouldInsertSpace(lastChunk, text2))
      out.push(" ");
    out.push(text2);
    lastChunk = text2;
  };
  const appendCommandToken = (cmd) => {
    if (shouldInsertSpace(lastChunk, cmd))
      out.push(" ");
    out.push(cmd);
    lastChunk = cmd;
  };
  const appendControlToken = (cmd) => {
    out.push(" ");
    out.push(cmd);
    lastChunk = cmd;
  };
  const appendNewline = () => {
    out.push(`
`);
    lastChunk = `
`;
  };
  const appendSpace = () => {
    out.push(" ");
    lastChunk = " ";
  };
  const appendShapeOverrideTokens = (ctx) => {
    if (ctx.boxPadding != null)
      appendControlToken(`\\boxpad#${ctx.boxPadding}`);
    if (ctx.thickness != null)
      appendControlToken(`\\thickness#${ctx.thickness}`);
    if (ctx.cornerRadius != null)
      appendControlToken(`\\cornerradius#${ctx.cornerRadius}`);
  };
  const recordInlineShape = () => {
    style.hasInlineShape = true;
  };
  const recordLoweredInlineShift = (amountStaffSpaces) => {
    if (!Number.isFinite(amountStaffSpaces) || amountStaffSpaces <= 0)
      return;
    style.loweredInlineShiftStaffSpaces = Math.max(style.loweredInlineShiftStaffSpaces ?? 0, amountStaffSpaces);
  };
  const visit = (node, ctx) => {
    if (node.type === "markupText") {
      appendText(node.text);
      if (node.text.trim().length > 0) {
        lastMeaningfulText = unescapeMarkupString(node.text);
        meaningfulTextNodeCount++;
        if (ctx.code)
          codeMeaningfulTextNodeCount++;
        if (ctx.bold)
          boldMeaningfulTextNodeCount++;
        if (ctx.italic)
          italicMeaningfulTextNodeCount++;
        if (ctx.large)
          largeMeaningfulTextNodeCount++;
        if (ctx.huge)
          hugeMeaningfulTextNodeCount++;
        if (ctx.smallCaps)
          smallCapsMeaningfulTextNodeCount++;
        if (ctx.color) {
          coloredMeaningfulTextNodeCount++;
          if (uniformColor === undefined)
            uniformColor = ctx.color;
          else if (uniformColor !== ctx.color)
            mixedColor = true;
        }
        if (ctx.fontSizeScale != null) {
          if (uniformFontSizeScale === undefined)
            uniformFontSizeScale = ctx.fontSizeScale;
          else if (uniformFontSizeScale !== ctx.fontSizeScale)
            mixedFontSizeScale = true;
        }
        if (ctx.circled)
          style.circled = true;
        if (ctx.boxed)
          style.boxed = true;
        if (ctx.rounded)
          style.rounded = true;
      }
      if (ctx.wordwrap)
        style.wordwrap = true;
      if (ctx.align)
        style.align = ctx.align;
      return;
    }
    if (node.type === "markupBlock") {
      let pendingOverride = {};
      for (let i = 0;i < node.children.length; i++) {
        const child = node.children[i];
        const parsedOverride = parseOverrideFromChildren(node.children, i);
        if (parsedOverride) {
          pendingOverride = { ...pendingOverride, ...parsedOverride.style };
          i = parsedOverride.nextIndex - 1;
          continue;
        }
        const childCtx = Object.keys(pendingOverride).length > 0 ? { ...ctx, ...pendingOverride } : ctx;
        visit(child, childCtx);
        if (!(child.type === "markupText" && child.text.trim().length === 0)) {
          pendingOverride = {};
        }
      }
      return;
    }
    if (node.type === "markupList") {
      let first = true;
      for (const item of node.items) {
        if (item.type === "markupText" && item.text.trim().length === 0)
          continue;
        if (!first)
          appendNewline();
        visit(item, ctx);
        first = false;
      }
      return;
    }
    if (node.type === "markupCommand") {
      const cmd = node.command;
      if (cmd === "bold") {
        if (node.args.length > 0)
          appendCommandToken("\\bold");
        for (const arg of node.args) {
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          visit(arg, { ...ctx, bold: true });
        }
        return;
      }
      if (cmd === "italic") {
        if (node.args.length > 0)
          appendCommandToken("\\italic");
        for (const arg of node.args) {
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          visit(arg, { ...ctx, italic: true });
        }
        return;
      }
      if (cmd === "typewriter") {
        for (const arg of node.args) {
          const colBlock = columnBlockFromTypewriterArg(arg);
          if (colBlock) {
            let first = true;
            for (const child of colBlock.children) {
              if (child.type === "markupText" && child.text.trim().length === 0)
                continue;
              if (!first)
                appendNewline();
              visit(child, { ...ctx, code: true });
              first = false;
            }
            return;
          }
        }
        if (node.args.length > 0)
          appendCommandToken("\\typewriter");
        for (const arg of node.args) {
          if (arg.type === "markupBlock") {
            const meaningful = arg.children.filter((child) => !(child.type === "markupText" && child.text.trim().length === 0));
            if (meaningful.length > 1 && meaningful.every((child) => child.type === "markupText")) {
              let first = true;
              for (const child of meaningful) {
                if (!first)
                  appendNewline();
                visit(child, { ...ctx, code: true });
                first = false;
              }
              continue;
            }
          }
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          visit(arg, { ...ctx, code: true });
        }
        return;
      }
      if (cmd === "smallCaps") {
        if (node.args.length > 0)
          appendCommandToken("\\smallCaps");
        for (const arg of node.args) {
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          visit(arg, { ...ctx, smallCaps: true });
        }
        return;
      }
      if (cmd === "wordwrap" || cmd === "justify") {
        for (const arg of node.args)
          visit(arg, { ...ctx, wordwrap: true });
        return;
      }
      if (cmd === "large") {
        for (const arg of node.args)
          visit(arg, { ...ctx, large: true });
        return;
      }
      if (cmd === "huge") {
        for (const arg of node.args)
          visit(arg, { ...ctx, huge: true });
        return;
      }
      if (cmd === "larger") {
        const scale = (ctx.fontSizeScale ?? 1) * Math.pow(2, 1 / 6);
        for (const arg of node.args)
          visit(arg, { ...ctx, fontSizeScale: scale });
        return;
      }
      if (cmd === "smaller") {
        const scale = (ctx.fontSizeScale ?? 1) * Math.pow(2, -1 / 6);
        for (const arg of node.args)
          visit(arg, { ...ctx, fontSizeScale: scale });
        return;
      }
      if (cmd === "small") {
        const scale = (ctx.fontSizeScale ?? 1) * Math.pow(2, -1 / 6);
        for (const arg of node.args)
          visit(arg, { ...ctx, fontSizeScale: scale });
        return;
      }
      if (cmd === "fontsize") {
        const numArg = node.args[0];
        const contentArgs = node.args.slice(1);
        const n = numArg?.type === "markupText" ? parseFloat(numArg.text) : NaN;
        const scale = Number.isFinite(n) ? (ctx.fontSizeScale ?? 1) * Math.pow(2, n / 6) : ctx.fontSizeScale ?? 1;
        for (const arg of contentArgs)
          visit(arg, { ...ctx, fontSizeScale: scale });
        return;
      }
      if (cmd === "circle") {
        const hasInlinePrefix = out.some((chunk) => chunk.trim().length > 0);
        if (hasInlinePrefix) {
          recordInlineShape();
          appendShapeOverrideTokens(ctx);
          appendCommandToken("\\circled-start");
          for (const arg of node.args)
            visit(arg, ctx);
          appendControlToken("\\circled-end");
          return;
        }
        if (ctx.boxPadding != null)
          style.boxPadding = ctx.boxPadding;
        if (ctx.thickness != null)
          style.thickness = ctx.thickness;
        for (const arg of node.args)
          visit(arg, { ...ctx, circled: true });
        return;
      }
      if (cmd === "combine") {
        const primary = node.args[0];
        const secondary = node.args[1];
        if (primary) {
          const primaryPayload = extractMarkupPayload([primary]);
          const styleTokens = [
            primaryPayload.style.color ? `\\with-color "${primaryPayload.style.color}"` : null,
            primaryPayload.style.code ? "\\typewriter" : null,
            primaryPayload.style.smallCaps ? "\\smallCaps" : null,
            primaryPayload.style.italic ? "\\italic" : null,
            primaryPayload.style.bold ? "\\bold" : null
          ].filter(Boolean);
          if (styleTokens.length > 0)
            appendCommandToken(styleTokens.join(" "));
          if (primaryPayload.style.fontSizeScale != null)
            style.fontSizeScale = primaryPayload.style.fontSizeScale;
          appendText(primaryPayload.text);
        }
        const drawToken = drawLineTokenFromNode(secondary);
        if (drawToken) {
          style.hasDrawLine = true;
          appendControlToken(drawToken);
        }
        return;
      }
      if (cmd === "box") {
        const fillLine = node.args.map(fillLineCommandFromNode).find(Boolean);
        if (fillLine && fillLine.type === "markupCommand") {
          style.boxed = true;
          style.fullWidth = true;
          style.align = "center";
          if (ctx.boxPadding != null)
            style.boxPadding = ctx.boxPadding;
          if (ctx.thickness != null)
            style.thickness = ctx.thickness;
          for (const arg of fillLine.args)
            visit(arg, { ...ctx, boxed: true, align: "center" });
          return;
        }
        const isMeaningfulNode = (arg) => !(arg.type === "markupText" && arg.text.trim().length === 0);
        const isGroupingCommand = (arg) => arg.type === "markupCommand" && (arg.command === "line" || arg.command === "column" || arg.command === "concat");
        if (node.args.length === 1 && node.args[0]?.type === "markupBlock") {
          const meaningful = node.args[0].children.filter(isMeaningfulNode);
          const distribute = meaningful.length > 1 && !(meaningful.length === 1 && isGroupingCommand(meaningful[0]));
          if (distribute) {
            let first = true;
            for (const child of meaningful) {
              if (!first)
                appendSpace();
              recordInlineShape();
              appendShapeOverrideTokens(ctx);
              appendCommandToken("\\boxed-run");
              visit(child, ctx);
              first = false;
            }
            return;
          }
        }
        const hasInlinePrefix = out.some((chunk) => chunk.trim().length > 0);
        if (hasInlinePrefix) {
          recordInlineShape();
          appendShapeOverrideTokens(ctx);
          appendCommandToken("\\boxed-start");
          for (const arg of node.args)
            visit(arg, ctx);
          appendControlToken("\\boxed-end");
          return;
        }
        if (ctx.boxPadding != null)
          style.boxPadding = ctx.boxPadding;
        if (ctx.thickness != null)
          style.thickness = ctx.thickness;
        for (const arg of node.args)
          visit(arg, { ...ctx, boxed: true });
        return;
      }
      if (cmd === "rounded-box") {
        const hasInlinePrefix = out.some((chunk) => chunk.trim().length > 0);
        if (hasInlinePrefix) {
          recordInlineShape();
          appendShapeOverrideTokens(ctx);
          appendCommandToken("\\rounded-start");
          for (const arg of node.args)
            visit(arg, ctx);
          appendControlToken("\\rounded-end");
          return;
        }
        if (ctx.boxPadding != null)
          style.boxPadding = ctx.boxPadding;
        if (ctx.thickness != null)
          style.thickness = ctx.thickness;
        if (ctx.cornerRadius != null)
          style.cornerRadius = ctx.cornerRadius;
        style.rounded = true;
        for (const arg of node.args)
          visit(arg, { ...ctx, boxed: true, rounded: true });
        return;
      }
      if (cmd === "center-column" || cmd === "right-column" || cmd === "left-column") {
        const align = cmd === "right-column" ? "right" : cmd === "left-column" ? "left" : "center";
        const blockArg = node.args.find(isMarkupBlockNode);
        if (style.align === undefined)
          style.align = align;
        let first = true;
        for (const arg of blockArg ? blockArg.children : node.args) {
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          if (!first)
            appendNewline();
          visit(arg, { ...ctx, align });
          first = false;
        }
        return;
      }
      if (cmd === "with-color") {
        const color = colorFromNode(node.args[0]);
        for (const arg of node.args.slice(1))
          visit(arg, { ...ctx, ...color ? { color } : {} });
        return;
      }
      if (cmd === "column") {
        const blockArg = node.args.find(isMarkupBlockNode);
        if (blockArg) {
          let first = true;
          let pendingOverride = {};
          for (let i = 0;i < blockArg.children.length; i++) {
            const child = blockArg.children[i];
            const parsedOverride = parseOverrideFromChildren(blockArg.children, i);
            if (parsedOverride) {
              pendingOverride = { ...pendingOverride, ...parsedOverride.style };
              i = parsedOverride.nextIndex - 1;
              continue;
            }
            if (child.type === "markupText" && child.text.trim().length === 0) {
              if (ctx.code && !first) {
                if (child.text.length === 0) {
                  appendNewline();
                  continue;
                }
                const newlines = (child.text.match(/\n/g) || []).length;
                if (newlines >= 2) {
                  appendNewline();
                }
              }
              continue;
            }
            if (!first)
              appendNewline();
            const childCtx = Object.keys(pendingOverride).length > 0 ? { ...ctx, ...pendingOverride } : ctx;
            visit(child, childCtx);
            first = false;
            pendingOverride = {};
          }
          return;
        }
        let firstArg = true;
        for (const arg of node.args) {
          if (!firstArg)
            appendNewline();
          visit(arg, ctx);
          firstArg = false;
        }
        return;
      }
      if (cmd === "line") {
        const args = node.args.length === 1 && node.args[0]?.type === "markupBlock" ? node.args[0].children : node.args;
        let first = true;
        let pendingOverride = {};
        for (let i = 0;i < args.length; i++) {
          const arg = args[i];
          const parsedOverride = parseOverrideFromChildren(args, i);
          if (parsedOverride) {
            pendingOverride = { ...pendingOverride, ...parsedOverride.style };
            i = parsedOverride.nextIndex - 1;
            continue;
          }
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          if (!first && lastChunk !== `
` && !/\s$/.test(lastChunk))
            appendSpace();
          const inlineArg = arg.type === "markupBlock" ? { ...arg, children: arg.children.filter((child) => !(child.type === "markupText" && child.text.trim().length === 0)) } : arg;
          const childCtx = Object.keys(pendingOverride).length > 0 ? { ...ctx, ...pendingOverride } : ctx;
          visit(inlineArg, childCtx);
          first = false;
          pendingOverride = {};
        }
        return;
      }
      if (cmd === "concat") {
        let pendingOverride = {};
        for (let i = 0;i < node.args.length; i++) {
          const arg = node.args[i];
          const parsedOverride = parseOverrideFromChildren(node.args, i);
          if (parsedOverride) {
            pendingOverride = { ...pendingOverride, ...parsedOverride.style };
            i = parsedOverride.nextIndex - 1;
            continue;
          }
          if (arg.type === "markupText" && arg.text.trim().length === 0)
            continue;
          const inlineArg = arg.type === "markupBlock" ? { ...arg, children: arg.children.filter((child) => !(child.type === "markupText" && child.text.trim().length === 0)) } : arg;
          const childCtx = Object.keys(pendingOverride).length > 0 ? { ...ctx, ...pendingOverride } : ctx;
          visit(inlineArg, childCtx);
          pendingOverride = {};
        }
        return;
      }
      if (cmd === "fill-line") {
        for (const arg of node.args)
          visit(arg, ctx);
        return;
      }
      if (cmd === "vcenter") {
        for (const arg of node.args)
          visit(arg, ctx);
        return;
      }
      if (cmd === "vspace") {
        appendNewline();
        return;
      }
      if (cmd === "sub") {
        if (node.args.length > 0) {
          recordLoweredInlineShift(SUBSCRIPT_SHIFT_STAFF_SPACES);
          appendCommandToken("\\sub");
        }
        for (const arg of node.args)
          visit(arg, ctx);
        return;
      }
      if (cmd === "super") {
        if (node.args.length > 0)
          appendCommandToken("\\super");
        for (const arg of node.args)
          visit(arg, ctx);
        return;
      }
      if (cmd === "raise" || cmd === "lower") {
        const numArg = node.args[0];
        const n = numArg?.type === "markupText" ? numArg.text.trim() : "";
        if (cmd === "lower")
          recordLoweredInlineShift(Number(n.replace(/^#/, "")));
        if (n)
          appendCommandToken(`\\${cmd}#${n}`);
        for (const arg of node.args.slice(1))
          visit(arg, ctx);
        return;
      }
      if (cmd === "hspace" || cmd === "pad-markup" || cmd === "pad-x" || cmd === "pad-y" || cmd === "translate" || cmd === "translate-scaled") {
        return;
      }
      if (cmd === "override" || cmd === "revert" || cmd === "set" || cmd === "once" || cmd === "undo" || cmd === "tweak") {
        return;
      }
      if (cmd === "musicglyph") {
        const nameArg = node.args[0];
        const glyphName = nameArg?.type === "markupText" ? nameArg.text.replace(/^"|"$/g, "") : "";
        const unicode = {
          "accidentals.sharp": "♯",
          "accidentals.flat": "♭",
          "accidentals.natural": "♮",
          "accidentals.doubleSharp": "\uD834\uDD2A",
          "accidentals.flatflat": "\uD834\uDD2B",
          keyboardPedalPed: "",
          keyboardPedalUp: ""
        };
        const ch = unicode[glyphName];
        if (ch)
          appendText(ch);
        return;
      }
      for (const arg of node.args)
        visit(arg, ctx);
    }
  };
  for (const child of children)
    visit(child, {});
  if (meaningfulTextNodeCount > 0 && boldMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.bold = true;
  if (meaningfulTextNodeCount > 0 && italicMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.italic = true;
  if (meaningfulTextNodeCount > 0 && codeMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.code = true;
  if (meaningfulTextNodeCount > 0 && largeMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.large = true;
  if (meaningfulTextNodeCount > 0 && hugeMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.huge = true;
  if (meaningfulTextNodeCount > 0 && smallCapsMeaningfulTextNodeCount === meaningfulTextNodeCount)
    style.smallCaps = true;
  if (meaningfulTextNodeCount > 0 && !mixedFontSizeScale && uniformFontSizeScale != null)
    style.fontSizeScale = uniformFontSizeScale;
  if (meaningfulTextNodeCount > 0 && coloredMeaningfulTextNodeCount === meaningfulTextNodeCount && !mixedColor && uniformColor) {
    style.color = uniformColor;
  }
  let text = out.join("");
  if (!style.code) {
    text = text.replace(/[ \t]+\n/g, `
`);
  }
  if (style.wordwrap) {
    text = text.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  } else if (style.code) {
    const preserveTrailingSpace = meaningfulTextNodeCount === 1 && /\s$/.test(lastMeaningfulText);
    text = text.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    if (!preserveTrailingSpace)
      text = text.replace(/[ \t]+$/, "");
  } else {
    text = text.trim();
  }
  if (style.bold)
    text = text.replace(/^\\bold\s*/, "");
  if (style.italic)
    text = text.replace(/^\\italic\s*/, "");
  if (style.code) {
    text = text.replace(/^[ \t]*\\typewriter([ \t]?)/, (match2, sep, offset, whole) => {
      const next = whole[offset + match2.length] ?? "";
      return sep && next && next > " " ? "" : sep;
    });
  }
  if (style.smallCaps)
    text = text.replace(/^\\smallCaps\s*/, "");
  const runs = extractScopedMarkupRuns(children, style);
  return { text, style, ...runs ? { runs } : {} };
}
// src/music-input/lilypond/markup-payload/blocks.ts
function findColumnChildren(nodes) {
  const meaningful = nodes.filter(isMeaningfulMarkupNode);
  const first = meaningful[0];
  if (!first)
    return null;
  if (first.type === "markupList")
    return first.items;
  const fromCommand = (node) => {
    if (node.command === "vcenter")
      return findColumnChildren(node.args);
    const isColCmd = node.command === "column" || node.command === "center-column" || node.command === "right-column" || node.command === "left-column";
    if (!isColCmd)
      return null;
    const blockArg = node.args.find(isMarkupBlockNode);
    return blockArg?.children ?? null;
  };
  if (first.type === "markupCommand")
    return fromCommand(first);
  if (first.type === "markupBlock") {
    const meaningfulNested = first.children.filter(isMeaningfulMarkupNode);
    if (meaningfulNested.length !== 1)
      return null;
    const nested = meaningfulNested[0];
    if (nested && nested.type === "markupCommand")
      return fromCommand(nested);
    if (nested && nested.type === "markupList")
      return nested.items;
  }
  return null;
}
function isMarkupListColumn(nodes) {
  const meaningful = nodes.filter(isMeaningfulMarkupNode);
  const first = meaningful[0];
  if (!first)
    return false;
  if (first.type === "markupList")
    return true;
  if (first.type === "markupCommand" && first.command === "vcenter")
    return isMarkupListColumn(first.args);
  if (first.type !== "markupBlock")
    return false;
  const nested = first.children.filter(isMeaningfulMarkupNode);
  return nested.length === 1 && nested[0]?.type === "markupList";
}
function wrapStyledLine(styleNode, child) {
  if (styleNode.command === "with-color" || styleNode.command === "fontsize") {
    return { ...styleNode, args: [...styleNode.args.slice(0, 1), child] };
  }
  return { ...styleNode, args: [child] };
}
function styleContentArgs(node) {
  if (node.command === "with-color" || node.command === "fontsize")
    return node.args.slice(1);
  return node.args;
}
function isBlockStyleCommand(node) {
  if (node.type !== "markupCommand")
    return false;
  return node.command === "typewriter" || node.command === "italic" || node.command === "bold" || node.command === "large" || node.command === "huge" || node.command === "larger" || node.command === "smaller" || node.command === "with-color" || node.command === "fontsize";
}
function isExplicitBlankCodeLineNode(styleNode, node) {
  const sourceSpan = node.loc ? (node.loc.endOffset ?? node.loc.offset) - node.loc.offset : 0;
  return styleNode.command === "typewriter" && node.type === "markupText" && node.text.trim().length === 0 && sourceSpan > node.text.length;
}
function isStyledBlockContentNode(styleNode, node) {
  return isMeaningfulMarkupNode(node) || isExplicitBlankCodeLineNode(styleNode, node);
}
function blankCodeLinePayload() {
  return { text: " ", style: { code: true }, runs: [{ text: " ", code: true }] };
}
function expandStyledBlockLines(node) {
  if (!isBlockStyleCommand(node))
    return null;
  const contentArgs = styleContentArgs(node).filter((arg) => isStyledBlockContentNode(node, arg));
  if (contentArgs.length === 0)
    return null;
  if (contentArgs.length > 1)
    return contentArgs.map((arg) => isVspaceNode(arg) ? arg : wrapStyledLine(node, arg));
  const onlyArg = contentArgs[0];
  const nestedColumn = findColumnChildren([onlyArg]);
  if (nestedColumn && nestedColumn.some((child) => isStyledBlockContentNode(node, child))) {
    return nestedColumn.filter((child) => isStyledBlockContentNode(node, child)).map((child) => isVspaceNode(child) ? child : wrapStyledLine(node, child));
  }
  if (onlyArg.type === "markupBlock") {
    const blockChildren = onlyArg.children.filter((child) => isStyledBlockContentNode(node, child));
    if (blockChildren.length > 1)
      return blockChildren.map((child) => isVspaceNode(child) ? child : wrapStyledLine(node, child));
  }
  return null;
}
function isVspaceNode(node) {
  return node.type === "markupCommand" && node.command === "vspace";
}
function parseVspaceStaffSpaces(node) {
  const raw = node.args.find((arg) => arg.type === "markupText")?.text.trim() ?? "";
  const value = Number(raw.replace(/^#/, ""));
  return Number.isFinite(value) ? value : 0;
}
function payloadLineCount(payload) {
  const textLineCount = payload.text.length > 0 ? payload.text.split(`
`).length : 1;
  if (payload.style.wordwrap)
    return textLineCount;
  const runLineCount = payload.runs ? payload.runs.reduce((count, run) => count + (run.text.match(/\n/g)?.length ?? 0), 1) : 1;
  return Math.max(1, textLineCount, runLineCount);
}
function addLineGap(payload, key, staffSpaces, lineIndex) {
  if (staffSpaces === 0)
    return payload;
  const lineCount = payloadLineCount(payload);
  const index = Math.max(0, Math.min(lineIndex, lineCount - 1));
  const gaps = Array.from({ length: lineCount }, (_, i) => payload[key]?.[i] ?? 0);
  gaps[index] = (gaps[index] ?? 0) + staffSpaces;
  return { ...payload, [key]: gaps };
}
function addGapBeforeFirstLine(payload, staffSpaces) {
  return addLineGap(payload, "lineGapBeforeStaffSpaces", staffSpaces, 0);
}
function addGapAfterLastLine(payload, staffSpaces) {
  return addLineGap(payload, "lineGapAfterStaffSpaces", staffSpaces, payloadLineCount(payload) - 1);
}
function extractMarkupPayloadBlocks(children) {
  const columnChildren = findColumnChildren(children);
  const compactLineGap = isMarkupListColumn(children);
  const meaningfulTop = children.filter(isMeaningfulMarkupNode);
  const exBlock = meaningfulTop.length === 1 && meaningfulTop[0]?.type === "markupCommand" && meaningfulTop[0].command === "ex-block" ? meaningfulTop[0] : null;
  if (exBlock) {
    const contentPayload = extractMarkupPayload(exBlock.args);
    if (contentPayload.text.trim().length > 0) {
      return [
        { text: "Example:", style: { bold: true, codeBlockHeading: true } },
        {
          text: contentPayload.text,
          style: { ...contentPayload.style, boxed: true }
        }
      ];
    }
  }
  if (columnChildren && columnChildren.length > 0) {
    const blocks = [];
    let pendingStyle = {};
    let pendingLineGapBeforeStaffSpaces = 0;
    const pushPayload = (payload2) => {
      const explicitBlankCodeLine = payload2.style.code === true && payload2.text.length > 0 && payload2.text.trim().length === 0;
      if (payload2.text.trim().length === 0 && !explicitBlankCodeLine)
        return;
      let styledPayload = {
        ...payload2,
        style: { ...pendingStyle, ...payload2.style }
      };
      if (pendingLineGapBeforeStaffSpaces !== 0) {
        styledPayload = addGapBeforeFirstLine(styledPayload, pendingLineGapBeforeStaffSpaces);
        pendingLineGapBeforeStaffSpaces = 0;
      }
      blocks.push(styledPayload);
      pendingStyle = {};
    };
    const applyVspace = (node) => {
      const staffSpaces = parseVspaceStaffSpaces(node);
      pendingLineGapBeforeStaffSpaces += staffSpaces;
    };
    for (let i = 0;i < columnChildren.length; i++) {
      const lineNode = columnChildren[i];
      const parsedOverride = parseOverrideFromChildren(columnChildren, i);
      if (parsedOverride) {
        pendingStyle = { ...pendingStyle, ...parsedOverride.style };
        i = parsedOverride.nextIndex - 1;
        continue;
      }
      if (!isMeaningfulMarkupNode(lineNode))
        continue;
      if (isVspaceNode(lineNode)) {
        applyVspace(lineNode);
        continue;
      }
      const nestedColumnChildren = findColumnChildren([lineNode]);
      if (nestedColumnChildren && nestedColumnChildren.length > 0) {
        for (const payload3 of extractMarkupPayloadBlocks([lineNode])) {
          pushPayload(payload3);
        }
        continue;
      }
      const expandedLines = expandStyledBlockLines(lineNode);
      if (expandedLines) {
        for (const expandedLine of expandedLines) {
          if (isVspaceNode(expandedLine)) {
            applyVspace(expandedLine);
            continue;
          }
          const payload3 = expandedLine.type === "markupCommand" && expandedLine.command === "typewriter" && expandedLine.args.some((arg) => isExplicitBlankCodeLineNode(expandedLine, arg)) ? blankCodeLinePayload() : extractMarkupPayload([expandedLine]);
          pushPayload(payload3);
        }
        continue;
      }
      const payload2 = extractMarkupPayload([lineNode]);
      pushPayload(payload2);
    }
    if (pendingLineGapBeforeStaffSpaces !== 0 && blocks.length > 0) {
      const lastIndex = blocks.length - 1;
      blocks[lastIndex] = addGapAfterLastLine(blocks[lastIndex], pendingLineGapBeforeStaffSpaces);
    }
    if (blocks.length > 0) {
      return compactLineGap ? blocks.map((block) => ({ ...block, compactLineGap: true })) : blocks;
    }
  }
  const payload = extractMarkupPayload(children);
  if (!payload.text)
    return [];
  return [payload];
}
// src/music-input/lilypond/markup-payload/fillLine.ts
function unwrapToFillLineCommand(nodes) {
  const meaningful = nodes.filter(isMeaningfulMarkupNode);
  if (meaningful.length !== 1)
    return null;
  const node = meaningful[0];
  if (node.type === "markupCommand" && node.command === "fill-line")
    return node;
  if (node.type === "markupBlock")
    return unwrapToFillLineCommand(node.children);
  return null;
}
function extractFillLineColumns(children) {
  const fillLineNode = unwrapToFillLineCommand(children);
  if (!fillLineNode)
    return null;
  let colNodes;
  if (fillLineNode.args.length === 1 && fillLineNode.args[0]?.type === "markupBlock") {
    colNodes = fillLineNode.args[0].children.filter(isMeaningfulMarkupNode);
  } else {
    colNodes = fillLineNode.args.filter(isMeaningfulMarkupNode);
  }
  if (colNodes.length === 0)
    return null;
  return colNodes.map((colNode) => extractMarkupPayloadBlocks([colNode]));
}
// src/music-input/lilypond/phases/parser/primitives/attachments.ts
var DYNAMIC_COMMANDS = new Set([
  "p",
  "pp",
  "ppp",
  "pppp",
  "ppppp",
  "pppppp",
  "f",
  "ff",
  "fff",
  "ffff",
  "fffff",
  "ffffff",
  "mp",
  "mf",
  "fp",
  "fz",
  "sf",
  "sfz",
  "sff",
  "sffz",
  "rfz",
  "rf",
  "sfp",
  "sfpp",
  "sp",
  "spp",
  "n"
]);
var NOTE_ATTACHMENT_COMMANDS = new Set([
  "staccato",
  "tenuto",
  "accent",
  "downbow",
  "upbow",
  "fermata",
  "harmonic",
  "flageolet",
  "trill",
  "mordent",
  "turn",
  "reverseturn",
  "prall",
  "prallprall"
]);
function parseChord(state) {
  const openToken = expect(state, "chord_open", "Expected < for chord");
  if (!openToken)
    return null;
  const notes = [];
  const attachments = [];
  while (!isAtEnd(state) && !check(state, "chord_close")) {
    const tok = current(state);
    if (tok.kind === "note") {
      notes.push(parseNote(advance(state)));
      continue;
    }
    if (tok.kind === "command" && NOTE_ATTACHMENT_COMMANDS.has(tok.value)) {
      attachments.push({
        type: "articulation",
        symbol: tok.value,
        loc: tokenToLoc(tok)
      });
      advance(state);
      continue;
    }
    advance(state);
  }
  const closeToken = expect(state, "chord_close", "Expected > for chord");
  const durationToken = match(state, "number");
  const duration2 = durationToken ? parseDurationToken(durationToken.value) : null;
  const endToken = durationToken ?? closeToken;
  const endOffset = endToken ? endToken.end ?? endToken.pos + endToken.value.length : undefined;
  const loc = tokenToLoc(openToken);
  if (endOffset != null)
    loc.endOffset = endOffset;
  return {
    type: "chord",
    notes,
    ...attachments.length > 0 ? { attachments } : {},
    ...duration2 && { duration: duration2 },
    loc
  };
}
function normalizeAttachedMarkupText(s) {
  return s.replace(/[ \t]+\n/g, `
`).replace(/\n[ \t]+/g, `
`).replace(/[ \t]{2,}/g, " ").replace(/\n{2,}/g, `
`).replace(/^\n+/, "").replace(/\n+$/, "");
}
function flattenMarkupForAttachedText(nodes) {
  const out = [];
  let lastChunk = "";
  const style = {};
  const MIN_FONT_SCALE2 = Math.pow(2, -10 / 6);
  const unescapeMarkupString2 = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const shouldInsertSpace2 = (prev, next) => {
    if (!prev || !next)
      return false;
    if (prev.endsWith(`
`) || next.startsWith(`
`))
      return false;
    if (/\s$/.test(prev) || /^\s/.test(next))
      return false;
    if (/[0-9]$/.test(prev) && /^[A-Za-z]/.test(next))
      return false;
    if (/[A-Za-z]$/.test(prev) && /^[♮♯♭]/.test(next))
      return false;
    if (/[([{'"\-–—/\\]$/.test(prev))
      return false;
    if (/^[)\]}'":;,.!?]/.test(next))
      return false;
    return true;
  };
  const appendText = (raw) => {
    if (raw.length === 0)
      return;
    if (/^\\+$/.test(raw.trim()))
      return;
    const text = unescapeMarkupString2(raw);
    if (shouldInsertSpace2(lastChunk, text))
      out.push(" ");
    out.push(text);
    lastChunk = text;
  };
  const colorFromNode2 = (node) => {
    if (!node)
      return;
    if (node.type === "markupText")
      return unescapeMarkupString2(node.text.replace(/^"|"$/g, ""));
    if (node.type === "markupBlock")
      return colorFromNode2(node.children[0]);
    if (node.type === "markupCommand")
      return colorFromNode2(node.args[0]);
    return;
  };
  const fontSizeFromNode = (node) => {
    if (!node)
      return;
    if (node.type === "markupText") {
      const n = Number.parseFloat(node.text.trim());
      return Number.isFinite(n) ? n : undefined;
    }
    if (node.type === "markupBlock")
      return fontSizeFromNode(node.children[0]);
    if (node.type === "markupCommand")
      return fontSizeFromNode(node.args[0]);
    return;
  };
  const visit = (node, ctx) => {
    if (node.type === "markupText") {
      if (node.text.trim().length === 0)
        return;
      appendText(node.text);
      if (ctx.bold)
        style.bold = true;
      if (ctx.italic)
        style.italic = true;
      if (ctx.large)
        style.large = true;
      if (ctx.color)
        style.color = ctx.color;
      if (ctx.code)
        style.code = true;
      if (ctx.wordwrap)
        style.wordwrap = true;
      if (ctx.fontSizeScale != null)
        style.fontSizeScale = ctx.fontSizeScale;
      if (ctx.circled)
        style.circled = true;
      if (ctx.boxed)
        style.boxed = true;
      if (ctx.smallCaps)
        style.smallCaps = true;
      return;
    }
    if (node.type === "markupBlock") {
      for (const child of node.children)
        visit(child, ctx);
      return;
    }
    if (node.type === "markupCommand") {
      const cmd = node.command;
      if (cmd === "bold")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, bold: true }));
      if (cmd === "italic")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, italic: true }));
      if (cmd === "large" || cmd === "huge")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, large: true }));
      if (cmd === "typewriter")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, code: true }));
      if (cmd === "wordwrap")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, wordwrap: true }));
      if (cmd === "circle")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, circled: true }));
      if (cmd === "box")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, boxed: true }));
      if (cmd === "smallCaps")
        return void node.args.forEach((arg) => visit(arg, { ...ctx, smallCaps: true }));
      if (cmd === "smaller") {
        const nextScale = Math.max((ctx.fontSizeScale ?? 1) * Math.pow(2, -1 / 6), MIN_FONT_SCALE2);
        return void node.args.forEach((arg) => visit(arg, { ...ctx, fontSizeScale: nextScale }));
      }
      if (cmd === "fontsize") {
        const size = fontSizeFromNode(node.args[0]);
        const scale = size != null ? Math.max(Math.pow(2, size / 6), MIN_FONT_SCALE2) : 1;
        const nextScale = Math.max((ctx.fontSizeScale ?? 1) * scale, MIN_FONT_SCALE2);
        return void node.args.slice(1).forEach((arg) => visit(arg, { ...ctx, fontSizeScale: nextScale }));
      }
      if (cmd === "with-color") {
        const color = colorFromNode2(node.args[0]);
        return void node.args.slice(1).forEach((arg) => visit(arg, { ...ctx, ...color ? { color } : {} }));
      }
      if (cmd === "column") {
        if (node.args.length === 1 && node.args[0]?.type === "markupBlock") {
          let first = true;
          for (const child of node.args[0].children) {
            if (!first) {
              out.push(`
`);
              lastChunk = `
`;
            }
            visit(child, ctx);
            first = false;
          }
          return;
        }
      }
      node.args.forEach((arg) => visit(arg, ctx));
    }
  };
  nodes.forEach((n) => visit(n, {}));
  return { text: normalizeAttachedMarkupText(out.join("")), ...style };
}
function parseAttachedText(state, position, markerTok) {
  if (check(state, "string")) {
    const t = advance(state);
    return {
      type: "attachedText",
      position,
      text: t.value,
      loc: tokenToLoc(markerTok)
    };
  }
  if (check(state, "command") && current(state).value === "markup") {
    const markupTok = advance(state);
    const markup = parseTopLevelMarkup(state, markupTok);
    const payload = extractMarkupPayload(markup.children);
    if (!payload.text)
      return null;
    return {
      type: "attachedText",
      position,
      text: payload.text,
      ...payload.style.bold ? { bold: true } : {},
      ...payload.style.italic ? { italic: true } : {},
      ...payload.style.large ? { large: true } : {},
      ...payload.style.color ? { color: payload.style.color } : {},
      ...payload.style.code ? { code: true } : {},
      ...payload.style.wordwrap ? { wordwrap: true } : {},
      ...payload.style.fontSizeScale != null ? { fontSizeScale: payload.style.fontSizeScale } : {},
      ...payload.style.circled ? { circled: true } : {},
      ...payload.style.boxed ? { boxed: true } : {},
      ...payload.style.smallCaps ? { smallCaps: true } : {},
      ...payload.runs ? { runs: payload.runs } : {},
      textAnchor: "start",
      loc: tokenToLoc(markerTok)
    };
  }
  if (check(state, "word") || check(state, "number") || check(state, "note") || check(state, "rest")) {
    const t = advance(state);
    return {
      type: "attachedText",
      position,
      text: t.value,
      loc: tokenToLoc(markerTok)
    };
  }
  return null;
}
// src/music-input/lilypond/phases/parser/primitives/scheme.ts
function skipBalancedSchemeCall(state) {
  let parenDepth = 0;
  while (!isAtEnd(state)) {
    const tok = advance(state);
    if (tok.kind === "slur_open")
      parenDepth++;
    if (tok.kind === "slur_close") {
      parenDepth--;
      if (parenDepth <= 0)
        break;
    }
  }
}
function trySkipTopLevelSchemeCall(state, commandNames) {
  const t0 = state.tokens[state.pos];
  const t1 = state.tokens[state.pos + 1];
  if (!t0 || !t1)
    return false;
  if (t0.kind !== "slur_open")
    return false;
  if (t1.kind !== "word" || !commandNames.has(t1.value))
    return false;
  skipBalancedSchemeCall(state);
  return true;
}
function trySkipSchemeAliasDefinition(state) {
  const t0 = state.tokens[state.pos];
  const t1 = state.tokens[state.pos + 1];
  const t2 = state.tokens[state.pos + 2];
  const t3 = state.tokens[state.pos + 3];
  if (!t0 || !t1 || !t2 || !t3)
    return false;
  if (t0.kind !== "word")
    return false;
  if (t1.kind !== "equals")
    return false;
  if (t2.kind !== "slur_open")
    return false;
  if (t3.kind !== "word" || t3.value !== "define-music-function")
    return false;
  advance(state);
  advance(state);
  skipBalancedSchemeCall(state);
  return true;
}
// src/music-input/lilypond/phases/parser/primitives/contextWith.ts
function readOptionalContextInstanceName(state) {
  if (!check(state, "equals"))
    return;
  advance(state);
  if (check(state, "word") || check(state, "string") || check(state, "note") || check(state, "number")) {
    return advance(state).value;
  }
  return;
}
function parseContextWithOperations(state, contextName) {
  const withToken = state.tokens[state.pos];
  if (withToken?.kind !== "command" || withToken.value !== "with")
    return [];
  advance(state);
  if (!check(state, "open")) {
    skipOneArgument(state);
    return [];
  }
  advance(state);
  const operations = [];
  while (!isAtEnd(state) && !check(state, "close")) {
    const propertyStart = current(state);
    const propertyParts = [];
    while (!isAtEnd(state)) {
      const tok = current(state);
      if (tok.kind === "equals" || tok.kind === "close" || tok.kind === "open" || tok.kind === "command")
        break;
      if (tok.kind === "word" || tok.kind === "note" || tok.kind === "number") {
        propertyParts.push(tok.value.split("|")[0] ?? tok.value);
      }
      advance(state);
    }
    if (!check(state, "equals")) {
      if (check(state, "open"))
        skipOneArgument(state);
      else if (!check(state, "close"))
        advance(state);
      continue;
    }
    advance(state);
    const valueToken = current(state);
    if (valueToken.kind !== "word" && valueToken.kind !== "number" && valueToken.kind !== "string" && valueToken.kind !== "command" && valueToken.kind !== "note") {
      if (!check(state, "close"))
        advance(state);
      continue;
    }
    advance(state);
    const property = propertyParts.join(".");
    if (!property)
      continue;
    operations.push({
      type: "set",
      property: property.includes(".") ? property : `${contextName}.${property}`,
      value: tokenValueForContextOperation(valueToken),
      loc: {
        ...tokenToLoc(propertyStart),
        endOffset: valueToken.end ?? valueToken.pos
      }
    });
  }
  if (check(state, "close"))
    advance(state);
  return operations;
}

// src/music-input/lilypond/phases/parser/contextCreation.ts
function parseNewContextCommand(state, cmdToken, parseMusic) {
  const ctxTok = match(state, "word");
  const ctxVal = ctxTok?.value ?? "";
  const contextName = readOptionalContextInstanceName(state);
  if (ctxVal === "ChordNames" || ctxVal === "FretBoards") {
    const body = parseMusic(state);
    if (!body)
      return null;
    return {
      type: "chordNamesContext",
      body,
      loc: tokenToLoc(cmdToken)
    };
  }
  if (ctxVal === "Staff") {
    const operations = parseContextWithOperations(state, "Staff");
    const body = parseMusic(state);
    if (!body)
      return null;
    return {
      type: "staffContext",
      ...contextName ? { name: contextName } : {},
      ...operations.length ? { operations } : {},
      body,
      loc: tokenToLoc(cmdToken)
    };
  }
  if (ctxVal === "PianoStaff" || ctxVal === "GrandStaff" || ctxVal === "StaffGroup") {
    parseContextWithOperations(state, ctxVal);
    const body = parseMusic(state);
    if (!body)
      return null;
    const elements = body.type === "simultaneous" ? body.elements : [body];
    return {
      type: "staffGroupContext",
      groupType: ctxVal,
      staves: [...elements],
      loc: tokenToLoc(cmdToken)
    };
  }
  return parseMusic(state);
}

// src/music-input/lilypond/phases/parser/aliasExpansion.ts
function parseAliasOrAttachmentCommand(state, cmdName, cmdToken, parseMusic) {
  const aliasDef = state.aliases.get(cmdName);
  if (aliasDef) {
    if (aliasDef.target === "tuplet" && aliasDef.actual && aliasDef.normal) {
      const body = parseMusic(state);
      if (body) {
        return {
          type: "tuplet",
          actual: aliasDef.actual,
          normal: aliasDef.normal,
          body,
          loc: tokenToLoc(cmdToken)
        };
      }
    }
    if (NOTE_ATTACHMENT_COMMANDS.has(aliasDef.target)) {
      return {
        type: "articulation",
        symbol: aliasDef.target,
        loc: tokenToLoc(cmdToken)
      };
    }
    if (DYNAMIC_COMMANDS.has(aliasDef.target)) {
      return {
        type: "dynamics",
        symbol: aliasDef.target,
        loc: tokenToLoc(cmdToken)
      };
    }
  }
  if (state.variables.has(cmdName)) {
    const alias = state.variables.get(cmdName);
    const aliasBody = alias?.body;
    if (aliasBody?.type === "variableRef") {
      const target = aliasBody.name;
      if (NOTE_ATTACHMENT_COMMANDS.has(target)) {
        return {
          type: "articulation",
          symbol: target,
          loc: tokenToLoc(cmdToken)
        };
      }
      if (DYNAMIC_COMMANDS.has(target)) {
        return {
          type: "dynamics",
          symbol: target,
          loc: tokenToLoc(cmdToken)
        };
      }
      if (target === "hairpinCresc" || target === "hairpinDecresc" || target === "hairpinStop") {
        return {
          type: "hairpin",
          direction: target === "hairpinCresc" ? "crescendo" : target === "hairpinDecresc" ? "decrescendo" : "stop",
          loc: tokenToLoc(cmdToken)
        };
      }
    }
  }
  if (NOTE_ATTACHMENT_COMMANDS.has(cmdName)) {
    return {
      type: "articulation",
      symbol: cmdName,
      loc: tokenToLoc(cmdToken)
    };
  }
  if (DYNAMIC_COMMANDS.has(cmdName)) {
    return {
      type: "dynamics",
      symbol: cmdName,
      loc: tokenToLoc(cmdToken)
    };
  }
  return;
}

// src/music-input/lilypond/phases/parser/commandWrappers.ts
function parseTransposeCommand(state, cmdToken, parseMusic) {
  const fromTok = expect(state, "note", "Expected source pitch after \\transpose");
  const toTok = expect(state, "note", "Expected target pitch after \\transpose");
  if (!fromTok || !toTok)
    return null;
  const body = parseMusic(state);
  if (!body)
    return null;
  return {
    type: "transpose",
    from: parsePitchFromNoteToken(fromTok),
    to: parsePitchFromNoteToken(toTok),
    body,
    loc: tokenToLoc(cmdToken)
  };
}
function parseGraceCommand(state, cmdToken, parseMusic) {
  const body = parseMusic(state);
  if (!body)
    return null;
  return {
    type: "grace",
    variant: cmdToken.value,
    body,
    loc: tokenToLoc(cmdToken)
  };
}
function parseRehearsalMark(state, cmdToken) {
  if (check(state, "command") && current(state).value === "markup") {
    const markupTok = advance(state);
    const markup = parseTopLevelMarkup(state, markupTok);
    const payload = flattenMarkupForAttachedText(markup.children);
    if (!payload.text)
      return null;
    return {
      type: "rehearsalMark",
      text: payload.text,
      ...payload.boxed ? { boxed: true } : {},
      loc: tokenToLoc(cmdToken)
    };
  }
  if (check(state, "string") || check(state, "word") || check(state, "number")) {
    const textTok = advance(state);
    return {
      type: "rehearsalMark",
      text: textTok.value,
      loc: tokenToLoc(cmdToken)
    };
  }
  return null;
}

// src/music-input/lilypond/phases/parser/commandDispatch.ts
function readNumberArgument(state) {
  const tok = match(state, "number");
  if (!tok)
    return null;
  let raw = tok.value;
  if (raw.endsWith(".") && check(state, "number")) {
    const frac = advance(state).value;
    if (/^\d+$/.test(frac))
      raw += frac;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function readOmitTarget(state) {
  if (check(state, "word") || check(state, "command")) {
    return advance(state).value;
  }
  return null;
}
function parseCommandDispatch(state, parseMusic, parseCommand) {
  const cmdToken = advance(state);
  const cmdName = cmdToken.value;
  switch (cmdName) {
    case "relative":
    case "fixed":
      return parseRelativeOrFixedCommand(state, cmdToken, parseMusic);
    case "new":
      return parseNewContextCommand(state, cmdToken, parseMusic);
    case "key": {
      const pitchToken = expect(state, "note", "Expected pitch after \\key");
      if (!pitchToken)
        return null;
      const pitch2 = parsePitchFromNoteToken(pitchToken);
      const modeToken = expect(state, "command", "Expected major/minor after key pitch");
      if (!modeToken)
        return null;
      const mode = modeToken.value;
      return {
        type: "key",
        pitch: { ...pitch2, octave: "" },
        mode: mode === "major" ? "major" : "minor",
        loc: tokenToLoc(cmdToken)
      };
    }
    case "time": {
      const numeratorToken = expect(state, "number", "Expected numerator after \\time");
      if (!numeratorToken)
        return null;
      expect(state, "slash", "Expected / between time signature numbers");
      const denominatorToken = expect(state, "number", "Expected denominator after numerator");
      if (!denominatorToken)
        return null;
      return {
        type: "time",
        numerator: parseInt(numeratorToken.value, 10),
        denominator: parseInt(denominatorToken.value, 10),
        loc: tokenToLoc(cmdToken)
      };
    }
    case "break":
      return {
        type: "bar",
        barType: "\\break",
        loc: tokenToLoc(cmdToken)
      };
    case "clef":
      if (check(state, "word") || check(state, "string") || check(state, "command")) {
        const clefTok = advance(state);
        const raw = clefTok.value.toLowerCase().replace(/['"]/g, "");
        const normalized = raw === "g" ? "treble" : raw === "f" ? "bass" : raw === "c" ? "alto" : raw;
        if (normalized === "treble" || normalized === "bass" || normalized === "alto") {
          return {
            type: "clef",
            name: normalized,
            loc: tokenToLoc(cmdToken)
          };
        }
      }
      return null;
    case "tempo": {
      let text;
      let beatUnitDenominator;
      let bpm;
      if (check(state, "string")) {
        text = advance(state).value;
      }
      if (check(state, "number")) {
        const beatTok = advance(state);
        const parsedBeat = Number.parseInt(beatTok.value, 10);
        if (Number.isFinite(parsedBeat) && parsedBeat > 0) {
          beatUnitDenominator = parsedBeat;
        }
        if (check(state, "equals")) {
          advance(state);
          if (check(state, "number")) {
            const bpmTok = advance(state);
            const parsedBpm = Number.parseInt(bpmTok.value, 10);
            if (Number.isFinite(parsedBpm) && parsedBpm > 0)
              bpm = parsedBpm;
          }
        }
      }
      return {
        type: "tempo",
        ...text ? { text } : {},
        ...beatUnitDenominator ? { beatUnitDenominator } : {},
        ...bpm ? { bpm } : {},
        loc: tokenToLoc(cmdToken)
      };
    }
    case "mark":
      return parseRehearsalMark(state, cmdToken);
    case "tuplet": {
      const actualToken = expect(state, "number", "Expected tuplet numerator");
      if (!actualToken)
        return null;
      expect(state, "slash", "Expected / in tuplet ratio");
      const normalToken = expect(state, "number", "Expected tuplet denominator");
      if (!normalToken)
        return null;
      let groupingDuration;
      if (check(state, "number")) {
        const groupingTok = advance(state);
        const parsed = parseDurationToken(groupingTok.value);
        if (parsed)
          groupingDuration = parsed;
      }
      const body = parseMusic(state);
      if (!body)
        return null;
      return {
        type: "tuplet",
        actual: parseInt(actualToken.value, 10),
        normal: parseInt(normalToken.value, 10),
        ...groupingDuration ? { groupingDuration } : {},
        body,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "magnifyMusic": {
      const scale = readNumberArgument(state);
      const body = parseMusic(state);
      if (scale == null || !Number.isFinite(scale) || scale <= 0 || !body)
        return null;
      return {
        type: "musicScale",
        scale,
        body,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "repeat":
      return parseRepeatCommand(state, cmdToken, parseMusic);
    case "transpose":
      return parseTransposeCommand(state, cmdToken, parseMusic);
    case "grace":
    case "acciaccatura":
    case "appoggiatura":
    case "slashedGrace":
      return parseGraceCommand(state, cmdToken, parseMusic);
    case "partial": {
      const durTok = expect(state, "number", "Expected duration after \\partial");
      if (!durTok)
        return null;
      const duration2 = parseDurationToken(durTok.value);
      if (!duration2)
        return null;
      let multiplier = 1;
      if (check(state, "number")) {
        const multTok = advance(state);
        const parsedMult = Number.parseInt(multTok.value, 10);
        if (Number.isFinite(parsedMult) && parsedMult > 0) {
          multiplier = parsedMult;
        }
      }
      return {
        type: "partial",
        duration: duration2,
        ...multiplier > 1 ? { multiplier } : {},
        loc: tokenToLoc(cmdToken)
      };
    }
    case "autoBeamOn":
      return {
        type: "beamMode",
        enabled: true,
        loc: tokenToLoc(cmdToken)
      };
    case "autoBeamOff":
      return {
        type: "beamMode",
        enabled: false,
        loc: tokenToLoc(cmdToken)
      };
    case "glissando":
      return {
        type: "glissando",
        spanType: "glissando",
        loc: tokenToLoc(cmdToken)
      };
    case "glide":
      return {
        type: "glissando",
        spanType: "finger-glide",
        loc: tokenToLoc(cmdToken)
      };
    case "stemUp":
    case "stemDown":
    case "stemNeutral":
      return {
        type: "stemDirection",
        direction: cmdName === "stemUp" ? "up" : cmdName === "stemDown" ? "down" : "neutral",
        loc: tokenToLoc(cmdToken)
      };
    case "once": {
      const next = state.tokens[state.pos];
      if (next?.kind === "command" && next.value === "omit") {
        advance(state);
        const target = readOmitTarget(state);
        if (!target)
          return null;
        return {
          type: "omit",
          target,
          once: true,
          loc: tokenToLoc(cmdToken)
        };
      }
      if (next?.kind === "command" && next.value === "override") {
        const overrideTok = advance(state);
        const op = parseContextOperationAssignment(state, overrideTok, "override");
        if (op?.type === "override") {
          return {
            ...op,
            once: true,
            loc: {
              ...tokenToLoc(cmdToken),
              endOffset: op.loc?.endOffset
            }
          };
        }
        return null;
      }
      skipOneArgument(state);
      return null;
    }
    case "omit": {
      const target = readOmitTarget(state);
      if (!target)
        return null;
      return {
        type: "omit",
        target,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "cadenzaOn":
    case "cadenzaOff":
      return {
        type: "cadenza",
        enabled: cmdName === "cadenzaOn",
        loc: tokenToLoc(cmdToken)
      };
    case "compressMMRests": {
      const body = parseMusic(state);
      if (!body)
        return null;
      return { type: "compressMMRests", body, loc: tokenToLoc(cmdToken) };
    }
    case "ottava": {
      const levelTok = match(state, "number");
      if (!levelTok)
        return null;
      const octaveShift = Number.parseInt(levelTok.value, 10);
      if (!Number.isFinite(octaveShift))
        return null;
      return {
        type: "ottava",
        octaveShift,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "chordmode":
      return parseChordModeCommand(state, cmdToken);
    case "fine":
      return {
        type: "bar",
        barType: "|.",
        loc: tokenToLoc(cmdToken)
      };
    case "bar": {
      const barTypeToken = match(state, "string");
      return {
        type: "bar",
        barType: barTypeToken?.value || "||",
        loc: tokenToLoc(cmdToken)
      };
    }
    case "set": {
      const beamMode = parseAutoBeamingSetAssignment(state, cmdToken);
      if (beamMode)
        return beamMode;
      const stanza = parseStanzaSetAssignment(state, cmdToken);
      if (stanza)
        return stanza;
      const op = parseContextOperationAssignment(state, cmdToken, "set");
      if (op)
        return op;
      parseSetLikeAssignment(state);
      return null;
    }
    case "override": {
      const op = parseContextOperationAssignment(state, cmdToken, "override");
      if (op)
        return op;
      parseSetLikeAssignment(state);
      return null;
    }
    case "hairpinCresc":
      return {
        type: "hairpin",
        direction: "crescendo",
        loc: tokenToLoc(cmdToken)
      };
    case "hairpinDecresc":
      return {
        type: "hairpin",
        direction: "decrescendo",
        loc: tokenToLoc(cmdToken)
      };
    case "hairpinStop":
      return {
        type: "hairpin",
        direction: "stop",
        loc: tokenToLoc(cmdToken)
      };
    case "sustainOn":
    case "sustainOff":
      return {
        type: "pedal",
        kind: "sustain",
        action: cmdName === "sustainOn" ? "on" : "off",
        loc: tokenToLoc(cmdToken)
      };
    case "numericTimeSignature":
      return {
        type: "timeSignatureStyle",
        style: "numeric",
        loc: tokenToLoc(cmdToken)
      };
    case "defaultTimeSignature":
      return {
        type: "timeSignatureStyle",
        style: "default",
        loc: tokenToLoc(cmdToken)
      };
    case "lyricmode":
    case "lyrics":
    case "addlyrics": {
      const body = parseLyricsBlock(state, parseCommand);
      if (!body)
        return null;
      return {
        type: cmdName === "lyricmode" ? "lyricMode" : cmdName,
        body,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "lyricsto": {
      const voiceToken = expect(state, "string", "Expected voice name after \\lyricsto");
      if (!voiceToken)
        return null;
      const body = parseLyricsBlock(state, parseCommand);
      if (!body)
        return null;
      return {
        type: "lyricsto",
        voiceName: voiceToken.value,
        body,
        loc: tokenToLoc(cmdToken)
      };
    }
    case "layout": {
      const layoutNode = parseLayout(state);
      if (layoutNode) {
        state._lastLayout = layoutNode;
      }
      return null;
    }
    case "midi":
    case "with":
    case "context":
    case "markup":
    case "wordwrap":
    case "typewriter":
    case "column":
    case "line":
    case "concat":
    case "bold":
    case "italic":
    case "circle":
    case "box":
    case "small":
    case "tiny":
    case "huge":
    case "fontsize":
    case "smaller":
    case "with-color":
      skipOneArgument(state);
      return null;
    default: {
      const aliasOrAttachment = parseAliasOrAttachmentCommand(state, cmdName, cmdToken, parseMusic);
      if (aliasOrAttachment)
        return aliasOrAttachment;
      return {
        type: "variableRef",
        name: cmdName,
        loc: tokenToLoc(cmdToken)
      };
    }
  }
}

// src/music-input/lilypond/phases/parser/sequential.ts
function parseSequentialBlock(state, parseMusic) {
  if (!expect(state, "open", "Expected {"))
    return null;
  const elements = [];
  let lastNotePitch = null;
  const startToken = state.tokens[state.pos - 1];
  let sequentialSyncBreak = false;
  while (!check(state, "close") && !isAtEnd(state)) {
    const token = current(state);
    const nextToken = peek(state, 1);
    if (token.kind === "word" && nextToken?.kind === "equals") {
      state.errors.add(new ParseError({
        message: `Expected } before variable assignment "${token.value}" (missing closing brace in previous block)`,
        loc: tokenToLoc(token),
        recoverable: true,
        severity: "error"
      }));
      sequentialSyncBreak = true;
      break;
    }
    if (token.kind === "command") {
      const topLevelCommands = ["header", "paper", "score", "book", "bookpart"];
      if (topLevelCommands.includes(token.value)) {
        state.errors.add(new ParseError({
          message: `Expected } before \\${token.value} (missing closing brace in previous block)`,
          loc: tokenToLoc(token),
          recoverable: true,
          severity: "error"
        }));
        sequentialSyncBreak = true;
        break;
      }
    }
    if (check(state, "number") && lastNotePitch) {
      const durationTok = advance(state);
      const duration2 = parseDurationToken(durationTok.value);
      if (duration2) {
        const previous = elements[elements.length - 1];
        if (previous?.type === "note" && !previous.duration) {
          previous.duration = duration2;
          if (previous.loc)
            previous.loc.endOffset = durationTok.end ?? durationTok.pos + durationTok.value.length;
        } else {
          elements.push({
            type: "note",
            pitch: clonePitch(lastNotePitch),
            duration: duration2,
            loc: tokenToLoc(durationTok)
          });
        }
      }
      continue;
    }
    const posBefore = state.pos;
    const element = parseMusic(state);
    if (element) {
      if (element.type === "note") {
        lastNotePitch = clonePitch(element.pitch);
      }
      elements.push(element);
    } else if (state.pos === posBefore) {
      if (current(state).kind !== "eof")
        advance(state);
    }
  }
  if (sequentialSyncBreak) {} else if (!check(state, "close")) {
    if (isAtEnd(state)) {
      state.errors.add(new ParseError({
        message: "Expected } but found end of file (unclosed block)",
        loc: tokenToLoc(startToken),
        recoverable: true,
        severity: "error"
      }));
    }
  } else {
    const closeTok = current(state);
    if (closeTok.value === ">>" && startToken.value === "{") {
      const alreadyReported = state.errors.getAll().some((e) => e.message.includes("before >>"));
      if (!alreadyReported) {
        state.errors.add(new ParseError({
          message: "Expected } before >> (missing closing brace in block)",
          loc: tokenToLoc(closeTok),
          recoverable: true,
          severity: "error"
        }));
      }
    } else {
      advance(state);
    }
  }
  const endToken = state.tokens[state.pos - 1] || startToken;
  return {
    type: startToken.value === "<<" ? "simultaneous" : "sequential",
    elements,
    loc: {
      offset: startToken.pos,
      line: 1,
      column: startToken.pos,
      endOffset: endToken.end ?? endToken.pos
    }
  };
}

// src/music-input/lilypond/phases/parser/music-expression.ts
function parseMusic(state) {
  const token = peek(state);
  if (!token)
    return null;
  try {
    switch (token.kind) {
      case "note":
        return parseNote(advance(state));
      case "rest":
        return parseRest(advance(state));
      case "open":
        return parseSequential(state);
      case "chord_open":
        return parseChord(state);
      case "command":
        return parseCommand(state);
      case "word": {
        const nextTok = peek(state, 1);
        if (nextTok?.kind === "equals")
          return null;
        const tok = advance(state);
        const unsupported = parseUnsupportedEnglishAccidentalWord(state, tok);
        if (unsupported)
          return unsupported;
        return {
          type: "variableRef",
          name: tok.value,
          loc: tokenToLoc(tok)
        };
      }
      case "barcheck":
        advance(state);
        return {
          type: "bar",
          barType: "|",
          loc: tokenToLoc(token)
        };
      case "tie":
        advance(state);
        return {
          type: "tie",
          loc: tokenToLoc(token)
        };
      case "slur_open":
        advance(state);
        return {
          type: token.value === "\\(" ? "phrasingSlur" : "slur",
          direction: "open",
          loc: tokenToLoc(token)
        };
      case "slur_close":
        advance(state);
        return {
          type: token.value === "\\)" ? "phrasingSlur" : "slur",
          direction: "close",
          loc: tokenToLoc(token)
        };
      case "beam_open":
        advance(state);
        return {
          type: "beam",
          direction: "open",
          loc: tokenToLoc(token)
        };
      case "beam_close":
        advance(state);
        return {
          type: "beam",
          direction: "close",
          loc: tokenToLoc(token)
        };
      case "fingering":
        advance(state);
        return {
          type: "fingering",
          value: token.value,
          loc: tokenToLoc(token)
        };
      case "markup_above": {
        const markerTok = advance(state);
        const next = peek(state);
        if (next?.kind === "beam_open") {
          advance(state);
          return {
            type: "beam",
            direction: "open",
            placement: "above",
            loc: tokenToLoc(markerTok)
          };
        }
        return parseAttachedText(state, "above", markerTok);
      }
      case "markup_below": {
        const markerTok = advance(state);
        const next = peek(state);
        if (next?.kind === "beam_open") {
          advance(state);
          return {
            type: "beam",
            direction: "open",
            placement: "below",
            loc: tokenToLoc(markerTok)
          };
        }
        return parseAttachedText(state, "below", markerTok);
      }
      case "number":
      case "string":
      case "chord_close":
      case "close":
      case "slash":
      case "equals":
        advance(state);
        return null;
      default:
        advance(state);
        return null;
    }
  } catch {
    advance(state);
    return null;
  }
}
function parseSequential(state) {
  return parseSequentialBlock(state, parseMusic);
}
function parseCommand(state) {
  return parseCommandDispatch(state, parseMusic, parseCommand);
}

// src/music-input/lilypond/functions/sexpr.ts
class SExprReadError extends Error {
  constructor(message) {
    super(message);
    this.name = "SExprReadError";
  }
}

class Reader {
  src;
  pos = 0;
  constructor(src) {
    this.src = src;
  }
  read() {
    this.skipWhitespace();
    if (this.peek() === "#") {
      if (this.peek(1) === "(") {
        this.pos++;
        return this.readList();
      }
      if (this.peek(1) === "'" && this.peek(2) === "(") {
        this.pos += 2;
        return this.readList(true);
      }
    }
    if (this.peek() === "'") {
      this.pos++;
      const quoted = this.read();
      return quoted.kind === "list" ? { ...quoted, quoted: true } : { kind: "list", quoted: true, items: [quoted] };
    }
    return this.readExpr();
  }
  get done() {
    return this.pos >= this.src.length;
  }
  peek(offset = 0) {
    return this.src[this.pos + offset] ?? "";
  }
  skipWhitespace() {
    for (;; ) {
      while (!this.done && /\s/.test(this.peek()))
        this.pos++;
      if (this.peek() === ";") {
        while (!this.done && this.peek() !== `
`)
          this.pos++;
        continue;
      }
      return;
    }
  }
  readExpr() {
    this.skipWhitespace();
    if (this.done)
      throw new SExprReadError("Unexpected end of Scheme expression");
    if (this.peek() === "(")
      return this.readList();
    if (this.peek() === '"')
      return this.readString();
    if (this.peek() === "#" && this.peek(1) === "{")
      return this.readLilyBlock();
    if (this.peek() === "#" && this.peek(1) === "t") {
      this.pos += 2;
      return { kind: "boolean", value: true };
    }
    if (this.peek() === "#" && this.peek(1) === "f") {
      this.pos += 2;
      return { kind: "boolean", value: false };
    }
    if (this.peek() === "'" && this.peek(1) === "(") {
      this.pos++;
      return this.readList(true);
    }
    return this.readAtom();
  }
  readList(quoted = false) {
    if (this.peek() !== "(")
      throw new SExprReadError("Expected Scheme list");
    this.pos++;
    const items = [];
    while (!this.done) {
      this.skipWhitespace();
      if (this.peek() === ")") {
        this.pos++;
        return { kind: "list", items, ...quoted ? { quoted: true } : {} };
      }
      items.push(this.readExpr());
    }
    throw new SExprReadError("Unclosed Scheme list");
  }
  readString() {
    this.pos++;
    let value = "";
    while (!this.done) {
      const ch = this.src[this.pos++];
      if (ch === '"')
        return { kind: "string", value };
      if (ch === "\\" && !this.done) {
        value += this.src[this.pos++];
        continue;
      }
      value += ch;
    }
    throw new SExprReadError("Unclosed Scheme string");
  }
  readLilyBlock() {
    const start = this.pos;
    this.pos += 2;
    let depth = 1;
    while (!this.done && depth > 0) {
      if (this.peek() === '"') {
        this.readString();
        continue;
      }
      if (this.peek() === "#" && this.peek(1) === "{") {
        this.pos += 2;
        depth++;
        continue;
      }
      if (this.peek() === "#" && this.peek(1) === "}") {
        this.pos += 2;
        depth--;
        continue;
      }
      this.pos++;
    }
    if (depth !== 0)
      throw new SExprReadError("Unclosed LilyPond Scheme body");
    return { kind: "lilyBlock", source: this.src.slice(start, this.pos) };
  }
  readAtom() {
    const start = this.pos;
    while (!this.done && !/\s/.test(this.peek()) && this.peek() !== "(" && this.peek() !== ")") {
      this.pos++;
    }
    const raw = this.src.slice(start, this.pos);
    if (!raw)
      throw new SExprReadError("Expected Scheme atom");
    const n = Number(raw);
    if (Number.isFinite(n))
      return { kind: "number", value: n };
    return { kind: "symbol", name: raw };
  }
}
function readSchemeBlock(raw) {
  return new Reader(raw.trim()).read();
}
// src/music-input/lilypond/functions/schemeFunctionParser.ts
function locFromToken(token) {
  return {
    offset: token.pos,
    line: 1,
    column: token.pos,
    endOffset: token.end
  };
}
function asList(expr) {
  return expr.kind === "list" ? expr : null;
}
function symbolName(expr) {
  return expr?.kind === "symbol" ? expr.name : null;
}
function quotedSymbolName(expr) {
  const direct = symbolName(expr);
  if (direct)
    return direct.startsWith("'") ? direct.slice(1) : direct;
  if (expr?.kind === "list" && expr.quoted && expr.items.length === 1) {
    const quoted = symbolName(expr.items[0]);
    return quoted?.startsWith("'") ? quoted.slice(1) : quoted;
  }
  return null;
}
function expectList(expr, label) {
  const list = expr ? asList(expr) : null;
  if (!list)
    throw new Error(`Expected Scheme list for ${label}`);
  return list;
}
function expectSymbolList(expr, label) {
  return expectList(expr, label).items.map((item) => {
    const name = symbolName(item);
    if (!name)
      throw new Error(`Expected symbol in ${label}`);
    return name;
  });
}
function isPredicateName(value) {
  return value === "string?" || value === "list?" || value === "number?" || value === "boolean?" || value === "markup?" || value === "ly:music?";
}
function expectPredicateList(expr) {
  return expectSymbolList(expr, "function predicates").map((name) => {
    if (!isPredicateName(name))
      throw new Error(`Unsupported Scheme function predicate: ${name}`);
    return name;
  });
}
function schemeExprNodeFromSExpr(expr) {
  switch (expr.kind) {
    case "symbol":
      return { type: "schemeSymbol", name: expr.name };
    case "string":
      return { type: "schemeString", value: expr.value };
    case "number":
      return { type: "schemeNumber", value: expr.value };
    case "boolean":
      return { type: "schemeBoolean", value: expr.value };
    case "list": {
      if (expr.quoted) {
        return {
          type: "schemeList",
          quoted: true,
          items: expr.items.map(schemeExprNodeFromSExpr)
        };
      }
      const [head, ...args] = expr.items;
      const callee = symbolName(head);
      if (!callee)
        throw new Error("Expected Scheme call to start with a symbol");
      return {
        type: "schemeCall",
        callee,
        args: args.map(schemeExprNodeFromSExpr)
      };
    }
    case "lilyBlock":
      throw new Error("LilyPond body blocks are not ordinary Scheme values");
  }
}
function schemeMutationFromSExpr(expr) {
  const list = asList(expr);
  if (!list || symbolName(list.items[0]) !== "set!")
    return null;
  const target = symbolName(list.items[1]);
  const value = list.items[2];
  if (!target || !value)
    throw new Error("Malformed set! mutation in Scheme function");
  return {
    type: "schemeStateMutation",
    target,
    value: schemeExprNodeFromSExpr(value)
  };
}
function parseSchemeVariableDefinition(token) {
  const expr = readSchemeBlock(token.value);
  const list = asList(expr);
  if (!list || symbolName(list.items[0]) !== "define")
    return null;
  const name = symbolName(list.items[1]);
  const value = list.items[2];
  if (!name || !value)
    throw new Error("Malformed Scheme define form");
  return {
    type: "schemeVariableDefinition",
    name,
    value: schemeExprNodeFromSExpr(value),
    loc: locFromToken(token)
  };
}
function parseSchemeOption(token) {
  const expr = readSchemeBlock(token.value);
  const list = asList(expr);
  if (!list || symbolName(list.items[0]) !== "ly:set-option")
    return null;
  const name = quotedSymbolName(list.items[1]);
  if (!name)
    throw new Error("Malformed ly:set-option form");
  const value = list.items[2] ? schemeExprNodeFromSExpr(list.items[2]) : { type: "schemeBoolean", value: true };
  return {
    type: "schemeOption",
    name,
    value,
    loc: locFromToken(token)
  };
}
function parseSchemeFunctionDefinition(name, token) {
  const expr = readSchemeBlock(token.value);
  const list = asList(expr);
  if (!list || symbolName(list.items[0]) !== "define-scheme-function")
    return null;
  const paramNames = expectSymbolList(list.items[1], "function params");
  const predicates = expectPredicateList(list.items[2]);
  if (paramNames.length !== predicates.length) {
    throw new Error(`Scheme function ${name} has mismatched params and predicates`);
  }
  let i = 3;
  let docString;
  const maybeDocString = list.items[i];
  if (maybeDocString?.kind === "string") {
    docString = maybeDocString.value;
    i++;
  }
  const mutations = [];
  let bodySource = "";
  for (;i < list.items.length; i++) {
    const item = list.items[i];
    if (item.kind === "lilyBlock") {
      bodySource = item.source;
      continue;
    }
    const mutation = schemeMutationFromSExpr(item);
    if (mutation) {
      mutations.push(mutation);
      continue;
    }
    throw new Error(`Unsupported form in Scheme function ${name}`);
  }
  if (!bodySource)
    throw new Error(`Scheme function ${name} has no LilyPond body`);
  return {
    type: "schemeFunctionDefinition",
    name,
    params: paramNames.map((param, idx) => ({
      name: param,
      predicate: predicates[idx]
    })),
    ...docString ? { docString } : {},
    mutations,
    bodySource,
    loc: locFromToken(token)
  };
}
function parseSchemeExpressionToken(token) {
  return schemeExprNodeFromSExpr(readSchemeBlock(token.value));
}
// src/music-input/lilypond/functions/schemeEnvironment.ts
function isSchemePairValue(value) {
  return typeof value === "object" && !Array.isArray(value) && value !== null && value.type === "schemePairValue";
}
function makeEnv(globals, locals, functions) {
  return {
    globals,
    locals,
    functions,
    get(name) {
      if (locals.has(name))
        return locals.get(name);
      if (globals.has(name))
        return globals.get(name);
      throw new Error(`Unknown Scheme symbol: ${name}`);
    },
    setGlobal(name, value) {
      globals.set(name, value);
    },
    child(bindings) {
      return makeEnv(globals, bindings, functions);
    }
  };
}
function createSchemeEnvironment() {
  return makeEnv(new Map, new Map, new Map);
}
// src/music-input/lilypond/functions/schemeEvaluator.ts
function expectNumber(value) {
  if (typeof value !== "number")
    throw new Error(`Expected Scheme number, got ${typeof value}`);
  return value;
}
function expectList2(value) {
  if (!Array.isArray(value))
    throw new Error(`Expected Scheme list, got ${typeof value}`);
  return value;
}
function assertPredicate(predicate, value, functionName, paramName) {
  const ok = predicate === "string?" && typeof value === "string" || predicate === "number?" && typeof value === "number" || predicate === "boolean?" && typeof value === "boolean" || predicate === "list?" && Array.isArray(value);
  if (!ok) {
    throw new Error(`\\${functionName} expected ${paramName} to satisfy ${predicate}`);
  }
}
function evaluateSchemeExpr(expr, env) {
  switch (expr.type) {
    case "schemeString":
      return expr.value;
    case "schemeNumber":
      return expr.value;
    case "schemeBoolean":
      return expr.value;
    case "schemeSymbol":
      return env.get(expr.name);
    case "schemeList":
      return expr.items.map((item) => evaluateSchemeExpr(item, env));
    case "schemeCall":
      return evaluateSchemeCall(expr.callee, expr.args, env);
  }
}
function evaluateSchemeCall(callee, args, env) {
  switch (callee) {
    case "+":
      return args.reduce((sum, arg) => sum + expectNumber(evaluateSchemeExpr(arg, env)), 0);
    case "-": {
      if (args.length === 0)
        throw new Error("Scheme - expects at least one argument");
      const first = expectNumber(evaluateSchemeExpr(args[0], env));
      if (args.length === 1)
        return -first;
      return args.slice(1).reduce((value, arg) => value - expectNumber(evaluateSchemeExpr(arg, env)), first);
    }
    case "*":
      return args.reduce((product, arg) => product * expectNumber(evaluateSchemeExpr(arg, env)), 1);
    case "length":
      return expectList2(evaluateSchemeExpr(args[0], env)).length;
    case "cons":
      return {
        type: "schemePairValue",
        car: evaluateSchemeExpr(args[0], env),
        cdr: evaluateSchemeExpr(args[1], env)
      };
    case "number->string":
      return String(expectNumber(evaluateSchemeExpr(args[0], env)));
    default:
      throw new Error(`Unsupported Scheme call: ${callee}`);
  }
}
function executeSchemeMutation(mutation, env) {
  env.setGlobal(mutation.target, evaluateSchemeExpr(mutation.value, env));
}
// src/music-input/lilypond/functions/schemeMarkup.ts
function stripLilyBlockDelimiters(bodySource) {
  let src = bodySource.trim();
  if (src.startsWith("#{"))
    src = src.slice(2);
  if (src.endsWith("#}"))
    src = src.slice(0, -2);
  return src;
}
function readHashSymbol(src, start) {
  const first = src[start] ?? "";
  if (!/[A-Za-z_]/.test(first))
    return null;
  let i = start + 1;
  while (i < src.length && /[A-Za-z0-9_-]/.test(src[i]))
    i++;
  return { name: src.slice(start, i), end: i };
}
function readBalancedSchemeCallFromSource(src, start) {
  let i = start;
  if (src[i] !== "#" || src[i + 1] !== "(")
    throw new Error("Expected Scheme interpolation call");
  i += 2;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '"') {
      i++;
      while (i < src.length) {
        if (src[i] === "\\" && i + 1 < src.length) {
          i += 2;
          continue;
        }
        if (src[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (src[i] === "(")
      depth++;
    else if (src[i] === ")")
      depth--;
    i++;
  }
  if (depth !== 0)
    throw new Error("Unclosed Scheme interpolation call");
  return { text: src.slice(start, i), end: i };
}
function schemeValueToLilyMarkupLiteral(value) {
  if (typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number")
    return String(value);
  if (typeof value === "boolean")
    return value ? "##t" : "##f";
  if (isSchemePairValue(value)) {
    return `(${schemeValueToLilyMarkupLiteral(value.car)} . ${schemeValueToLilyMarkupLiteral(value.cdr)})`;
  }
  return value.map(schemeValueToLilyMarkupLiteral).join(" ");
}
function evaluateSchemeExprText(text, env) {
  return evaluateSchemeExpr(schemeExprNodeFromSExpr(readSchemeBlock(text)), env);
}
function substituteSchemeInterpolations(src, env) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      out += src[i++];
      while (i < src.length) {
        out += src[i];
        if (src[i] === "\\" && i + 1 < src.length) {
          i++;
          out += src[i];
        } else if (src[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (src[i] !== "#") {
      out += src[i++];
      continue;
    }
    if (src[i + 1] === "(") {
      const { text, end } = readBalancedSchemeCallFromSource(src, i);
      out += schemeValueToLilyMarkupLiteral(evaluateSchemeExprText(text, env));
      i = end;
      continue;
    }
    const symbol = readHashSymbol(src, i + 1);
    if (symbol) {
      out += schemeValueToLilyMarkupLiteral(env.get(symbol.name));
      i = symbol.end;
      continue;
    }
    out += src[i++];
  }
  return out;
}
function parseMarkupFromSchemeBody(bodySource, env, language) {
  const inner = stripLilyBlockDelimiters(bodySource);
  const substituted = substituteSchemeInterpolations(inner, env);
  const tokens = tokenize(substituted, { language });
  const state = createState(tokens, substituted, language);
  const cmd = expect(state, "command", "Expected \\markup in Scheme function body");
  if (!cmd || cmd.value !== "markup") {
    throw new Error("Only markup-emitting define-scheme-function bodies are supported");
  }
  return parseTopLevelMarkup(state, cmd);
}

// src/music-input/lilypond/functions/schemeRuntime.ts
function executeSchemeFunctionCall(call, env, language) {
  const fn = env.functions.get(call.name);
  if (!fn)
    throw new Error(`Unknown Scheme function: \\${call.name}`);
  if (call.args.length !== fn.params.length) {
    throw new Error(`\\${call.name} expects ${fn.params.length} args, got ${call.args.length}`);
  }
  const locals = new Map;
  for (let i = 0;i < fn.params.length; i++) {
    const param = fn.params[i];
    const value = evaluateSchemeExpr(call.args[i], env);
    assertPredicate(param.predicate, value, call.name, param.name);
    locals.set(param.name, value);
  }
  const frame = env.child(locals);
  for (const mutation of fn.mutations) {
    executeSchemeMutation(mutation, frame);
  }
  return parseMarkupFromSchemeBody(fn.bodySource, frame, language);
}
// src/music-input/lilypond/phases/parser/schemeFunctions.ts
function parseTopLevelSchemeBlock(state) {
  if (!check(state, "scheme_block"))
    return null;
  const token = advance(state);
  try {
    const schemeToken = token;
    return parseSchemeVariableDefinition(schemeToken) ?? parseSchemeOption(schemeToken);
  } catch (error) {
    state.errors.add(new ParseError({
      message: error instanceof Error ? error.message : "Unsupported top-level Scheme block",
      loc: tokenToLoc(token),
      recoverable: true
    }));
    return null;
  }
}
function parseSchemeFunctionDefinition2(state, nameToken) {
  if (!check(state, "scheme_block"))
    return null;
  const token = advance(state);
  try {
    return parseSchemeFunctionDefinition(nameToken.value, token);
  } catch (error) {
    state.errors.add(new ParseError({
      message: error instanceof Error ? error.message : `Unsupported Scheme function ${nameToken.value}`,
      loc: tokenToLoc(token),
      recoverable: true
    }));
    return null;
  }
}
function parseListArgument(token) {
  return parseSchemeExpressionToken(token);
}
function parseSchemeFunctionCall(state) {
  const cmd = advance(state);
  const fn = state.schemeFunctions.get(cmd.value);
  const args = [];
  if (!fn) {
    state.errors.add(new ParseError({
      message: `Unknown Scheme function: \\${cmd.value}`,
      loc: tokenToLoc(cmd),
      recoverable: true
    }));
    return { type: "schemeFunctionCall", name: cmd.value, args, loc: tokenToLoc(cmd) };
  }
  for (const param of fn.params) {
    if (param.predicate === "string?" && check(state, "string")) {
      const tok = advance(state);
      args.push({ type: "schemeString", value: tok.value, loc: tokenToLoc(tok) });
      continue;
    }
    if (param.predicate === "number?" && check(state, "number")) {
      const tok = advance(state);
      args.push({ type: "schemeNumber", value: Number(tok.value), loc: tokenToLoc(tok) });
      continue;
    }
    if (param.predicate === "list?" && check(state, "scheme_block")) {
      const tok = advance(state);
      try {
        args.push(parseListArgument(tok));
      } catch (error) {
        state.errors.add(new ParseError({
          message: error instanceof Error ? error.message : `Invalid list argument for \\${cmd.value}`,
          loc: tokenToLoc(tok),
          recoverable: true
        }));
      }
      continue;
    }
    state.errors.add(new ParseError({
      message: `Unsupported or missing argument for \\${cmd.value}: expected ${param.predicate}`,
      loc: tokenToLoc(current(state)),
      recoverable: true
    }));
    break;
  }
  return {
    type: "schemeFunctionCall",
    name: cmd.value,
    args,
    loc: tokenToLoc(cmd)
  };
}

// src/music-input/lilypond/phases/parser/index.ts
var TOP_LEVEL_SOURCE_SCHEME_COMMANDS = new Set([
  "set-global-staff-size",
  "set-paper-size",
  "set-default-paper-size"
]);
function parseVariableDef(state) {
  if (!check(state, "word"))
    return null;
  const nameToken = advance(state);
  if (!match(state, "equals")) {
    state.pos--;
    return null;
  }
  if (check(state, "string")) {
    advance(state);
    return null;
  }
  if (check(state, "scheme_block")) {
    const fn = parseSchemeFunctionDefinition2(state, nameToken);
    if (fn) {
      state.schemeFunctions.set(fn.name, fn);
      return fn;
    }
    return null;
  }
  const body = parseMusic(state);
  if (!body) {
    state.errors.add(new ParseError({
      message: `Expected music after ${nameToken.value} =`,
      loc: tokenToLoc(nameToken),
      recoverable: true
    }));
    return null;
  }
  return {
    type: "variableDef",
    name: nameToken.value,
    body,
    isRelative: false,
    loc: tokenToLoc(nameToken)
  };
}
function parseDocument(state) {
  const children = [];
  while (!isAtEnd(state)) {
    const startPos = state.pos;
    const token = peek(state);
    if (!token)
      break;
    if (token.kind === "eof")
      break;
    if (trySkipTopLevelSchemeCall(state, TOP_LEVEL_SOURCE_SCHEME_COMMANDS)) {
      continue;
    }
    if (token.kind === "scheme_block") {
      const schemeNode = parseTopLevelSchemeBlock(state);
      if (schemeNode)
        children.push(schemeNode);
      continue;
    }
    if (token.kind === "word") {
      if (trySkipSchemeAliasDefinition(state)) {
        continue;
      }
      const savePos = state.pos;
      const varDef = parseVariableDef(state);
      if (varDef) {
        if (varDef.type === "variableDef")
          state.variables.set(varDef.name, varDef);
        if (varDef.type === "schemeFunctionDefinition")
          state.schemeFunctions.set(varDef.name, varDef);
        children.push(varDef);
        continue;
      }
      state.pos = savePos;
    }
    if (token.kind === "command") {
      const cmdName = token.value;
      if (state.schemeFunctions.has(cmdName)) {
        children.push(parseSchemeFunctionCall(state));
        continue;
      }
      if (cmdName === "version") {
        advance(state);
        const versionToken = expect(state, "string", "Expected version string");
        if (versionToken) {
          children.push({
            type: "version",
            version: versionToken.value,
            loc: tokenToLoc(token)
          });
        }
        continue;
      }
      if (cmdName === "language") {
        advance(state);
        const langToken = expect(state, "string", "Expected language string");
        if (langToken) {
          const parsedLanguage = normalizeLyLanguage(langToken.value);
          if (parsedLanguage)
            state.language = parsedLanguage;
          children.push({
            type: "language",
            language: langToken.value,
            loc: tokenToLoc(token)
          });
        }
        continue;
      }
      if (cmdName === "header") {
        advance(state);
        const headerNode = parseHeader(state);
        if (headerNode) {
          children.push(headerNode);
        }
        continue;
      }
      if (cmdName === "paper") {
        advance(state);
        const paperNode = parsePaper(state);
        if (paperNode) {
          children.push(paperNode);
        }
        continue;
      }
      if (cmdName === "layout") {
        advance(state);
        const layoutNode = parseLayout(state);
        if (layoutNode) {
          children.push(layoutNode);
        }
        continue;
      }
      if (cmdName === "markup") {
        const cmdToken = advance(state);
        const markupNode = parseTopLevelMarkup(state, cmdToken);
        children.push(markupNode);
        continue;
      }
      if (cmdName === "markuplist") {
        const mlTok = advance(state);
        if (check(state, "open")) {
          const openTok = advance(state);
          const items = [];
          while (!isAtEnd(state) && !check(state, "close")) {
            const itemTok = current(state);
            const itemBlock = parseTopLevelMarkup(state, itemTok);
            if (itemBlock.children.length === 1) {
              items.push(itemBlock.children[0]);
            } else if (itemBlock.children.length > 1) {
              items.push(itemBlock);
            }
          }
          if (check(state, "close"))
            advance(state);
          const listNode = { type: "markupList", items, loc: tokenToLoc(openTok) };
          children.push({ type: "markupBlock", children: [listNode], loc: tokenToLoc(mlTok) });
        }
        continue;
      }
      if (cmdName === "score" || cmdName === "book" || cmdName === "bookpart") {
        advance(state);
        state._lastLayout = undefined;
        const body = parseMusic(state);
        if (body) {
          const capturedLayout = state._lastLayout;
          const scoreNode = {
            type: cmdName === "score" ? "scoreBlock" : cmdName,
            ...cmdName === "score" ? { music: body } : { scores: [body] },
            ...cmdName === "score" && capturedLayout ? { layout: capturedLayout } : {},
            loc: tokenToLoc(token)
          };
          children.push(scoreNode);
        }
        continue;
      }
      const music2 = parseCommand(state);
      if (music2)
        children.push(music2);
      continue;
    }
    const music = parseMusic(state);
    if (music)
      children.push(music);
    if (state.pos === startPos) {
      advance(state);
    }
  }
  return children;
}
function parse(tokens, source, language = "english") {
  const state = createState(tokens, source, language);
  const children = parseDocument(state);
  const ast = children.length > 0 ? {
    type: "root",
    children,
    loc: children[0]?.loc
  } : null;
  return {
    ast,
    variables: state.variables,
    schemeFunctions: state.schemeFunctions,
    errors: state.errors
  };
}
// src/music-input/lilypond/phases/03-transform.ts
var BASE_STEP = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
var ABS_OCTAVE_PREFIX = "abs:";
function contextFromPitch(pitch2) {
  const diatonicClass = BASE_STEP[pitch2.base] ?? 0;
  const upOctaves = (pitch2.octave.match(/'/g) || []).length;
  const downOctaves = (pitch2.octave.match(/,/g) || []).length;
  const octave = 3 + upOctaves - downOctaves;
  return { prevDiatonic: octave * 7 + diatonicClass, relativeMode: true };
}
function defaultRelativeContext() {
  return { prevDiatonic: 3 * 7 + 3, relativeMode: true };
}
function absoluteContext() {
  return { prevDiatonic: 4 * 7 + 0, relativeMode: false };
}
function resolveRelative(note, ctx) {
  const { pitch: pitch2 } = note;
  const diatonicClass = BASE_STEP[pitch2.base] ?? 0;
  const prevOctave = Math.floor(ctx.prevDiatonic / 7);
  let bestOctave = prevOctave;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const tryOctave of [prevOctave - 1, prevOctave, prevOctave + 1]) {
    const tryDiatonic = tryOctave * 7 + diatonicClass;
    const dist = Math.abs(tryDiatonic - ctx.prevDiatonic);
    if (dist < bestDist || dist === bestDist && tryOctave === prevOctave) {
      bestDist = dist;
      bestOctave = tryOctave;
    }
  }
  const upOctaves = (pitch2.octave.match(/'/g) || []).length;
  const downOctaves = (pitch2.octave.match(/,/g) || []).length;
  bestOctave += upOctaves - downOctaves;
  const newDiatonic = bestOctave * 7 + diatonicClass;
  const absolutePitch = {
    base: pitch2.base,
    accidental: pitch2.accidental,
    octave: `${ABS_OCTAVE_PREFIX}${bestOctave}`
  };
  return {
    note: { ...note, pitch: absolutePitch },
    newCtx: { prevDiatonic: newDiatonic, relativeMode: ctx.relativeMode }
  };
}
function resolveAbsolute(note, ctx) {
  const pitch2 = note.pitch;
  const diatonicClass = BASE_STEP[pitch2.base] ?? 0;
  const upOctaves = (pitch2.octave.match(/'/g) || []).length;
  const downOctaves = (pitch2.octave.match(/,/g) || []).length;
  const octave = 3 + upOctaves - downOctaves;
  const newDiatonic = octave * 7 + diatonicClass;
  return {
    note: {
      ...note,
      pitch: {
        base: pitch2.base,
        accidental: pitch2.accidental,
        octave: `${ABS_OCTAVE_PREFIX}${octave}`
      }
    },
    newCtx: { prevDiatonic: newDiatonic, relativeMode: ctx.relativeMode }
  };
}
function transformMusic(node, ctx, variables) {
  const currentCtx = ctx ?? absoluteContext();
  switch (node.type) {
    case "note": {
      const res = currentCtx.relativeMode ? resolveRelative(node, currentCtx) : resolveAbsolute(node, currentCtx);
      return { node: res.note, ctx: res.newCtx };
    }
    case "relative": {
      const relCtx = node.startPitch ? contextFromPitch(node.startPitch) : defaultRelativeContext();
      const bodyResult = transformMusic(node.body, relCtx, variables);
      return {
        node: { ...node, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "fixed": {
      const fixedStart = contextFromPitch(node.startPitch);
      const bodyResult = transformMusic(node.body, { ...fixedStart, relativeMode: false }, variables);
      return {
        node: { ...node, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "sequential":
    case "simultaneous": {
      let seqCtx = currentCtx;
      const elements = [];
      for (const el of node.elements) {
        const result = transformMusic(el, seqCtx, variables);
        elements.push(result.node);
        seqCtx = result.ctx;
      }
      return {
        node: { ...node, elements },
        ctx: seqCtx
      };
    }
    case "chord": {
      if (node.notes.length === 0)
        return { node, ctx };
      let chordCtx = currentCtx;
      const resolvedNotes = [];
      for (const n of node.notes) {
        const res = currentCtx.relativeMode ? resolveRelative(n, chordCtx) : resolveAbsolute(n, chordCtx);
        resolvedNotes.push(res.note);
        chordCtx = res.newCtx;
      }
      const first = resolvedNotes[0];
      const firstOctave = Number.parseInt(first.pitch.octave.slice(ABS_OCTAVE_PREFIX.length), 10);
      const firstClass = BASE_STEP[first.pitch.base] ?? 0;
      return {
        node: { ...node, notes: resolvedNotes },
        ctx: Number.isFinite(firstOctave) ? { prevDiatonic: firstOctave * 7 + firstClass, relativeMode: chordCtx.relativeMode } : chordCtx
      };
    }
    case "tuplet": {
      const tupletNode = node;
      const bodyResult = transformMusic(tupletNode.body, currentCtx, variables);
      return {
        node: { ...node, body: bodyResult.node },
        ctx: bodyResult.ctx
      };
    }
    case "musicScale": {
      const scaleNode = node;
      const bodyResult = transformMusic(scaleNode.body, currentCtx, variables);
      return {
        node: { ...scaleNode, body: bodyResult.node },
        ctx: bodyResult.ctx
      };
    }
    case "chordNamesContext": {
      const cn = node;
      const bodyResult = transformMusic(cn.body, currentCtx, variables);
      return {
        node: { ...cn, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "staffContext": {
      const staff2 = node;
      const bodyResult = transformMusic(staff2.body, absoluteContext(), variables);
      return {
        node: { ...staff2, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "staffGroupContext": {
      const sg = node;
      const transformedStaves = sg.staves.map((stave) => {
        const result = transformMusic(stave, absoluteContext(), variables);
        return result.node;
      });
      return {
        node: { type: "staffGroupContext", groupType: sg.groupType, staves: transformedStaves, loc: sg.loc },
        ctx: currentCtx
      };
    }
    case "chordMode":
      return { node, ctx: currentCtx };
    case "grace": {
      const graceNode = node;
      const bodyResult = transformMusic(graceNode.body, currentCtx, variables);
      return {
        node: { ...graceNode, body: bodyResult.node },
        ctx: bodyResult.ctx
      };
    }
    case "repeat": {
      const rep = node;
      const bodyResult = transformMusic(rep.body, currentCtx, variables);
      let exitCtx = bodyResult.ctx;
      const alternatives = [];
      if (rep.alternatives && rep.alternatives.length > 0) {
        let altCtx = bodyResult.ctx;
        let lastAltCtx = bodyResult.ctx;
        for (const alt of rep.alternatives) {
          const result = transformMusic(alt, altCtx, variables);
          alternatives.push(result.node);
          altCtx = result.ctx;
          lastAltCtx = result.ctx;
        }
        exitCtx = lastAltCtx;
      }
      return {
        node: {
          ...rep,
          body: bodyResult.node,
          ...alternatives.length ? { alternatives } : {}
        },
        ctx: exitCtx
      };
    }
    case "transpose": {
      const tr = node;
      const bodyResult = transformMusic(tr.body, currentCtx, variables);
      return {
        node: { ...tr, body: bodyResult.node },
        ctx: bodyResult.ctx
      };
    }
    case "variableRef": {
      const ref = node;
      const varBody = variables.get(ref.name);
      if (!varBody)
        return { node, ctx: currentCtx };
      return transformMusic(varBody, currentCtx, variables);
    }
    case "lyricMode":
    case "lyrics":
    case "addlyrics": {
      const lyricNode = node;
      const bodyResult = transformMusic(lyricNode.body, currentCtx, variables);
      return {
        node: { ...lyricNode, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "lyricsto": {
      const ls = node;
      const bodyResult = transformMusic(ls.body, currentCtx, variables);
      return {
        node: { ...ls, body: bodyResult.node },
        ctx: currentCtx
      };
    }
    case "lyricSyllable":
      return { node, ctx: currentCtx };
    default:
      return { node, ctx: currentCtx };
  }
}
function transform(ast) {
  const variables = new Map;
  const schemeEnv = createSchemeEnvironment();
  for (const child of ast.children) {
    if (child.type === "variableDef") {
      variables.set(child.name, child.body);
    }
  }
  const children = [];
  for (const child of ast.children) {
    if (child.type === "schemeVariableDefinition") {
      const def = child;
      schemeEnv.setGlobal(def.name, evaluateSchemeExpr(def.value, schemeEnv));
      continue;
    }
    if (child.type === "schemeFunctionDefinition") {
      const fn = child;
      schemeEnv.functions.set(fn.name, fn);
      continue;
    }
    if (child.type === "schemeFunctionCall") {
      const call = child;
      const expanded = executeSchemeFunctionCall(call, schemeEnv, "english");
      children.push({ ...expanded, loc: call.loc });
      continue;
    }
    if (child.type === "scoreBlock") {
      const score2 = child;
      const result = transformMusic(score2.music, absoluteContext(), variables);
      children.push({ ...score2, music: result.node });
      continue;
    }
    if (child.type === "staffGroupContext") {
      const result = transformMusic(child, absoluteContext(), variables);
      children.push(result.node);
      continue;
    }
    if (child.type === "variableDef")
      continue;
    switch (child.type) {
      case "relative":
      case "fixed":
      case "sequential":
      case "simultaneous":
      case "note":
      case "rest":
      case "spacer":
      case "multiRest":
      case "chord":
      case "variableRef":
      case "transpose":
      case "key":
      case "time":
      case "clef":
      case "tempo":
      case "repeat":
      case "tuplet":
      case "musicScale":
      case "stemDirection":
      case "omit":
      case "chordMode":
      case "chordNamesContext":
      case "staffContext":
      case "staffGroupContext":
      case "grace":
      case "ottava":
      case "bar":
      case "partial":
      case "slur":
      case "tie":
      case "beam":
      case "cadenza":
      case "articulation":
      case "pedal":
      case "attachedText":
      case "set":
      case "override":
      case "markupBlock":
      case "lyrics":
      case "addlyrics":
      case "lyricsto": {
        const result = transformMusic(child, absoluteContext(), variables);
        children.push(result.node);
        continue;
      }
      default:
        children.push(child);
    }
  }
  return { ...ast, children };
}

// src/music-input/lilypond/phases/04-validate.ts
function createContext() {
  return {
    timeSig: null,
    keySig: null,
    barDuration: 0,
    currentDuration: 0,
    errors: new ErrorCollection
  };
}
function calculateDuration(node) {
  if (!node.duration)
    return 4;
  let value = node.duration.value;
  let dots = node.duration.dots ?? 0;
  let quarters = 4 / value;
  let dotFactor = 0;
  for (let i = 0;i < dots; i++) {
    dotFactor += Math.pow(0.5, i + 1);
  }
  quarters *= 1 + dotFactor;
  return quarters;
}
function validateMusic(node, ctx) {
  switch (node.type) {
    case "note": {
      ctx.currentDuration += calculateDuration(node);
      if (ctx.currentDuration > 64) {
        ctx.errors.add(new ParseError({
          message: "Note duration seems very long - possible error?",
          loc: node.loc,
          severity: "warning",
          recoverable: true
        }));
      }
      break;
    }
    case "rest":
      ctx.currentDuration += node.duration ? calculateDuration(node) : 4;
      break;
    case "sequential":
    case "simultaneous": {
      const savedDuration = ctx.currentDuration;
      for (const el of node.elements) {
        validateMusic(el, ctx);
      }
      if (node.type === "simultaneous") {
        ctx.currentDuration = savedDuration + ctx.currentDuration;
      }
      break;
    }
    case "musicScale":
      validateMusic(node.body, ctx);
      break;
    case "stemDirection":
    case "omit":
      break;
    case "time": {
      const timeNode = node;
      ctx.timeSig = { num: timeNode.numerator, den: timeNode.denominator };
      ctx.barDuration = 0;
      break;
    }
    case "key": {
      const keyNode = node;
      ctx.keySig = { base: keyNode.pitch.base, mode: keyNode.mode };
      break;
    }
    default:
      break;
  }
}
function validate(ast) {
  const ctx = createContext();
  for (const child of ast.children) {
    switch (child.type) {
      case "scoreBlock":
      case "variableDef":
        if ("music" in child) {
          validateMusic(child.music, ctx);
        } else if ("body" in child) {
          validateMusic(child.body, ctx);
        }
        break;
      default:
        break;
    }
  }
  return {
    valid: !ctx.errors.hasFatalError(),
    errors: ctx.errors
  };
}

// src/music-input/lilypond/ast/helpers.ts
function isMusicNode(node) {
  return node.type === "note" || node.type === "rest" || node.type === "spacer" || node.type === "multiRest" || node.type === "chord" || node.type === "sequential" || node.type === "simultaneous" || node.type === "variableRef" || node.type === "relative" || node.type === "fixed" || node.type === "transpose" || node.type === "key" || node.type === "time" || node.type === "timeSignatureStyle" || node.type === "clef" || node.type === "tempo" || node.type === "rehearsalMark" || node.type === "repeat" || node.type === "tuplet" || node.type === "musicScale" || node.type === "stemDirection" || node.type === "omit" || node.type === "chordMode" || node.type === "chordNamesContext" || node.type === "staffContext" || node.type === "staffGroupContext" || node.type === "grace" || node.type === "ottava" || node.type === "bar" || node.type === "partial" || node.type === "beamMode" || node.type === "cadenza" || node.type === "set" || node.type === "override" || node.type === "slur" || node.type === "phrasingSlur" || node.type === "tie" || node.type === "beam" || node.type === "articulation" || node.type === "ornament" || node.type === "dynamics" || node.type === "hairpin" || node.type === "glissando" || node.type === "fingering" || node.type === "pedal" || node.type === "attachedText" || node.type === "markupBlock" || node.type === "lyricMode" || node.type === "lyrics" || node.type === "lyricsto" || node.type === "addlyrics" || node.type === "lyricSyllable" || node.type === "compressMMRests";
}
function isRelativeNode(node) {
  return node.type === "relative";
}
function isFixedNode(node) {
  return node.type === "fixed";
}
// src/music-input/lilypond/phases/emit/context.ts
function createContext2() {
  return {
    notes: [],
    voices: [],
    structuralEvents: [],
    chordNames: [],
    lyricLines: [],
    systemBreaks: [],
    repeatRegions: [],
    percentRepeatRegions: [],
    voltaRegions: [],
    currentKey: "C",
    currentTimeSig: "4/4",
    keySeen: false,
    timeSeen: false,
    ottavaLevel: 0,
    ottavaStartIndex: -1,
    ottavaRegions: [],
    tempoMarks: [],
    midiInstrument: undefined,
    rehearsalMarks: [],
    pendingTieEnd: false,
    activeBeamGroupId: undefined,
    activeBeamStemDirection: undefined,
    stemDirection: undefined,
    omitNextTupletNumber: false,
    beamGroupCounter: 0,
    cadenzaEnabled: false,
    lastDuration: { value: 4, dots: 0 },
    partialDuration: undefined,
    simultaneousDepth: 0,
    compressMMRests: false,
    countPercentRepeats: false,
    printInitialRepeatBar: false,
    currentGlissandoStyle: undefined,
    nextGlissandoStyle: undefined
  };
}

// src/music-input/lilypond/phases/emit/pitch.ts
var DIATONIC_BASES = ["c", "d", "e", "f", "g", "a", "b"];
var DIATONIC_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
var STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
function pitchToNoteName(pitch2) {
  const base = pitch2.base.toUpperCase();
  const accMap = {
    "": "",
    s: "#",
    ss: "##",
    f: "b",
    ff: "bb"
  };
  const acc = accMap[pitch2.accidental ?? ""] ?? "";
  return base + acc;
}
function pitchToOctave(pitch2) {
  if (pitch2.octave.startsWith("abs:")) {
    const n = Number.parseInt(pitch2.octave.slice(4), 10);
    if (Number.isFinite(n))
      return n;
  }
  const upOctaves = (pitch2.octave.match(/'/g) || []).length;
  const downOctaves = (pitch2.octave.match(/,/g) || []).length;
  const octaveDelta = upOctaves - downOctaves;
  return 3 + octaveDelta;
}
function pitchToPitchClass(pitch2) {
  const baseSemitones = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11
  };
  const accSemitones = {
    "": 0,
    s: 1,
    ss: 2,
    f: -1,
    ff: -2
  };
  const base = baseSemitones[pitch2.base] ?? 0;
  const acc = accSemitones[pitch2.accidental ?? ""] ?? 0;
  return ((base + acc) % 12 + 12) % 12;
}
function transposePitch(pitch2, semitoneShift, diatonicShift) {
  if (semitoneShift === 0 && diatonicShift === 0)
    return pitch2;
  const octave = pitchToOctave(pitch2);
  const baseIdx = DIATONIC_INDEX[pitch2.base] ?? 0;
  const absDiatonic = octave * 7 + baseIdx;
  const absSemitone = octave * 12 + pitchToPitchClass(pitch2);
  const outDiatonic = absDiatonic + diatonicShift;
  const outSemitone = absSemitone + semitoneShift;
  const outOctave = Math.floor(outDiatonic / 7);
  const outBaseIdx = (outDiatonic % 7 + 7) % 7;
  const outBase = DIATONIC_BASES[outBaseIdx];
  const naturalSemitone = outOctave * 12 + STEP_SEMITONES[outBaseIdx];
  let diff = outSemitone - naturalSemitone;
  while (diff > 6)
    diff -= 12;
  while (diff < -6)
    diff += 12;
  let accidental = "";
  if (diff >= 2)
    accidental = "ss";
  else if (diff === 1)
    accidental = "s";
  else if (diff === -1)
    accidental = "f";
  else if (diff <= -2)
    accidental = "ff";
  return {
    base: outBase,
    accidental,
    octave: `abs:${outOctave}`
  };
}

// src/music-input/lilypond/phases/emit/duration.ts
function durationToQN(duration2) {
  const base = 4 / duration2.value;
  let dots = duration2.dots ?? 0;
  let total = base;
  let dotValue = base / 2;
  while (dots > 0) {
    total += dotValue;
    dotValue /= 2;
    dots--;
  }
  return total;
}
function durationToWritten(duration2) {
  const valueMap = {
    1: "whole",
    2: "half",
    4: "quarter",
    8: "eighth",
    16: "16th",
    32: "32nd",
    64: "64th"
  };
  return {
    value: valueMap[duration2.value] || "quarter",
    dots: duration2.dots ?? 0
  };
}
function effectiveDuration(duration2, ctx) {
  if (duration2) {
    ctx.lastDuration = duration2;
    return duration2;
  }
  return ctx.lastDuration;
}
function formatDuration(wd) {
  if (!wd)
    return "";
  const dots = ".".repeat(wd.dots);
  return wd.value + dots;
}
function writtenFromQuarterNotes(qn) {
  const candidates = [
    { qn: 4, value: "whole", dots: 0 },
    { qn: 3, value: "half", dots: 1 },
    { qn: 2, value: "half", dots: 0 },
    { qn: 1.5, value: "quarter", dots: 1 },
    { qn: 1, value: "quarter", dots: 0 },
    { qn: 0.75, value: "eighth", dots: 1 },
    { qn: 0.5, value: "eighth", dots: 0 },
    { qn: 0.375, value: "16th", dots: 1 },
    { qn: 0.25, value: "16th", dots: 0 },
    { qn: 0.125, value: "32nd", dots: 0 },
    { qn: 0.0625, value: "64th", dots: 0 }
  ];
  const match2 = candidates.find((candidate) => Math.abs(candidate.qn - qn) < 0.0001);
  return match2 ? { value: match2.value, dots: match2.dots } : { value: "quarter", dots: 0 };
}

// src/music-input/lilypond/phases/emit/notes.ts
function parseFingering(raw) {
  if (!raw)
    return {};
  const below = raw.startsWith("_");
  const digits = raw.startsWith("_") || raw.startsWith("^") ? raw.slice(1) : raw;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n))
    return {};
  return {
    value: n,
    ...below ? { below: true } : {}
  };
}
function emitNote(node, ctx, semitoneShift = 0, diatonicShift = 0) {
  const pitch2 = transposePitch(node.pitch, semitoneShift, diatonicShift);
  const resolvedDuration = effectiveDuration(node.duration, ctx);
  const qn = durationToQN(resolvedDuration);
  const fingering = parseFingering(node.fingering);
  const wd = durationToWritten(resolvedDuration);
  const noteName = pitchToNoteName(pitch2);
  const octave = pitchToOctave(pitch2);
  const emitted = {
    noteName,
    octave,
    pitchClass: pitchToPitchClass(pitch2),
    duration: qn,
    writtenDuration: wd,
    isRest: false,
    isGrace: false,
    tooltipText: `${noteName}${octave} ${formatDuration(wd)}`,
    ...node.loc?.offset != null && node.loc.endOffset != null ? { sourceRange: { start: node.loc.offset, end: node.loc.endOffset } } : {},
    ...node.fingering && node.loc?.endOffset != null ? { fingeringRange: { start: node.loc.endOffset - node.fingering.length, end: node.loc.endOffset } } : {},
    ...fingering.value !== undefined ? { fingering: fingering.value } : {},
    ...fingering.below ? { fingeringBelow: true } : {},
    ...ctx.activeBeamGroupId ? { beamGroupId: ctx.activeBeamGroupId } : {},
    ...ctx.stemDirection ?? ctx.activeBeamStemDirection ? { stemDirection: ctx.stemDirection ?? ctx.activeBeamStemDirection } : {}
  };
  if (ctx.pendingTieEnd) {
    emitted.tieEnd = true;
    ctx.pendingTieEnd = false;
  }
  return emitted;
}
function emitRest(node, ctx) {
  const resolvedDuration = effectiveDuration(node.duration, ctx);
  const qn = durationToQN(resolvedDuration);
  const wd = durationToWritten(resolvedDuration);
  const isFullMeasureRest = node.type === "multiRest";
  const mmBars = isFullMeasureRest ? node.barCount ?? 1 : undefined;
  return {
    noteName: "R",
    octave: 0,
    pitchClass: -1,
    duration: qn,
    writtenDuration: wd,
    isRest: true,
    ...node.type === "spacer" ? { isSpacer: true } : {},
    ...isFullMeasureRest ? { isFullMeasureRest: true } : {},
    ...ctx.stemDirection ?? ctx.activeBeamStemDirection ? { stemDirection: ctx.stemDirection ?? ctx.activeBeamStemDirection } : {},
    isGrace: false,
    ...mmBars != null ? { mmRestBars: mmBars } : {},
    tooltipText: node.type === "spacer" ? `spacer ${formatDuration(wd)}` : mmBars != null ? `rest ${mmBars} bars` : `rest ${formatDuration(wd)}`,
    ...node.loc?.offset != null && node.loc.endOffset != null ? { sourceRange: { start: node.loc.offset, end: node.loc.endOffset } } : {}
  };
}
function emitChord(node, ctx, semitoneShift = 0, diatonicShift = 0) {
  if (node.notes.length === 0) {
    return emitRest({ type: "rest", duration: node.duration }, ctx);
  }
  const resolvedDuration = effectiveDuration(node.duration, ctx);
  const qn = durationToQN(resolvedDuration);
  const voiced = node.notes.map((n, idx) => {
    const tp = transposePitch(n.pitch, semitoneShift, diatonicShift);
    const octave = pitchToOctave(tp);
    const pitchClass = pitchToPitchClass(tp);
    return {
      idx,
      noteName: pitchToNoteName(tp),
      octave,
      pitchClass,
      rank: octave * 12 + pitchClass
    };
  });
  let main = voiced[0];
  for (const candidate of voiced) {
    if (candidate.rank > main.rank)
      main = candidate;
  }
  const chordNotes = voiced.filter((v) => v.idx !== main.idx).map((v) => ({
    noteName: v.noteName,
    octave: v.octave,
    pitchClass: v.pitchClass
  }));
  const wd = durationToWritten(resolvedDuration);
  const allNoteNames = voiced.map((v) => v.noteName);
  const emitted = {
    noteName: main.noteName,
    octave: main.octave,
    pitchClass: main.pitchClass,
    duration: qn,
    writtenDuration: wd,
    isRest: false,
    isGrace: false,
    tooltipText: `<${allNoteNames.join(" ")}> ${formatDuration(wd)}`,
    ...node.loc?.offset != null && node.loc.endOffset != null ? { sourceRange: { start: node.loc.offset, end: node.loc.endOffset } } : {},
    ...node.attachments && node.attachments.length > 0 ? {
      articulations: node.attachments.filter((a) => a.type === "articulation").map((a) => a.symbol)
    } : {},
    ...ctx.activeBeamGroupId ? { beamGroupId: ctx.activeBeamGroupId } : {},
    ...ctx.stemDirection ?? ctx.activeBeamStemDirection ? { stemDirection: ctx.stemDirection ?? ctx.activeBeamStemDirection } : {},
    ...chordNotes.length > 0 ? { chordNotes } : {}
  };
  if (ctx.pendingTieEnd) {
    emitted.tieEnd = true;
    ctx.pendingTieEnd = false;
  }
  return emitted;
}

// src/music-input/lilypond/phases/emit/chords.ts
var CHORD_ROOT_PITCH_CLASS = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};
var CHORD_QUALITY_INTERVALS = {
  "": [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  "°": [0, 3, 6],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "+": [0, 4, 8]
};
var DIATONIC_BASES2 = ["c", "d", "e", "f", "g", "a", "b"];
function pitchClassForRoot(root) {
  const letter = root[0]?.toUpperCase() ?? "C";
  let pc = CHORD_ROOT_PITCH_CLASS[letter] ?? 0;
  const acc = root.slice(1);
  for (const ch of acc) {
    if (ch === "#")
      pc += 1;
    if (ch === "b")
      pc -= 1;
  }
  return (pc % 12 + 12) % 12;
}
function accidentalSuffix(diff) {
  if (diff === 1)
    return "#";
  if (diff === 2)
    return "##";
  if (diff === -1)
    return "b";
  if (diff === -2)
    return "bb";
  return "";
}
function chordModeNameToPitches(name) {
  const match2 = name.match(/^([A-G](?:##|#|bb|b)?)(.*)$/);
  if (!match2)
    return [];
  const root = match2[1];
  const quality = match2[2] ?? "";
  const rootLetter = root[0].toUpperCase();
  const rootIdx = DIATONIC_INDEX[rootLetter.toLowerCase()] ?? 0;
  const rootPc = pitchClassForRoot(root);
  const intervals = CHORD_QUALITY_INTERVALS[quality] ?? CHORD_QUALITY_INTERVALS[""];
  return intervals.map((interval, degreeIndex) => {
    const diatonicStep = degreeIndex * 2;
    const noteIdx = (rootIdx + diatonicStep) % 7;
    const octave = 4 + Math.floor((rootIdx + diatonicStep) / 7);
    const letter = DIATONIC_BASES2[noteIdx].toUpperCase();
    const targetPc = (rootPc + interval) % 12;
    const naturalPc = STEP_SEMITONES[noteIdx];
    let diff = targetPc - naturalPc;
    while (diff > 6)
      diff -= 12;
    while (diff < -6)
      diff += 12;
    return {
      noteName: `${letter}${accidentalSuffix(diff)}`,
      octave,
      pitchClass: (targetPc % 12 + 12) % 12
    };
  });
}
function emitChordModeChord(chord, ctx, durationScale) {
  const pitches = chordModeNameToPitches(chord.name);
  if (pitches.length === 0)
    return;
  const main = pitches[pitches.length - 1];
  const wd = writtenFromQuarterNotes(chord.duration);
  const emitted = {
    noteName: main.noteName,
    octave: main.octave,
    pitchClass: main.pitchClass,
    duration: chord.duration * durationScale,
    writtenDuration: wd,
    isRest: false,
    isGrace: false,
    tooltipText: `<${pitches.map((p) => p.noteName).join(" ")}> ${formatDuration(wd)}`,
    ...pitches.length > 1 ? {
      chordNotes: pitches.slice(0, -1).map((p) => ({
        noteName: p.noteName,
        octave: p.octave,
        pitchClass: p.pitchClass
      }))
    } : {}
  };
  ctx.notes.push(emitted);
}
function collectChordModeChords(node) {
  switch (node.type) {
    case "chordMode":
      return node.chords;
    case "sequential":
    case "simultaneous":
      return node.elements.flatMap((el) => collectChordModeChords(el));
    case "relative":
    case "fixed":
      return collectChordModeChords(node.body);
    default:
      return [];
  }
}

// src/music-input/lilypond/phases/emit/lyrics.ts
function collectSyllables(node) {
  switch (node.type) {
    case "set": {
      const s = node;
      if (s.property === "stanza" && s.value != null) {
        return [{ text: "", stanza: String(s.value).trim() }];
      }
      return [];
    }
    case "lyricSyllable": {
      const s = node;
      return [{ text: s.text, hyphen: s.hyphen, extender: s.extender, skip: s.skip }];
    }
    case "lyricMode":
    case "lyrics":
    case "addlyrics": {
      const n = node;
      return collectSyllables(n.body);
    }
    case "lyricsto": {
      const n = node;
      return collectSyllables(n.body);
    }
    case "sequential":
    case "simultaneous": {
      const n = node;
      const result = [];
      for (const el of n.elements)
        result.push(...collectSyllables(el));
      return result;
    }
    default:
      return [];
  }
}
function buildLyricLine(syllables, notes, startIdx, voiceId) {
  const lyricableIdx = [];
  for (let i = 0;i < notes.length; i++) {
    const n = notes[i];
    if (!n.isGrace && !n.isRest)
      lyricableIdx.push(startIdx + i);
  }
  const out = [];
  let stanza;
  let notePos = 0;
  for (const s of syllables) {
    if (s.stanza != null) {
      stanza = s.stanza;
      continue;
    }
    if (notePos >= lyricableIdx.length)
      break;
    if (s.skip) {
      notePos++;
      continue;
    }
    out.push({
      text: s.text,
      noteIndex: lyricableIdx[notePos],
      ...s.hyphen ? { hyphen: true } : {},
      ...s.extender ? { extender: true } : {}
    });
    notePos++;
  }
  return { syllables: out, ...stanza ? { stanza } : {}, ...voiceId ? { voiceId } : {} };
}
function isLyricNode(type) {
  return type === "addlyrics" || type === "lyricsto" || type === "lyricMode" || type === "lyrics";
}

// src/music-input/lilypond/phases/emit/polyphony.ts
function mergeVoicesByTime(voices) {
  const streams = voices.map((notes, vi) => {
    const entries = [];
    let t = 0;
    for (const n of notes) {
      entries.push({ time: t, note: n, voiceIndex: vi });
      t += n.duration;
    }
    return entries;
  });
  const result = [];
  const ptrs = streams.map(() => 0);
  while (true) {
    let minTime = Number.POSITIVE_INFINITY;
    for (let vi = 0;vi < streams.length; vi++) {
      const p = ptrs[vi];
      if (p < streams[vi].length)
        minTime = Math.min(minTime, streams[vi][p].time);
    }
    if (!Number.isFinite(minTime))
      break;
    for (let vi = 0;vi < streams.length; vi++) {
      const stream = streams[vi];
      while (ptrs[vi] < stream.length && stream[ptrs[vi]].time === minTime) {
        const { note, voiceIndex, time } = stream[ptrs[vi]];
        if (voiceIndex > 0 && !note.isGrace) {
          result.push({ ...note, duration: 0, voiceDuration: note.duration, voiceOffsetQN: time });
        } else {
          result.push(note);
        }
        ptrs[vi]++;
      }
    }
  }
  return result;
}
function offsetStructuralEvent(ev, base) {
  if ("at" in ev)
    return { ...ev, at: ev.at + base };
  if ("noteIndex" in ev)
    return { ...ev, noteIndex: ev.noteIndex + base };
  if ("start" in ev && "end" in ev) {
    const e = ev;
    return { ...ev, start: e.start + base, end: e.end + base };
  }
  return ev;
}

// src/music-input/lilypond/phases/emit/events.ts
function keyToString(node) {
  const base = node.pitch.base.toUpperCase();
  const acc = node.pitch.accidental === "s" ? "#" : node.pitch.accidental === "f" ? "b" : "";
  const mode = node.mode === "minor" ? "m" : "";
  return base + acc + mode;
}
function timeToString(node) {
  return `${node.numerator}/${node.denominator}`;
}
function isCountPercentRepeatsProperty(property) {
  return property?.split(".").pop() === "countPercentRepeats";
}
function isPrintInitialRepeatBarProperty(property) {
  return property?.split(".").pop() === "printInitialRepeatBar";
}
function isMidiInstrumentProperty(property) {
  return property?.split(".").pop() === "midiInstrument";
}
function setBooleanValue(value) {
  if (typeof value === "boolean")
    return value;
  if (typeof value === "string") {
    if (value === "##t" || value === "#t" || value === "true")
      return true;
    if (value === "##f" || value === "#f" || value === "false")
      return false;
  }
  return null;
}
function parseFingeringEvent(raw) {
  if (!raw)
    return {};
  const below = raw.startsWith("_");
  const digits = raw.startsWith("_") || raw.startsWith("^") ? raw.slice(1) : raw;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n))
    return {};
  return {
    value: n,
    ...below ? { below: true } : {}
  };
}
function normalizeGlissandoStyle(value) {
  if (value === "dashed-line")
    return "dashed-line";
  if (value === "solid" || value === "line")
    return "solid";
  return;
}
function percentRepeatDuration(notes) {
  return notes.reduce((sum, note) => sum + (note.isGrace ? 0 : note.duration), 0);
}
function percentRepeatPlaceholder(note, percentRepeatId, occurrence) {
  return {
    noteName: "R",
    octave: 0,
    pitchClass: -1,
    duration: note.duration,
    ...note.writtenDuration ? { writtenDuration: note.writtenDuration } : {},
    ...note.tupletFactors ? { tupletFactors: note.tupletFactors.map((factor) => ({ ...factor })) } : {},
    isRest: true,
    isGrace: false,
    isPercentRepeatPlaceholder: true,
    percentRepeatOccurrence: occurrence,
    percentRepeatId,
    tooltipText: `percent repeat ${occurrence}`
  };
}
function emitMusic(node, ctx, durationScale = 1, semitoneShift = 0, diatonicShift = 0) {
  if (!node)
    return;
  switch (node.type) {
    case "note": {
      const emitted = emitNote(node, ctx, semitoneShift, diatonicShift);
      emitted.duration *= durationScale;
      ctx.notes.push(emitted);
      break;
    }
    case "rest":
    case "spacer":
      {
        const emitted = emitRest(node, ctx);
        emitted.duration *= durationScale;
        ctx.notes.push(emitted);
      }
      break;
    case "multiRest": {
      const mrNode = node;
      if (ctx.compressMMRests) {
        const emitted = emitRest(node, ctx);
        emitted.duration *= durationScale;
        ctx.notes.push(emitted);
      } else {
        const bars = mrNode.barCount ?? 1;
        for (let b = 0;b < bars; b++) {
          const emitted = emitRest(node, ctx);
          emitted.mmRestBars = undefined;
          emitted.duration *= durationScale;
          ctx.notes.push(emitted);
        }
      }
      break;
    }
    case "chord": {
      const emitted = emitChord(node, ctx, semitoneShift, diatonicShift);
      emitted.duration *= durationScale;
      ctx.notes.push(emitted);
      break;
    }
    case "sequential": {
      const seq = node;
      const lyricEls = seq.elements.filter((el) => isLyricNode(el.type));
      if (lyricEls.length > 0) {
        const melodyEls = seq.elements.filter((el) => !isLyricNode(el.type));
        const startIdx = ctx.notes.length;
        for (const el of melodyEls)
          emitMusic(el, ctx, durationScale, semitoneShift, diatonicShift);
        const melodyNotes = ctx.notes.slice(startIdx);
        for (const lyricEl of lyricEls) {
          const syllables = collectSyllables(lyricEl);
          if (syllables.length === 0)
            continue;
          const voiceId = lyricEl.voiceName;
          const line = buildLyricLine(syllables, melodyNotes, startIdx, voiceId);
          if (line.syllables.length > 0)
            ctx.lyricLines.push(line);
        }
      } else {
        for (const child of seq.elements) {
          emitMusic(child, ctx, durationScale, semitoneShift, diatonicShift);
        }
      }
      break;
    }
    case "simultaneous": {
      const sim = node;
      const lyricEls = sim.elements.filter((el) => isLyricNode(el.type));
      const melodyEls = sim.elements.filter((el) => !isLyricNode(el.type));
      if (lyricEls.length > 0) {
        const startIdx = ctx.notes.length;
        if (melodyEls.some((el) => el.type === "chordNamesContext")) {
          for (const el of melodyEls)
            emitMusic(el, ctx, durationScale, semitoneShift, diatonicShift);
        } else if (melodyEls[0]) {
          emitMusic(melodyEls[0], ctx, durationScale, semitoneShift, diatonicShift);
        }
        const melodyNotes = ctx.notes.slice(startIdx);
        for (const lyricEl of lyricEls) {
          const syllables = collectSyllables(lyricEl);
          if (syllables.length === 0)
            continue;
          const voiceId = lyricEl.voiceName;
          const line = buildLyricLine(syllables, melodyNotes, startIdx, voiceId);
          if (line.syllables.length > 0)
            ctx.lyricLines.push(line);
        }
      } else if (sim.elements.some((el) => el.type === "chordNamesContext")) {
        for (const el of sim.elements) {
          emitMusic(el, ctx, durationScale, semitoneShift, diatonicShift);
        }
      } else if (melodyEls.length >= 2) {
        const STEM_DIRS = ["up", "down", "up", "down"];
        ctx.simultaneousDepth++;
        const voiceNotes = melodyEls.map((el, vi) => {
          const scratch = createContext2();
          scratch.currentKey = ctx.currentKey;
          scratch.currentTimeSig = ctx.currentTimeSig;
          scratch.lastDuration = { ...ctx.lastDuration };
          scratch.cadenzaEnabled = ctx.cadenzaEnabled;
          scratch.stemDirection = ctx.stemDirection;
          scratch.activeBeamStemDirection = ctx.activeBeamStemDirection;
          scratch.omitNextTupletNumber = ctx.omitNextTupletNumber;
          scratch.simultaneousDepth = ctx.simultaneousDepth;
          emitMusic(el, scratch, durationScale, semitoneShift, diatonicShift);
          for (const n of scratch.notes) {
            if (n.beamGroupId)
              n.beamGroupId = `v${vi}-${n.beamGroupId}`;
          }
          const dir = STEM_DIRS[vi] ?? (vi % 2 === 0 ? "up" : "down");
          for (const n of scratch.notes)
            n.stemDirection = dir;
          return scratch.notes;
        });
        ctx.simultaneousDepth--;
        const isTopLevelPolyphony = ctx.simultaneousDepth === 0 && ctx.notes.length === 0;
        if (isTopLevelPolyphony) {
          for (let vi = 0;vi < voiceNotes.length; vi++) {
            ctx.voices.push({ voiceIndex: vi, notes: voiceNotes[vi] });
          }
        }
        const merged = mergeVoicesByTime(voiceNotes);
        ctx.notes.push(...merged);
        const scratch0 = createContext2();
        scratch0.currentKey = ctx.currentKey;
        scratch0.currentTimeSig = ctx.currentTimeSig;
        emitMusic(melodyEls[0], scratch0, durationScale, semitoneShift, diatonicShift);
        const baseIdx = ctx.notes.length - merged.length;
        for (const ev of scratch0.structuralEvents) {
          ctx.structuralEvents.push(offsetStructuralEvent(ev, baseIdx));
        }
        if (scratch0.partialDuration !== undefined && ctx.partialDuration === undefined) {
          ctx.partialDuration = scratch0.partialDuration;
        }
      } else if (melodyEls[0]) {
        emitMusic(melodyEls[0], ctx, durationScale, semitoneShift, diatonicShift);
      }
      break;
    }
    case "chordMode":
      for (const chord of node.chords) {
        emitChordModeChord(chord, ctx, durationScale);
      }
      break;
    case "chordNamesContext": {
      const cn = node;
      const chords = collectChordModeChords(cn.body);
      if (chords.length > 0)
        ctx.chordNames.push(...chords);
      break;
    }
    case "staffContext": {
      emitMusic(node.body, ctx, durationScale, semitoneShift, diatonicShift);
      break;
    }
    case "set": {
      const setNode = node;
      if (isCountPercentRepeatsProperty(setNode.property)) {
        const value = setBooleanValue(setNode.value);
        if (value != null)
          ctx.countPercentRepeats = value;
      } else if (isPrintInitialRepeatBarProperty(setNode.property)) {
        const value = setBooleanValue(setNode.value);
        if (value != null)
          ctx.printInitialRepeatBar = value;
      } else if (isMidiInstrumentProperty(setNode.property) && typeof setNode.value === "string") {
        ctx.midiInstrument = setNode.value;
      }
      break;
    }
    case "override": {
      const override = node;
      if (override.grob.split(".").pop() === "Glissando" && override.property === "style") {
        const style = normalizeGlissandoStyle(override.value);
        if (style) {
          if (override.once)
            ctx.nextGlissandoStyle = style;
          else
            ctx.currentGlissandoStyle = style;
        }
      }
      break;
    }
    case "key":
      const keyNode = node;
      const keyPitch = transposePitch(keyNode.pitch, semitoneShift, diatonicShift);
      const nextKey = keyToString({ ...keyNode, pitch: keyPitch });
      if (!ctx.keySeen) {
        ctx.currentKey = nextKey;
        ctx.keySeen = true;
      }
      ctx.structuralEvents.push({
        type: "keyChange",
        at: ctx.notes.length,
        key: nextKey
      });
      break;
    case "time":
      const nextTime = timeToString(node);
      if (!ctx.timeSeen) {
        ctx.currentTimeSig = nextTime;
        ctx.timeSeen = true;
      }
      ctx.structuralEvents.push({
        type: "timeChange",
        at: ctx.notes.length,
        timeSig: nextTime
      });
      break;
    case "timeSignatureStyle": {
      const styleNode = node;
      ctx.structuralEvents.push({
        type: "timeSignatureStyle",
        at: ctx.notes.length,
        style: styleNode.style
      });
      break;
    }
    case "beamMode": {
      const beamMode = node;
      ctx.structuralEvents.push({
        type: "autoBeam",
        at: ctx.notes.length,
        enabled: beamMode.enabled
      });
      break;
    }
    case "cadenza": {
      const cadenza = node;
      ctx.cadenzaEnabled = cadenza.enabled;
      ctx.structuralEvents.push({
        type: "cadenza",
        at: ctx.notes.length,
        enabled: cadenza.enabled
      });
      break;
    }
    case "clef": {
      const clefNode = node;
      const raw = (clefNode.name ?? "").toLowerCase();
      const normalized = raw === "g" ? "treble" : raw === "f" ? "bass" : raw === "c" ? "alto" : raw;
      if (normalized === "treble" || normalized === "bass" || normalized === "alto") {
        ctx.structuralEvents.push({
          type: "clefChange",
          at: ctx.notes.length,
          clef: normalized
        });
      }
      break;
    }
    case "compressMMRests": {
      const prev = ctx.compressMMRests;
      ctx.compressMMRests = true;
      emitMusic(node.body, ctx, durationScale, semitoneShift, diatonicShift);
      ctx.compressMMRests = prev;
      break;
    }
    case "ottava":
      const ottNode = node;
      if (ctx.ottavaLevel !== 0 && ctx.ottavaStartIndex >= 0) {
        const region = {
          start: ctx.ottavaStartIndex,
          end: ctx.notes.length,
          level: ctx.ottavaLevel
        };
        ctx.ottavaRegions.push(region);
        ctx.structuralEvents.push({ type: "ottavaRegion", ...region });
      }
      ctx.ottavaLevel = ottNode.octaveShift;
      ctx.ottavaStartIndex = ottNode.octaveShift !== 0 ? ctx.notes.length : -1;
      break;
    case "tempo":
      const tempoNode = node;
      ctx.tempoMarks.push({
        noteIndex: ctx.notes.length,
        text: tempoNode.text,
        bpm: tempoNode.bpm,
        beatUnitDenominator: tempoNode.beatUnitDenominator
      });
      ctx.structuralEvents.push({
        type: "tempoMark",
        noteIndex: ctx.notes.length,
        text: tempoNode.text,
        bpm: tempoNode.bpm,
        beatUnitDenominator: tempoNode.beatUnitDenominator
      });
      break;
    case "rehearsalMark": {
      const markNode = node;
      ctx.rehearsalMarks.push({
        noteIndex: ctx.notes.length,
        text: markNode.text
      });
      ctx.structuralEvents.push({
        type: "rehearsalMark",
        noteIndex: ctx.notes.length,
        text: markNode.text
      });
      break;
    }
    case "dynamics": {
      const dyn = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (last)
        last.dynamic = dyn.symbol;
      break;
    }
    case "articulation": {
      const art = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      if (!last.articulations) {
        last.articulations = [art.symbol];
      } else if (!last.articulations.includes(art.symbol)) {
        last.articulations.push(art.symbol);
      }
      break;
    }
    case "hairpin": {
      const hp = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      if (hp.direction === "crescendo")
        last.hairpinStart = "cresc";
      else if (hp.direction === "decrescendo")
        last.hairpinStart = "decresc";
      else
        last.hairpinEnd = true;
      break;
    }
    case "glissando": {
      const gliss = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last || last.isRest)
        break;
      if (gliss.spanType === "finger-glide") {
        last.fingerGlideStart = true;
      } else {
        last.glissando = true;
        const style = ctx.nextGlissandoStyle ?? ctx.currentGlissandoStyle;
        if (style)
          last.glissandoStyle = style;
        ctx.nextGlissandoStyle = undefined;
      }
      break;
    }
    case "fingering": {
      const fingering = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last || last.isRest)
        break;
      const parsed = parseFingeringEvent(fingering.value);
      if (parsed.value === undefined)
        break;
      last.fingering = parsed.value;
      last.fingeringBelow = parsed.below;
      if (fingering.loc?.offset != null && fingering.loc.endOffset != null) {
        last.fingeringRange = { start: fingering.loc.offset, end: fingering.loc.endOffset };
      }
      break;
    }
    case "pedal": {
      const pedal = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      const mark = {
        kind: pedal.kind,
        action: pedal.action,
        ...pedal.loc?.offset != null && pedal.loc.endOffset != null ? { sourceRange: { start: pedal.loc.offset, end: pedal.loc.endOffset } } : {}
      };
      last.pedals = [...last.pedals ?? [], mark];
      break;
    }
    case "attachedText": {
      const at = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      last.noteText = {
        text: at.text,
        placement: at.position,
        ...at.bold ? { bold: true } : {},
        ...at.italic ? { italic: true } : {},
        ...at.large ? { large: true } : {},
        ...at.color ? { color: at.color } : {},
        ...at.code ? { code: true } : {},
        ...at.wordwrap ? { wordwrap: true } : {},
        ...at.fontSizeScale != null ? { fontSizeScale: at.fontSizeScale } : {},
        ...at.circled ? { circled: true } : {},
        ...at.boxed ? { boxed: true } : {},
        ...at.smallCaps ? { smallCaps: true } : {},
        ...at.textAnchor ? { textAnchor: at.textAnchor } : {},
        ...at.runs ? { runs: at.runs } : {}
      };
      break;
    }
    case "tuplet": {
      const tup = node;
      const actual = tup.actual > 0 ? tup.actual : 1;
      const normal = tup.normal > 0 ? tup.normal : 1;
      const hideTupletNumber = ctx.omitNextTupletNumber;
      ctx.omitNextTupletNumber = false;
      const pendingTieBeforeTuplet = ctx.pendingTieEnd;
      ctx.pendingTieEnd = false;
      const start = ctx.notes.length;
      emitMusic(tup.body, ctx, durationScale * (normal / actual), semitoneShift, diatonicShift);
      ctx.pendingTieEnd = pendingTieBeforeTuplet;
      const tupletableIndices = [];
      for (let i = start;i < ctx.notes.length; i++) {
        const n = ctx.notes[i];
        if (!n || n.isRest)
          continue;
        tupletableIndices.push(i);
      }
      if (tupletableIndices.length > 0) {
        const factor = { actual, normal };
        const groupSize = tup.groupingDuration ? Math.max(1, actual) : tupletableIndices.length;
        for (let g = 0;g < tupletableIndices.length; g += groupSize) {
          const group = tupletableIndices.slice(g, g + groupSize);
          const total = group.length;
          for (let idx = 0;idx < group.length; idx++) {
            const noteIdx = group[idx];
            const n = ctx.notes[noteIdx];
            n.tupletFactors = [...n.tupletFactors ?? [], factor];
            n.tuplet = { n: actual, denom: normal, total, idx, ...hideTupletNumber ? { hideNumber: true } : {} };
          }
        }
      }
      break;
    }
    case "musicScale": {
      const scaleNode = node;
      const start = ctx.notes.length;
      emitMusic(scaleNode.body, ctx, durationScale, semitoneShift, diatonicShift);
      for (let i = start;i < ctx.notes.length; i++) {
        const n = ctx.notes[i];
        if (!n)
          continue;
        n.musicScale = (n.musicScale ?? 1) * scaleNode.scale;
      }
      break;
    }
    case "stemDirection": {
      const stemNode = node;
      ctx.stemDirection = stemNode.direction === "neutral" ? undefined : stemNode.direction;
      break;
    }
    case "omit": {
      const omitNode = node;
      if (omitNode.target === "TupletNumber") {
        ctx.omitNextTupletNumber = true;
      }
      break;
    }
    case "grace": {
      const g = node;
      const start = ctx.notes.length;
      emitMusic(g.body, ctx, durationScale, semitoneShift, diatonicShift);
      for (let i = start;i < ctx.notes.length; i++) {
        const n = ctx.notes[i];
        if (!n)
          continue;
        const originalDur = n.duration;
        n.isGrace = true;
        n.graceType = g.variant;
        if (originalDur > 0)
          n.graceDuration = originalDur;
        n.duration = 0;
      }
      break;
    }
    case "repeat": {
      const rep = node;
      if (rep.variant === "percent") {
        const count = Math.max(0, rep.count);
        if (count <= 0)
          break;
        const bodyStart = ctx.notes.length;
        emitMusic(rep.body, ctx, durationScale, semitoneShift, diatonicShift);
        const bodyEnd = ctx.notes.length;
        if (count <= 1)
          break;
        const template = ctx.notes.slice(bodyStart, bodyEnd).filter((note) => !note.isGrace && note.duration > 0);
        if (template.length === 0)
          break;
        const repeatId = `percent:${ctx.percentRepeatRegions.length}`;
        const occurrences = [];
        for (let occurrence = 2;occurrence <= count; occurrence++) {
          const placeholderStart = ctx.notes.length;
          for (const note of template) {
            ctx.notes.push(percentRepeatPlaceholder(note, repeatId, occurrence));
          }
          const placeholderEnd = ctx.notes.length;
          occurrences.push({
            occurrence,
            placeholderStart,
            placeholderEnd,
            duration: percentRepeatDuration(template),
            ...ctx.countPercentRepeats ? { countPercentRepeats: true } : {}
          });
        }
        ctx.percentRepeatRegions.push({
          bodyStart,
          bodyEnd,
          count,
          duration: percentRepeatDuration(template),
          ...ctx.countPercentRepeats ? { countPercentRepeats: true } : {},
          occurrences,
          ...rep.loc?.offset != null && rep.loc.endOffset != null ? { sourceRange: { start: rep.loc.offset, end: rep.loc.endOffset } } : {}
        });
        break;
      }
      const times = rep.variant === "unfold" ? Math.max(0, rep.count) : 1;
      const repeatStart = ctx.notes.length;
      if (rep.variant === "unfold" && rep.alternatives && rep.alternatives.length > 0) {
        for (let i = 0;i < times; i++) {
          emitMusic(rep.body, ctx, durationScale, semitoneShift, diatonicShift);
          const ai = Math.min(i, rep.alternatives.length - 1);
          const alt = rep.alternatives[ai];
          if (alt)
            emitMusic(alt, ctx, durationScale, semitoneShift, diatonicShift);
        }
      } else {
        for (let i = 0;i < times; i++) {
          emitMusic(rep.body, ctx, durationScale, semitoneShift, diatonicShift);
        }
      }
      if (rep.alternatives && rep.alternatives.length > 0) {
        if (rep.variant === "unfold") {} else {
          let voltaNum = 1;
          for (const alt of rep.alternatives) {
            const start = ctx.notes.length;
            emitMusic(alt, ctx, durationScale, semitoneShift, diatonicShift);
            const region = { start, end: ctx.notes.length, volta: voltaNum };
            ctx.voltaRegions.push(region);
            ctx.structuralEvents.push({ type: "voltaRegion", ...region });
            voltaNum++;
          }
        }
      }
      if (rep.variant !== "unfold") {
        const region = { start: repeatStart, end: ctx.notes.length };
        ctx.repeatRegions.push(region);
        ctx.structuralEvents.push({ type: "repeatRegion", ...region });
      }
      if (times === 0 && rep.variant !== "unfold") {
        emitMusic(rep.body, ctx, durationScale, semitoneShift, diatonicShift);
      }
      break;
    }
    case "transpose": {
      const tr = node;
      const fromOct = pitchToOctave(tr.from);
      const toOct = pitchToOctave(tr.to);
      const fromSemi = fromOct * 12 + pitchToPitchClass(tr.from);
      const toSemi = toOct * 12 + pitchToPitchClass(tr.to);
      const fromDia = fromOct * 7 + (DIATONIC_INDEX[tr.from.base] ?? 0);
      const toDia = toOct * 7 + (DIATONIC_INDEX[tr.to.base] ?? 0);
      emitMusic(tr.body, ctx, durationScale, semitoneShift + (toSemi - fromSemi), diatonicShift + (toDia - fromDia));
      break;
    }
    case "partial": {
      const part2 = node;
      ctx.partialDuration = durationToQN(part2.duration) * (part2.multiplier ?? 1);
      ctx.structuralEvents.push({
        type: "partial",
        at: ctx.notes.length,
        duration: ctx.partialDuration
      });
      break;
    }
    case "relative":
    case "fixed": {
      const relNode = node;
      if (relNode.body) {
        emitMusic(relNode.body, ctx, durationScale, semitoneShift, diatonicShift);
      }
      break;
    }
    case "variableRef":
      break;
    case "bar":
      if (node.barType === "\\break") {
        ctx.structuralEvents.push({ type: "systemBreak", at: ctx.notes.length });
        ctx.systemBreaks.push(ctx.notes.length);
      } else if (node.barType === "||" || node.barType === "|." || node.barType === "|" && ctx.cadenzaEnabled || node.barType === ".|:" || node.barType === ".|:-|" || node.barType === ":|.") {
        ctx.structuralEvents.push({
          type: "barline",
          at: ctx.notes.length,
          barType: node.barType
        });
      }
      break;
    case "slur": {
      const slur = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      if (slur.direction === "open")
        last.slurStart = true;
      else
        last.slurEnd = true;
      break;
    }
    case "phrasingSlur": {
      const slur = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      if (slur.direction === "open")
        last.phrasingSlurStart = true;
      else
        last.phrasingSlurEnd = true;
      break;
    }
    case "tie": {
      const tie = node;
      const last = ctx.notes[ctx.notes.length - 1];
      if (!last)
        break;
      last.tieStart = true;
      ctx.pendingTieEnd = true;
      break;
    }
    case "beam": {
      const beam = node;
      if (beam.direction === "open") {
        ctx.beamGroupCounter += 1;
        ctx.activeBeamGroupId = `manual-${ctx.beamGroupCounter}`;
        ctx.activeBeamStemDirection = beam.placement === "above" ? "up" : beam.placement === "below" ? "down" : undefined;
        const last = ctx.notes[ctx.notes.length - 1];
        if (last) {
          last.beamGroupId = ctx.activeBeamGroupId;
          if (ctx.activeBeamStemDirection) {
            last.stemDirection = ctx.activeBeamStemDirection;
          }
        }
      } else {
        ctx.activeBeamGroupId = undefined;
        ctx.activeBeamStemDirection = undefined;
      }
      break;
    }
  }
}

// src/music-input/lilypond/helpers/paper.ts
var LY_PAGE_BREAKING_SYMBOLS = {
  "optimal-breaking": "optimal",
  "one-page-breaking": "one-page",
  "one-line-breaking": "one-line",
  "one-line-auto-height-breaking": "one-line-auto-height"
};
function lookupPageBreakingSymbol(raw) {
  const trimmed = raw.replace(/^#?ly:/, "").trim();
  const mode = LY_PAGE_BREAKING_SYMBOLS[trimmed];
  if (mode)
    return { mode, known: true };
  return { mode: "optimal", known: false };
}
var verticalSpacingNames = new Set([
  "top-markup-spacing",
  "top-system-spacing",
  "markup-markup-spacing",
  "markup-system-spacing",
  "score-markup-spacing",
  "score-system-spacing",
  "system-system-spacing",
  "last-bottom-spacing"
]);
var verticalSpacingProperties = {
  "basic-distance": "basicDistance",
  "minimum-distance": "minimumDistance",
  padding: "padding",
  stretchability: "stretchability"
};
function applyVerticalSpacingOverride(target, spacingName, propertyName, value) {
  if (!verticalSpacingNames.has(spacingName))
    return;
  const outKey = verticalSpacingProperties[propertyName];
  if (!outKey)
    return;
  const name = spacingName;
  target.verticalSpacing ??= {};
  target.verticalSpacing[name] ??= {};
  target.verticalSpacing[name][outKey] = value;
}
function applyVerticalSpacingSettings(target, block) {
  for (const match2 of block.matchAll(/\b(top-markup-spacing|top-system-spacing|markup-markup-spacing|markup-system-spacing|score-markup-spacing|score-system-spacing|system-system-spacing|last-bottom-spacing)\.([a-z-]+)\s*=\s*#?\s*([-+]?\d+(?:\.\d+)?)/g)) {
    const n = Number.parseFloat(match2[3] ?? "");
    if (Number.isFinite(n))
      applyVerticalSpacingOverride(target, match2[1] ?? "", match2[2] ?? "", n);
  }
  for (const match2 of block.matchAll(/\b(top-markup-spacing|top-system-spacing|markup-markup-spacing|markup-system-spacing|score-markup-spacing|score-system-spacing|system-system-spacing|last-bottom-spacing)\s*=\s*#'\s*\(([\s\S]*?)\)(?=\s*(?:[a-z-]+\s*(?:\.|=)|\}|$))/g)) {
    const spacingName = match2[1] ?? "";
    const body = match2[2] ?? "";
    for (const pair of body.matchAll(/\(\s*([a-z-]+)\s*\.\s*([-+]?\d+(?:\.\d+)?)\s*\)/g)) {
      const n = Number.parseFloat(pair[2] ?? "");
      if (Number.isFinite(n))
        applyVerticalSpacingOverride(target, spacingName, pair[1] ?? "", n);
    }
  }
}
function paperBlocks(src) {
  const blocks = [];
  for (const match2 of src.matchAll(/\\paper\b/g)) {
    let i = (match2.index ?? 0) + match2[0].length;
    while (i < src.length && /\s/.test(src[i]))
      i++;
    if (src[i] !== "{")
      continue;
    i++;
    const start = i;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "{")
        depth++;
      else if (src[i] === "}")
        depth--;
      i++;
    }
    if (depth === 0)
      blocks.push(src.slice(start, i - 1));
  }
  return blocks;
}
function extractPaper(src) {
  const result = {};
  const namedPaperFormatsMm = {
    letter: { widthMm: 215.9, heightMm: 279.4 },
    a4: { widthMm: 210, heightMm: 297 }
  };
  const applySetPaperSize = (text) => {
    const custom = [...text.matchAll(/#\(\s*set(?:-default)?-paper-size\s*'\(\s*cons\s*\(\*\s*([-+]?\d+(?:\.\d+)?)\s*mm\s*\)\s*\(\*\s*([-+]?\d+(?:\.\d+)?)\s*mm\s*\)\s*\)\s*\)/gi)].at(-1);
    if (custom?.[1] != null && custom?.[2] != null) {
      result.paperWidthMm = Number(custom[1]);
      result.paperHeightMm = Number(custom[2]);
      return;
    }
    const namedRaw = [...text.matchAll(/#\(\s*set(?:-default)?-paper-size\s*"([^"]+)"(?:\s+[^\)]*)?\)/gi)].at(-1)?.[1];
    const fmt = namedRaw ? namedPaperFormatsMm[namedRaw.trim().toLowerCase()] : undefined;
    if (fmt) {
      result.paperWidthMm = fmt.widthMm;
      result.paperHeightMm = fmt.heightMm;
    }
  };
  for (const block of paperBlocks(src)) {
    const raggedLast = block.match(/ragged-last\s*=\s*##([ft])/);
    if (raggedLast)
      result.raggedLast = raggedLast[1] === "t";
    const raggedRight = block.match(/ragged-right\s*=\s*##([ft])/);
    if (raggedRight)
      result.raggedRight = raggedRight[1] === "t";
    const indent = block.match(/\bindent\s*=\s*([-+]?\d+(?:\.\d+)?)/);
    if (indent)
      result.indent = Number(indent[1]);
    const font = block.match(/\bfont\s*=\s*"([^"]+)"/);
    if (font)
      result.font = font[1];
    const annotateSpacing = block.match(/\bannotate-spacing\s*=\s*##([ft])/);
    if (annotateSpacing)
      result.annotateSpacing = annotateSpacing[1] === "t";
    applySetPaperSize(block);
    applyVerticalSpacingSettings(result, block);
    const pageBreakingMatch = [
      ...block.matchAll(/\bpage-breaking\s*=\s*#?\s*ly:([a-z-]+)/gi)
    ].at(-1);
    if (pageBreakingMatch?.[1]) {
      const { mode } = lookupPageBreakingSymbol(pageBreakingMatch[1]);
      result.pageBreaking = mode;
    }
    for (const [key, outKey] of [
      ["paper-width", "paperWidthMm"],
      ["paper-height", "paperHeightMm"],
      ["top-margin", "topMarginMm"],
      ["bottom-margin", "bottomMarginMm"],
      ["left-margin", "leftMarginMm"],
      ["right-margin", "rightMarginMm"]
    ]) {
      const value = [...block.matchAll(new RegExp(`\\b${key}\\s*=\\s*([-+]?\\d+(?:\\.\\d+)?)\\s*(?:\\\\\\s*)?mm\\b`, "gi"))].at(-1)?.[1];
      if (value != null)
        result[outKey] = Number(value);
    }
  }
  if (result.paperWidthMm === undefined || result.paperHeightMm === undefined) {
    const prevWidth = result.paperWidthMm;
    const prevHeight = result.paperHeightMm;
    applySetPaperSize(src);
    if (prevWidth !== undefined)
      result.paperWidthMm = prevWidth;
    if (prevHeight !== undefined)
      result.paperHeightMm = prevHeight;
  }
  return result;
}

// src/music-input/lilypond/phases/emit/meta.ts
function coercePageBreaking(value) {
  if (typeof value !== "string")
    return;
  const trimmed = value.trim();
  if (!/^#?ly:[a-z-]+$/i.test(trimmed))
    return;
  return lookupPageBreakingSymbol(trimmed).mode;
}
function coerceMm(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  if (typeof value !== "string")
    return;
  const m = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*\\mm\s*$/i);
  if (!m)
    return;
  const n = Number.parseFloat(m[1] ?? "");
  return Number.isFinite(n) ? n : undefined;
}
function coerceBool(value) {
  if (typeof value === "boolean")
    return value;
  if (typeof value !== "string")
    return;
  if (value === "#t")
    return true;
  if (value === "#f")
    return false;
  return;
}
function coerceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n))
      return n;
  }
  return;
}
function coerceBarNumberSelfAlignmentX(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= -0.5)
      return "left";
    if (value >= 0.5)
      return "right";
    return "center";
  }
  if (typeof value !== "string")
    return;
  const normalized = value.trim().replace(/^#/, "").toUpperCase();
  if (normalized === "LEFT")
    return "left";
  if (normalized === "CENTER" || normalized === "CENTRE")
    return "center";
  if (normalized === "RIGHT")
    return "right";
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? coerceBarNumberSelfAlignmentX(numeric) : undefined;
}
function coerceBarNumberDirection(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return value < 0 ? "down" : "up";
  if (typeof value !== "string")
    return;
  const normalized = value.trim().replace(/^#/, "").toUpperCase();
  if (normalized === "DOWN")
    return "down";
  if (normalized === "UP")
    return "up";
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? coerceBarNumberDirection(numeric) : undefined;
}
function coerceBarNumberVisibility(value) {
  if (typeof value !== "string")
    return;
  const normalized = value.trim().replace(/^#/, "").toLowerCase();
  if (normalized === "all-bar-numbers-visible")
    return "all";
  return;
}
function schemeExprBooleanValue(value) {
  if (value.type === "schemeBoolean")
    return value.value;
  if (value.type === "schemeSymbol") {
    if (value.name === "#t")
      return true;
    if (value.name === "#f")
      return false;
  }
  return;
}
var verticalSpacingNames2 = new Set([
  "top-markup-spacing",
  "top-system-spacing",
  "markup-markup-spacing",
  "markup-system-spacing",
  "score-markup-spacing",
  "score-system-spacing",
  "system-system-spacing",
  "last-bottom-spacing"
]);
var verticalSpacingProperties2 = {
  "basic-distance": "basicDistance",
  "minimum-distance": "minimumDistance",
  padding: "padding",
  stretchability: "stretchability"
};
function isVerticalSpacingName(value) {
  return verticalSpacingNames2.has(value);
}
function ensureVerticalSpacingOverride(target, name) {
  target.verticalSpacing ??= {};
  target.verticalSpacing[name] ??= {};
  return target.verticalSpacing[name];
}
function parseVerticalSpacingAlist(value) {
  if (typeof value !== "string")
    return;
  const out = {};
  for (const match2 of value.matchAll(/\(\s*([a-z-]+)\s*\.\s*([-+]?\d+(?:\.\d+)?)\s*\)/g)) {
    const rawKey = match2[1] ?? "";
    const outKey = verticalSpacingProperties2[rawKey];
    if (!outKey)
      continue;
    const n = Number.parseFloat(match2[2] ?? "");
    if (Number.isFinite(n))
      out[outKey] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
function applyVerticalSpacingSetting(target, rawKey, rawValue) {
  const key = rawKey.toLowerCase();
  const [spacingName, propertyName, ...rest] = key.split(".");
  if (rest.length === 0 && spacingName && propertyName && isVerticalSpacingName(spacingName)) {
    const outKey = verticalSpacingProperties2[propertyName];
    if (!outKey)
      return true;
    const n = coerceNumber(rawValue);
    if (n !== undefined) {
      ensureVerticalSpacingOverride(target, spacingName)[outKey] = n;
    }
    return true;
  }
  if (propertyName === undefined && spacingName && isVerticalSpacingName(spacingName)) {
    const parsed = parseVerticalSpacingAlist(rawValue);
    if (parsed) {
      Object.assign(ensureVerticalSpacingOverride(target, spacingName), parsed);
    }
    return true;
  }
  return false;
}
function applyLayoutSetting(target, rawKey, rawValue) {
  if (rawKey === "Lyrics.LyricText.font-size") {
    const delta = coerceNumber(rawValue);
    if (delta !== undefined)
      target.lyricFontSizeDelta = delta;
    return;
  }
  if (rawKey === "Score.BarNumber.self-alignment-X" || rawKey === "BarNumber.self-alignment-X") {
    const alignment = coerceBarNumberSelfAlignmentX(rawValue);
    if (alignment)
      target.barNumberSelfAlignmentX = alignment;
    return;
  }
  if (rawKey === "Score.BarNumber.direction" || rawKey === "BarNumber.direction") {
    const direction = coerceBarNumberDirection(rawValue);
    if (direction)
      target.barNumberDirection = direction;
    return;
  }
  if (rawKey === "Score.barNumberVisibility" || rawKey === "barNumberVisibility") {
    const visibility = coerceBarNumberVisibility(rawValue);
    if (visibility)
      target.barNumberVisibility = visibility;
  }
}
function extractMeta(ast) {
  const info = {};
  const paper = {};
  for (const child of ast.children) {
    if (child.type === "version") {
      paper.lilypondVersion = child.version;
      continue;
    }
    if (child.type === "header") {
      const header = child;
      for (const [rawKey, rawVal] of header.fields.entries()) {
        const key = rawKey.toLowerCase();
        const val = rawVal;
        switch (key) {
          case "title":
            if (typeof val === "string")
              info.title = val;
            break;
          case "composer":
            if (typeof val === "string")
              info.composer = val;
            break;
          case "subtitle":
            if (typeof val === "string")
              info.subtitle = val;
            break;
          case "tagline":
            if (typeof val === "string" || typeof val === "boolean")
              info.tagline = val;
            break;
          case "arranger":
            if (typeof val === "string")
              info.arranger = val;
            break;
          case "transcriber":
            if (typeof val === "string")
              info.transcriber = val;
            break;
          case "genre":
            if (typeof val === "string")
              info.genre = val;
            break;
          case "subgenre":
            if (typeof val === "string")
              info.subgenre = val;
            break;
          case "country":
            if (typeof val === "string")
              info.country = val;
            break;
          case "video":
            if (typeof val === "string")
              info.video = val;
            break;
          case "notes":
            if (typeof val === "string")
              info.notes = val;
            break;
          case "composeryear":
            if (typeof val === "string")
              info.composerYear = val;
            break;
          case "key":
            if (typeof val === "string")
              info.key = val;
            break;
          default:
            if (typeof val === "string" || typeof val === "boolean") {
              info[key] = val;
            }
            break;
        }
      }
      continue;
    }
    if (child.type === "layout") {
      const layoutNode = child;
      for (const [rawKey, rawVal] of layoutNode.settings.entries()) {
        applyLayoutSetting(paper, rawKey, rawVal);
      }
      continue;
    }
    if (child.type === "schemeOption") {
      if (child.name === "debug-skylines") {
        paper.debugSkylines = schemeExprBooleanValue(child.value) ?? true;
      }
      continue;
    }
    if (child.type === "scoreBlock") {
      const scoreNode = child;
      if (scoreNode.layout) {
        for (const [rawKey, rawVal] of scoreNode.layout.settings.entries()) {
          applyLayoutSetting(paper, rawKey, rawVal);
        }
      }
    }
    if (child.type === "paper") {
      const paperNode = child;
      for (const [rawKey, rawVal] of paperNode.settings.entries()) {
        const key = rawKey.toLowerCase();
        if (applyVerticalSpacingSetting(paper, key, rawVal))
          continue;
        switch (key) {
          case "ragged-last": {
            const b = coerceBool(rawVal);
            if (b !== undefined)
              paper.raggedLast = b;
            break;
          }
          case "ragged-right": {
            const b = coerceBool(rawVal);
            if (b !== undefined)
              paper.raggedRight = b;
            break;
          }
          case "annotate-spacing": {
            const b = coerceBool(rawVal);
            if (b !== undefined)
              paper.annotateSpacing = b;
            break;
          }
          case "indent": {
            const n = coerceNumber(rawVal);
            if (n !== undefined)
              paper.firstIndent = n;
            break;
          }
          case "font":
            if (typeof rawVal === "string")
              paper.paperFont = rawVal;
            break;
          case "paper-width": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.paperWidthMm = mm;
            break;
          }
          case "paper-height": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.paperHeightMm = mm;
            break;
          }
          case "top-margin": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.topMarginMm = mm;
            break;
          }
          case "bottom-margin": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.bottomMarginMm = mm;
            break;
          }
          case "left-margin": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.leftMarginMm = mm;
            break;
          }
          case "right-margin": {
            const mm = coerceMm(rawVal);
            if (mm !== undefined)
              paper.rightMarginMm = mm;
            break;
          }
          case "page-breaking": {
            const mode = coercePageBreaking(rawVal);
            if (mode !== undefined)
              paper.pageBreaking = mode;
            break;
          }
        }
      }
    }
  }
  return {
    ...info.title ? { title: info.title } : {},
    ...info.composer ? { composer: info.composer } : {},
    ...Object.keys(info).length > 0 ? { info } : {},
    ...paper
  };
}

// src/music-input/lilypond/phases/emit/tune.ts
function extractInitialClef(notes, structuralEvents) {
  const firstRealIndex = notes.findIndex((n) => n.duration > 0);
  const realStart = firstRealIndex >= 0 ? firstRealIndex : Number.POSITIVE_INFINITY;
  for (const ev of structuralEvents) {
    if (ev.type !== "clefChange")
      continue;
    if (ev.at <= realStart)
      return ev.clef;
  }
  return "treble";
}
function closeOpenOttava(ctx) {
  if (ctx.ottavaLevel !== 0 && ctx.ottavaStartIndex >= 0) {
    const region = {
      start: ctx.ottavaStartIndex,
      end: ctx.notes.length,
      level: ctx.ottavaLevel
    };
    ctx.ottavaRegions.push(region);
    ctx.structuralEvents.push({ type: "ottavaRegion", ...region });
  }
}
function collectPedalEvents(notes) {
  const events2 = [];
  let offsetQN = 0;
  for (let noteIndex = 0;noteIndex < notes.length; noteIndex++) {
    const note = notes[noteIndex];
    for (const pedal of note.pedals ?? []) {
      events2.push({
        kind: pedal.kind,
        action: pedal.action,
        offsetQN,
        noteIndex,
        ...pedal.sourceRange ? { sourceRange: pedal.sourceRange } : {}
      });
    }
    if (!note.isGrace)
      offsetQN += note.duration;
  }
  return events2;
}
function tuneFromContext(ctx, meta = {}) {
  const pedalEvents = collectPedalEvents(ctx.notes);
  return {
    notes: ctx.notes,
    ...ctx.voices.length > 0 ? { voices: ctx.voices } : {},
    clef: extractInitialClef(ctx.notes, ctx.structuralEvents),
    ...ctx.systemBreaks.length ? { systemBreaks: ctx.systemBreaks } : {},
    ...ctx.chordNames.length ? { chordNames: ctx.chordNames } : {},
    ...ctx.lyricLines.length ? { lyricLines: ctx.lyricLines } : {},
    ...ctx.repeatRegions.length ? { repeatRegions: ctx.repeatRegions } : {},
    ...ctx.printInitialRepeatBar ? { printInitialRepeatBar: true } : {},
    ...ctx.percentRepeatRegions.length ? { percentRepeatRegions: ctx.percentRepeatRegions } : {},
    ...ctx.voltaRegions.length ? { voltaRegions: ctx.voltaRegions } : {},
    key: ctx.currentKey,
    timeSig: ctx.currentTimeSig,
    ...meta,
    ...ctx.partialDuration !== undefined ? { partialDuration: ctx.partialDuration } : {},
    ottavaRegions: ctx.ottavaRegions,
    tempoMarks: ctx.tempoMarks,
    ...ctx.midiInstrument ? { midiInstrument: ctx.midiInstrument } : {},
    rehearsalMarks: ctx.rehearsalMarks,
    ...pedalEvents.length ? { pedalEvents } : {},
    ...ctx.structuralEvents.length > 0 ? { structuralEvents: ctx.structuralEvents } : {}
  };
}

// src/music-input/lilypond/phases/emit/index.ts
function emitStaffMusic(music, meta) {
  const ctx = createContext2();
  if (meta?.key)
    ctx.currentKey = meta.key;
  if (meta?.timeSig)
    ctx.currentTimeSig = meta.timeSig;
  emitMusic(music, ctx, 1);
  closeOpenOttava(ctx);
  return tuneFromContext(ctx, meta);
}
function splitContextProperty(path) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length <= 1)
    return { property: path };
  return {
    context: parts[0],
    property: parts.slice(1).join(".")
  };
}
function operationsFromSetNodes(nodes) {
  return (nodes ?? []).map((set) => {
    const { context, property } = splitContextProperty(set.property);
    return {
      type: "set",
      ...context ? { context } : {},
      property,
      value: set.value,
      ...set.loc ? { range: { pos: set.loc.offset, end: set.loc.endOffset ?? set.loc.offset } } : {}
    };
  });
}
function staffContextNode(music) {
  return music.type === "staffContext" ? music : undefined;
}
function emitStaffGroup(node, meta) {
  const all = node.staves.map((staveMusic, idx) => {
    const staffContext = staffContextNode(staveMusic);
    const tune = emitStaffMusic(staveMusic, meta);
    const name = staffContext?.name ?? (idx === 0 ? "up" : idx === 1 ? "down" : `staff_${idx}`);
    const operations = operationsFromSetNodes(staffContext?.operations);
    return { name, tune, ...operations.length ? { operations } : {} };
  });
  const melodic = all.filter(({ tune }) => tune.notes.some((n) => !n.isRest && (n.duration > 0 || n.isGrace)));
  const visible = melodic.length >= 2 ? melodic : all;
  const pedalEvents = all.flatMap(({ tune }) => tune.pedalEvents ?? []);
  if (!pedalEvents.length || visible.length === 0)
    return visible;
  return visible.map((staff2, idx) => idx === 0 ? { ...staff2, tune: { ...staff2.tune, pedalEvents } } : staff2);
}
function emit(ast) {
  const ctx = createContext2();
  const meta = extractMeta(ast);
  const isTopMusicType = (type) => type === "relative" || type === "fixed" || type === "sequential" || type === "simultaneous" || type === "note" || type === "rest" || type === "spacer" || type === "multiRest" || type === "chord" || type === "chordMode" || type === "chordNamesContext" || type === "staffContext" || type === "tuplet" || type === "musicScale" || type === "stemDirection" || type === "omit" || type === "repeat" || type === "transpose" || type === "grace" || type === "key" || type === "time" || type === "tempo" || type === "bar" || type === "partial" || type === "ottava" || type === "clef" || type === "slur" || type === "tie" || type === "beam" || type === "variableRef" || type === "dynamics" || type === "articulation" || type === "pedal" || type === "attachedText" || type === "hairpin" || type === "set" || type === "override" || type === "compressMMRests" || type === "cadenza";
  const firstScoreIndex = ast.children.findIndex((c) => c.type === "scoreBlock");
  if (firstScoreIndex > 0) {
    const preScoreMusicRoots = ast.children.slice(0, firstScoreIndex).filter((c) => isTopMusicType(c.type));
    if (preScoreMusicRoots.length > 0) {
      const startCount = ctx.notes.length;
      for (const child of preScoreMusicRoots) {
        emitMusic(child, ctx, 1);
      }
      const emitted = ctx.notes.slice(startCount).filter((n) => n.duration > 0 || n.isGrace);
      if (emitted.length > 0) {
        closeOpenOttava(ctx);
        return tuneFromContext(ctx, meta);
      }
    }
  }
  const firstScore = ast.children.find((c) => c.type === "scoreBlock");
  if (firstScore) {
    emitMusic(firstScore.music, ctx, 1);
  } else {
    for (const child of ast.children) {
      if (isMusicNode(child)) {
        if (isRelativeNode(child)) {
          emitMusic(child.body, ctx, 1);
        } else if (isFixedNode(child)) {
          emitMusic(child.body, ctx, 1);
        } else {
          emitMusic(child, ctx, 1);
        }
      }
    }
  }
  closeOpenOttava(ctx);
  return tuneFromContext(ctx, meta);
}
// src/music-input/lilypond/phases/contextModel.ts
function sourceRangeFromNode(node) {
  if (!node?.loc)
    return;
  return { pos: node.loc.offset, end: node.loc.endOffset ?? node.loc.offset };
}
function splitContextProperty2(path) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length <= 1)
    return { property: path };
  return {
    context: parts[0],
    property: parts.slice(1).join(".")
  };
}
function splitOverridePath(grob) {
  const parts = grob.split(".").filter(Boolean);
  if (parts.length <= 1)
    return { grob };
  return {
    context: parts[0],
    grob: parts.slice(1).join(".")
  };
}
function layoutOperation(node) {
  return {
    type: "layout",
    settings: Object.fromEntries(node.settings.entries()),
    range: sourceRangeFromNode(node)
  };
}
function setOperation(node) {
  const { context, property } = splitContextProperty2(node.property);
  return {
    type: "set",
    ...context ? { context } : {},
    property,
    value: node.value,
    range: sourceRangeFromNode(node)
  };
}
function operationsFromSetNodes2(nodes) {
  return (nodes ?? []).map(setOperation);
}
function collectOperationsFromMusic(node, out) {
  if (!node)
    return;
  switch (node.type) {
    case "set": {
      out.push(setOperation(node));
      break;
    }
    case "override": {
      const override = node;
      const { context, grob } = splitOverridePath(override.grob);
      out.push({
        type: "override",
        ...context ? { context } : {},
        grob,
        property: override.property,
        value: override.value,
        range: sourceRangeFromNode(override)
      });
      break;
    }
    case "sequential":
    case "simultaneous":
      for (const child of node.elements)
        collectOperationsFromMusic(child, out);
      break;
    case "staffContext":
      collectOperationsFromMusic(node.body, out);
      break;
    case "relative":
    case "fixed":
    case "transpose":
    case "grace":
    case "compressMMRests":
      collectOperationsFromMusic(node.body, out);
      break;
    case "repeat":
      collectOperationsFromMusic(node.body, out);
      for (const alt of node.alternatives ?? [])
        collectOperationsFromMusic(alt, out);
      break;
    case "tuplet":
      collectOperationsFromMusic(node.body, out);
      break;
    case "musicScale":
      collectOperationsFromMusic(node.body, out);
      break;
    case "stemDirection":
    case "omit":
      break;
    case "chordNamesContext":
    case "lyricMode":
    case "lyrics":
    case "lyricsto":
    case "addlyrics":
      collectOperationsFromMusic(node.body, out);
      break;
  }
}
function extractSingleStaffContext(node) {
  if (!node)
    return;
  if (node.type === "staffContext")
    return node;
  if (node.type === "sequential" && node.elements.length === 1) {
    return extractSingleStaffContext(node.elements[0]);
  }
  return;
}
function voiceContextsFromTune(tune) {
  if (tune.voices?.length) {
    return tune.voices.map((voice) => ({
      type: "Voice",
      id: `voice:${voice.voiceIndex}`,
      voiceIndex: voice.voiceIndex,
      notes: voice.notes
    }));
  }
  return [{
    type: "Voice",
    id: "voice:0",
    voiceIndex: 0,
    notes: tune.notes
  }];
}
function scoreStateFromTune(tune) {
  return {
    key: tune.key,
    timeSig: tune.timeSig,
    ...tune.clef ? { clef: tune.clef } : {},
    ...tune.structuralEvents?.length ? { structuralEvents: tune.structuralEvents } : {}
  };
}
function buildScoreContext(tune, options = {}) {
  const operations = [];
  for (const layout of options.layoutNodes ?? [])
    operations.push(layoutOperation(layout));
  if (options.scoreNode?.layout)
    operations.push(layoutOperation(options.scoreNode.layout));
  const musicNodes = Array.isArray(options.music) ? options.music : options.music ? [options.music] : options.scoreNode?.music ? [options.scoreNode.music] : [];
  for (const music of musicNodes)
    collectOperationsFromMusic(music, operations);
  const explicitStaffContext = musicNodes.map((music) => extractSingleStaffContext(music)).find((staff2) => Boolean(staff2));
  const staffOperations = operationsFromSetNodes2(explicitStaffContext?.operations);
  const children = [{
    type: "Staff",
    id: "staff:0",
    ...explicitStaffContext?.name ? { name: explicitStaffContext.name } : {},
    ...staffOperations.length ? { operations: staffOperations } : {},
    state: scoreStateFromTune(tune),
    voices: voiceContextsFromTune(tune)
  }];
  for (let i = 0;i < (tune.lyricLines?.length ?? 0); i++) {
    const line = tune.lyricLines[i];
    children.push({
      type: "Lyrics",
      id: `lyrics:${i}`,
      ...line.voiceId ? { voiceId: line.voiceId } : {},
      line
    });
  }
  if (tune.chordNames?.length) {
    children.push({
      type: "ChordNames",
      id: "chord-names:0",
      chordNames: tune.chordNames
    });
  }
  return {
    type: "Score",
    id: "score:0",
    range: options.range ?? sourceRangeFromNode(options.scoreNode),
    ...operations.length ? { operations } : {},
    state: scoreStateFromTune(tune),
    children
  };
}
function buildPianoScoreContext(score2, options = {}) {
  const operations = [];
  for (const layout of options.layoutNodes ?? [])
    operations.push(layoutOperation(layout));
  if (options.scoreNode?.layout)
    operations.push(layoutOperation(options.scoreNode.layout));
  const firstTune = score2.staves[0]?.tune;
  const state = firstTune ? scoreStateFromTune(firstTune) : { key: "C", timeSig: "4/4" };
  return {
    type: "Score",
    id: "score:0",
    range: options.range ?? score2.range ?? sourceRangeFromNode(options.scoreNode),
    ...operations.length ? { operations } : {},
    state,
    children: [{
      type: "StaffGroup",
      id: "staff-group:0",
      groupType: score2.groupType,
      range: options.range ?? score2.range ?? sourceRangeFromNode(options.scoreNode),
      staves: score2.staves.map((staff2, idx) => ({
        type: "Staff",
        id: `staff:${idx}`,
        name: staff2.name,
        ...staff2.operations?.length ? { operations: staff2.operations } : {},
        state: scoreStateFromTune(staff2.tune),
        voices: voiceContextsFromTune(staff2.tune)
      }))
    }]
  };
}

// src/music-input/lilypond/phases/documentMarkupBlocks.ts
function markupBlockFromPayload(payload, range) {
  return {
    type: "markup",
    text: payload.text,
    ...payload.graphics ? { graphics: payload.graphics } : {},
    ...payload.lineGapBeforeStaffSpaces ? { lineGapBeforeStaffSpaces: payload.lineGapBeforeStaffSpaces } : {},
    ...payload.lineGapAfterStaffSpaces ? { lineGapAfterStaffSpaces: payload.lineGapAfterStaffSpaces } : {},
    ...payload.textOffsetXStaffSpaces != null ? { textOffsetXStaffSpaces: payload.textOffsetXStaffSpaces } : {},
    ...payload.textOffsetYStaffSpaces != null ? { textOffsetYStaffSpaces: payload.textOffsetYStaffSpaces } : {},
    ...payload.compactLineGap ? { compactLineGap: true } : {},
    ...payload.style,
    ...payload.runs ? { runs: payload.runs } : {},
    ...range ? { range } : {}
  };
}
function joinedText(blocks) {
  return blocks.map((payload) => {
    const prefix = [
      payload.style.color ? `\\with-color "${payload.style.color}"` : null,
      payload.style.code ? "\\typewriter" : null,
      payload.style.smallCaps ? "\\smallCaps" : null,
      payload.style.italic ? "\\italic" : null,
      payload.style.bold ? "\\bold" : null
    ].filter(Boolean).join(" ");
    return prefix ? `${prefix} ${payload.text}` : payload.text;
  }).join(`
`);
}
var JOINED_STYLE_KEYS = [
  "bold",
  "italic",
  "large",
  "huge",
  "color",
  "code",
  "wordwrap",
  "fontSizeScale",
  "circled",
  "boxed",
  "rounded",
  "fullWidth",
  "boxPadding",
  "thickness",
  "cornerRadius",
  "smallCaps",
  "align"
];
function aggregateMarkupMetadata(blocks) {
  const loweredInlineShiftStaffSpaces = Math.max(0, ...blocks.map((payload) => payload.style.loweredInlineShiftStaffSpaces ?? 0));
  return {
    ...blocks.some((payload) => payload.style.hasDrawLine) ? { hasDrawLine: true } : {},
    ...blocks.some((payload) => payload.style.hasInlineShape) ? { hasInlineShape: true } : {},
    ...blocks.some((payload) => payload.style.codeBlockHeading) ? { codeBlockHeading: true } : {},
    ...loweredInlineShiftStaffSpaces > 0 ? { loweredInlineShiftStaffSpaces } : {}
  };
}
function sharedStyle(blocks) {
  const first = blocks[0]?.style;
  if (!first)
    return {};
  const out = {};
  for (const key of JOINED_STYLE_KEYS) {
    const value = first[key];
    if (value === undefined)
      continue;
    if (blocks.every((payload) => payload.style[key] === value)) {
      Object.assign(out, { [key]: value });
    }
  }
  return out;
}
function payloadLineCount2(payload) {
  const textLineCount = payload.text.length > 0 ? payload.text.split(`
`).length : 1;
  if (payload.style.wordwrap)
    return textLineCount;
  const runLineCount = payload.runs ? payload.runs.reduce((count, run) => count + (run.text.match(/\n/g)?.length ?? 0), 1) : 1;
  return Math.max(1, textLineCount, runLineCount);
}
function joinedLineGaps(blocks, key) {
  const gaps = blocks.flatMap((payload) => {
    const lineCount = payloadLineCount2(payload);
    return Array.from({ length: lineCount }, (_, i) => payload[key]?.[i] ?? 0);
  });
  return gaps.some((gap) => gap !== 0) ? gaps : undefined;
}
function fontSizeScaleFromStyle(style) {
  let scale = style.fontSizeScale ?? 1;
  if (style.large)
    scale *= 1.2;
  if (style.huge)
    scale *= 1.44;
  return Math.abs(scale - 1) > 0.000000001 ? scale : undefined;
}
function applyPayloadStyleToRun(run, style) {
  const fontSizeScale = fontSizeScaleFromStyle(style);
  return {
    ...run,
    ...style.bold || run.bold ? { bold: run.bold || style.bold } : {},
    ...style.italic || run.italic ? { italic: run.italic || style.italic } : {},
    ...style.code || run.code ? { code: run.code || style.code } : {},
    ...style.smallCaps || run.smallCaps ? { smallCaps: run.smallCaps || style.smallCaps } : {},
    ...run.color ?? style.color ? { color: run.color ?? style.color } : {},
    ...run.fontSizeScale != null || fontSizeScale != null ? { fontSizeScale: run.fontSizeScale ?? fontSizeScale } : {}
  };
}
function payloadRuns(payload) {
  return (payload.runs ?? [{ text: payload.text }]).map((run) => payload.style.wordwrap ? {
    ...run,
    text: run.text.replace(/\s+/g, " "),
    wordwrapLine: true
  } : run).map((run) => applyPayloadStyleToRun(run, payload.style));
}
function joinedRuns(blocks) {
  const runs = blocks.flatMap((payload, index) => [
    ...index > 0 ? [{ text: `
` }] : [],
    ...payloadRuns(payload)
  ]);
  return runs.some((run) => Boolean(run.bold || run.italic || run.code || run.smallCaps || run.color || run.fontSizeScale != null || run.wordwrapLine || run.wordwrapUnit)) ? runs : undefined;
}
function pushJoined(out, blocks, range) {
  if (blocks.length === 0)
    return;
  const style = sharedStyle(blocks);
  const metadata = aggregateMarkupMetadata(blocks);
  const runs = joinedRuns(blocks);
  const lineGapBeforeStaffSpaces = joinedLineGaps(blocks, "lineGapBeforeStaffSpaces");
  const lineGapAfterStaffSpaces = joinedLineGaps(blocks, "lineGapAfterStaffSpaces");
  const compactLineGap = blocks.length > 1 && blocks.every((payload) => payload.compactLineGap);
  out.push({
    type: "markup",
    text: joinedText(blocks),
    ...style,
    ...metadata,
    ...runs ? { runs } : {},
    ...lineGapBeforeStaffSpaces ? { lineGapBeforeStaffSpaces } : {},
    ...lineGapAfterStaffSpaces ? { lineGapAfterStaffSpaces } : {},
    ...compactLineGap ? { compactLineGap: true } : {},
    ...range ? { range } : {}
  });
}
function appendMarkupPayloadBlocks(out, payloadBlocks, range) {
  if (payloadBlocks.length === 1) {
    out.push(markupBlockFromPayload(payloadBlocks[0], range));
    return;
  }
  let pending = [];
  for (const payload of payloadBlocks) {
    if (!payload.style.boxed) {
      pending.push(payload);
      continue;
    }
    pushJoined(out, pending, range);
    pending = [];
    out.push(markupBlockFromPayload(payload, range));
  }
  pushJoined(out, pending, range);
}

// src/music-input/lilypond/phases/documentMetadataPropagation.ts
function applyDocumentGlobalStaffSize(blocks, globalStaffSize) {
  if (globalStaffSize === undefined)
    return blocks;
  return blocks.map((block) => {
    if (block.type === "score") {
      return {
        ...block,
        score: {
          ...block.score,
          tune: { ...block.score.tune, globalStaffSize }
        }
      };
    }
    if (block.type === "pianoScore") {
      return {
        ...block,
        score: {
          ...block.score,
          meta: { ...block.score.meta, globalStaffSize },
          staves: block.score.staves.map((staff2) => ({
            ...staff2,
            tune: { ...staff2.tune, globalStaffSize }
          }))
        }
      };
    }
    if (block.type === "book" || block.type === "bookpart") {
      return {
        ...block,
        blocks: applyDocumentGlobalStaffSize(block.blocks, globalStaffSize)
      };
    }
    return block;
  });
}
function applyDocumentDebugSkylines(blocks, debugSkylines) {
  if (debugSkylines === undefined)
    return blocks;
  return blocks.map((block) => {
    if (block.type === "score") {
      return {
        ...block,
        score: {
          ...block.score,
          tune: { ...block.score.tune, debugSkylines }
        }
      };
    }
    if (block.type === "pianoScore") {
      return {
        ...block,
        score: {
          ...block.score,
          meta: { ...block.score.meta, debugSkylines },
          staves: block.score.staves.map((staff2) => ({
            ...staff2,
            tune: { ...staff2.tune, debugSkylines }
          }))
        }
      };
    }
    if (block.type === "book" || block.type === "bookpart") {
      return {
        ...block,
        blocks: applyDocumentDebugSkylines(block.blocks, debugSkylines)
      };
    }
    return block;
  });
}

// src/music-input/lilypond/phases/engravingEvents.ts
function noteSourceRange(note) {
  if (!note.sourceRange)
    return;
  return { pos: note.sourceRange.start, end: note.sourceRange.end };
}
function eventId(parts) {
  return parts.filter((part2) => part2 !== undefined && part2 !== "").join(":");
}
function pushNoteOrRestEvents(out, staff2, voice) {
  const staffId = staff2.id;
  const voiceId = voice.id;
  for (let noteIndex = 0;noteIndex < voice.notes.length; noteIndex++) {
    const note = voice.notes[noteIndex];
    if (note.isRest) {
      out.push({
        type: "rest",
        id: eventId(["rest", staffId, voiceId, noteIndex]),
        noteIndex,
        ...staffId ? { staffId } : {},
        ...voiceId ? { voiceId } : {},
        duration: note.duration,
        ...note.mmRestBars != null ? { mmRestBars: note.mmRestBars } : {},
        ...noteSourceRange(note) ? { sourceRange: noteSourceRange(note) } : {}
      });
      continue;
    }
    out.push({
      type: "note",
      id: eventId(["note", staffId, voiceId, noteIndex]),
      noteIndex,
      ...staffId ? { staffId } : {},
      ...voiceId ? { voiceId } : {},
      noteName: note.noteName,
      octave: note.octave,
      pitchClass: note.pitchClass,
      duration: note.duration,
      ...noteSourceRange(note) ? { sourceRange: noteSourceRange(note) } : {}
    });
    if (note.noteText) {
      out.push({
        type: "text",
        id: eventId(["text", "noteText", staffId, voiceId, noteIndex]),
        textType: "noteText",
        text: note.noteText.text,
        noteIndex,
        ...staffId ? { staffId } : {},
        ...voiceId ? { voiceId } : {},
        ...noteSourceRange(note) ? { sourceRange: noteSourceRange(note) } : {}
      });
    }
    if (note.dynamic) {
      out.push({
        type: "text",
        id: eventId(["text", "dynamic", staffId, voiceId, noteIndex]),
        textType: "dynamic",
        text: note.dynamic,
        noteIndex,
        ...staffId ? { staffId } : {},
        ...voiceId ? { voiceId } : {},
        ...noteSourceRange(note) ? { sourceRange: noteSourceRange(note) } : {}
      });
    }
  }
}
function findNextFlaggedNote(notes, start, flag) {
  for (let i = start + 1;i < notes.length; i++) {
    if (notes[i]?.[flag])
      return i;
  }
  return Math.min(start + 1, notes.length);
}
function pushNoteSpanners(out, staff2, voice) {
  const staffId = staff2.id;
  const voiceId = voice.id;
  const seenTuplets = new Set;
  for (let noteIndex = 0;noteIndex < voice.notes.length; noteIndex++) {
    const note = voice.notes[noteIndex];
    const common = {
      ...staffId ? { staffId } : {},
      ...voiceId ? { voiceId } : {}
    };
    if (note.slurStart) {
      out.push({
        type: "spanner",
        id: eventId(["spanner", "slur", staffId, voiceId, noteIndex]),
        spannerType: "slur",
        start: noteIndex,
        end: findNextFlaggedNote(voice.notes, noteIndex, "slurEnd"),
        ...common
      });
    }
    if (note.phrasingSlurStart) {
      out.push({
        type: "spanner",
        id: eventId(["spanner", "phrasingSlur", staffId, voiceId, noteIndex]),
        spannerType: "phrasingSlur",
        start: noteIndex,
        end: findNextFlaggedNote(voice.notes, noteIndex, "phrasingSlurEnd"),
        ...common
      });
    }
    if (note.tieStart) {
      out.push({
        type: "spanner",
        id: eventId(["spanner", "tie", staffId, voiceId, noteIndex]),
        spannerType: "tie",
        start: noteIndex,
        end: Math.min(noteIndex + 1, voice.notes.length),
        ...common
      });
    }
    if (note.hairpinStart) {
      out.push({
        type: "spanner",
        id: eventId(["spanner", "hairpin", staffId, voiceId, noteIndex]),
        spannerType: "hairpin",
        start: noteIndex,
        end: findNextFlaggedNote(voice.notes, noteIndex, "hairpinEnd"),
        value: note.hairpinStart,
        ...common
      });
    }
    if (note.tuplet && note.tuplet.idx === 0) {
      const key = `${noteIndex}:${note.tuplet.n}:${note.tuplet.denom}:${note.tuplet.total}`;
      if (!seenTuplets.has(key)) {
        seenTuplets.add(key);
        out.push({
          type: "spanner",
          id: eventId(["spanner", "tuplet", staffId, voiceId, noteIndex]),
          spannerType: "tuplet",
          start: noteIndex,
          end: noteIndex + note.tuplet.total,
          value: `${note.tuplet.n}/${note.tuplet.denom}`,
          ...common
        });
      }
    }
  }
}
function structuralEventValue(event) {
  switch (event.type) {
    case "keyChange":
      return event.key;
    case "timeChange":
      return event.timeSig;
    case "clefChange":
      return event.clef;
    case "barline":
      return event.barType;
    case "partial":
      return event.duration;
    case "autoBeam":
      return event.enabled;
    case "cadenza":
      return event.enabled;
    case "timeSignatureStyle":
      return event.style;
  }
  return;
}
function pushStructuralEvents(out, staff2) {
  for (const event of staff2.state.structuralEvents ?? []) {
    switch (event.type) {
      case "keyChange":
      case "timeChange":
      case "clefChange":
      case "barline":
      case "partial":
      case "autoBeam":
      case "cadenza":
      case "timeSignatureStyle": {
        const value = structuralEventValue(event);
        if (value === undefined)
          break;
        const changeType = event.type === "keyChange" ? "key" : event.type === "timeChange" ? "time" : event.type === "clefChange" ? "clef" : event.type === "barline" ? "barline" : event.type === "partial" ? "partial" : event.type === "autoBeam" ? "autoBeam" : event.type === "cadenza" ? "cadenza" : "timeSignatureStyle";
        out.push({
          type: "change",
          id: eventId(["change", changeType, staff2.id, event.at]),
          changeType,
          at: event.at,
          value,
          ...staff2.id ? { staffId: staff2.id } : {}
        });
        break;
      }
      case "tempoMark":
        out.push({
          type: "text",
          id: eventId(["text", "tempo", staff2.id, event.noteIndex]),
          textType: "tempo",
          text: event.text ?? (event.bpm != null ? String(event.bpm) : "tempo"),
          noteIndex: event.noteIndex,
          ...staff2.id ? { staffId: staff2.id } : {}
        });
        break;
      case "rehearsalMark":
        out.push({
          type: "text",
          id: eventId(["text", "rehearsal", staff2.id, event.noteIndex]),
          textType: "rehearsal",
          text: event.text,
          noteIndex: event.noteIndex,
          ...staff2.id ? { staffId: staff2.id } : {}
        });
        break;
      case "ottavaRegion":
      case "repeatRegion":
      case "voltaRegion":
        out.push({
          type: "spanner",
          id: eventId(["spanner", event.type, staff2.id, event.start]),
          spannerType: event.type === "ottavaRegion" ? "ottava" : event.type === "repeatRegion" ? "repeat" : "volta",
          start: event.start,
          end: event.end,
          ...event.type === "ottavaRegion" ? { value: event.level } : {},
          ...event.type === "voltaRegion" ? { value: event.volta } : {},
          ...staff2.id ? { staffId: staff2.id } : {}
        });
        break;
    }
  }
}
function pushStaffEvents(out, staff2) {
  pushStructuralEvents(out, staff2);
  for (const voice of staff2.voices) {
    pushNoteOrRestEvents(out, staff2, voice);
    pushNoteSpanners(out, staff2, voice);
  }
}
function pushStaffGroupEvents(out, group) {
  for (const staff2 of group.staves)
    pushStaffEvents(out, staff2);
}
function pushLyricsEvents(out, lyrics) {
  for (let i = 0;i < lyrics.line.syllables.length; i++) {
    const syllable = lyrics.line.syllables[i];
    out.push({
      type: "text",
      id: eventId(["text", "lyric", lyrics.id, i]),
      textType: "lyric",
      text: syllable.text,
      noteIndex: syllable.noteIndex,
      ...lyrics.voiceId ? { voiceId: lyrics.voiceId } : {}
    });
  }
}
function pushChordNameEvents(out, chordNames) {
  for (let i = 0;i < chordNames.chordNames.length; i++) {
    const chord = chordNames.chordNames[i];
    out.push({
      type: "text",
      id: eventId(["text", "chordName", chordNames.id, i]),
      textType: "chordName",
      text: chord.name
    });
  }
}
function pushLayoutOperations(out, operations) {
  for (let i = 0;i < (operations?.length ?? 0); i++) {
    out.push({
      type: "layoutOperation",
      id: eventId(["layout", i]),
      operation: operations[i]
    });
  }
}
function buildEngravingEventStream(context) {
  const out = [];
  pushLayoutOperations(out, context.operations);
  for (const child of context.children) {
    switch (child.type) {
      case "Staff":
        pushStaffEvents(out, child);
        break;
      case "StaffGroup":
        pushStaffGroupEvents(out, child);
        break;
      case "Lyrics":
        pushLyricsEvents(out, child);
        break;
      case "ChordNames":
        pushChordNameEvents(out, child);
        break;
    }
  }
  return out;
}

// src/music-input/lilypond/phases/documentBlocks.ts
function sourceRangeFromNode2(node) {
  if (!node?.loc)
    return;
  return { pos: node.loc.offset, end: node.loc.endOffset ?? node.loc.offset };
}
function sourceRangeFromError(error) {
  return { pos: error.loc.offset, end: error.loc.endOffset ?? error.loc.offset };
}
function extractStaffGroupContext(node) {
  if (node.type === "staffGroupContext")
    return node;
  if (node.type === "sequential" && Array.isArray(node.elements) && node.elements.length === 1) {
    const sole = node.elements[0];
    if (sole.type === "staffGroupContext")
      return sole;
  }
  return null;
}
function isTopMusicNodeType(type) {
  return type === "relative" || type === "fixed" || type === "sequential" || type === "simultaneous" || type === "note" || type === "rest" || type === "spacer" || type === "multiRest" || type === "chord" || type === "staffContext" || type === "tuplet" || type === "musicScale" || type === "stemDirection" || type === "omit" || type === "repeat" || type === "transpose" || type === "key" || type === "time" || type === "tempo" || type === "rehearsalMark" || type === "bar" || type === "partial" || type === "ottava" || type === "clef" || type === "set" || type === "override" || type === "variableRef" || type === "dynamics" || type === "hairpin" || type === "pedal" || type === "beam" || type === "cadenza";
}
function hasRenderableMusic(tune) {
  return tune.notes.some((note) => note.duration > 0 || note.isGrace);
}
function documentMetaFromTune(tune) {
  return {
    key: tune.key,
    timeSig: tune.timeSig,
    title: tune.title,
    composer: tune.composer,
    info: tune.info,
    lilypondVersion: tune.lilypondVersion,
    raggedLast: tune.raggedLast,
    raggedRight: tune.raggedRight,
    firstIndent: tune.firstIndent,
    paperFont: tune.paperFont,
    paperWidthMm: tune.paperWidthMm,
    paperHeightMm: tune.paperHeightMm,
    topMarginMm: tune.topMarginMm,
    bottomMarginMm: tune.bottomMarginMm,
    leftMarginMm: tune.leftMarginMm,
    rightMarginMm: tune.rightMarginMm,
    verticalSpacing: tune.verticalSpacing,
    annotateSpacing: tune.annotateSpacing,
    pageBreaking: tune.pageBreaking,
    globalStaffSize: tune.globalStaffSize,
    debugSkylines: tune.debugSkylines,
    midiInstrument: tune.midiInstrument,
    lyricFontSizeDelta: tune.lyricFontSizeDelta,
    barNumberSelfAlignmentX: tune.barNumberSelfAlignmentX,
    barNumberDirection: tune.barNumberDirection,
    barNumberVisibility: tune.barNumberVisibility
  };
}
function parsedDocumentInfoFromTune(tune, ast) {
  const versionNode = ast?.children.find((child) => child.type === "version");
  const headerNode = ast?.children.find((child) => child.type === "header");
  const paperNode = ast?.children.find((child) => child.type === "paper");
  const layoutNode = ast?.children.find((child) => child.type === "layout");
  return {
    title: tune.title,
    composer: tune.composer,
    info: tune.info,
    lilypondVersion: tune.lilypondVersion,
    raggedLast: tune.raggedLast,
    raggedRight: tune.raggedRight,
    firstIndent: tune.firstIndent,
    paperFont: tune.paperFont,
    paperWidthMm: tune.paperWidthMm,
    paperHeightMm: tune.paperHeightMm,
    topMarginMm: tune.topMarginMm,
    bottomMarginMm: tune.bottomMarginMm,
    leftMarginMm: tune.leftMarginMm,
    rightMarginMm: tune.rightMarginMm,
    verticalSpacing: tune.verticalSpacing,
    annotateSpacing: tune.annotateSpacing,
    pageBreaking: tune.pageBreaking,
    globalStaffSize: tune.globalStaffSize,
    debugSkylines: tune.debugSkylines,
    lyricFontSizeDelta: tune.lyricFontSizeDelta,
    barNumberSelfAlignmentX: tune.barNumberSelfAlignmentX,
    barNumberDirection: tune.barNumberDirection,
    barNumberVisibility: tune.barNumberVisibility,
    sourceRanges: {
      version: sourceRangeFromNode2(versionNode),
      header: sourceRangeFromNode2(headerNode),
      paper: sourceRangeFromNode2(paperNode),
      layout: sourceRangeFromNode2(layoutNode)
    }
  };
}
function normalizeScoreMetadata(blocks) {
  let scoreIdx = 0;
  return blocks.map((block) => {
    if (block.type !== "score" && block.type !== "pianoScore")
      return block;
    if (scoreIdx === 0) {
      scoreIdx++;
      return block;
    }
    scoreIdx++;
    if (block.type === "pianoScore") {
      return {
        ...block,
        score: {
          ...block.score,
          meta: { ...block.score.meta, title: undefined, composer: undefined, info: undefined }
        }
      };
    }
    return {
      type: "score",
      score: {
        ...block.score,
        tune: {
          ...block.score.tune,
          title: undefined,
          composer: undefined,
          info: undefined
        }
      },
      range: block.range
    };
  });
}
function parsedScoreFromTune(tune, options = {}) {
  const context = buildScoreContext(tune, options);
  const engravingEvents2 = buildEngravingEventStream(context);
  return {
    tune: { ...tune, engravingEvents: engravingEvents2 },
    context,
    engravingEvents: engravingEvents2,
    ...options.range ? { range: options.range } : {}
  };
}
function parsedPianoScoreFromStaves(score2, options = {}) {
  const context = buildPianoScoreContext(score2, options);
  const engravingEvents2 = buildEngravingEventStream(context);
  return {
    groupType: score2.groupType,
    staves: score2.staves,
    ...score2.meta ? { meta: score2.meta } : {},
    context,
    engravingEvents: engravingEvents2,
    ...score2.range ? { range: score2.range } : {}
  };
}
function buildParsedDocumentBlocks(ast, tune) {
  const nextBlocks = [];
  if (ast) {
    const metaNodes = ast.children.filter((child) => child.type === "header" || child.type === "paper" || child.type === "version" || child.type === "layout");
    const layoutNodes = ast.children.filter((child) => child.type === "layout");
    const pendingTopMusic = [];
    const flushTopMusic = () => {
      if (pendingTopMusic.length === 0)
        return;
      const topTune = emit({
        type: "root",
        children: [...metaNodes, ...pendingTopMusic],
        loc: ast.loc
      });
      if (hasRenderableMusic(topTune)) {
        const range = pendingTopMusic[0] ? sourceRangeFromNode2(pendingTopMusic[0]) : undefined;
        nextBlocks.push({
          type: "score",
          score: parsedScoreFromTune(topTune, {
            music: pendingTopMusic,
            layoutNodes,
            range
          }),
          range
        });
      }
      pendingTopMusic.length = 0;
    };
    for (const child of ast.children) {
      if (child.type === "header" || child.type === "paper" || child.type === "version" || child.type === "layout")
        continue;
      if (child.type === "schemeVariableDefinition" || child.type === "schemeFunctionDefinition" || child.type === "schemeOption")
        continue;
      if (child.type === "schemeFunctionCall") {
        flushTopMusic();
        nextBlocks.push({ type: "diagnostic", severity: "warning", message: `Unexpanded Scheme function call: \\${child.name}`, range: sourceRangeFromNode2(child) });
        continue;
      }
      if (isTopMusicNodeType(child.type)) {
        pendingTopMusic.push(child);
        continue;
      }
      if (child.type === "markupBlock") {
        flushTopMusic();
        const fillLineCols = extractFillLineColumns(child.children);
        if (fillLineCols) {
          nextBlocks.push({
            type: "fillLine",
            columns: fillLineCols.map((col) => col.map((p) => ({
              text: p.text,
              ...p.style,
              ...p.runs ? { runs: p.runs } : {},
              ...p.graphics ? { graphics: p.graphics } : {},
              ...p.lineGapBeforeStaffSpaces ? { lineGapBeforeStaffSpaces: p.lineGapBeforeStaffSpaces } : {},
              ...p.lineGapAfterStaffSpaces ? { lineGapAfterStaffSpaces: p.lineGapAfterStaffSpaces } : {},
              ...p.textOffsetXStaffSpaces != null ? { textOffsetXStaffSpaces: p.textOffsetXStaffSpaces } : {},
              ...p.textOffsetYStaffSpaces != null ? { textOffsetYStaffSpaces: p.textOffsetYStaffSpaces } : {},
              ...p.compactLineGap ? { compactLineGap: true } : {}
            }))),
            range: sourceRangeFromNode2(child)
          });
          continue;
        }
        const payloadBlocks = extractMarkupPayloadBlocks(child.children);
        appendMarkupPayloadBlocks(nextBlocks, payloadBlocks, sourceRangeFromNode2(child));
        continue;
      }
      if (child.type === "markupList") {
        flushTopMusic();
        for (const item of child.items) {
          if (item.type === "markupText" && item.text.trim().length === 0)
            continue;
          const payload = extractMarkupPayloadBlocks([item]);
          for (const p of payload) {
            if (p.text.trim().length === 0)
              continue;
            appendMarkupPayloadBlocks(nextBlocks, [p], sourceRangeFromNode2(item));
          }
        }
        continue;
      }
      if (child.type === "staffGroupContext") {
        flushTopMusic();
        const sgNode = child;
        const staves = emitStaffGroup(sgNode);
        if (staves.length >= 2) {
          const range = sourceRangeFromNode2(sgNode);
          nextBlocks.push({
            type: "pianoScore",
            score: parsedPianoScoreFromStaves({ groupType: sgNode.groupType, staves, range }, { layoutNodes, range }),
            range
          });
        }
        continue;
      }
      if (child.type === "book" || child.type === "bookpart") {
        flushTopMusic();
        const bookNode = child;
        const blocks = [];
        for (const scoreLike of bookNode.scores ?? []) {
          const scoreTune = emit({
            type: "root",
            children: [...metaNodes, scoreLike],
            loc: ast.loc
          });
          const range = sourceRangeFromNode2(scoreLike);
          if (hasRenderableMusic(scoreTune)) {
            blocks.push({
              type: "score",
              score: parsedScoreFromTune(scoreTune, {
                scoreNode: scoreLike.type === "scoreBlock" ? scoreLike : undefined,
                music: scoreLike.type === "scoreBlock" ? scoreLike.music : scoreLike,
                layoutNodes,
                range
              }),
              range
            });
          }
        }
        nextBlocks.push({ type: child.type, blocks: normalizeScoreMetadata(blocks), range: sourceRangeFromNode2(child) });
        continue;
      }
      if (child.type === "scoreBlock") {
        flushTopMusic();
        const scoreNode = child;
        const sgNode = extractStaffGroupContext(scoreNode.music);
        if (sgNode) {
          const metaTune = emit({
            type: "root",
            children: [...metaNodes, child],
            loc: ast.loc
          });
          const meta = documentMetaFromTune(metaTune);
          const staves = emitStaffGroup(sgNode, meta);
          if (staves.length >= 2) {
            const range2 = sourceRangeFromNode2(child);
            nextBlocks.push({
              type: "pianoScore",
              score: parsedPianoScoreFromStaves({
                groupType: sgNode.groupType,
                staves,
                meta,
                range: range2
              }, { scoreNode, layoutNodes, range: range2 }),
              range: range2
            });
          } else {
            const range2 = sourceRangeFromNode2(child);
            nextBlocks.push({
              type: "score",
              score: parsedScoreFromTune(metaTune, { scoreNode, layoutNodes, range: range2 }),
              range: range2
            });
          }
          continue;
        }
        const perScoreTune = emit({
          type: "root",
          children: [...metaNodes, child],
          loc: ast.loc
        });
        const range = sourceRangeFromNode2(child);
        nextBlocks.push({
          type: "score",
          score: parsedScoreFromTune(perScoreTune, { scoreNode, layoutNodes, range }),
          range
        });
      }
    }
    flushTopMusic();
    if (nextBlocks.length > 0) {
      return normalizeScoreMetadata(applyDocumentDebugSkylines(applyDocumentGlobalStaffSize(nextBlocks, tune.globalStaffSize), tune.debugSkylines));
    }
  }
  nextBlocks.push({
    type: "score",
    score: parsedScoreFromTune(tune)
  });
  return normalizeScoreMetadata(applyDocumentDebugSkylines(applyDocumentGlobalStaffSize(nextBlocks, tune.globalStaffSize), tune.debugSkylines));
}
function documentBlocksFromParsedDocument(document2) {
  if (!document2)
    return [];
  return document2.blocks.flatMap(legacyBlocksFromParsedBlock);
}
function legacyBlocksFromParsedBlock(block) {
  switch (block.type) {
    case "score":
      return [{
        type: "score",
        tune: block.score.tune,
        context: block.score.context,
        engravingEvents: block.score.engravingEvents,
        range: block.range
      }];
    case "pianoScore":
      return [{
        type: "pianoScore",
        groupType: block.score.groupType,
        staves: block.score.staves,
        meta: block.score.meta,
        context: block.score.context,
        engravingEvents: block.score.engravingEvents,
        range: block.range
      }];
    case "markup":
      return [{ ...block }];
    case "fillLine":
      return [{ ...block }];
    case "diagnostic":
      return [{ type: block.severity, message: block.message, range: block.range }];
    case "book":
    case "bookpart":
      return block.blocks.flatMap(legacyBlocksFromParsedBlock);
  }
}
function buildParsedDocument(ast, tune, diagnostics = []) {
  const contentBlocks = buildParsedDocumentBlocks(ast, tune);
  const diagnosticBlocks = diagnostics.map((error) => ({
    type: "diagnostic",
    severity: error.severity,
    message: error.message,
    range: sourceRangeFromError(error)
  }));
  const blocks = [...contentBlocks, ...diagnosticBlocks].sort((a, b) => {
    const ar = a.range?.pos ?? Number.POSITIVE_INFINITY;
    const br = b.range?.pos ?? Number.POSITIVE_INFINITY;
    return ar - br;
  });
  return {
    info: parsedDocumentInfoFromTune(tune, ast),
    blocks
  };
}
// src/music-input/lilypond/phases/index.ts
function detectLanguageDirective(source) {
  const m = source.match(/\\language\s+"([^"]+)"/i);
  return m?.[1] ? normalizeLyLanguage(m[1]) : undefined;
}
function parseLilyPond(source, opts = {}) {
  return runModularPipeline(source, opts);
}
function runModularPipeline(source, opts) {
  const errors = new ErrorCollection;
  const normalizedSource = preprocessSource(source, opts);
  const language = detectLanguageDirective(normalizedSource) ?? opts.language ?? "english";
  const { tokens, errors: lexerErrors } = lex(normalizedSource, language);
  lexerErrors.forEach((e) => errors.add(new ParseError({
    message: e.message,
    loc: e.loc,
    recoverable: true
  })));
  if (errors.hasFatalError()) {
    return { success: false, tune: null, document: null, errors };
  }
  const { ast, errors: parseErrors } = parse(tokens, normalizedSource, language);
  parseErrors.getAll().forEach((e) => errors.add(e));
  if (!ast || errors.hasFatalError()) {
    return { success: false, tune: null, document: null, errors, ast: ast ?? undefined };
  }
  let transformedAst = ast;
  if (!opts.skipTransform) {
    transformedAst = transform(ast);
  }
  if (!opts.skipValidation) {
    const { valid, errors: validationErrors } = validate(transformedAst);
    validationErrors.getAll().forEach((e) => errors.add(e));
    if (!valid) {
      return {
        success: false,
        tune: null,
        document: null,
        errors,
        ast: transformedAst
      };
    }
  }
  const tune = emit(transformedAst);
  if (tune) {
    applySetPaperSize(normalizedSource, tune);
    tune.globalStaffSize = extractGlobalStaffSize(normalizedSource);
  }
  const document2 = tune ? buildParsedDocument(transformedAst, tune, errors.getAll()) : null;
  return {
    success: !errors.hasFatalError(),
    tune,
    document: document2,
    errors,
    ast: transformedAst
  };
}
var NAMED_PAPER_SIZES = {
  letter: { widthMm: 215.9, heightMm: 279.4 },
  a4: { widthMm: 210, heightMm: 297 }
};
function applySetPaperSize(src, tune) {
  const customRe = /#\(\s*set(?:-default)?-paper-size\s*'\(\s*cons\s*\(\*\s*([-+]?\d+(?:\.\d+)?)\s*mm\s*\)\s*\(\*\s*([-+]?\d+(?:\.\d+)?)\s*mm\s*\)\s*\)\s*\)/gi;
  const customMatches = [...src.matchAll(customRe)];
  const custom = customMatches[customMatches.length - 1];
  if (custom?.[1] != null && custom?.[2] != null) {
    const w = parseFloat(custom[1]);
    const h = parseFloat(custom[2]);
    if (Number.isFinite(w) && w > 0)
      tune.paperWidthMm = w;
    if (Number.isFinite(h) && h > 0)
      tune.paperHeightMm = h;
    return;
  }
  const namedRe = /#\(\s*set(?:-default)?-paper-size\s*"([^"]+)"(?:\s+[^\)]*)?\)/gi;
  const namedMatches = [...src.matchAll(namedRe)];
  const namedRaw = namedMatches[namedMatches.length - 1]?.[1];
  if (!namedRaw)
    return;
  const fmt = NAMED_PAPER_SIZES[namedRaw.trim().toLowerCase()];
  if (!fmt)
    return;
  tune.paperWidthMm = fmt.widthMm;
  tune.paperHeightMm = fmt.heightMm;
}
function expandIncludes(source, opts, fromPath, seen) {
  if (!opts.includeResolver)
    return source;
  return source.replace(/\\include\s+"([^"]+)"/g, (match2, includePath) => {
    const resolved = opts.includeResolver?.(includePath, fromPath);
    if (!resolved)
      return match2;
    const includeSource = typeof resolved === "string" ? resolved : resolved.source;
    const includeResolvedPath = typeof resolved === "string" ? includePath : resolved.path ?? includePath;
    const seenKey = includeResolvedPath;
    if (seen.has(seenKey))
      return "";
    const nextSeen = new Set(seen);
    nextSeen.add(seenKey);
    return `
${expandIncludes(includeSource, opts, includeResolvedPath, nextSeen)}
`;
  });
}
function preprocessSource(source, opts = {}) {
  return stripComments(expandIncludes(source, opts, opts.sourcePath, new Set(opts.sourcePath ? [opts.sourcePath] : [])));
}
function parseLy(src) {
  const result = parseLilyPond(src);
  if (result.tune)
    return result.tune;
  return { key: "C", timeSig: "4/4", notes: [] };
}
function parseDocument2(src) {
  const result = parseLilyPond(src);
  if (result.document)
    return documentBlocksFromParsedDocument(result.document);
  return result.errors.getAll().map((e) => e.toBlock());
}
// src/music-rendering/engraving/paperDefaults.ts
var SPACING_224 = {
  "system-system-spacing": {
    basicDistance: 12,
    minimumDistance: 8,
    padding: 1,
    stretchability: 60
  },
  "score-system-spacing": {
    basicDistance: 14,
    minimumDistance: 8,
    padding: 1,
    stretchability: 120
  },
  "markup-system-spacing": {
    basicDistance: 5,
    padding: 0.5,
    stretchability: 30
  },
  "score-markup-spacing": {
    basicDistance: 12,
    padding: 0.5,
    stretchability: 60
  },
  "markup-markup-spacing": {
    basicDistance: 1,
    padding: 0.5
  },
  "top-system-spacing": {
    basicDistance: 1,
    minimumDistance: 0,
    padding: 1
  },
  "top-markup-spacing": {
    basicDistance: 0,
    minimumDistance: 0,
    padding: 1
  },
  "last-bottom-spacing": {
    basicDistance: 1,
    minimumDistance: 0,
    padding: 1,
    stretchability: 30
  }
};
var SPACING_226 = {
  ...SPACING_224,
  "top-system-spacing": {
    basicDistance: 6,
    minimumDistance: 0,
    padding: 1
  },
  "top-markup-spacing": {
    basicDistance: 4,
    minimumDistance: 0,
    padding: 1
  }
};
var SOURCE_226_DEFAULTS = {
  fixedMarginsMm: {
    leftMm: 15,
    rightMm: 15,
    topMm: 15,
    bottomMm: 10
  },
  spacing: SPACING_226
};
var CURRENT_REFERENCE_DEFAULTS = {
  ...SOURCE_226_DEFAULTS,
  fixedMarginsMm: {
    leftMm: 15,
    rightMm: 15,
    topMm: 15,
    bottomMm: 15
  }
};
var spacingNames = new Set([
  "top-markup-spacing",
  "top-system-spacing",
  "markup-markup-spacing",
  "markup-system-spacing",
  "score-markup-spacing",
  "score-system-spacing",
  "system-system-spacing",
  "last-bottom-spacing"
]);
// src/music-rendering/engraving/constants.ts
var CANONICAL_STAFF_SPACE_PX = 7.03 / 4 * (96 / 25.4);
var LINE_SPACING = 7;
var STAFF_TOP = 10;
var STEP_HEIGHT = LINE_SPACING / 2;
var BOTTOM_LINE_Y = STAFF_TOP + 4 * LINE_SPACING;
var ROW_HEIGHT = LINE_SPACING * 15;
var PAGE_MARGIN_PX = Math.round(LINE_SPACING * (48 / 7));
var CLEF_W = LINE_SPACING * 3;
var CLEF_X = Math.round(LINE_SPACING * 0.7);
var CLEF_GLYPH_W = Math.ceil(2.7 * LINE_SPACING);
var BAR_NUM_FONT_SIZE = Math.round(LINE_SPACING * 4 / 3);
var BAR_NUM_Y_OFFSET = Math.round(LINE_SPACING * 2 / 3);
var HEADER_GAP = 3;
var HEADER_RIGHT_TEXT_OPTICAL_OUTSET = LINE_SPACING * 0.14;
var STAFF_RIGHT_EDGE_OPTICAL_OUTSET = LINE_SPACING * 0.07;
var HEADER_CHANGE_NOTE_GAP = Math.round(LINE_SPACING * 0.85);
var KEYED_TIME_SIG_NOTE_AREA_BACKSET = Math.round(LINE_SPACING * 1);
var CLEF_KEY_GAP = Math.round(LINE_SPACING * 0.65);
var KEY_SIGNATURE_CLEF_DISTANCE = LINE_SPACING * 3.5;
var PRE_BARLINE_CLEF_BARLINE_GAP = Math.round(LINE_SPACING * 0.5);
var PRE_BARLINE_CLEF_ANCHOR_W = CLEF_GLYPH_W + PRE_BARLINE_CLEF_BARLINE_GAP;
var PRE_BARLINE_CLEF_SLOT_W = Math.max(CLEF_W + HEADER_GAP, PRE_BARLINE_CLEF_ANCHOR_W);
var ACC_W = Math.round(LINE_SPACING * 1);
var TIMESIG_W = Math.round(LINE_SPACING * 1.9);
var NO_KEY_TIME_SIG_X_NUDGE = Math.round(LINE_SPACING * 0.75);
var NOTE_MIN_W = LINE_SPACING * 2.4;
var SPACING_INCREMENT = LINE_SPACING * 1.2;
var MIN_MEASURE_W = LINE_SPACING * 7;
var STEM_H = Math.round(LINE_SPACING * 3.5);
var STEM_H_FLAG = LINE_SPACING * 3.65;
var STEM_W = LINE_SPACING * 0.14;
var BEAM_H = LINE_SPACING * 0.4;
var BEAM_INTER_GAP = LINE_SPACING * 0.41;
var BEAM_STUB_W = LINE_SPACING * 1.085;
var ART_CLEAR = Math.round(LINE_SPACING * 0.5);
var ACC_EXTRA_W = Math.round(LINE_SPACING * 1);
var ACC_NOTEHEAD_GAP = Math.round(LINE_SPACING * 0.4);
var FLAG_ADV_W = Math.round(LINE_SPACING * 1.3);
var TUP_OUTSET = Math.round(LINE_SPACING * 0.25);
var TUP_HOOK_LEN = Math.round(LINE_SPACING * 0.67);
var TUP_NUM_GAP = Math.round(LINE_SPACING * 0.67);
var TUP_TGAP = Math.round(LINE_SPACING * 0.83);
var BRACKET_W = LINE_SPACING * 0.11;
var REPEAT_BAR_W = Math.round(LINE_SPACING * 1.9);
var BARLINE_THICK_W = Math.round(LINE_SPACING * 0.25);
var WIDE_BARLINE_W = Math.round(LINE_SPACING * 1.4);
var STEM_OPTICAL = Math.round(LINE_SPACING * 0.3);
var NH_RX = LINE_SPACING * 0.5;
var LEDGER_LINE_EXTENSION = LINE_SPACING * 0.35;
var DOT_OFFSET = NH_RX + Math.round(LINE_SPACING * 0.5);
var DOT_R = Math.round(LINE_SPACING * 0.2);
var BRAVURA_MUSIC_SIZE = LINE_SPACING * 4;
var BRAVURA_CLEF_SIZE = LINE_SPACING * 4;
var BRAVURA_KEY_SIZE = LINE_SPACING * 4;
var BRAVURA_TIMESIG_SIZE = LINE_SPACING * 4;
var BRAVURA_ACC_SIZE = LINE_SPACING * 3.6;
var BRAVURA_ART_SIZE = LINE_SPACING * 3.1;
var BRAVURA_GRACE_SIZE = LINE_SPACING * 2.6;
var GRACE_STEM_H = LINE_SPACING * 2;
var GRACE_BEAM_H = BEAM_H * 0.65;
var GRACE_SPACING = Math.round(LINE_SPACING * 1.8);
var GRACE_NH_RX = Math.round(NH_RX * 0.65);
var HEADER_TITLE_FONT_SIZE = CANONICAL_STAFF_SPACE_PX * 3.493;
var HEADER_SUBTITLE_FONT_SIZE = CANONICAL_STAFF_SPACE_PX * 2.47;
var HEADER_COMPOSER_FONT_SIZE = CANONICAL_STAFF_SPACE_PX * 2.2;
var TAGLINE_FONT_SIZE = CANONICAL_STAFF_SPACE_PX * 2.2;
var TAGLINE_BOTTOM_OFFSET = CANONICAL_STAFF_SPACE_PX * 6.1653;
var CHORD_NAME_FONT_SIZE = Math.round(LINE_SPACING * 1.6);
var TEMPO_TEXT_FONT_SIZE = LINE_SPACING * 2.2;
var REHEARSAL_MARK_FONT_SIZE = Math.round(LINE_SPACING * 1.4);
var REHEARSAL_MARK_PAD = Math.max(2, Math.round(LINE_SPACING * 0.6));
var REHEARSAL_MARK_PAD_X = Math.max(REHEARSAL_MARK_PAD, Math.round(LINE_SPACING * 0.85));
var FINGERING_FONT_SIZE = Math.round(LINE_SPACING * 1.2);
var VOLTA_NUMBER_FONT_SIZE = Math.round(LINE_SPACING * 1.55);
var TUPLET_NUMBER_FONT_SIZE = Math.round(LINE_SPACING * 1.2);
var TIME_SIG_Y_OFFSETS = {
  Leipzig: -Math.round(LINE_SPACING * 1.6) + Math.round(LINE_SPACING * 0.14)
};
var DYN_FONT_SIZE = Math.round(LINE_SPACING * 3.6);
var DYN_CLEARANCE = Math.round(LINE_SPACING * 0.5);
var DYN_LINE_TEXT_DROP = LINE_SPACING * 0.6;
var HAIRPIN_H = LINE_SPACING * 1.3332;
var HAIRPIN_SW = LINE_SPACING * 0.1;
var MM_REST_H = LINE_SPACING * 0.66;
var MM_REST_CAP_EXT = LINE_SPACING * 0.67;
var MM_REST_MIN_W = Math.round(LINE_SPACING * 3);
var MM_REST_MAX_W = Math.round(LINE_SPACING * 9.25);
var MM_REST_CAP_W = LINE_SPACING * 0.2;
var MM_REST_CAP_RY = LINE_SPACING * 0.08;
var MM_REST_NUM_SIZE = Math.round(LINE_SPACING * 4 / 3);
var BARLINE_FONT_SIZE = 4 * LINE_SPACING;
// src/music-rendering/engraving/dynamics.ts
var DYNAMIC_MEASURE_RESERVE_PER_EVENT = LINE_SPACING * 0.9;
var HAIRPIN_MEASURE_RESERVE = LINE_SPACING * 0.6;

// src/music-rendering/engraving/ornamentArticulations.ts
var ORNAMENT_ARTICULATIONS = new Set([
  "trill",
  "mordent",
  "turn",
  "reverseturn",
  "prall",
  "prallprall"
]);

// src/music-rendering/layout/spacingModel.ts
var DENSE_16TH_REFERENCE_SPACE_BONUS = LINE_SPACING * 0.092;
var ORDINARY_ATTACK_ROD = Math.round(LINE_SPACING * 3);
var ORDINARY_FIRST_ATTACK_OFFSET = Math.round(LINE_SPACING * 1.75);
var ORDINARY_POST_BARLINE_ATTACK_OFFSET = Math.round(LINE_SPACING * 6 / 7);
var POST_BARLINE_NOTEHEAD_CLEARANCE = LINE_SPACING * 0.5;
var POST_BARLINE_FIRST_NOTE_GAP_FLOOR = LINE_SPACING * 1.6;
var COMPACT_SHORT_POST_BARLINE_FIRST_NOTE_GAP_FLOOR = LINE_SPACING * 1.1;
var DENSE_BEAM_LEADING_ATTACK_TARGET = LINE_SPACING * 2.6;
var DENSE_BEAM_INTERNAL_GAP_FLOOR = LINE_SPACING * 2.35;
var DENSE_ACCIDENTAL_BEAM_INTERNAL_GAP_FLOOR = LINE_SPACING * 2.05;
var DENSE_ACCIDENTAL_DESCENDING_CONTOUR_RELAXATION = LINE_SPACING * 0.12;
var DENSE_ACCIDENTAL_FOLLOWING_ATTACK_GAP = LINE_SPACING * 2.55;
var DENSE_REMOTE_ACCIDENTAL_FOLLOWING_ATTACK_GAP = LINE_SPACING * 2.05;
var ORDINARY_FINAL_ATTACK_TAIL = Math.round(LINE_SPACING * 2.6);
var ORDINARY_FINAL_LONG_ATTACK_TAIL = Math.round(LINE_SPACING * 3.45);
var ACCIDENTAL_PREVIOUS_NOTEHEAD_CLEARANCE = LINE_SPACING * 0.55;
var SHARP_ACCIDENTAL_PREVIOUS_NOTEHEAD_CLEARANCE = LINE_SPACING * 1.3;
var NATURAL_ACCIDENTAL_PREVIOUS_NOTEHEAD_CLEARANCE = LINE_SPACING * 1;
var FIRST_ACCIDENTAL_BOUNDARY_CLEARANCE = LINE_SPACING * 0.8;
var FIRST_SHARP_ACCIDENTAL_BOUNDARY_CLEARANCE = LINE_SPACING * 1.3;
var FIRST_NATURAL_ACCIDENTAL_BOUNDARY_CLEARANCE = LINE_SPACING * 1.1;

// src/music-rendering/layout/inlineClefSpacing.ts
var INLINE_CLEF_CHANGE_SPACE = CLEF_W + HEADER_CHANGE_NOTE_GAP;
// src/music-rendering/layout/rowPacking.ts
var BADNESS_SCALE = 100;
var OVERFULL_SYSTEM_PENALTY_SCALE = BADNESS_SCALE * 4;
var OVERFULL_LAST_SYSTEM_PENALTY_SCALE = BADNESS_SCALE * 2;
var UNDERFULL_SYSTEM_PENALTY_SCALE = BADNESS_SCALE * 2.8;
var RAGGED_LAST_SYSTEM_PENALTY_SCALE = BADNESS_SCALE * 2.2;
// src/music-core-adapter/pitchConversion.ts
var SUPPORTED_CLEF_NAMES = new Set([
  "treble",
  "bass",
  "alto"
]);
// src/music-input/lilypond/helpers/pitch.ts
function displayPitch(raw) {
  const lower = raw.toLowerCase();
  const base = lower[0]?.toUpperCase() ?? "C";
  const acc = lower.slice(1);
  if (acc === "s" || acc === "is" || acc === "#")
    return `${base}#`;
  if (acc === "f" || acc === "es" || acc === "b")
    return `${base}b`;
  if (acc === "ss" || acc === "isis")
    return `${base}##`;
  if (acc === "ff" || acc === "eses")
    return `${base}bb`;
  return base;
}
function extractKey(src) {
  const match2 = src.match(/\\key\s+([a-gA-G](?:isis|eses|is|es|ss|ff|s|f|#|b)?)\s+\\(major|minor)/);
  if (!match2)
    return "C";
  return `${displayPitch(match2[1])}${match2[2] === "minor" ? "m" : ""}`;
}
function extractTimeSig(src) {
  return src.match(/\\time\s+(\d+)\s*\/\s*(\d+)/)?.slice(1, 3).join("/") ?? "4/4";
}
// src/music-input/lilypond/helpers/duration.ts
function parseDuration2(durStr, prevDuration) {
  if (!durStr)
    return prevDuration;
  const match2 = durStr.match(/^(\d+)(\.*)/);
  if (!match2)
    return prevDuration;
  const base = 4 / Number(match2[1]);
  let duration3 = base;
  for (let i = 0;i < (match2[2]?.length ?? 0); i++) {
    duration3 += base / Math.pow(2, i + 1);
  }
  return duration3;
}
// src/music-input/lilypond/helpers/chordMode.ts
function chordName(root, modifier) {
  const r = displayPitch(root);
  if (!modifier)
    return r;
  if (modifier === "m")
    return `${r}m`;
  if (modifier === "dim")
    return `${r}°`;
  if (modifier === "aug")
    return `${r}+`;
  return `${r}${modifier}`;
}
function parseChordMode(body, _vars, defaultDuration = 4) {
  const result = [];
  let prev = defaultDuration;
  const re = /([a-gA-G](?:s|f|#|b)?|s)(\d*(?:\.*))(?:\:([A-Za-z0-9.]+))?/g;
  for (const match2 of body.matchAll(re)) {
    prev = parseDuration2(match2[2] ?? "", prev);
    const root = match2[1];
    result.push({
      name: root === "s" ? "" : chordName(root, match2[3] ?? ""),
      duration: prev
    });
  }
  return result;
}
export {
  stripComments,
  parseLy,
  parseDuration2 as parseDuration,
  parseDocument2 as parseDocument,
  parseChordMode,
  extractTimeSig,
  extractPaper,
  extractKey,
  Scanner
};
