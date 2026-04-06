export declare const SHARP_STEPS: number[];
export declare const FLAT_STEPS: number[];
export declare const SHARP_NAMES: string[];
export declare const FLAT_NAMES: string[];
export declare function keySigInfo(key: string): {
    type: 'sharp' | 'flat' | 'none';
    count: number;
};
export declare function buildKeyAccidentalSet(key: string): Set<string>;
