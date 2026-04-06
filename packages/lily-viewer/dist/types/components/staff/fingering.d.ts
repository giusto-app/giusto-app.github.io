/**
 * SVG y coordinate for a fingering digit above or below a note.
 * Always placed outside the staff lines.
 */
export declare function fingeringY(ny: number, // notehead y in SVG coords (includes yOffset)
stemUp: boolean, fingeringBelow: boolean | undefined, topY: number, // top staff line y (STAFF_TOP + yOffset)
btmY: number): number;
