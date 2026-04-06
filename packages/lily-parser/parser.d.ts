/**
 * Recursive-descent LilyPond parser.
 * Extracts melody notes from \relative notation into ParsedNote[].
 */
import type { ParsedTune, DocumentBlock } from './types.js';
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
export declare function enharmonicSpelling(pitchClass: number, diatonicClass: number): string;
export declare function stripComments(src: string): string;
/** Extract \key X \major/minor → display string like 'D', 'Em', 'Bb' */
export declare function extractKey(src: string): string;
/** Extract \time N/M → string like '6/8' */
export declare function extractTimeSig(src: string): string;
/** Extract title from \header { title = "..." } */
export declare function extractTitle(src: string): string | undefined;
/** Extract composer from \header { composer = "..." } */
export declare function extractComposer(src: string): string | undefined;
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
export declare function extractPaper(src: string): {
    raggedLast?: boolean;
    indent?: number;
    font?: string;
};
interface VarDef {
    body: string;
    startNote: string;
    isRelative: boolean;
    isChordMode?: boolean;
}
/**
 * Extract all top-level variable definitions of the form:
 *   name = \relative startNote { body }
 *   name = { body }
 * Returns a Map from name → VarDef.
 */
export declare function extractVariables(src: string): Map<string, VarDef>;
/**
 * Find which variable is used in the first \new Staff { \varname } inside \score.
 * Falls back to a priority list of common names.
 */
export declare function findMelodyVarName(src: string, vars: Map<string, VarDef>): string | undefined;
/**
 * Parse a LilyPond duration string (e.g. "8", "4.", "2..", "") into
 * quarter-note units. Empty string → reuse prevDuration.
 */
export declare function parseDuration(durStr: string, prevDuration: number): number;
/**
 * Parse a \chordmode body string into ChordName[].
 * Handles: c1:maj  e:7  a:m7  d:maj7  g:7  f/a  etc.
 * Repeat/alternative regions are flattened in the same way as the melody.
 */
import type { ChordName } from './types.js';
export declare function parseChordMode(body: string, vars: Map<string, VarDef>, defaultDuration?: number): ChordName[];
/**
 * Parse a LilyPond source string and return structured note data.
 * @param src  Full content of a .ly file
 */
export declare function parseLy(src: string): ParsedTune;
/**
 * Parse a LilyPond source string that may contain multiple \score blocks and
 * top-level \markup headings, returning an ordered array of DocumentBlock items.
 *
 * Single-score files produce [{ type: 'score', tune }] — identical result to
 * wrapping parseLy() — so all existing callers can migrate without a diff.
 */
export declare function parseDocument(src: string): DocumentBlock[];
export {};
