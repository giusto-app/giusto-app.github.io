/**
 * Adjust a control-height parameter so the arc peak clears all supplied staff
 * lines by at least STAFF_LINE_CLEARANCE.
 *
 * Visual peak y = midY + ctrlH × peakFactor × dir, where:
 *   - Cubic tie:  peakFactor = 0.75  (both ctrl-pts at ctrlH → peak = 0.75 × ctrlH)
 *   - Slur:       peakFactor = 1.5   (cpInner = 2×arcH → peak = 1.5 × arcH)
 *
 * A staff line is "in the arc's sweep" when it lies between the nearest
 * endpoint (in the arc direction) and the current peak.  When that happens,
 * the returned ctrlH is increased so the peak moves past the staff line plus
 * STAFF_LINE_CLEARANCE.  If no line is in the sweep, ctrlH is returned as-is.
 *
 * @param midY        (sy1+sy2)/2 — y midpoint of the arc endpoints.
 * @param ctrlH       Current control parameter (ctrlH for ties, arcH for slurs).
 * @param dir         +1 = arc goes downward (below notes); −1 = upward (above notes).
 * @param sy1         First arc endpoint y.
 * @param sy2         Second arc endpoint y.
 * @param staffLineYs Absolute y-coordinates of the staff lines to check.
 * @param peakFactor  0.75 for cubic ties; 1.5 for slurs.
 * @returns Adjusted ctrlH (always ≥ input ctrlH).
 */
export declare function clearStaffLines(midY: number, ctrlH: number, dir: number, sy1: number, sy2: number, staffLineYs: number[], peakFactor: number): number;
export interface SlurGeomResult {
    dir: number;
    sy1: number;
    sy2: number;
    span: number;
    arcH: number;
    thick: number;
    midY: number;
    cpX: number;
    cpInner: number;
    cpOuter: number;
    y1: number;
    y2: number;
}
/**
 * Compute slur arc geometry from two absolute note y-coordinates and their x positions.
 *
 * Direction rule: slur below (+1) when the average of both note y-coordinates is at or
 * below the middle staff line; above (-1) when the average is above the middle line.
 * This matches renderRow.tsx exactly.
 *
 * @param x1       Start note centre x.
 * @param y1       Start note centre y (absolute, including yOffset).
 * @param x2       End note centre x.
 * @param y2       End note centre y (absolute, including yOffset).
 * @param middleY  Middle staff line y = stepY(4) + yOffset.
 */
export declare function computeSlurGeometry(x1: number, y1: number, x2: number, y2: number, middleY: number, staffLineYs?: number[]): SlurGeomResult;
export interface TieGeomResult {
    dir: number;
    sy1: number;
    sy2: number;
    span: number;
    arcH: number;
    thick: number;
    midY: number;
    cpX1: number;
    cpX2: number;
    cpInner: number;
    cpOuter: number;
}
/**
 * Compute tie arc geometry.
 *
 * Arc direction is based on NOTE PITCH vs the middle staff line (Gould p.66):
 * notes at or above the middle line → tie above (tieUp=true); below → tie below.
 * This is independent of stem direction, which can be forced by beaming.
 *
 * Endpoint offset size is based on STEM direction (LilyPond SVG analysis):
 *   stemDown=true  → 0.726ss (endpoint near staff line above/below note)
 *   stemDown=false → 0.239ss (endpoint just outside the notehead)
 *
 * @param startNoteY  Start note centre y (absolute).
 * @param endNoteY    End note centre y (absolute).
 * @param x1          Right edge of start notehead (startNoteX + NH_RX).
 * @param x2          Left edge of end notehead (endNoteX − NH_RX).
 * @param tieUp       true = arc above; false = arc below. Set by note pitch vs middleY.
 * @param stemDown    true = start note has stem down → use 0.726ss endpoint offset.
 */
export declare function computeTieGeometry(startNoteY: number, endNoteY: number, x1: number, x2: number, tieUp: boolean, stemDown: boolean, staffLineYs?: number[]): TieGeomResult;
