import type { ParsedTune } from 'lily-parser';
interface StaffViewProps {
    tune: ParsedTune;
    showTitle?: boolean;
    selectedRange?: [number, number];
    fontFamily?: string;
    measureRange?: [number, number];
    width?: number | string;
}
export default function StaffView({ tune, showTitle, selectedRange, fontFamily, measureRange, width }: StaffViewProps): import("react/jsx-runtime").JSX.Element;
export {};
