import React from 'react';
import type { ChordName } from 'lily-parser';
import { StaffRowDef } from './layout';
export interface RowProps {
    row: StaffRowDef;
    yOffset: number;
    keySig: {
        type: 'sharp' | 'flat' | 'none';
        count: number;
    };
    timeSig: string;
    keySet: Set<string>;
    bravura: boolean;
    hasPickup: boolean;
    badMeasures: Set<number>;
    selectedRange?: [number, number];
    rehearsalMarks?: Map<number, string>;
    isLast?: boolean;
    raggedLast?: boolean;
    firstIndent?: number;
    fontFamily?: string;
    chordNames?: ChordName[];
    chordOffset?: number;
    tempoMarks?: Map<number, {
        text?: string;
        bpm?: number;
        beatDuration?: number;
    }>;
}
export declare function renderRow(props: RowProps): React.ReactNode[];
