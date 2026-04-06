/**
 * Recursive-descent LilyPond parser.
 * Extracts melody notes from \relative notation into ParsedNote[].
 */
import { Scanner } from './scanner.js';
// ── Pitch tables ──────────────────────────────────────────────────────────────
/** Accidental string → semitone offset */
const ACC_OFFSET = {
    '': 0, s: 1, ss: 2, f: -1, ff: -2,
};
/** LilyPond note token name → display string */
const LY_DISPLAY = {
    c: 'C', cs: 'C#', cf: 'Cb', css: 'C##',
    d: 'D', ds: 'D#', df: 'Db', dss: 'D##',
    e: 'E', es: 'E#', ef: 'Eb',
    f: 'F', fs: 'F#', ff: 'Fb',
    g: 'G', gs: 'G#', gf: 'Gb', gss: 'G##',
    a: 'A', as: 'A#', af: 'Ab', ass: 'A##',
    b: 'B', bs: 'B#', bf: 'Bb',
};
/** Diatonic step index for each note base (C=0, D=1, E=2, F=3, G=4, A=5, B=6) */
const DIATONIC_STEP = {
    c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6,
};
/** Number of semitones in each diatonic step (C to B) */
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
// ── Key-signature map ─────────────────────────────────────────────────────────
const KEY_DISPLAY = {
    c: 'C', cs: 'C#', cf: 'Cb',
    d: 'D', ds: 'D#', df: 'Db',
    e: 'E', ef: 'Eb',
    f: 'F', fs: 'F#',
    g: 'G', gf: 'Gb',
    a: 'A', af: 'Ab', as: 'A#',
    b: 'B', bf: 'Bb',
};
// ── Enharmonic spelling ───────────────────────────────────────────────────────
/** Diatonic letter names in order (index = diatonic class 0–6) */
const DIATONIC_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/**
 * Return the note name (e.g. 'C#', 'Db', 'E') for a given pitch class and
 * diatonic class. The diatonic class (0=C … 6=B) selects the base letter; the
 * accidental is derived from the difference between the pitch class and the
 * natural semitone position of that letter.
 *
 * Examples:
 *   enharmonicSpelling(1, 0)  → 'C#'   (pitch class 1 spelled as C-something)
 *   enharmonicSpelling(1, 1)  → 'Db'   (pitch class 1 spelled as D-something)
 *   enharmonicSpelling(5, 2)  → 'E#'   (pitch class 5 spelled as E-something)
 *   enharmonicSpelling(5, 3)  → 'F'    (pitch class 5 spelled as F-natural)
 */
export function enharmonicSpelling(pitchClass, diatonicClass) {
    const dClass = ((diatonicClass % 7) + 7) % 7; // normalise to 0–6
    const base = DIATONIC_LETTERS[dClass];
    let acc = pitchClass - STEP_SEMITONES[dClass];
    // Normalise accidental to the closest spelling: e.g. +11 → -1 (Cb), -11 → +1 (B#)
    if (acc > 6)
        acc -= 12;
    if (acc < -6)
        acc += 12;
    const accStr = acc === 0 ? '' : acc === 1 ? '#' :
        acc === -1 ? 'b' : acc === 2 ? '##' : 'bb';
    return base + accStr;
}
// ── Comment stripping ─────────────────────────────────────────────────────────
export function stripComments(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
        // Block comment %{ ... %}
        if (src[i] === '%' && src[i + 1] === '{') {
            i += 2;
            let depth = 1;
            while (i < src.length && depth > 0) {
                if (src[i] === '%' && src[i + 1] === '{') {
                    depth++;
                    i += 2;
                }
                else if (src[i] === '%' && src[i + 1] === '}') {
                    depth--;
                    i += 2;
                }
                else {
                    i++;
                }
            }
            out += ' ';
            continue;
        }
        // Line comment % ...
        if (src[i] === '%') {
            while (i < src.length && src[i] !== '\n')
                i++;
            continue;
        }
        out += src[i++];
    }
    return out;
}
// ── Meta extraction ───────────────────────────────────────────────────────────
/** Extract \key X \major/minor → display string like 'D', 'Em', 'Bb' */
export function extractKey(src) {
    const sc = new Scanner(src);
    const tokens = sc.tokenize();
    for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i].kind === 'command' && tokens[i].value === 'key') {
            const noteToken = tokens[i + 1];
            const modeToken = tokens[i + 2];
            if (!noteToken || !modeToken)
                continue;
            // noteToken is a 'note' token: value = "noteName|octave|dur"
            // or a 'word' token for the key tonic
            let noteName = '';
            if (noteToken.kind === 'note') {
                noteName = noteToken.value.split('|')[0] ?? '';
            }
            else if (noteToken.kind === 'word') {
                noteName = noteToken.value;
            }
            const display = KEY_DISPLAY[noteName] ?? noteName.toUpperCase();
            const isMinor = modeToken.kind === 'command' && modeToken.value === 'minor';
            return display + (isMinor ? 'm' : '');
        }
    }
    return 'C';
}
/** Extract \time N/M → string like '6/8' */
export function extractTimeSig(src) {
    const sc = new Scanner(src);
    const tokens = sc.tokenize();
    for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i].kind === 'command' && tokens[i].value === 'time') {
            const num = tokens[i + 1];
            const slash = tokens[i + 2];
            const den = tokens[i + 3];
            if (num?.kind === 'number' && slash?.kind === 'slash' && den?.kind === 'number') {
                return `${num.value}/${den.value}`;
            }
        }
    }
    return '4/4';
}
/** Extract a string field from \header { fieldName = "..." } using regex (avoids Scanner splitting note-letter names). */
function extractHeaderField(src, fieldName) {
    // Match \header { ... } block first, then search for fieldName = "value" inside it
    const block = src.match(/\\header\s*\{([^{}]*)\}/)?.[1];
    if (!block)
        return undefined;
    const m = block.match(new RegExp(`\\b${fieldName}\\s*=\\s*"([^"]*)"`));
    return m?.[1];
}
/** Extract title from \header { title = "..." } */
export function extractTitle(src) {
    return extractHeaderField(src, 'title');
}
/** Extract composer from \header { composer = "..." } */
export function extractComposer(src) {
    return extractHeaderField(src, 'composer');
}
// ── Paper extraction ──────────────────────────────────────────────────────────
/**
 * Extract settings from \paper { ... }.
 *
 * ragged-last:
 *   ##t (true)  → last system left at natural width (ragged right) — LilyPond default
 *   ##f (false) → last system stretched to fill the full line width
 *
 * indent:
 *   Numeric value (SVG user units). 0 = no first-system indentation (default in our viewer).
 */
export function extractPaper(src) {
    const result = {};
    // Match \paper { ... } — paper blocks don't contain nested braces in practice
    const m = src.match(/\\paper\s*\{([^{}]*)\}/);
    if (!m)
        return result;
    const block = m[1];
    // ragged-last = ##f (false = stretch) | ##t (true = ragged)
    const raggedMatch = block.match(/ragged-last\s*=\s*##([ft])/);
    if (raggedMatch)
        result.raggedLast = raggedMatch[1] === 't';
    // indent = N  (bare integer or decimal, no unit suffix — treated as SVG user units)
    const indentMatch = block.match(/\bindent\s*=\s*(\d+(?:\.\d+)?)/);
    if (indentMatch)
        result.indent = parseFloat(indentMatch[1]);
    // font = "FontName"  — SMuFL font override (e.g. "Petaluma")
    const fontMatch = block.match(/\bfont\s*=\s*"([^"]+)"/);
    if (fontMatch)
        result.font = fontMatch[1];
    return result;
}
/**
 * Extract all top-level variable definitions of the form:
 *   name = \relative startNote { body }
 *   name = { body }
 * Returns a Map from name → VarDef.
 */
export function extractVariables(src) {
    const vars = new Map();
    let i = 0;
    while (i < src.length) {
        // Skip whitespace
        while (i < src.length && (src[i] === ' ' || src[i] === '\t' ||
            src[i] === '\n' || src[i] === '\r'))
            i++;
        if (i >= src.length)
            break;
        // Try to read a bare identifier (variable name)
        if (!isIdentStart(src[i])) {
            i++;
            continue;
        }
        const nameStart = i;
        while (i < src.length && isIdentChar(src[i]))
            i++;
        const name = src.slice(nameStart, i);
        // Skip whitespace
        while (i < src.length && (src[i] === ' ' || src[i] === '\t'))
            i++;
        // Must be followed by =
        if (src[i] !== '=')
            continue;
        i++; // consume =
        // Skip whitespace
        while (i < src.length && (src[i] === ' ' || src[i] === '\t' ||
            src[i] === '\n' || src[i] === '\r'))
            i++;
        let startNote = '';
        let isRelative = false;
        // Check for \relative, \fixed, or \chordmode
        let isChordMode = false;
        if (src.startsWith('\\relative', i) || src.startsWith('\\fixed', i)) {
            const cmd = src.startsWith('\\relative', i) ? '\\relative' : '\\fixed';
            isRelative = true;
            i += cmd.length; // consume \relative or \fixed
            // Skip whitespace, then read the start-note (e.g. c'')
            while (i < src.length && (src[i] === ' ' || src[i] === '\t'))
                i++;
            // Start note: a letter optionally followed by ' and ,
            if (i < src.length && src[i] >= 'a' && src[i] <= 'g') {
                const snStart = i;
                while (i < src.length && (isAlpha(src[i]) || src[i] === "'" || src[i] === ','))
                    i++;
                startNote = src.slice(snStart, i);
            }
            while (i < src.length && (src[i] === ' ' || src[i] === '\t' ||
                src[i] === '\n' || src[i] === '\r'))
                i++;
        }
        else if (src.startsWith('\\chordmode', i) || src.startsWith('\\chords', i)) {
            isChordMode = true;
            i += src.startsWith('\\chordmode', i) ? 10 : 7;
            while (i < src.length && (src[i] === ' ' || src[i] === '\t' ||
                src[i] === '\n' || src[i] === '\r'))
                i++;
        }
        // Must be followed by {
        if (src[i] !== '{')
            continue;
        const bodyStart = i + 1;
        i++; // consume {
        // Find matching }
        let depth = 1;
        while (i < src.length && depth > 0) {
            if (src[i] === '{')
                depth++;
            else if (src[i] === '}')
                depth--;
            i++;
        }
        const body = src.slice(bodyStart, i - 1);
        vars.set(name, { body, startNote, isRelative, ...(isChordMode ? { isChordMode: true } : {}) });
    }
    return vars;
}
function isIdentStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}
function isIdentChar(ch) {
    return isIdentStart(ch) || (ch >= '0' && ch <= '9') || ch === '-';
}
function isAlpha(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}
// ── Melody variable discovery ─────────────────────────────────────────────────
/**
 * Find which variable is used in the first \new Staff { \varname } inside \score.
 * Falls back to a priority list of common names.
 */
export function findMelodyVarName(src, vars) {
    // Scan for \new Staff { \varname }
    const sc = new Scanner(src);
    const tokens = sc.tokenize();
    for (let i = 0; i < tokens.length - 3; i++) {
        const t = tokens[i];
        if (t.kind === 'command' && t.value === 'new') {
            const ctx = tokens[i + 1];
            if (ctx?.kind === 'word' && ctx.value === 'Staff') {
                // Look ahead for the first \varname inside this Staff context
                // Skip optional modifier words until we find { \varname }
                let j = i + 2;
                // skip modifier words/commands
                while (j < tokens.length && tokens[j].kind !== 'open')
                    j++;
                if (tokens[j]?.kind === 'open') {
                    j++;
                    // Collect commands/words inside the staff block (shallow)
                    while (j < tokens.length && tokens[j].kind !== 'close') {
                        const inner = tokens[j];
                        if (inner.kind === 'command' && vars.has(inner.value)) {
                            return inner.value;
                        }
                        j++;
                    }
                }
            }
        }
    }
    // Fallback: priority order
    const priority = ['melody', 'violin', 'flute', 'soprano', 'voice',
        'upper', 'right', 'notes', 'music', 'mel', 'part'];
    for (const name of priority) {
        if (vars.has(name))
            return name;
    }
    // Last resort: first variable that has a startNote (is \relative)
    for (const [name, def] of vars) {
        if (def.startNote)
            return name;
    }
    return undefined;
}
// ── Duration parsing ──────────────────────────────────────────────────────────
/**
 * Parse a LilyPond duration string (e.g. "8", "4.", "2..", "") into
 * quarter-note units. Empty string → reuse prevDuration.
 */
export function parseDuration(durStr, prevDuration) {
    if (durStr === '')
        return prevDuration;
    let s = durStr;
    const dots = countLeadingFromRight(s, '.');
    s = s.slice(0, s.length - dots);
    if (s === '')
        return prevDuration;
    const base = 4 / parseInt(s, 10); // e.g. "8" → 0.5 quarter notes
    let dur = base;
    for (let i = 0; i < dots; i++)
        dur += base / Math.pow(2, i + 1);
    return dur;
}
function countLeadingFromRight(s, ch) {
    let n = 0;
    for (let i = s.length - 1; i >= 0 && s[i] === ch; i--)
        n++;
    return n;
}
// ── \chordmode parser ─────────────────────────────────────────────────────────
/** Map LilyPond note base → display letter */
const CHORD_ROOT_DISPLAY = {
    c: 'C', cs: 'C#', cf: 'Cb',
    d: 'D', ds: 'D#', df: 'Db',
    e: 'E', ef: 'Eb', es: 'E#',
    f: 'F', fs: 'F#', ff: 'Fb',
    g: 'G', gs: 'G#', gf: 'Gb',
    a: 'A', as: 'A#', af: 'Ab',
    b: 'B', bf: 'Bb', bs: 'B#',
};
/** Convert a LilyPond chord quality modifier to a display suffix.
 * e.g. "maj" → "maj", "m7" → "m7", "dim" → "dim", "aug" → "aug", "7" → "7"
 * Handles the most common jazz/classical chord types.
 */
function chordQualitySuffix(mod) {
    // Strip added/removed step notation (e.g. c:7^5 → "7"), keep the first meaningful part
    // Common direct mappings
    const map = {
        '': '',
        'maj': 'maj', 'm': 'm', 'min': 'm',
        'aug': '+', 'dim': '°', 'dim7': '°7',
        '5': '5', '6': '6', '7': '7', '9': '9', '11': '11', '13': '13',
        'maj7': 'maj7', 'maj9': 'maj9', 'maj11': 'maj11',
        'm7': 'm7', 'm9': 'm9', 'min7': 'm7',
        'm6': 'm6', 'm11': 'm11', 'm13': 'm13',
        'aug7': '+7', 'sus': 'sus4', 'sus4': 'sus4', 'sus2': 'sus2',
        '7sus4': '7sus4', '7sus': '7sus4',
        'm7b5': 'm7b5', 'hdim7': 'm7b5', 'hdim': 'm7b5',
    };
    if (mod in map)
        return map[mod];
    // For anything else, pass through as-is (preserves custom modifiers)
    return mod;
}
export function parseChordMode(body, vars, defaultDuration = 4) {
    const tokens = new Scanner(body).tokenize();
    const chords = [];
    let prevDur = defaultDuration;
    let i = 0;
    const tlen = tokens.length;
    // Collect all chords from the token stream
    function collect() {
        while (i < tlen) {
            const t = tokens[i];
            if (t.kind === 'eof')
                break;
            // Open brace: recurse into a block
            if (t.kind === 'open') {
                i++;
                collect();
                continue;
            }
            if (t.kind === 'close') {
                i++;
                return;
            }
            // \repeat volta N { body } [\alternative { { e1 } { e2 } ... }]
            if (t.kind === 'command' && t.value === 'repeat') {
                i++;
                // consume 'volta' word
                while (i < tlen && tokens[i].kind !== 'number')
                    i++;
                const countTok = tokens[i];
                const repeatCount = parseInt(countTok.kind === 'number' ? countTok.value : '1', 10) || 1;
                i++; // past count
                // collect body
                while (i < tlen && tokens[i].kind !== 'open')
                    i++;
                i++; // consume {
                const bodyStart = chords.length;
                collect(); // fills chords; collect() returns when it sees }
                const bodyChords = chords.splice(bodyStart); // extract body
                // \alternative { { e1 } { e2 } }
                let endings = [];
                // look ahead for \alternative
                let j = i;
                while (j < tlen && tokens[j].kind !== 'command' && tokens[j].kind !== 'eof')
                    j++;
                if (j < tlen && tokens[j].kind === 'command' && tokens[j].value === 'alternative') {
                    i = j + 1;
                    while (i < tlen && tokens[i].kind !== 'open')
                        i++;
                    i++; // consume outer {
                    // each { ... } is one ending
                    while (i < tlen) {
                        while (i < tlen && tokens[i].kind !== 'open' && tokens[i].kind !== 'close')
                            i++;
                        if (tokens[i]?.kind === 'close') {
                            i++;
                            break;
                        } // outer }
                        i++; // consume inner {
                        const endStart = chords.length;
                        collect();
                        endings.push(chords.splice(endStart));
                    }
                }
                // Emit: body × (repeatCount - endings.length) then body + ending[k] for each ending
                if (endings.length === 0) {
                    for (let r = 0; r < repeatCount; r++)
                        chords.push(...bodyChords);
                }
                else {
                    const plainTimes = Math.max(0, repeatCount - endings.length);
                    for (let r = 0; r < plainTimes; r++)
                        chords.push(...bodyChords);
                    for (const ending of endings) {
                        chords.push(...bodyChords);
                        chords.push(...ending);
                    }
                }
                continue;
            }
            // Variable reference: \varname
            if (t.kind === 'command' && vars.has(t.value)) {
                i++;
                const varDef = vars.get(t.value);
                const sub = parseChordMode(varDef.body, vars, prevDur);
                if (sub.length > 0) {
                    chords.push(...sub);
                    prevDur = sub[sub.length - 1].duration;
                }
                continue;
            }
            // Note token = chord root
            if (t.kind === 'note') {
                i++;
                const parts = t.value.split('|');
                const lyName = parts[0]; // e.g. "c", "cs", "bf"
                const durStr = parts[2] ?? '';
                prevDur = parseDuration(durStr, prevDur);
                // Chord quality: read directly from the body source after the note token.
                // The scanner silently skips ':' (not a recognized token kind), and modifiers like
                // "dim" or "aug" start with note-base letters (d, a) so the tokenizer mislabels them
                // as note tokens. Reading from source avoids this ambiguity entirely.
                //
                // Pattern: noteToken ends, then optionally whitespace, then ':', then modifier chars
                // (alphanumeric + '.') up to the next whitespace, '|', '/', or next note letter
                // that is NOT part of the modifier (i.e., a new chord).
                let mod = '';
                // Find end of note token in source.
                // The note token value encodes as "name|octave|dur|fingering" — the actual source
                // ends after the last non-whitespace char of the note+duration.  Use t.pos as start.
                {
                    // Walk past the note in the raw source to find ':'
                    let k = t.pos;
                    const blen = body.length;
                    // skip note base + accidental
                    while (k < blen && /[a-zA-Z]/.test(body[k]))
                        k++;
                    // skip octave marks (' and ,)
                    while (k < blen && (body[k] === "'" || body[k] === ','))
                        k++;
                    // skip duration digits and dots
                    while (k < blen && /[\d.]/.test(body[k]))
                        k++;
                    // skip fingering (-N or _N)
                    if (k < blen && (body[k] === '-' || body[k] === '_') && /\d/.test(body[k + 1] ?? '')) {
                        k += 2;
                        while (k < blen && /\d/.test(body[k]))
                            k++;
                    }
                    // skip whitespace
                    while (k < blen && (body[k] === ' ' || body[k] === '\t'))
                        k++;
                    // if we see ':', read the modifier
                    if (k < blen && body[k] === ':') {
                        k++; // consume ':'
                        // Read until whitespace, '|', '/', '\', '{', '}', '<', '>' — these end the modifier
                        const modStart = k;
                        while (k < blen && !/[\s|/\\{}><~,^_]/.test(body[k]))
                            k++;
                        mod = body.slice(modStart, k);
                        // Skip any tokens the scanner already emitted for the modifier chars
                        // (since those were mislabeled as note/word tokens, advance `i` past them)
                        const modEnd = t.pos + (k - t.pos); // absolute position in body after modifier
                        while (i < tlen && tokens[i].kind !== 'eof') {
                            const nt = tokens[i];
                            if (nt.pos >= modEnd)
                                break;
                            if (nt.pos < t.pos + 1) {
                                i++;
                                continue;
                            } // still within note token range
                            i++; // skip tokens that were part of the modifier
                        }
                    }
                    // Bass note /note — skip tokens until next whitespace-separated note/rest
                    while (i < tlen && tokens[i].kind === 'slash')
                        i++;
                    // If there's a note token right after '/' skip it (bass note — ignored for display)
                    if (i < tlen && tokens[i - 1]?.kind === 'slash' && tokens[i]?.kind === 'note')
                        i++;
                }
                const root = CHORD_ROOT_DISPLAY[lyName] ?? lyName.toUpperCase();
                const suffix = chordQualitySuffix(mod);
                chords.push({ name: root + suffix, duration: prevDur });
                continue;
            }
            // Rest token — spacer, no chord displayed; still advances duration
            if (t.kind === 'rest') {
                i++;
                if (t.value)
                    prevDur = parseDuration(t.value, prevDur);
                // emit a blank chord so positions stay in sync (renderer skips empty names)
                chords.push({ name: '', duration: prevDur });
                continue;
            }
            // barcheck, tie, word, number, slash, etc. — skip
            i++;
        }
    }
    collect();
    return chords;
}
/**
 * Resolve the absolute pitch of a note in \relative context.
 * Uses diatonic nearest-neighbor rule (standard LilyPond behaviour):
 *   - Find the diatonic interval to all candidates in octave ±1
 *   - Pick the one with the smallest absolute diatonic distance (≤ 3)
 *   - Then apply explicit ' and , octave modifiers
 */
function resolveRelative(lyName, // e.g. 'g', 'fs', 'bf'
octaveStr, // e.g. "''", ",", ""
ctx) {
    const base = lyName[0]; // first char is always a-g
    const acc = lyName.slice(1); // accidental part: '', 's', 'ss', 'f', 'ff'
    const diatonicClass = DIATONIC_STEP[base] ?? 0;
    const semitonesInOctave = STEP_SEMITONES[diatonicClass] + (ACC_OFFSET[acc] ?? 0);
    const pc = ((semitonesInOctave % 12) + 12) % 12;
    // Find best octave using diatonic distance
    const prevDClass = ((ctx.prevDiatonic % 7) + 7) % 7;
    const prevOctave = Math.floor(ctx.prevDiatonic / 7);
    let bestOctave = prevOctave;
    let bestDist = Infinity;
    for (const tryOct of [prevOctave - 1, prevOctave, prevOctave + 1]) {
        const tryDiatonic = tryOct * 7 + diatonicClass;
        const diatonicDist = Math.abs(tryDiatonic - ctx.prevDiatonic);
        if (diatonicDist < bestDist || (diatonicDist === bestDist && tryOct === prevOctave)) {
            bestDist = diatonicDist;
            bestOctave = tryOct;
        }
    }
    // Apply explicit octave modifiers
    for (const ch of octaveStr) {
        if (ch === "'")
            bestOctave++;
        else if (ch === ',')
            bestOctave--;
    }
    const diatonic = bestOctave * 7 + diatonicClass;
    const semitones = bestOctave * 12 + semitonesInOctave;
    // Suppress TS unused warning — prevDClass used for context only
    void prevDClass;
    return { semitones, diatonic, octave: bestOctave, pitchClass: pc };
}
/** Parse the start-note of \relative, e.g. "c''" → {octave:5, diatonic:35, semitones:60}
 *  When isRelative=true and startNote is empty, defaults to c' (C4) in relative mode.
 *  When isRelative=false and startNote is empty, uses absolute pitch mode. */
function parseStartNote(startNote, isRelative = false) {
    if (!startNote) {
        // When \relative has no explicit start note, LilyPond treats the first note as
        // absolute pitch. This is equivalent to using f (F3) as the reference:
        //   \relative { g'4 } → nearest G to F3 = G3, +1 tick → G4 ✓
        //   \relative { d''4 } → nearest D to F3 = D3, +2 ticks → D5 ✓
        // F3: diatonic = 3*7+3 = 24, semitones = 3*12+5 = 41
        if (isRelative)
            return { prevDiatonic: 3 * 7 + 3, prevSemitones: 3 * 12 + 5, prevDuration: 1 };
        return { prevDiatonic: 4 * 7 + 0, prevSemitones: 48, prevDuration: 1, absolute: true };
    }
    const base = startNote[0];
    const rest = startNote.slice(1);
    const acc = rest.replace(/[',]/g, '');
    const ups = (rest.match(/'/g) ?? []).length;
    const dns = (rest.match(/,/g) ?? []).length;
    const diatonicClass = DIATONIC_STEP[base] ?? 0;
    const semitonesInOctave = STEP_SEMITONES[diatonicClass] + (ACC_OFFSET[acc] ?? 0);
    // LilyPond: bare letter = octave 3, each ' adds 1, each , subtracts 1
    const octave = 3 + ups - dns;
    const diatonic = octave * 7 + diatonicClass;
    const semitones = octave * 12 + semitonesInOctave;
    return { prevDiatonic: diatonic, prevSemitones: semitones, prevDuration: 1 };
}
// ── Token stream cursor ───────────────────────────────────────────────────────
class TokenCursor {
    tokens;
    pos = 0;
    constructor(tokens) { this.tokens = tokens; }
    get done() { return this.pos >= this.tokens.length || this.tokens[this.pos].kind === 'eof'; }
    peek(offset = 0) {
        return this.tokens[this.pos + offset] ?? { kind: 'eof', value: '', pos: -1 };
    }
    advance() {
        return this.tokens[this.pos++] ?? { kind: 'eof', value: '', pos: -1 };
    }
    expect(kind) {
        const t = this.advance();
        if (t.kind !== kind)
            throw new Error(`Expected ${kind} but got ${t.kind} ('${t.value}')`);
        return t;
    }
    is(kind, value) {
        const t = this.peek();
        return t.kind === kind && (value === undefined || t.value === value);
    }
    isCommand(name) {
        return this.peek().kind === 'command' && this.peek().value === name;
    }
    skip(kind, value) {
        if (this.is(kind, value)) {
            this.advance();
            return true;
        }
        return false;
    }
    skipCommand(name) {
        if (this.isCommand(name)) {
            this.advance();
            return true;
        }
        return false;
    }
}
// ── Music expression parser ───────────────────────────────────────────────────
/**
 * Parse a sequence of music tokens into ParsedNote[].
 * ctx is mutated in place as we process notes (relative pitch state).
 */
function parseMusicSeq(cur, ctx, vars) {
    const notes = [];
    let pendingTieEnd = false; // set after ~ — next real note gets tieEnd=true
    while (!cur.done && !cur.is('close') && !cur.is('close', '>>')) {
        const t = cur.peek();
        // Bar check — skip
        if (t.kind === 'barcheck') {
            cur.advance();
            continue;
        }
        // Tie: mark the note just pushed as tieStart; next note will get tieEnd
        if (t.kind === 'tie') {
            cur.advance();
            if (notes.length > 0)
                notes[notes.length - 1].tieStart = true;
            pendingTieEnd = true;
            continue;
        }
        // Slur open/close — attach to the most recently pushed note
        if (t.kind === 'slur_open') {
            cur.advance();
            if (notes.length > 0)
                notes[notes.length - 1].slurStart = true;
            continue;
        }
        if (t.kind === 'slur_close') {
            cur.advance();
            if (notes.length > 0)
                notes[notes.length - 1].slurEnd = true;
            continue;
        }
        // << simultaneous >> — treat as sequential, take first voice only
        if (t.kind === 'open' && t.value === '<<') {
            cur.advance();
            notes.push(...parseMusicSeq(cur, ctx, vars));
            // skip remaining voices until >>
            while (!cur.done && !(cur.is('close') && cur.peek().value === '>>'))
                cur.advance();
            cur.advance(); // >>
            continue;
        }
        // Open brace — enter sub-expression
        if (t.kind === 'open') {
            cur.advance();
            notes.push(...parseMusicSeq(cur, ctx, vars));
            cur.skip('close');
            continue;
        }
        // Rest
        if (t.kind === 'rest') {
            cur.advance();
            ctx.prevDuration = parseDuration(t.value, ctx.prevDuration);
            notes.push({ noteName: 'R', octave: 0, pitchClass: -1, duration: ctx.prevDuration, isRest: true });
            continue;
        }
        // Note
        if (t.kind === 'note') {
            cur.advance();
            const parts = t.value.split('|');
            const lyName = parts[0];
            const octStr = parts[1] ?? '';
            const durStr = parts[2] ?? '';
            const fingeringStr = parts[3] ?? '';
            ctx.prevDuration = parseDuration(durStr, ctx.prevDuration);
            let octave, pitchClass;
            const base = lyName[0];
            const acc = lyName.slice(1);
            const diatonicClass = DIATONIC_STEP[base] ?? 0;
            const semitonesInOctave = STEP_SEMITONES[diatonicClass] + (ACC_OFFSET[acc] ?? 0);
            if (ctx.absolute) {
                // Absolute pitch: count ' and , modifiers from octave baseline of 3
                // e.g. c=C3, c'=C4, c''=C5, c,=C2
                const ups = octStr.split('').filter(c => c === "'").length;
                const dns = octStr.split('').filter(c => c === ',').length;
                octave = 3 + ups - dns;
                pitchClass = ((semitonesInOctave % 12) + 12) % 12;
            }
            else {
                const result = resolveRelative(lyName, octStr, ctx);
                octave = result.octave;
                pitchClass = result.pitchClass;
            }
            // Update context (used for duration inheritance and relative-mode pitch tracking)
            ctx.prevDiatonic = octave * 7 + diatonicClass;
            ctx.prevSemitones = octave * 12 + semitonesInOctave;
            const noteName = LY_DISPLAY[lyName] ?? lyName.toUpperCase();
            const note = { noteName, octave, pitchClass, duration: ctx.prevDuration, isRest: false };
            if (fingeringStr) {
                if (fingeringStr.startsWith('_')) {
                    note.fingering = parseInt(fingeringStr.slice(1), 10);
                    note.fingeringBelow = true;
                }
                else {
                    note.fingering = parseInt(fingeringStr, 10);
                }
            }
            if (pendingTieEnd) {
                note.tieEnd = true;
                pendingTieEnd = false;
            }
            notes.push(note);
            continue;
        }
        // Chord < note note note >dur
        if (t.kind === 'chord_open') {
            cur.advance();
            const chordNotes = [];
            // Each chord note is relative to the previous chord note (LilyPond rule)
            const chordCtx = { ...ctx };
            while (!cur.done && !cur.is('chord_close')) {
                const ct = cur.peek();
                if (ct.kind === 'note') {
                    cur.advance();
                    const [lyName, octStr, durStr] = ct.value.split('|');
                    void durStr;
                    const { octave, pitchClass } = resolveRelative(lyName, octStr, chordCtx);
                    const noteName = LY_DISPLAY[lyName] ?? lyName.toUpperCase();
                    chordNotes.push({ noteName, octave, pitchClass, duration: ctx.prevDuration, isRest: false });
                    // Update chordCtx for the next chord note
                    const base = lyName[0];
                    const acc = lyName.slice(1);
                    chordCtx.prevDiatonic = octave * 7 + (DIATONIC_STEP[base] ?? 0);
                    chordCtx.prevSemitones = octave * 12 + STEP_SEMITONES[DIATONIC_STEP[base] ?? 0] + (ACC_OFFSET[acc] ?? 0);
                }
                else if (ct.kind === 'barcheck' || ct.kind === 'tie') {
                    cur.advance();
                }
                else {
                    cur.advance(); // skip anything else inside chord
                }
            }
            // Consume > and optional duration
            if (cur.is('chord_close')) {
                cur.advance();
                // Duration after > is a separate 'number' token — consume it.
                if (cur.is('number')) {
                    const durTok = cur.advance();
                    let durStr = durTok.value;
                    // consume dots
                    while (cur.is('word') && cur.peek().value === '') { /* nothing */ }
                    // dots are separate characters — the scanner doesn't attach them here.
                    // Check peek for trailing dots (scanner emits them as part of 'duration' in note tokens
                    // but chord closing duration comes as a bare number). Skip for now — rare edge case.
                    ctx.prevDuration = parseDuration(durStr, ctx.prevDuration);
                }
            }
            // The top (highest-pitched) note is the primary entry; the others become chordNotes.
            if (chordNotes.length > 0) {
                const top = chordNotes.reduce((a, b) => (a.octave * 12 + a.pitchClass) >= (b.octave * 12 + b.pitchClass) ? a : b);
                // Update relative context to the FIRST note of the chord (LilyPond rule:
                // "the first note of the preceding chord is used as the reference point").
                // chordNotes[0] is the first note encountered in the chord (leftmost in source).
                const first = chordNotes[0];
                const firstBase = Object.entries(LY_DISPLAY).find(([, v]) => v === first.noteName)?.[0];
                if (firstBase) {
                    ctx.prevDiatonic = first.octave * 7 + (DIATONIC_STEP[firstBase[0]] ?? 0);
                    ctx.prevSemitones = first.octave * 12 + first.pitchClass;
                }
                const others = chordNotes.filter(n => n !== top).map(n => ({
                    noteName: n.noteName, octave: n.octave, pitchClass: n.pitchClass
                }));
                const chordNote = { ...top, duration: ctx.prevDuration };
                if (others.length > 0)
                    chordNote.chordNotes = others;
                if (pendingTieEnd) {
                    chordNote.tieEnd = true;
                    pendingTieEnd = false;
                }
                notes.push(chordNote);
            }
            continue;
        }
        // Commands
        if (t.kind === 'command') {
            cur.advance();
            const cmd = t.value;
            // \global — inline the global variable
            if (cmd === 'global' && vars.has('global')) {
                // global contains \key, \time, \tempo — no notes, just skip
                continue;
            }
            // \repeat volta N { body } [\alternative { { end1 } { end2 } ... }]
            if (cmd === 'repeat') {
                // consume 'volta'
                cur.skip('word', 'volta');
                cur.skipCommand('volta');
                // consume count (no longer used — we emit once, not N times)
                if (cur.is('number'))
                    cur.advance();
                // body
                cur.skip('open');
                const bodyCtxSave = { ...ctx };
                const body = parseMusicSeq(cur, ctx, vars);
                cur.skip('close');
                const bodyCtxAfter = { ...ctx };
                // \alternative { { end1 } { end2 } ... }
                // Also supports \volta numberlist { body } syntax (LilyPond 2.23+):
                //   \alternative { \volta 1,2,3 { ... } \volta 4 { ... } }
                let endings = [];
                const endingVoltaNumbers = [];
                if (cur.isCommand('alternative')) {
                    cur.advance();
                    cur.skip('open'); // outer {
                    while (cur.is('open') || cur.isCommand('volta')) {
                        let voltaNum = endings.length + 1; // default: sequential
                        if (cur.isCommand('volta')) {
                            cur.advance(); // consume \volta
                            // consume number list (e.g. "1,2,3" — commas are skipped by scanner, numbers are separate)
                            if (cur.is('number')) {
                                voltaNum = parseInt(cur.advance().value, 10);
                                while (cur.is('number'))
                                    cur.advance(); // skip remaining numbers in list
                            }
                        }
                        cur.skip('open'); // inner { (or { after \volta N)
                        const endCtx = { ...bodyCtxSave };
                        const end = parseMusicSeq(cur, endCtx, vars);
                        cur.skip('close');
                        endings.push(end);
                        endingVoltaNumbers.push(voltaNum);
                    }
                    cur.skip('close'); // outer }
                }
                // Emit body ONCE wrapped in repeat markers, then each volta ending with markers.
                notes.push({ noteName: '\x00repeatStart', octave: 0, pitchClass: -1, duration: 0, isRest: true });
                notes.push(...body);
                for (let ei = 0; ei < endings.length; ei++) {
                    const vn = endingVoltaNumbers[ei] ?? (ei + 1);
                    notes.push({ noteName: `\x00volta${vn}Start`, octave: 0, pitchClass: -1, duration: 0, isRest: true });
                    notes.push(...endings[ei]);
                    notes.push({ noteName: `\x00volta${vn}End`, octave: 0, pitchClass: -1, duration: 0, isRest: true });
                }
                notes.push({ noteName: '\x00repeatEnd', octave: 0, pitchClass: -1, duration: 0, isRest: true });
                Object.assign(ctx, bodyCtxAfter);
                continue;
            }
            // \tuplet N/M { body }  OR  \tuplet N/M dur { body }
            // The optional `dur` after N/M is a LilyPond sub-group duration hint; we skip it.
            if (cmd === 'tuplet') {
                const numTok = cur.is('number') ? cur.advance() : null;
                cur.skip('slash');
                const denTok = cur.is('number') ? cur.advance() : null;
                // Skip optional duration hint between ratio and '{', e.g. \tuplet 3/2 8 { ... }
                if (cur.is('number'))
                    cur.advance();
                const tupletN = numTok ? parseInt(numTok.value, 10) : 3;
                const tupletD = denTok ? parseInt(denTok.value, 10) : 2;
                const ratio = tupletD / tupletN;
                cur.skip('open');
                const tupNotes = parseMusicSeq(cur, ctx, vars);
                cur.skip('close');
                const total = tupNotes.length;
                notes.push(...tupNotes.map((n, idx) => ({
                    ...n,
                    duration: n.duration * ratio,
                    tuplet: { n: tupletN, denom: tupletD, total, idx },
                })));
                continue;
            }
            // Grace notes — parse and emit with isGrace flag.
            // Per LilyPond spec: the note *following* a grace resolves its pitch relative to the
            // last grace note, not the note before the grace. So we update ctx.prevDiatonic /
            // prevSemitones after parsing the grace group (but NOT prevDuration).
            // Handles both brace form (\grace { b16 c }) and single-note form (\grace b16)
            if (cmd === 'appoggiatura' || cmd === 'acciaccatura' || cmd === 'grace' || cmd === 'slashedGrace') {
                const graceCtx = { ...ctx };
                const graceNotes = [];
                if (cur.is('open')) {
                    cur.advance();
                    graceNotes.push(...parseMusicSeq(cur, graceCtx, vars));
                    cur.skip('close');
                }
                else if (cur.is('note')) {
                    // Single-note grace without braces, e.g. \grace b16 or \acciaccatura d''8
                    const noteTok = cur.advance();
                    const singleTokens = [noteTok, { kind: 'eof', value: '', pos: -1 }];
                    const singleCur = new TokenCursor(singleTokens);
                    graceNotes.push(...parseMusicSeq(singleCur, graceCtx, vars));
                }
                // Update main ctx pitch (not duration) so the following note resolves relative to
                // the last grace note's pitch
                ctx.prevDiatonic = graceCtx.prevDiatonic;
                ctx.prevSemitones = graceCtx.prevSemitones;
                // Emit grace notes: preserve original duration in graceDuration for flag rendering,
                // zero out duration so they don't affect measure length.
                // For acciaccatura/appoggiatura, the last grace note starts a slur to the main note.
                const gType = cmd;
                notes.push(...graceNotes.map(n => ({
                    ...n, isGrace: true, graceType: gType, graceDuration: n.duration, duration: 0,
                })));
                continue;
            }
            // \partial dur — emit a marker with the partial duration
            if (cmd === 'partial') {
                let durVal = 0;
                if (cur.is('number')) {
                    const numTok = cur.advance();
                    durVal = parseDuration(numTok.value, 1.0);
                }
                notes.push({ noteName: '\x00partial', octave: 0, pitchClass: -1, duration: durVal, isRest: true });
                continue;
            }
            // \set, \override, \revert, \once — skip to end of line/expression
            if (cmd === 'set' || cmd === 'override' || cmd === 'revert' || cmd === 'once') {
                // skip until next note or brace
                while (!cur.done && !cur.is('note') && !cur.is('rest') &&
                    !cur.is('open') && !cur.is('close') && !cur.is('chord_open')) {
                    cur.advance();
                }
                continue;
            }
            // \break, \pageBreak — emit a zero-duration marker note (extracted by parseLy)
            if (cmd === 'break' || cmd === 'pageBreak') {
                notes.push({ noteName: '\x00break', octave: 0, pitchClass: -1, duration: 0, isRest: true });
                continue;
            }
            // \mark \markup \box "text" — rehearsal mark (boxed letter above staff)
            // Syntax: \mark \markup \box "A"  OR  \mark "A"
            if (cmd === 'mark') {
                let markText = '';
                // Consume optional \markup and \box commands, then read the string
                while (cur.isCommand('markup') || cur.isCommand('box'))
                    cur.advance();
                if (cur.is('string'))
                    markText = cur.advance().value;
                if (markText) {
                    notes.push({ noteName: `\x00mark:${markText}`, octave: 0, pitchClass: -1, duration: 0, isRest: true });
                }
                continue;
            }
            // \noBreak, \compressMMRests — no-op
            // \bar "..." — emit a zero-duration marker for recognised types; skip unknown ones
            if (cmd === 'bar') {
                const barStr = cur.is('string') ? cur.advance().value : '';
                // Recognised types that change rendering: || = double barline
                if (barStr === '||') {
                    notes.push({ noteName: '\x00bar:||', octave: 0, pitchClass: -1, duration: 0, isRest: true });
                }
                // All other \bar types (|., |, !, etc.) are silently ignored for now
                continue;
            }
            // \tempo — parse text and/or BPM, emit \x00tempo: marker
            // Forms: \tempo "Allegro"  |  \tempo 4=120  |  \tempo "Allegro" 4=120
            if (cmd === 'tempo') {
                let text = '';
                let beatDur = 0;
                let bpm = 0;
                if (cur.is('string'))
                    text = cur.advance().value;
                if (cur.is('number')) {
                    beatDur = parseInt(cur.advance().value, 10);
                    cur.skip('equals');
                    if (cur.is('number'))
                        bpm = parseInt(cur.advance().value, 10);
                }
                // Remaining words/numbers (e.g. markup text) — skip
                while (!cur.done && (cur.is('word') || cur.is('number') || cur.is('slash')))
                    cur.advance();
                if (text || bpm) {
                    notes.push({ noteName: `\x00tempo:${text}|${beatDur}|${bpm}`,
                        octave: 0, pitchClass: -1, duration: 0, isRest: true });
                }
                continue;
            }
            // \key — skip the note-name and major/minor
            if (cmd === 'key') {
                cur.advance(); // note name (note token)
                cur.advance(); // \major or \minor
                continue;
            }
            // \time N/M — emit a marker so groupMeasures and the renderer can react to mid-piece changes
            if (cmd === 'time') {
                let n = '', d = '';
                if (cur.is('number'))
                    n = cur.advance().value;
                cur.skip('slash');
                if (cur.is('number'))
                    d = cur.advance().value;
                if (n && d) {
                    notes.push({ noteName: `\x00time:${n}/${d}`, octave: 0, pitchClass: -1, duration: 0, isRest: true });
                }
                continue;
            }
            // \new Staff/Voice/ChordNames/Lyrics — skip \new WORD and the body
            if (cmd === 'new' || cmd === 'context') {
                cur.skip('word'); // context type
                if (cur.is('open')) {
                    cur.advance();
                    const innerCtx = { ...ctx };
                    parseMusicSeq(cur, innerCtx, vars); // discard
                    cur.skip('close');
                }
                continue;
            }
            // \relative [startNote] { body } — inline relative block
            if (cmd === 'relative') {
                let startNote = '';
                if (cur.is('note')) {
                    const tok = cur.advance();
                    const p = tok.value.split('|');
                    startNote = (p[0] ?? '') + (p[1] ?? ''); // lyName + octStr
                }
                if (cur.is('open')) {
                    cur.advance();
                    const relCtx = parseStartNote(startNote, true);
                    notes.push(...parseMusicSeq(cur, relCtx, vars));
                    cur.skip('close');
                }
                continue;
            }
            // \transpose fromPitch toPitch \varname  OR  \transpose fromPitch toPitch { body }
            if (cmd === 'transpose') {
                // Token value is lyName|octStr|durStr|fingerStr — reconstruct pitch string for parseStartNote
                function tokPitch(v) {
                    const p = v.split('|');
                    return (p[0] ?? '') + (p[1] ?? '');
                }
                const fromTok = cur.is('note') ? cur.advance() : null;
                const toTok = cur.is('note') ? cur.advance() : null;
                const fromCtx = parseStartNote(tokPitch(fromTok?.value ?? 'c'), false);
                const toCtx = parseStartNote(tokPitch(toTok?.value ?? 'c'), false);
                const semitoneShift = toCtx.prevSemitones - fromCtx.prevSemitones;
                // Diatonic shift: how many letter steps the interval spans.
                // e.g. c→cs = 0 (same letter C), c→df = 1 (letter C to D), c→ef = 2 (C to E)
                const diatonicShift = toCtx.prevDiatonic - fromCtx.prevDiatonic;
                // Parse body: braced block or variable reference
                let bodyNotes = [];
                if (cur.is('open')) {
                    cur.advance();
                    bodyNotes = parseMusicSeq(cur, { ...ctx }, vars);
                    cur.skip('close');
                }
                else if (cur.peek().kind === 'command' && vars.has(cur.peek().value)) {
                    const varName = cur.advance().value;
                    const varDef = vars.get(varName);
                    const varTokens = new Scanner(varDef.body).tokenize();
                    const varCur = new TokenCursor(varTokens);
                    // Use variable's own relative context; non-relative vars get absolute mode
                    const varCtx = varDef.isRelative
                        ? parseStartNote(varDef.startNote, true)
                        : parseStartNote('', false);
                    bodyNotes = parseMusicSeq(varCur, varCtx, vars);
                }
                // Apply transposition — pure octave shift keeps noteName/pitchClass intact.
                // Non-octave shifts use enharmonicSpelling() to choose the correct spelling
                // based on the diatonic shift (augmented vs diminished interval quality).
                const octaveShift = semitoneShift / 12;
                const isPureOctave = Number.isInteger(octaveShift);
                notes.push(...bodyNotes.map(n => {
                    if (n.isRest || n.pitchClass < 0)
                        return n;
                    if (isPureOctave)
                        return { ...n, octave: n.octave + octaveShift };
                    const total = n.octave * 12 + n.pitchClass + semitoneShift;
                    const newOctave = Math.floor(total / 12);
                    const newPitchClass = total - newOctave * 12;
                    const origClass = DIATONIC_STEP[n.noteName[0].toLowerCase()] ?? 0;
                    const newClass = origClass + diatonicShift;
                    return { ...n, octave: newOctave, pitchClass: newPitchClass,
                        noteName: enharmonicSpelling(newPitchClass, newClass) };
                }));
                continue;
            }
            // Variable reference: \varname
            if (vars.has(cmd)) {
                const varDef = vars.get(cmd);
                const varTokens = new Scanner(varDef.body).tokenize();
                const varCur = new TokenCursor(varTokens);
                // Use the variable's own \relative context if it has one, so that
                // \melody always resolves at the pitch written in the variable definition
                // regardless of the calling context (e.g. inside \transpose).
                const varCtx = varDef.isRelative
                    ? parseStartNote(varDef.startNote, varDef.isRelative)
                    : { ...ctx };
                const varNotes = parseMusicSeq(varCur, varCtx, vars);
                notes.push(...varNotes);
                ctx.prevDiatonic = varCtx.prevDiatonic;
                ctx.prevSemitones = varCtx.prevSemitones;
                continue;
            }
            // Articulations and ornaments — attach to the most recently pushed note
            if (cmd === 'downbow' || cmd === 'upbow' || cmd === 'staccato' ||
                cmd === 'tenuto' || cmd === 'accent' || cmd === 'fermata' ||
                cmd === 'trill' || cmd === 'mordent' || cmd === 'turn' || cmd === 'prall') {
                if (notes.length > 0) {
                    const last = notes[notes.length - 1];
                    last.articulations = [...(last.articulations ?? []), cmd];
                }
                continue;
            }
            // All other commands — skip
            continue;
        }
        // Chord symbols: ^"Am" (above) or _"text" (below) — attach to last note
        if (t.kind === 'markup_above' || t.kind === 'markup_below') {
            cur.advance();
            if (cur.is('string') && notes.length > 0) {
                const symTok = cur.advance();
                const last = notes[notes.length - 1];
                last.chordSymbol = symTok.value;
                last.chordSymbolBelow = t.kind === 'markup_below';
            }
            continue;
        }
        // word tokens (major, minor, etc.) — skip
        if (t.kind === 'word' || t.kind === 'number' || t.kind === 'string' ||
            t.kind === 'equals' || t.kind === 'slash') {
            cur.advance();
            continue;
        }
        // Anything else — skip
        cur.advance();
    }
    return notes;
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Parse a LilyPond source string and return structured note data.
 * @param src  Full content of a .ly file
 */
export function parseLy(src) {
    const clean = stripComments(src);
    const key = extractKey(clean);
    const timeSig = extractTimeSig(clean);
    const title = extractTitle(clean);
    const composer = extractComposer(clean);
    const paper = extractPaper(clean);
    const vars = extractVariables(clean);
    // Find the melody variable
    const melodyName = findMelodyVarName(clean, vars);
    // Bare-block fallback: { c'4 d'4 ... } with no variable assignment or \score wrapper.
    // Scan for the first top-level { not preceded by a backslash command.
    if (!melodyName) {
        const bareBody = extractBareMusicBlock(clean);
        if (bareBody) {
            // Bare blocks use absolute mode — octave apostrophes are explicit.
            const ctx = parseStartNote('', false);
            const tokens = new Scanner(bareBody).tokenize();
            const cur = new TokenCursor(tokens);
            const raw = parseMusicSeq(cur, ctx, vars);
            return buildTune({ title, composer, key, timeSig, paper }, raw);
        }
        // Top-level \relative / \fixed fallback: tokenize the full source and let
        // parseMusicSeq's existing \relative handler (line ~1106) process it.
        // This avoids duplicating brace-counting or pitch logic here.
        const tokens = new Scanner(clean).tokenize();
        const cur = new TokenCursor(tokens);
        const ctx = parseStartNote('', false); // root absolute context; \relative sets its own
        const raw = parseMusicSeq(cur, ctx, vars);
        if (raw.length > 0)
            return buildTune({ title, composer, key, timeSig, paper }, raw);
        return { title, ...(composer ? { composer } : {}), key, timeSig, notes: [] };
    }
    const varDef = vars.get(melodyName);
    const ctx = parseStartNote(varDef.startNote, varDef.isRelative);
    // Use melody body directly — \global is handled at command level in parseMusicSeq
    // (key/time are extracted separately by extractKey/extractTimeSig on the full source)
    const melodyBody = varDef.body;
    const tokens = new Scanner(melodyBody).tokenize();
    const cur = new TokenCursor(tokens);
    const raw = parseMusicSeq(cur, ctx, vars);
    return buildTune({ title, composer, key, timeSig, paper }, raw);
}
// ── Bare music block extraction ───────────────────────────────────────────────
/**
 * Find the first top-level `{ ... }` block that is NOT immediately preceded by
 * a backslash command (e.g. \header, \score, \paper, \relative, etc.).
 * Returns the inner body string (between the braces), or null if none found.
 */
function extractBareMusicBlock(src) {
    let i = 0;
    const len = src.length;
    while (i < len) {
        if (src[i] === '{') {
            // Walk backwards past whitespace to see if a \command immediately precedes this {
            let j = i - 1;
            while (j >= 0 && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r'))
                j--;
            const precededByCommand = j >= 0 && (
            // ends with a letter (could be a command like \header, \score, etc.)
            (src[j] >= 'a' && src[j] <= 'z') || (src[j] >= 'A' && src[j] <= 'Z') ||
                // or ends with ' or , (start-note for \relative c'' {)
                src[j] === "'" || src[j] === ',');
            if (!precededByCommand) {
                // Found a bare {; extract its body
                const bodyStart = i + 1;
                let depth = 1;
                let k = bodyStart;
                while (k < len && depth > 0) {
                    if (src[k] === '{')
                        depth++;
                    else if (src[k] === '}')
                        depth--;
                    k++;
                }
                return src.slice(bodyStart, k - 1);
            }
        }
        i++;
    }
    return null;
}
/**
 * Convert a raw ParsedNote[] (direct output of parseMusicSeq) into a ParsedTune
 * by extracting zero-duration marker notes into their respective fields.
 * \x00time:N/M markers are kept in notes[] so groupMeasures and renderRow can use them.
 */
function buildTune(meta, raw) {
    const { title, composer, key, timeSig, paper } = meta;
    const notes = [];
    const systemBreaks = [];
    const repeatRegions = [];
    const voltaRegions = [];
    const rehearsalMarks = [];
    const tempoMarks = [];
    const pendingRepeatStarts = [];
    let pendingVolta = null;
    let partialDuration;
    for (const n of raw) {
        if (n.noteName === '\x00break') {
            systemBreaks.push(notes.length);
        }
        else if (n.noteName === '\x00partial') {
            partialDuration = n.duration;
        }
        else if (n.noteName.startsWith('\x00tempo:')) {
            const [text, beatDurStr, bpmStr] = n.noteName.slice(7).split('|');
            const bpm = parseInt(bpmStr ?? '', 10);
            const beatDuration = parseInt(beatDurStr ?? '', 10);
            tempoMarks.push({
                noteIndex: notes.length,
                ...(text ? { text } : {}),
                ...(bpm ? { bpm } : {}),
                ...(beatDuration ? { beatDuration } : {}),
            });
        }
        else if (n.noteName === '\x00repeatStart') {
            pendingRepeatStarts.push(notes.length);
        }
        else if (n.noteName === '\x00repeatEnd') {
            const start = pendingRepeatStarts.pop();
            if (start !== undefined)
                repeatRegions.push({ start, end: notes.length });
        }
        else if (n.noteName.startsWith('\x00volta') && n.noteName.endsWith('Start')) {
            const volta = parseInt(n.noteName.slice(6, -5), 10);
            if (pendingVolta)
                voltaRegions.push({ start: pendingVolta.start, end: notes.length, volta: pendingVolta.volta });
            pendingVolta = { start: notes.length, volta };
        }
        else if (n.noteName.startsWith('\x00volta') && n.noteName.endsWith('End')) {
            if (pendingVolta) {
                voltaRegions.push({ start: pendingVolta.start, end: notes.length, volta: pendingVolta.volta });
                pendingVolta = null;
            }
        }
        else if (n.noteName.startsWith('\x00mark:')) {
            rehearsalMarks.push({ noteIndex: notes.length, text: n.noteName.slice(6) });
        }
        else {
            // \x00time:N/M and \x00bar:|| are kept in notes[] so layout/renderer can react
            notes.push(n);
        }
    }
    if (pendingVolta)
        voltaRegions.push({ start: pendingVolta.start, end: notes.length, volta: pendingVolta.volta });
    return {
        ...(title ? { title } : {}),
        ...(composer ? { composer } : {}),
        key, timeSig, notes,
        ...(systemBreaks.length ? { systemBreaks } : {}),
        ...(repeatRegions.length ? { repeatRegions } : {}),
        ...(voltaRegions.length ? { voltaRegions } : {}),
        ...(partialDuration != null ? { partialDuration } : {}),
        ...(rehearsalMarks.length ? { rehearsalMarks } : {}),
        ...(tempoMarks.length ? { tempoMarks } : {}),
        ...(paper.raggedLast !== undefined ? { raggedLast: paper.raggedLast } : {}),
        ...(paper.indent !== undefined ? { firstIndent: paper.indent } : {}),
        ...(paper.font !== undefined ? { paperFont: paper.font } : {}),
    };
}
// ── Markup expression parser ─────────────────────────────────────────────────
/**
 * Parse a LilyPond \markup expression starting at `pos` (just after the '\markup' keyword).
 * Supports:
 *   \bold, \italic, \large / \larger
 *   \typewriter / \verbatim  → code flag (monospace block)
 *   \with-color "name"       → CSS color name from a quoted string
 *   \with-color #name        → bare Scheme color name (e.g. #red)
 *   \with-color #(...)       → Scheme expression (color ignored)
 *   Quoted text  "..."
 *   Bare word / phrase       (to end of line)
 *   Braced form  { modifiers "text" }
 */
function parseMarkupExpr(src, pos) {
    const len = src.length;
    let i = pos;
    function ws() {
        while (i < len && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r'))
            i++;
    }
    function ident() {
        const s = i;
        while (i < len && ((src[i] >= 'a' && src[i] <= 'z') || (src[i] >= 'A' && src[i] <= 'Z') || src[i] === '-'))
            i++;
        return src.slice(s, i);
    }
    function quoted() {
        i++; // skip opening "
        let t = '';
        while (i < len && src[i] !== '"') {
            if (src[i] === '\\' && i + 1 < len) {
                i++; // skip backslash
                const c = src[i];
                t += c === 'n' ? '\n' : c === 't' ? '\t' : c; // \\→\, \"→", \n→newline
            }
            else {
                t += src[i];
            }
            i++;
        }
        if (src[i] === '"')
            i++;
        return t;
    }
    function colorArg() {
        if (src[i] === '"')
            return quoted();
        if (src[i] === '#') {
            i++;
            if (src[i] === '(') {
                let d = 1;
                i++;
                while (i < len && d > 0) {
                    if (src[i] === '(')
                        d++;
                    else if (src[i] === ')')
                        d--;
                    i++;
                }
                return undefined; // Scheme expr — skip
            }
            const s = i;
            while (i < len && ((src[i] >= 'a' && src[i] <= 'z') || src[i] === '-'))
                i++;
            return src.slice(s, i) || undefined;
        }
        return undefined;
    }
    let bold = false;
    let italic = false;
    let large = false;
    let color;
    let code = false;
    function mods() {
        ws();
        while (i < len && src[i] === '\\') {
            i++;
            const m = ident();
            ws();
            if (m === 'bold')
                bold = true;
            else if (m === 'italic')
                italic = true;
            else if (m === 'large' || m === 'larger')
                large = true;
            else if (m === 'typewriter' || m === 'verbatim')
                code = true;
            else if (m === 'with-color') {
                color = colorArg();
                ws();
            }
            // Unknown modifier — keep reading (it may prefix the text)
        }
    }
    function result(text) {
        if (!text)
            return null;
        return { text, bold, italic, large, ...(color ? { color } : {}), code, end: i };
    }
    ws();
    // Parse content inside a { } block: \column { items }, single string, or bare phrase.
    // Returns the text string, advancing i past the closing }.
    function parseBracedContent() {
        ws();
        // \column / \left-column / \center-column / \right-column — multi-line
        if (src[i] === '\\') {
            const save = i;
            i++;
            const cmd = ident();
            ws();
            if ((cmd === 'column' || cmd === 'left-column' ||
                cmd === 'center-column' || cmd === 'right-column') && src[i] === '{') {
                i++; // skip opening {
                const lines = [];
                while (i < len && src[i] !== '}') {
                    ws();
                    if (i >= len || src[i] === '}')
                        break;
                    if (src[i] === '"') {
                        lines.push(quoted());
                    }
                    else {
                        // bare word/phrase — read to end of line or next quote/brace
                        const s = i;
                        while (i < len && src[i] !== '\n' && src[i] !== '"' && src[i] !== '}')
                            i++;
                        const word = src.slice(s, i).trim();
                        if (word)
                            lines.push(word);
                    }
                }
                if (src[i] === '}')
                    i++; // close \column {
                return lines.join('\n');
            }
            // Not a column command — restore and fall through
            i = save;
        }
        // Single quoted string
        if (src[i] === '"')
            return quoted();
        // Bare word/phrase to closing }
        const s = i;
        while (i < len && src[i] !== '}' && src[i] !== '\n')
            i++;
        return src.slice(s, i).trim();
    }
    // Braced form: \markup { [modifiers] content }
    // Modifiers may introduce another nested { } (e.g. \typewriter { \column { … } })
    if (src[i] === '{') {
        i++;
        mods();
        // After modifiers, another { means the modifier wraps a sub-block
        if (src[i] === '{') {
            i++;
            const text = parseBracedContent();
            ws();
            if (src[i] === '}')
                i++; // close inner {
            ws();
            if (src[i] === '}')
                i++; // close outer {
            return result(text);
        }
        // Direct content (no nested braces)
        const text = parseBracedContent();
        ws();
        if (src[i] === '}')
            i++;
        return result(text);
    }
    // Unbraced: [modifiers] "text"  |  [modifiers] bareword
    mods();
    if (src[i] === '"')
        return result(quoted());
    // Bare word/phrase to end of line (e.g. \markup \italic intenso)
    const s = i;
    while (i < len && src[i] !== '\n' && src[i] !== '%')
        i++;
    return result(src.slice(s, i).trim());
}
// ── Multi-score document parser ───────────────────────────────────────────────
/**
 * Parse a LilyPond source string that may contain multiple \score blocks and
 * top-level \markup headings, returning an ordered array of DocumentBlock items.
 *
 * Single-score files produce [{ type: 'score', tune }] — identical result to
 * wrapping parseLy() — so all existing callers can migrate without a diff.
 */
export function parseDocument(src) {
    const clean = stripComments(src);
    const key = extractKey(clean);
    const timeSig = extractTimeSig(clean);
    const title = extractTitle(clean);
    const composer = extractComposer(clean);
    const paper = extractPaper(clean);
    const vars = extractVariables(clean);
    const blocks = [];
    // Walk the cleaned source with a simple character scanner to find top-level
    // \markup and \score blocks in order.
    let i = 0;
    const len = clean.length;
    function skipWhitespace() {
        while (i < len && (clean[i] === ' ' || clean[i] === '\t' || clean[i] === '\n' || clean[i] === '\r'))
            i++;
    }
    // Find matching } starting just after the opening {
    function findMatchingClose(start) {
        let depth = 1;
        let j = start;
        while (j < len && depth > 0) {
            if (clean[j] === '{')
                depth++;
            else if (clean[j] === '}')
                depth--;
            j++;
        }
        return j; // points one past the closing }
    }
    // Track brace depth so \markup inside variable definitions (e.g. \mark \markup \box "A")
    // is not mistakenly emitted as a document-level heading block.
    let depth = 0;
    while (i < len) {
        skipWhitespace();
        if (i >= len)
            break;
        // Track brace depth: { increments, } decrements.
        // \score { } and \markup { } skip their contents via findMatchingClose / parseMarkupExpr
        // so those braces are never seen here — only variable-definition braces reach this path.
        if (clean[i] === '{') {
            depth++;
            i++;
            continue;
        }
        if (clean[i] === '}') {
            depth--;
            i++;
            continue;
        }
        if (clean[i] === '\\') {
            i++; // consume backslash
            // Read command name
            const nameStart = i;
            while (i < len && ((clean[i] >= 'a' && clean[i] <= 'z') || (clean[i] >= 'A' && clean[i] <= 'Z')))
                i++;
            const cmd = clean.slice(nameStart, i);
            if (cmd === 'markup' && depth === 0) {
                const parsed = parseMarkupExpr(clean, i);
                if (parsed) {
                    const { text, bold, italic, large, color, code, end } = parsed;
                    blocks.push({
                        type: 'markup', text,
                        ...(bold ? { bold } : {}),
                        ...(italic ? { italic } : {}),
                        ...(large ? { large } : {}),
                        ...(color ? { color } : {}),
                        ...(code ? { code } : {}),
                    });
                    i = end;
                }
                else {
                    while (i < len && clean[i] !== '\n')
                        i++; // skip unparseable markup line
                }
                continue;
            }
            if (cmd === 'score' && depth === 0) {
                skipWhitespace();
                if (i < len && clean[i] === '{') {
                    const bodyStart = i + 1;
                    const bodyEnd = findMatchingClose(bodyStart);
                    const scoreBody = clean.slice(bodyStart, bodyEnd - 1);
                    i = bodyEnd;
                    // Extract the content of \new Staff { … } so that wrappers like
                    // \transpose are processed by parseMusicSeq rather than bypassed.
                    function extractStaffBody(body) {
                        const toks = new Scanner(body).tokenize();
                        for (let ti = 0; ti < toks.length - 2; ti++) {
                            const t = toks[ti];
                            if (t.kind === 'command' && t.value === 'new') {
                                const nx = toks[ti + 1];
                                if (nx?.kind === 'word' && (nx.value === 'Staff' || nx.value === 'Voice')) {
                                    let tj = ti + 2;
                                    while (tj < toks.length && toks[tj].kind !== 'open')
                                        tj++;
                                    const openTok = toks[tj];
                                    if (openTok?.kind === 'open') {
                                        const start = openTok.pos + 1;
                                        let d = 1, k = start;
                                        while (k < body.length && d > 0) {
                                            if (body[k] === '{')
                                                d++;
                                            else if (body[k] === '}')
                                                d--;
                                            k++;
                                        }
                                        return body.slice(start, k - 1);
                                    }
                                }
                            }
                        }
                        return body;
                    }
                    // Parse the staff body through parseMusicSeq so \transpose and
                    // \relative wrappers are processed. Fall back to the whole scoreBody
                    // if no \new Staff block is found.
                    const staffBody = extractStaffBody(scoreBody);
                    // varName/varDef are only used for key/timeSig metadata.
                    const varName = findMelodyVarName(scoreBody, vars);
                    const varDef = varName ? vars.get(varName) : undefined;
                    // Extract \new ChordNames variable reference from scoreBody
                    function findChordNamesVarName(body) {
                        const toks = new Scanner(body).tokenize();
                        for (let ti = 0; ti < toks.length - 1; ti++) {
                            const t = toks[ti];
                            if (t.kind === 'command' && t.value === 'new') {
                                const nx = toks[ti + 1];
                                if (nx?.kind === 'word' && nx.value === 'ChordNames') {
                                    // Next token should be a \varname reference
                                    let tj = ti + 2;
                                    while (tj < toks.length && toks[tj].kind !== 'command' && toks[tj].kind !== 'open')
                                        tj++;
                                    const ref = toks[tj];
                                    if (ref?.kind === 'command' && vars.has(ref.value) && vars.get(ref.value)?.isChordMode) {
                                        return ref.value;
                                    }
                                    // Alternatively: \new ChordNames { \chordmode { ... } } inline
                                }
                            }
                        }
                        return undefined;
                    }
                    const chordVarName = findChordNamesVarName(scoreBody);
                    const chordVarDef = chordVarName ? vars.get(chordVarName) : undefined;
                    if (staffBody.trim()) {
                        // Absolute mode so inline absolute pitches (e.g. e'4) resolve correctly.
                        // Variables and \relative blocks override this via their own contexts.
                        const ctx = parseStartNote('', false);
                        const tokens = new Scanner(staffBody).tokenize();
                        const cur = new TokenCursor(tokens);
                        const raw = parseMusicSeq(cur, ctx, vars);
                        // Per-score key/timeSig — check variable body first, then scoreBody, then doc-level.
                        // extractKey always returns at least 'C', so we use a presence check instead.
                        const metaBody = (varDef?.body ?? '') + ' ' + scoreBody;
                        const hasKeyInScore = /\\key\b/.test(metaBody);
                        const hasTimeInScore = /\\time\b/.test(metaBody);
                        const scoreKey = hasKeyInScore ? extractKey(metaBody) : key;
                        const scoreTimeSig = hasTimeInScore ? extractTimeSig(metaBody) : timeSig;
                        // Title/composer only on first score block
                        const isFirst = blocks.filter(b => b.type === 'score').length === 0;
                        const tune = buildTune({
                            title: isFirst ? title : undefined,
                            composer: isFirst ? composer : undefined,
                            key: scoreKey,
                            timeSig: scoreTimeSig,
                            paper,
                        }, raw);
                        // Attach chord names if a \new ChordNames block was found
                        if (chordVarDef?.isChordMode) {
                            const chords = parseChordMode(chordVarDef.body, vars);
                            if (chords.length > 0)
                                tune.chordNames = chords;
                        }
                        blocks.push({ type: 'score', tune });
                    }
                }
                continue;
            }
            // Any other command — skip
            continue;
        }
        // Skip non-backslash characters (variable defs, \version, \language, etc.)
        i++;
    }
    // Fallback: if no \score blocks found (single-score files without explicit \score)
    if (blocks.filter(b => b.type === 'score').length === 0) {
        try {
            const tune = parseLy(src);
            if (tune.notes.length === 0 && src.trim().length > 0) {
                blocks.push({ type: 'error', message: 'No notes found. Wrap your music in a variable or \\relative block, e.g.: \\relative c\' { c d e f }' });
            }
            else {
                blocks.push({ type: 'score', tune });
            }
        }
        catch (e) {
            blocks.push({ type: 'error', message: e instanceof Error ? e.message : String(e) });
        }
    }
    return blocks;
}
