import type { ParsedNote } from 'lily-parser';
export declare function barLengthQN(timeSig: string): number;
export declare function groupMeasures(notes: ParsedNote[], timeSig: string, partialDuration?: number): ParsedNote[][];
/**
 * Horizontal space for a single note given the shortest duration in the measure.
 * Gould p.39 / LilyPond spacing-increment rule:
 *   shortest note → NOTE_MIN_W (minimum space)
 *   each doubling of duration adds SPACING_INCREMENT (≈ 1 notehead width)
 * Formula: NOTE_MIN_W + SPACING_INCREMENT × log₂(dur / shortestDur)
 */
export declare function noteSpaceW(dur: number, shortestDur: number): number;
/**
 * Natural width of a measure given an explicit shortest duration reference.
 * Used in renderRow where the row-wide shortest is known (LilyPond common-shortest-duration).
 */
export declare function measureWidthWithShortest(m: ParsedNote[], shortestDur: number): number;
export declare function measureWidth(m: ParsedNote[]): number;
export declare function headerWidth(keySigCount: number, showTimeSig: boolean): number;
export interface StaffRowDef {
    measures: ParsedNote[][];
    isFirst: boolean;
    measureOffset: number;
    noteOffset: number;
    repeatStartBefore: Set<number>;
    repeatEndAfter: Set<number>;
    voltaAt: Map<number, number>;
}
export declare function buildRows(measures: ParsedNote[][], key: string, systemBreaks?: number[], repeatRegions?: Array<{
    start: number;
    end: number;
}>, voltaRegions?: Array<{
    start: number;
    end: number;
    volta: number;
}>, firstIndent?: number): StaffRowDef[];
