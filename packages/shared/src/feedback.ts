import type { Range } from './range';
import { sumRanges } from './range';
import type { MealItem } from './meal';
import type { Profile } from './profile';
import { estimateEnergy, mealTarget, type EnergyEstimate } from './energy';

/**
 * "Miradita de Cachete": devolución suave de una comida o del día.
 * Marca cuando algo vino más generoso o más liviano que el rango sugerido, pero:
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
  /** Frase principal, amable */
  headline: string;
  /** Hasta 2 sugerencias para sumar */
  suggestions: string[];
  groups: string[];
}

const mid = (r: Range) => (r.min + r.max) / 2;
const round10 = (n: number) => Math.round(n / 10) * 10;

/** numbers=false: misma devolución pero sin cifras (para quien eligió no ver calorías). */
export function mealFeedback(profile: Profile, slotKey: string, items: MealItem[], numbers = true): MealFeedback {
  const kcal = sumRanges(items.map((i) => i.kcal));
  const protein = sumRanges(items.map((i) => i.protein));
  const groups = [...new Set(items.map((i) => i.group))];
  const energy = estimateEnergy(profile);
  const slot = profile.mealSlots.find((s) => s.key === slotKey);
  const slotName = slot ? slot.label.toLowerCase() : 'esta comida';
  const target = energy && slot ? mealTarget(profile, slotKey, energy) : undefined;
  const suggestions: string[] = [];

  const hasPlant = groups.includes('verdura') || groups.includes('fruta');
  const caresMuscle = profile.goal === 'reduccion-gradual-conservando-musculo' || profile.goal === 'ganar-masa-muscular';

  if (!kcal || !target) {
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

  let level: FeedbackLevel = 'dentro';
  let headline: string;
  const m = mid(kcal);
  if (m > target.kcal.max * 1.1) {
    level = 'generosa';
    const diff = round10(m - target.kcal.max);
    headline = `Vino un poquito más generosa de lo que te sugiero para ${slotName}${numbers ? ` (≈ +${diff} kcal)` : ''}. Nada grave: se equilibra a lo largo del día.`;
    suggestions.push('Para la próxima comida, algo con verdura y proteína te va a caer bárbaro.');
  } else if (m < target.kcal.min * 0.75) {
    level = 'liviana';
    headline = `Quedó livianita para ${slotName}. Si te quedás con hambre, sumá algo: comer bien también es parte.`;
  } else {
    headline = `Bien equilibrada para ${slotName} 👌`;
  }

  if (protein && mid(protein) < target.protein.min * 0.7) {
    suggestions.push(
      caresMuscle
        ? 'Sumarle una porción de proteína (huevo, yogur, legumbres, pollo, atún) ayuda a cuidar el músculo.'
        : 'Una porción de proteína (huevo, yogur, legumbres) te ayuda a quedar satisfecha más tiempo.',
    );
  }
  if (!hasPlant) suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');

  return { level, kcal, protein, target, groups, headline, suggestions: suggestions.slice(0, 2) };
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
export function dayFeedback(profile: Profile, items: MealItem[], hour: number): DayFeedback | null {
  const energy = estimateEnergy(profile);
  if (!energy) return null;
  const kcal = sumRanges(items.map((i) => i.kcal));
  const protein = sumRanges(items.map((i) => i.protein));
  const progress = kcal ? mid(kcal) / mid(energy.kcal) : 0;
  let line: string;
  if (!kcal) line = 'Cuando anotes comidas con cantidades, acá vas a ver cómo viene el día.';
  else if (mid(kcal) > energy.kcal.max * 1.1)
    line = 'Hoy vino un día generoso. Tranqui: un día no define nada, mañana seguimos con lo de siempre 💛';
  else if (hour >= 20 && mid(kcal) < energy.kcal.min * 0.7)
    line = 'Hoy fue un día más liviano. Si tenés hambre, comé algo rico antes de dormir.';
  else if (mid(kcal) >= energy.kcal.min) line = 'Ya estás dentro de tu rango del día 👌';
  else line = 'Vas bien. Lo que falta del día lo vas completando con tus comidas.';
  return { energy, kcal, protein, progress, line };
}
