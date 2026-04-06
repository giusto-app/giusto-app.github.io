export interface BeamGeomResult {
    bY1: number;
    bY2: number;
    bx1: number;
    bx2: number;
    xRange: number;
    stemUp: boolean;
    bDir: number;
    sxOff: number;
    BEAM_TOP: number;
}
/**
 * Compute primary beam geometry for a beam group.
 * Steps 1–3: stem direction, slope cap (1 ss), deficit shift.
 *
 * @param noteSteps  Diatonic steps for each note in the group (0-indexed within the group).
 * @param noteXs     Notehead-centre x for each note (same length as noteSteps).
 * @param yOffset    Row y offset (default 0).
 */
export declare function computeBeamGeometry(noteSteps: number[], noteXs: number[], yOffset?: number): BeamGeomResult;
export interface GraceBeamGeomResult {
    bY1: number;
    bY2: number;
    bx1: number;
    bx2: number;
    GBEAM_TOP: number;
}
/**
 * Compute grace note beam geometry.
 * Always stem-up; slope capped at 0.5 ss (Gould p.126); deficit shift ensures GRACE_STEM_H minimum.
 *
 * @param noteSteps  Diatonic steps for each grace note in the group.
 * @param noteXs     Absolute x positions (notehead centre + graceXOffset) for each note.
 * @param yOffset    Row y offset (default 0).
 */
export declare function computeGraceBeamGeometry(noteSteps: number[], noteXs: number[], yOffset?: number): GraceBeamGeomResult;
/**
 * Y position for an articulation mark (downbow, upbow, fermata).
 * Clears the stem tip or beam outer edge by ART_CLEAR; also clears topY - 10 (top margin).
 *
 * @param stemTipY  Outer edge of stem or beam at this note's x position.
 * @param topY      Top staff line y for this row.
 */
export declare function computeArticulationY(stemTipY: number, topY: number): number;
