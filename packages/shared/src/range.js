"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confidenceSchema = exports.rangeSchema = void 0;
exports.sumRanges = sumRanges;
exports.formatRange = formatRange;
const zod_1 = require("zod");
/** Toda estimación nutricional es un rango, nunca un número exacto. */
exports.rangeSchema = zod_1.z
    .object({ min: zod_1.z.number().nonnegative(), max: zod_1.z.number().nonnegative() })
    .refine((r) => r.max >= r.min, { message: 'max debe ser >= min' });
exports.confidenceSchema = zod_1.z.enum(['baja', 'media', 'alta']);
function sumRanges(ranges) {
    const valid = ranges.filter((r) => !!r);
    if (valid.length === 0)
        return undefined;
    return valid.reduce((acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }), { min: 0, max: 0 });
}
/** "420–560" o "≈ 450" si el rango es muy angosto. */
function formatRange(r, unit = '') {
    const u = unit ? ` ${unit}` : '';
    const min = Math.round(r.min);
    const max = Math.round(r.max);
    if (max - min <= Math.max(5, max * 0.05))
        return `≈ ${Math.round((min + max) / 2)}${u}`;
    return `${min}–${max}${u}`;
}
