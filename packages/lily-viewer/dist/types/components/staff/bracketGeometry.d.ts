export interface TupletBracketGeomResult {
    stemUp: boolean;
    sxOff: number;
    stemX1: number;
    stemX2: number;
    tx1: number;
    tx2: number;
    midX: number;
    byFlat: number;
    hookEnd: number;
    leftArmEnd: number;
    rightArmStart: number;
}
/**
 * Compute tuplet bracket geometry for an unbeamed tuplet group.
 *
 * Matches renderRow.tsx §19 exactly: stem direction by furthest-from-middle note,
 * bracket span flanks stem x positions by TUP_OUTSET, horizontal bar clears all stem
 * tips by TUP_TGAP, hook length is fixed TUP_HOOK_LEN (equal on both sides).
 *
 * @param noteSteps    Diatonic step for each note in the group (0-indexed).
 * @param noteXs       Notehead-centre x for each note.
 * @param graceXOffsets Per-note grace x offsets (defaults to all zeros).
 * @param yOffset      Row y offset (default 0).
 */
export declare function computeTupletBracket(noteSteps: number[], noteXs: number[], graceXOffsets?: number[], yOffset?: number): TupletBracketGeomResult;
