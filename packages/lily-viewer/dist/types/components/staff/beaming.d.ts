import type { ParsedNote } from 'lily-parser';
/**
 * Center-to-center step between consecutive beams (px).
 * Rule: beam thickness (0.5ss) + edge-to-edge gap (0.25ss) = 0.75ss.
 */
export declare function beamStep(): number;
/**
 * y-offset of beam level k's inner edge from the primary beam inner edge.
 * Level 0 = primary (8th), level 1 = secondary (16th), level 2 = tertiary (32nd).
 * For stem-up (bDir=1) higher levels move up (smaller y); stem-down (bDir=-1) downward.
 */
export declare function beamLevelOY(level: number, bDir: number): number;
/**
 * Number of beams a note with the given duration should carry.
 * 8th→1, 16th→2, 32nd→3, 64th→4.
 */
export declare function numBeams(duration: number): number;
/**
 * A note qualifies for beam level k if its duration ≤ this threshold.
 * level 0 → 0.5 (8th), level 1 → 0.25 (16th), level 2 → 0.125 (32nd).
 */
export declare function beamLevelThreshold(level: number): number;
/** Quarter-note length of one beat in the given time signature. */
export declare function beatLengthQN(timeSig: string): number;
export interface BeamGroup {
    indices: number[];
}
/**
 * Group note indices into beam groups based on beat boundaries.
 * Notes shorter than a quarter (duration < 1.0) are candidates for beaming.
 * Tuplet notes are kept together even when they cross a beat boundary.
 */
export declare function findBeamGroups(notes: ParsedNote[], timeSig: string): BeamGroup[];
