import { z } from 'zod';

/** Toda estimación nutricional es un rango, nunca un número exacto. */
export const rangeSchema = z
  .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
  .refine((r) => r.max >= r.min, { message: 'max debe ser >= min' });
export type Range = z.infer<typeof rangeSchema>;

export const confidenceSchema = z.enum(['baja', 'media', 'alta']);
export type Confidence = z.infer<typeof confidenceSchema>;

export function sumRanges(ranges: (Range | undefined)[]): Range | undefined {
  const valid = ranges.filter((r): r is Range => !!r);
  if (valid.length === 0) return undefined;
  return valid.reduce((acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }), { min: 0, max: 0 });
}

/** "420–560" o "≈ 450" si el rango es muy angosto. */
export function formatRange(r: Range, unit = ''): string {
  const u = unit ? ` ${unit}` : '';
  const min = Math.round(r.min);
  const max = Math.round(r.max);
  if (max - min <= Math.max(5, max * 0.05)) return `≈ ${Math.round((min + max) / 2)}${u}`;
  return `${min}–${max}${u}`;
}
