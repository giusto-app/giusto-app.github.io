/** Diatonic step number relative to E4 (step 0 = bottom staff line in treble clef). */
export declare function noteStep(noteName: string, octave: number): number;
/** SVG y coordinate for a given diatonic step (higher step = higher on screen = lower y). */
export declare function stepY(step: number): number;
/** Steps that require a ledger line for a given note step. */
export declare function ledgerLines(step: number): number[];
