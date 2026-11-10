import type { Range } from './range';
import type { Profile } from './profile';
import { estimateEnergy, mealTarget, type EnergyEstimate } from './energy';
import { estimateMealKcal, type DayMeal } from './feedback';

/**
 * Mirada semanal (lunes a domingo). La idea: muchos aflojan el finde y comen menos entre semana,
 * así que lo que importa es cómo cierra la semana, no cada día suelto.
 * Reglas para no empujar a restringir:
 * - Un día pasado sin nada anotado se cuenta como típico (no sabemos qué pasó).
 * - En un día con algo anotado, los momentos sin anotar también se cuentan como típicos.
 * - Nunca se sugiere comer por debajo del rango diario para "compensar".
 */

const ZERO: Range = { min: 0, max: 0 };
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });
const mid = (r: Range) => (r.min + r.max) / 2;
const round50 = (n: number) => Math.round(n / 50) * 50;
const DAY_MS = 864e5;

export interface WeekMeal extends DayMeal {
  date: string;
}

export interface WeekDay {
  date: string;
  /** 0 = lunes … 6 = domingo */
  index: number;
  kind: 'pasado' | 'hoy' | 'futuro';
  /** Lo del día: en días pasados incluye los momentos sin anotar como típicos; hoy, solo lo anotado. */
  kcal: Range | null;
  /** true = día pasado sin nada anotado (se cuenta como típico) */
  assumed: boolean;
  /** Momentos sin anotar que se contaron como típicos (en días pasados con algo anotado) */
  filled: number;
}

export interface WeekSummary {
  start: string;
  energy: EnergyEstimate;
  days: WeekDay[];
  /** Rango de la semana: 7 × el rango diario */
  target: Range;
  /** Lo de los días pasados + lo anotado hoy */
  soFar: Range;
  /**
   * Margen hasta ayer (kcal): lo sugerido para los días pasados menos lo comido.
   * Positivo = la semana viene por debajo (hay margen); negativo = viene por encima.
   */
  bank: number;
  /**
   * Cuánto de más puede tener un día sin que la miradita lo marque, gracias al margen de la semana.
   * Es el margen, pero con tope de medio día: la semana flexible no es vía libre.
   */
  flex: number;
  /** Días que quedan, contando hoy */
  daysLeft: number;
  /** Lo que queda de la semana dividido por los días que quedan */
  perDayLeft: Range | null;
  level: 'arranca' | 'margen' | 'en-linea' | 'arriba';
  line: string;
  /** Nota extra cuando entre semana se viene comiendo bastante por debajo */
  care?: string;
  /** Días pasados con algo anotado (los que sirven para sacar conclusiones) */
  loggedDays: number;
}

/** Fecha local "YYYY-MM-DD" (sin depender de la zona horaria del servidor). */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atNoon = (date: string) => new Date(`${date}T12:00:00`);

/** Lunes de la semana de esa fecha. */
export function weekStart(date: string): string {
  const d = atNoon(date);
  const back = (d.getDay() + 6) % 7;
  return iso(new Date(d.getTime() - back * DAY_MS));
}

export function addDays(date: string, n: number): string {
  return iso(new Date(atNoon(date).getTime() + n * DAY_MS));
}

/** Total de un día ya terminado: lo anotado + los momentos sin anotar como típicos. */
export function completedDayKcal(
  profile: Profile,
  energy: EnergyEstimate,
  meals: DayMeal[],
): { kcal: Range; assumed: boolean; filled: number } {
  if (!meals.length) return { kcal: energy.kcal, assumed: true, filled: 0 };
  const logged = meals.reduce((acc, m) => add(acc, estimateMealKcal(profile, energy, m)), ZERO);
  const missing = profile.mealSlots.filter((s) => !meals.some((m) => m.slotKey === s.key));
  const kcal = missing.reduce((acc, s) => add(acc, mealTarget(profile, s.key, energy).kcal), logged);
  return { kcal, assumed: false, filled: missing.length };
}

/**
 * Cómo viene la semana de `today` (los días anteriores a `today` cuentan como terminados).
 * Sirve también para un día pasado: se mira su semana "como si fuera ese día".
 */
export function weekSummary(profile: Profile, meals: WeekMeal[], today: string, numbers = true): WeekSummary | null {
  const energy = estimateEnergy(profile);
  if (!energy) return null;
  const start = weekStart(today);
  const byDate = new Map<string, WeekMeal[]>();
  for (const m of meals) if (m.date >= start && m.date <= addDays(start, 6)) (byDate.get(m.date) ?? byDate.set(m.date, []).get(m.date)!).push(m);

  const daily = mid(energy.kcal);
  const days: WeekDay[] = [];
  let soFar = ZERO;
  let bank = 0;
  let loggedDays = 0;
  let loggedSum = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const dayMeals = byDate.get(date) ?? [];
    if (date < today) {
      const d = completedDayKcal(profile, energy, dayMeals);
      soFar = add(soFar, d.kcal);
      bank += daily - mid(d.kcal);
      if (!d.assumed) {
        loggedDays++;
        loggedSum += mid(d.kcal);
      }
      days.push({ date, index: i, kind: 'pasado', kcal: d.kcal, assumed: d.assumed, filled: d.filled });
    } else if (date === today) {
      const k = dayMeals.length ? dayMeals.reduce((acc, m) => add(acc, estimateMealKcal(profile, energy, m)), ZERO) : null;
      if (k) soFar = add(soFar, k);
      days.push({ date, index: i, kind: 'hoy', kcal: k, assumed: false, filled: 0 });
    } else {
      days.push({ date, index: i, kind: 'futuro', kcal: null, assumed: false, filled: 0 });
    }
  }

  const target = { min: energy.kcal.min * 7, max: energy.kcal.max * 7 };
  const daysLeft = days.filter((d) => d.kind !== 'pasado').length;
  const perDayLeft = daysLeft
    ? { min: round50(Math.max(0, target.min - soFar.max) / daysLeft), max: round50(Math.max(0, target.max - soFar.min) / daysLeft) }
    : null;

  const tolerance = daily * 0.15;
  const flex = Math.max(0, Math.min(bank, daily * 0.5));
  const level: WeekSummary['level'] = loggedDays === 0 ? 'arranca' : bank > tolerance ? 'margen' : bank < -tolerance ? 'arriba' : 'en-linea';
  const n = (k: number) => `${round50(Math.abs(k)).toLocaleString('es-AR')} kcal`;

  let line: string;
  if (level === 'arranca') {
    line = 'Acá vas a ver cómo viene la semana en total, no solo cada día: lo que importa es cómo cierra.';
  } else if (level === 'margen') {
    line = `La semana viene con margen${numbers ? ` (≈ ${n(bank)} por debajo de lo sugerido hasta ayer)` : ''}. Si el finde se afloja un poco, entra.`;
  } else if (level === 'arriba') {
    line = `La semana viene un poco por encima${numbers ? ` (≈ ${n(bank)} más de lo sugerido hasta ayer)` : ''}. Sin culpa: con volver a tu rango de siempre alcanza, no hace falta compensar.`;
  } else {
    line = 'La semana viene pareja con lo sugerido 👌';
  }
  // Lo que queda por día: solo si no implica comer por debajo del rango diario ni invita a comer de más.
  if (
    numbers &&
    perDayLeft &&
    level !== 'arranca' &&
    daysLeft > 1 &&
    perDayLeft.min >= energy.kcal.min &&
    perDayLeft.max <= energy.kcal.max * 1.3
  ) {
    line += ` Para lo que queda: ≈ ${perDayLeft.min.toLocaleString('es-AR')}–${perDayLeft.max.toLocaleString('es-AR')} kcal por día.`;
  }
  const care =
    loggedDays >= 2 && loggedSum / loggedDays < energy.kcal.min * 0.8
      ? 'Ojo: estos días venís comiendo bastante por debajo de tu rango. Comer muy poco entre semana suele dar más hambre el finde; mejor parejo.'
      : undefined;

  return { start, energy, days, target, soFar, bank, flex, daysLeft, perDayLeft, level, line, care, loggedDays };
}

export interface WeekPattern {
  /** Promedio por día de lunes a viernes (días con algo anotado) */
  weekday: Range | null;
  /** Promedio por día de sábado y domingo (días con algo anotado) */
  weekend: Range | null;
  weekdayDays: number;
  weekendDays: number;
  /** Cuánto más (o menos) se come el finde, en % respecto de entre semana */
  weekendDiffPct: number | null;
  line: string | null;
}

/** Cómo se come entre semana vs. el finde, mirando los días terminados de las últimas `weeks` semanas. */
export function weekPattern(profile: Profile, meals: WeekMeal[], today: string, weeks = 4): WeekPattern | null {
  const energy = estimateEnergy(profile);
  if (!energy) return null;
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const byDate = new Map<string, WeekMeal[]>();
  for (const m of meals) if (m.date >= from && m.date < today) (byDate.get(m.date) ?? byDate.set(m.date, []).get(m.date)!).push(m);

  let wd = ZERO;
  let we = ZERO;
  let wdN = 0;
  let weN = 0;
  for (const [date, dayMeals] of byDate) {
    const k = completedDayKcal(profile, energy, dayMeals).kcal;
    const isWeekend = [0, 6].includes(atNoon(date).getDay());
    if (isWeekend) {
      we = add(we, k);
      weN++;
    } else {
      wd = add(wd, k);
      wdN++;
    }
  }
  const avg = (r: Range, n: number) => (n ? { min: round50(r.min / n), max: round50(r.max / n) } : null);
  const weekday = avg(wd, wdN);
  const weekend = avg(we, weN);
  const weekendDiffPct = weekday && weekend ? Math.round((mid(weekend) / mid(weekday) - 1) * 100) : null;

  let line: string | null = null;
  if (weekendDiffPct !== null && wdN >= 3 && weN >= 2) {
    line =
      weekendDiffPct >= 20
        ? `El finde comés ≈ ${weekendDiffPct} % más que entre semana. Es normal aflojar: lo que importa es cómo cierra la semana.`
        : weekendDiffPct <= -20
          ? `El finde comés ≈ ${-weekendDiffPct} % menos que entre semana.`
          : 'Entre semana y el finde comés parecido 👌';
  }
  return { weekday, weekend, weekdayDays: wdN, weekendDays: weN, weekendDiffPct, line };
}
