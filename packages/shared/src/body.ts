import { z } from 'zod';
import type { Profile } from './profile';

/**
 * Peso y medidas. Uno por día (si se anota dos veces el mismo día, se reemplaza).
 * Regla de tono: el peso sube y baja por agua, sal, hormonas o la hora; se mira la tendencia
 * de varias semanas, nunca un día suelto, y nunca se empuja a bajar más rápido.
 */

export const MEASURES = [
  { key: 'waistCm', label: 'Cintura' },
  { key: 'hipCm', label: 'Cadera' },
  { key: 'chestCm', label: 'Pecho' },
  { key: 'armCm', label: 'Brazo' },
  { key: 'thighCm', label: 'Muslo' },
] as const;
export type MeasureKey = (typeof MEASURES)[number]['key'];

const cm = z.number().min(10).max(250).nullable().default(null);

export const bodyEntrySchema = z
  .object({
    weightKg: z.number().min(30).max(300).nullable().default(null),
    waistCm: cm,
    hipCm: cm,
    chestCm: cm,
    armCm: cm,
    thighCm: cm,
    note: z.string().max(200).default(''),
  })
  .refine((e) => e.weightKg !== null || MEASURES.some((m) => e[m.key] !== null), { message: 'Anotá el peso o al menos una medida' });
export type BodyEntryInput = z.infer<typeof bodyEntrySchema>;
export type BodyEntry = BodyEntryInput & { date: string; updatedAt?: string };

const DAY_MS = 864e5;
const at = (date: string) => new Date(`${date}T12:00:00`).getTime();
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface MeasureChange {
  key: MeasureKey;
  label: string;
  first: { date: string; value: number };
  last: { date: string; value: number };
  /** cm (negativo = bajó) */
  change: number;
}

export interface BodyProgress {
  weights: { date: string; value: number }[];
  first?: { date: string; value: number };
  last?: { date: string; value: number };
  /** kg desde el primer registro */
  change?: number;
  /** kg por semana, según la tendencia de las últimas ~6 semanas (necesita al menos 3 pesos en 10 días o más) */
  perWeek?: number;
  line: string | null;
  /** Aviso amable cuando se baja muy rápido */
  care?: string;
  measures: MeasureChange[];
}

/** Pendiente (kg por día) de una recta por mínimos cuadrados. */
function slope(points: { t: number; v: number }[]): number {
  const n = points.length;
  const mt = points.reduce((s, p) => s + p.t, 0) / n;
  const mv = points.reduce((s, p) => s + p.v, 0) / n;
  const num = points.reduce((s, p) => s + (p.t - mt) * (p.v - mv), 0);
  const den = points.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  return den ? num / den : 0;
}

export function bodyProgress(profile: Profile, entries: BodyEntry[]): BodyProgress {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.filter((e) => e.weightKg !== null).map((e) => ({ date: e.date, value: e.weightKg! }));
  const first = weights[0];
  const last = weights.at(-1);
  const change = first && last && weights.length > 1 ? r1(last.value - first.value) : undefined;

  // Tendencia: últimas 6 semanas desde el último peso
  let perWeek: number | undefined;
  if (last) {
    const recent = weights.filter((w) => at(last.date) - at(w.date) <= 42 * DAY_MS);
    const span = recent.length ? (at(last.date) - at(recent[0]!.date)) / DAY_MS : 0;
    if (recent.length >= 3 && span >= 10) perWeek = r1(slope(recent.map((w) => ({ t: at(w.date) / DAY_MS, v: w.value }))) * 7);
  }

  const losing = profile.goal === 'reduccion-gradual-conservando-musculo';
  const gaining = profile.goal === 'ganar-masa-muscular';
  let line: string | null = null;
  let care: string | undefined;
  if (!last) {
    line = null;
  } else if (perWeek === undefined) {
    line =
      weights.length === 1
        ? 'Primer registro anotado 👌 Con unos cuantos más (una vez por semana alcanza) vas a ver la tendencia.'
        : 'Con un par de semanas más de registros vas a ver la tendencia. Mejor pesarse siempre a la misma hora, en ayunas.';
  } else {
    const pct = (Math.abs(perWeek) / last.value) * 100;
    const kg = `${Math.abs(perWeek).toLocaleString('es-AR')} kg por semana`;
    if (Math.abs(perWeek) < 0.1) {
      line = 'El peso viene estable estas semanas. Es normal que suba y baje unos días: lo que vale es la tendencia.';
    } else if (perWeek < 0) {
      line = losing ? `Vas bajando a ≈ ${kg} 👌` : `El peso viene bajando (≈ ${kg}).`;
      if (pct > 1)
        care =
          'Es un ritmo rápido: más despacio (hasta ~1 % de tu peso por semana) suele sostenerse mejor y cuidar el músculo. Si andás con poca energía o con mucha hambre, comé un poco más.';
    } else {
      line = gaining
        ? `Vas subiendo a ≈ ${kg} 👌`
        : `El peso subió un poco estas semanas (≈ ${kg}). Sin culpa: varía mucho por agua, sal o descanso. Lo importante es la tendencia de varias semanas.`;
    }
  }

  const measures: MeasureChange[] = [];
  for (const m of MEASURES) {
    const vals = sorted.filter((e) => e[m.key] !== null).map((e) => ({ date: e.date, value: e[m.key] as number }));
    if (vals.length < 2) continue;
    const f = vals[0]!;
    const l = vals.at(-1)!;
    measures.push({ key: m.key, label: m.label, first: f, last: l, change: r1(l.value - f.value) });
  }

  return { weights, first, last, change, perWeek, line, care, measures };
}
