export interface ParsedNote {
    noteName: string;
    octave: number;
    pitchClass: number;
    duration: number;
    isRest: boolean;
    isGrace?: boolean;
    graceType?: 'grace' | 'acciaccatura' | 'appoggiatura' | 'slashedGrace';
    graceDuration?: number;
    slurStart?: boolean;
    slurEnd?: boolean;
    tieStart?: boolean;
    tieEnd?: boolean;
    articulations?: string[];
    fingering?: number;
    fingeringBelow?: boolean;
    tuplet?: {
        n: number;
        denom: number;
        total: number;
        idx: number;
    };
    chordSymbol?: string;
    chordSymbolBelow?: boolean;
    chordNotes?: Array<{
        noteName: string;
        octave: number;
        pitchClass: number;
    }>;
}
export type DocumentBlock = {
    type: 'score';
    tune: ParsedTune;
} | {
    type: 'markup';
    text: string;
    bold?: boolean;
    italic?: boolean;
    large?: boolean;
    color?: string;
    code?: boolean;
} | {
    type: 'error';
    message: string;
};
/** A chord name symbol from \chordmode, e.g. { name: "Cmaj7", duration: 4 } */
export interface ChordName {
    name: string;
    duration: number;
}
export interface ParsedTune {
    title?: string;
    composer?: string;
    key: string;
    timeSig: string;
    notes: ParsedNote[];
    chordNames?: ChordName[];
    systemBreaks?: number[];
    repeatRegions?: Array<{
        start: number;
        end: number;
    }>;
    voltaRegions?: Array<{
        start: number;
        end: number;
        volta: number;
    }>;
    partialDuration?: number;
    rehearsalMarks?: Array<{
        noteIndex: number;
        text: string;
    }>;
    tempoMarks?: Array<{
        noteIndex: number;
        text?: string;
        bpm?: number;
        beatDuration?: number;
    }>;
    raggedLast?: boolean;
    firstIndent?: number;
    paperFont?: string;
}
