import type { Range } from './range';
import { sumRanges } from './range';
import type { MealItem } from './meal';
import type { Profile } from './profile';
import { estimateEnergy, mealTarget, type EnergyEstimate } from './energy';

/**
 * "Miradita de Cachete": devolución suave de una comida o del día.
 * Marca cuando algo vino más generoso o más liviano, mirando el día entero y no solo la comida, pero:
 * - nunca dice "mal", "te pasaste", "exceso" ni pide compensar;
 * - las sugerencias siempre son para sumar o para la próxima, nunca para restringir;
 * - si quedó por debajo, invita a comer más si hay hambre (nunca a comer menos).
 */
export type FeedbackLevel = 'dentro' | 'generosa' | 'liviana' | 'sin-datos';

export interface MealFeedback {
  level: FeedbackLevel;
  kcal?: Range;
  protein?: Range;
  target?: { kcal: Range; protein: Range };
  /** Cómo viene el día hasta esta comida (si hay datos para calcularlo) */
  day?: DayContext;
  /** Frase principal, amable */
  headline: string;
  /** Hasta 2 sugerencias para sumar */
  suggestions: string[];
  groups: string[];
}

const mid = (r: Range) => (r.min + r.max) / 2;
const round10 = (n: number) => Math.round(n / 10) * 10;
const round50 = (n: number) => Math.round(n / 50) * 50;
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });
const ZERO: Range = { min: 0, max: 0 };

/** Lo mínimo de una comida del mismo día que hace falta para mirar el acumulado. */
export interface DayMeal {
  slotKey: string;
  time?: string;
  items: MealItem[];
}

/**
 * Cómo viene el día hasta esta comida (incluyéndola).
 * - soFar: lo comido en las comidas anteriores + esta. Si una comida anotada no tiene cantidades, o un momento
 *   anterior no tiene nada anotado, se cuenta como uno típico (no sabemos, así que no asumimos ni de más ni de menos).
 * - expected: lo esperable a esta altura según el reparto del día (desayuno + almuerzo + … hasta esta).
 * - remaining: lo que queda del rango diario después de esta comida (nunca negativo).
 */
export interface DayContext {
  soFar: Range;
  expected: Range;
  day: Range;
  remaining: Range;
  /** 'adelante' = el día ya viene más cargado de lo esperable a esta altura; 'atras' = viene más liviano */
  balance: 'atras' | 'en-linea' | 'adelante';
  /** Cuántas comidas anteriores anotadas se tuvieron en cuenta */
  counted: number;
  /** Momentos anteriores sin nada anotado (se cuentan como típicos: no sabemos si se saltearon o se olvidaron) */
  assumed: number;
}

const toMin = (t?: string) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);

/** Momentos del día ordenados por hora (por si el perfil no los tiene en orden). */
function orderedSlots(profile: Profile) {
  return profile.mealSlots
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => (toMin(a.time) ?? a.i * 240) - (toMin(b.time) ?? b.i * 240));
}

/** ¿Esta otra comida del día fue antes (o en el mismo momento) que la que se está mirando? */
function cameBefore(profile: Profile, order: string[], other: DayMeal, slotKey: string, time?: string): boolean {
  const mine = order.indexOf(slotKey);
  const theirs = order.indexOf(other.slotKey);
  if (mine >= 0 && theirs >= 0) return theirs <= mine;
  // Una de las dos es "extra" (fuera de los momentos del perfil): se decide por la hora.
  const myTime = toMin(time) ?? toMin(profile.mealSlots.find((s) => s.key === slotKey)?.time);
  const theirTime = toMin(other.time) ?? toMin(profile.mealSlots.find((s) => s.key === other.slotKey)?.time);
  if (myTime === null || theirTime === null) return true;
  return theirTime <= myTime;
}

/** Calorías de una comida anotada; si no tiene cantidades, las de una comida típica de ese momento. */
export function estimateMealKcal(profile: Profile, energy: EnergyEstimate, m: DayMeal): Range {
  const k = sumRanges(m.items.map((i) => i.kcal));
  if (k) return k;
  return profile.mealSlots.some((s) => s.key === m.slotKey) ? mealTarget(profile, m.slotKey, energy).kcal : ZERO;
}

/** "la merienda", "el almuerzo"… (para frases como "para la merienda"). */
function withArticle(label: string): string {
  return `${/(a|ción|ión)$/.test(label) ? 'la' : 'el'} ${label}`;
}

export function dayContext(
  profile: Profile,
  energy: EnergyEstimate,
  slotKey: string,
  thisKcal: Range,
  others: DayMeal[],
  time?: string,
): DayContext {
  const slots = orderedSlots(profile);
  const order = slots.map((s) => s.key);
  const before = others.filter((m) => cameBefore(profile, order, m, slotKey, time));
  // Lo esperable hasta acá: los momentos hasta este inclusive. Un "extra" suma lo de los momentos que ya pasaron por hora.
  const idx = order.indexOf(slotKey);
  const myTime = toMin(time) ?? toMin(profile.mealSlots.find((s) => s.key === slotKey)?.time);
  const upTo = idx >= 0 ? slots.slice(0, idx + 1) : slots.filter((s) => myTime === null || (toMin(s.time) ?? 0) <= myTime);
  const expected = upTo.reduce((acc, s) => add(acc, mealTarget(profile, s.key, energy).kcal), ZERO);

  const missing = upTo.filter((s) => s.key !== slotKey && !before.some((m) => m.slotKey === s.key));
  const soFar = [
    ...before.map((m) => estimateMealKcal(profile, energy, m)),
    ...missing.map((s) => mealTarget(profile, s.key, energy).kcal),
  ].reduce(add, thisKcal);

  const s = mid(soFar);
  const balance = s > expected.max * 1.1 ? 'adelante' : s < expected.min * 0.8 ? 'atras' : 'en-linea';
  const remaining = { min: Math.max(0, energy.kcal.min - soFar.max), max: Math.max(0, energy.kcal.max - soFar.min) };
  return { soFar, expected, day: energy.kcal, remaining, balance, counted: before.length, assumed: missing.length };
}

/**
 * "Miradita" de una comida. Antes de opinar se fija cuánto va acumulado en el día:
 * una merienda más cargada después de un almuerzo liviano no es "generosa", el día viene equilibrado.
 * numbers=false: misma devolución pero sin cifras (para quien eligió no ver calorías).
 * others: las demás comidas de ese mismo día (sin esta).
 * weekBank: cuánto de más se le perdona al día por el margen de la semana (WeekSummary.flex).
 *   Si el día se pasa pero la semana tiene margen de sobra, no se marca como generosa.
 */
export function mealFeedback(
  profile: Profile,
  slotKey: string,
  items: MealItem[],
  numbers = true,
  others: DayMeal[] = [],
  time?: string,
  weekBank?: number,
): MealFeedback {
  const kcal = sumRanges(items.map((i) => i.kcal));
  const protein = sumRanges(items.map((i) => i.protein));
  const groups = [...new Set(items.map((i) => i.group))];
  const energy = estimateEnergy(profile);
  const slot = profile.mealSlots.find((s) => s.key === slotKey);
  const slotName = slot ? withArticle(slot.label.toLowerCase()) : 'esta comida';
  const target = energy && slot ? mealTarget(profile, slotKey, energy) : undefined;
  const suggestions: string[] = [];

  const hasPlant = groups.includes('verdura') || groups.includes('fruta');
  const caresMuscle = profile.goal === 'reduccion-gradual-conservando-musculo' || profile.goal === 'ganar-masa-muscular';

  if (kcal && energy && !target) {
    // Algo fuera de los momentos del día (un "extra"): no tiene porción propia, se mira solo el día.
    const day = dayContext(profile, energy, slotKey, kcal, others, time);
    const over = mid(day.soFar) - energy.kcal.max;
    const covered = over > 0 && weekBank !== undefined && weekBank >= over;
    const high = mid(day.soFar) > energy.kcal.max * 1.1 && !covered;
    if (!hasPlant && items.length > 0 && !high) suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');
    return {
      level: high ? 'generosa' : 'dentro',
      kcal,
      protein,
      day,
      groups,
      headline: high
        ? 'Con esto el día vino generoso. Tranqui: un día no define nada, mañana seguimos con lo de siempre 💛'
        : covered
          ? '¡Anotada! El día vino generoso, pero la semana venía con margen: entra bien 👌'
          : '¡Anotada! Con esto el día sigue bien 👌',
      suggestions: suggestions.slice(0, 2),
    };
  }

  if (!kcal || !target || !energy) {
    if (!hasPlant && items.length > 0) suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');
    return {
      level: 'sin-datos',
      kcal,
      protein,
      target,
      groups,
      headline: !kcal ? '¡Anotada! Si cargás cantidades, te cuento más de esta comida.' : '¡Anotada! Completá tus datos en Yo y te digo cómo viene para tu objetivo.',
      suggestions,
    };
  }

  const day = dayContext(profile, energy, slotKey, kcal, others, time);
  const m = mid(kcal);
  const slotHigh = m > target.kcal.max * 1.1;
  const slotLow = m < target.kcal.min * 0.75;
  const isLast = orderedSlots(profile).at(-1)?.key === slotKey;
  const left = numbers && !isLast && day.remaining.max > 0 ? ` Te quedan ≈ ${round50(mid(day.remaining))} kcal para el resto del día.` : '';

  let level: FeedbackLevel = 'dentro';
  let headline: string;
  if (slotHigh && day.balance !== 'adelante') {
    // Más cargada que lo típico para este momento, pero el día viene bien: no es para marcar.
    headline =
      day.counted > 0
        ? `Más cargadita de lo habitual para ${slotName}, pero con lo que comiste antes el día viene bien equilibrado 👌${left}`
        : `Un poquito más cargadita de lo habitual para ${slotName}, nada que marcar 👌${left}`;
  } else if (slotHigh && day.counted === 0) {
    level = 'generosa';
    const diff = round10(m - target.kcal.max);
    const more = numbers ? ` (≈ +${diff} kcal)` : '';
    headline =
      day.assumed > 0
        ? // Hay comidas antes sin anotar: no sabemos cómo viene el día, así que no lo damos por "completito".
          `Vino un poquito más generosa de lo que te sugiero para ${slotName}${more}. Si las comidas de antes fueron livianas, anotalas y la miro con el día entero.`
        : `Vino un poquito más generosa de lo que te sugiero para ${slotName}${more}. Nada grave: el día recién arranca y se acomoda solo.`;
  } else if (slotHigh && weekBank !== undefined && weekBank >= mid(day.soFar) - day.expected.max) {
    // El día viene cargado, pero la semana tiene margen de sobra (p. ej. un finde después de una semana liviana).
    headline = `Más generosa de lo habitual para ${slotName}, pero la semana viene con margen, así que entra bien 👌`;
  } else if (slotHigh) {
    level = 'generosa';
    const diff = round10(mid(day.soFar) - day.expected.max);
    headline = `Vino un poquito más generosa para ${slotName} y el día ya viene completito${
      numbers && diff > 0 ? ` (≈ +${diff} kcal sobre lo esperable a esta altura)` : ''
    }. Nada grave: se acomoda solo con las próximas comidas.`;
    if (!isLast) suggestions.push('Para la próxima comida, algo con verdura y proteína te va a caer bárbaro.');
  } else if (slotLow && day.balance === 'atras') {
    level = 'liviana';
    headline = `Quedó livianita para ${slotName}, y el día viene liviano también. Si te quedás con hambre, sumá algo: comer bien también es parte.`;
  } else if (slotLow) {
    headline = `Livianita, pero con lo que comiste antes está bien así. Si te da hambre, sumá algo sin drama.${left}`;
  } else {
    headline = `Bien equilibrada para ${slotName} 👌${left}`;
  }
  // Última comida y el día quedó corto: invitar a comer algo si hay hambre (nunca lo contrario).
  if (isLast && level !== 'liviana' && day.balance === 'atras') headline += ' El día quedó más bien liviano: si te queda hambre, algo rico antes de dormir.';

  if (protein && mid(protein) < target.protein.min * 0.7) {
    suggestions.push(
      caresMuscle
        ? 'Sumarle una porción de proteína (huevo, yogur, legumbres, pollo, atún) ayuda a cuidar el músculo.'
        : 'Una porción de proteína (huevo, yogur, legumbres) te ayuda a quedar satisfecha más tiempo.',
    );
  }
  if (!hasPlant) suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');

  return { level, kcal, protein, target, day, groups, headline, suggestions: suggestions.slice(0, 2) };
}

/**
 * Rango para una comida que todavía no se hizo (ideas, recetas), ajustado a lo que ya se comió en el día:
 * lo que queda del rango diario se reparte entre esta comida y las que faltan, según su peso habitual.
 * Se queda entre el 70 % y el 160 % del rango típico: nunca empuja a comer muy poco ni a "recuperar".
 */
export function remainingTarget(profile: Profile, slotKey: string, energy: EnergyEstimate, dayMeals: DayMeal[]): { kcal: Range; protein: Range } {
  const base = mealTarget(profile, slotKey, energy);
  const others = dayMeals.filter((m) => m.slotKey !== slotKey);
  if (!others.length) return base;
  const logged = new Set(others.map((m) => m.slotKey));
  const pending = profile.mealSlots.filter((s) => s.key === slotKey || !logged.has(s.key));
  const weightOf = (key: string) => mid(mealTarget(profile, key, energy).kcal);
  const share = weightOf(slotKey) / pending.reduce((n, s) => n + weightOf(s.key), 0);

  const eaten = others.reduce((acc, m) => add(acc, estimateMealKcal(profile, energy, m)), ZERO);
  const eatenProt = others.reduce((acc, m) => add(acc, sumRanges(m.items.map((i) => i.protein)) ?? ZERO), ZERO);
  const clamp = (v: number, b: Range) => Math.min(b.max * 1.6, Math.max(b.min * 0.7, v));
  const kMin = round50(clamp((energy.kcal.min - mid(eaten)) * share, base.kcal));
  const kMax = Math.max(round50(clamp((energy.kcal.max - mid(eaten)) * share, base.kcal)), kMin + 50);
  const pMin = Math.round(clamp((energy.protein.min - mid(eatenProt)) * share, base.protein) / 5) * 5;
  const pMax = Math.max(Math.round(clamp((energy.protein.max - mid(eatenProt)) * share, base.protein) / 5) * 5, pMin + 5);
  return { kcal: { min: kMin, max: kMax }, protein: { min: pMin, max: pMax } };
}

export interface DayFeedback {
  energy: EnergyEstimate;
  kcal?: Range;
  protein?: Range;
  /** 0..1+ cuánto del rango diario lleva (por el punto medio) */
  progress: number;
  line: string;
}

/** Resumen suave del día con lo anotado hasta ahora. */
export function dayFeedback(profile: Profile, items: MealItem[], hour: number, weekBank?: number): DayFeedback | null {
  const energy = estimateEnergy(profile);
  if (!energy) return null;
  const kcal = sumRanges(items.map((i) => i.kcal));
  const protein = sumRanges(items.map((i) => i.protein));
  const progress = kcal ? mid(kcal) / mid(energy.kcal) : 0;
  let line: string;
  if (!kcal) line = 'Cuando anotes comidas con cantidades, acá vas a ver cómo viene el día.';
  else if (mid(kcal) > energy.kcal.max * 1.1 && weekBank !== undefined && weekBank >= mid(kcal) - energy.kcal.max)
    line = 'Hoy vino un día generoso, pero la semana venía con margen: entra bien 👌';
  else if (mid(kcal) > energy.kcal.max * 1.1)
    line = 'Hoy vino un día generoso. Tranqui: un día no define nada, mañana seguimos con lo de siempre 💛';
  else if (hour >= 20 && mid(kcal) < energy.kcal.min * 0.7)
    line = 'Hoy fue un día más liviano. Si tenés hambre, comé algo rico antes de dormir.';
  else if (mid(kcal) >= energy.kcal.min) line = 'Ya estás dentro de tu rango del día 👌';
  else line = 'Vas bien. Lo que falta del día lo vas completando con tus comidas.';
  return { energy, kcal, protein, progress, line };
}
