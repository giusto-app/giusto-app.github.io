export type AccState = 'sharp' | 'flat' | 'natural';
/**
 * Returns the SMuFL accidental symbol to print before this note, or null if none needed.
 * Updates `measureAcc` as a side-effect (call once per note, in score order).
 * Key = letter+octave (e.g. "F4") — accidentals are tracked independently per octave.
 */
export declare function resolveAccidental(noteName: string, octave: number, keySet: Set<string>, measureAcc: Map<string, AccState>): string | null;
