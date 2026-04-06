/** True when `d` is a dotted duration (e.g. 1.5, 0.75, 3). */
export declare function isDotted(d: number): boolean;
export type NoteheadType = 'filled' | 'half' | 'whole';
export declare function noteheadType(d: number): NoteheadType;
export declare function restGlyph(d: number): string;
/** SMuFL flag glyph for a flagged note, or null if the note is not flagged. */
export declare function flagGlyph(d: number, up: boolean): string | null;
