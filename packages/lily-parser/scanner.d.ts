/**
 * Character-level scanner for LilyPond source text.
 * No regex used for music token recognition — pure character inspection.
 */
export type TokenKind = 'note' | 'rest' | 'tie' | 'barcheck' | 'open' | 'close' | 'chord_open' | 'chord_close' | 'slur_open' | 'slur_close' | 'command' | 'string' | 'number' | 'slash' | 'equals' | 'word' | 'markup_above' | 'markup_below' | 'eof';
export interface Token {
    kind: TokenKind;
    value: string;
    pos: number;
}
export declare class Scanner {
    readonly src: string;
    pos: number;
    constructor(src: string);
    get done(): boolean;
    peek(offset?: number): string;
    advance(): string;
    skipWhitespace(): void;
    skipLineComment(): void;
    skipBlockComment(): void;
    readWhile(pred: (ch: string) => boolean): string;
    readQuotedString(): string;
    nextToken(): Token;
    tokenize(): Token[];
}
