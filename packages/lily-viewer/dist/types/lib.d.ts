import StaffViewComponent from './components/staff/StaffView';
export { default as StaffView } from './components/staff/StaffView';
export type { ParsedTune, ParsedNote, DocumentBlock } from 'lily-parser';
export { parseDocument } from 'lily-parser';
export interface RenderOptions {
    /** SMuFL music font — 'Bravura' (default) or 'Petaluma' */
    fontFamily?: 'Bravura' | 'Petaluma';
    /** 1-indexed inclusive measure range to render, e.g. [1, 4] */
    measureRange?: [number, number];
    /** Show title/composer header on the first score (default true) */
    showTitle?: boolean;
    /** SVG width — number = px, string = any CSS value e.g. '100%'. Default: 540px */
    width?: number | string;
}
/**
 * Render LilyPond source into a DOM element.
 *
 * @param element  CSS selector string or HTMLElement to render into
 * @param source   LilyPond source code
 * @param options  Optional rendering options
 *
 * @example
 * import lilyjs from 'lily-viewer'
 * import 'lily-viewer/style.css'
 *
 * lilyjs.renderLily('#score', `
 *   \\relative c' { c d e f | g a b c }
 * `)
 */
export declare function renderLily(element: HTMLElement | string, source: string, options?: RenderOptions): void;
declare const _default: {
    renderLily: typeof renderLily;
    StaffView: typeof StaffViewComponent;
};
export default _default;
