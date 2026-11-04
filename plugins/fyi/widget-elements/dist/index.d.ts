import type { PluginElementsModule } from './types';
/** YYYY-MM-DD (or ISO) → dd-Mmm-yy (§1). Plain dates are not timezone-shifted. */
export declare function fmtDate(value: unknown): string;
/** Amount → A$1,234.56 / £1,234.56 (§2: symbol prefix, 2dp). */
export declare function fmtMoney(value: unknown, currency: unknown, fractionDigits?: number): string;
declare const elements: PluginElementsModule;
export default elements;
