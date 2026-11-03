import type { Range } from './range';
import type { Goal, Profile } from './profile';

/**
 * Sugerencia orientativa de energía diaria. No es una prescripción.
 * - Gasto basal: Mifflin-St Jeor.
 * - Actividad: factor según los días de entrenamiento de la rutina (trabajo sentado de base).
 * - Objetivo: déficit suave (10–15 %) para bajar de a poco, nunca por debajo del basal.
 * Siempre devuelve rangos redondeados, nunca un número exacto.
 */
export interface EnergyEstimate {
  kcal: Range;
  protein: Range;
  bmr: number;
  tdee: number;
  activityFactor: number;
  trainingDays: number;
  /** Explicación corta, en lenguaje simple */
  explanation: string;
}

const round50 = (n: number) => Math.round(n / 50) * 50;
const round5 = (n: number) => Math.round(n / 5) * 5;

export function activityFactorFor(trainingDays: number): number {
  if (trainingDays >= 6) return 1.7;
  if (trainingDays >= 4) return 1.6;
  if (trainingDays >= 2) return 1.45;
  if (trainingDays === 1) return 1.35;
  return 1.25;
}

const GOAL_MULTIPLIER: Record<Goal, [number, number]> = {
  'reduccion-gradual-conservando-musculo': [0.85, 0.9],
  'ganar-masa-muscular': [1.05, 1.1],
  mantener: [0.95, 1.05],
  'acompañar-habitos': [0.95, 1.05],
  'mas-energia': [0.97, 1.05],
};

/** Gramos de proteína por kilo: más alto si el objetivo cuida o suma músculo. */
const PROTEIN_PER_KG: Record<Goal, [number, number]> = {
  'reduccion-gradual-conservando-musculo': [1.6, 2.0],
  'ganar-masa-muscular': [1.6, 2.0],
  mantener: [1.2, 1.6],
  'acompañar-habitos': [1.2, 1.6],
  'mas-energia': [1.2, 1.6],
};

export function missingForEnergy(p: Profile): string[] {
  const missing: string[] = [];
  if (!p.age) missing.push('edad');
  if (!p.heightCm) missing.push('altura');
  if (!p.weightKg) missing.push('peso');
  return missing;
}

export function estimateEnergy(p: Profile): EnergyEstimate | null {
  if (!p.age || p.age < 18 || !p.heightCm || !p.weightKg) return null;
  const sexTerm = p.sex === 'masculino' ? 5 : p.sex === 'femenino' ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexTerm;
  const trainingDays = p.routine.filter((d) => d.trainingKey).length;
  // Una segunda actividad en el mismo día suma, pero como medio día más.
  const extraSessions = p.routine.reduce((n, d) => n + (d.trainingKey ? (d.more ?? []).length : 0), 0);
  const activityFactor = activityFactorFor(trainingDays + extraSessions * 0.5);
  const tdee = bmr * activityFactor;
  const [lo, hi] = GOAL_MULTIPLIER[p.goal];
  // Piso: nunca sugerir por debajo del gasto basal.
  const min = round50(Math.max(tdee * lo, bmr));
  const max = round50(Math.max(tdee * hi, min + 100));
  const [plo, phi] = PROTEIN_PER_KG[p.goal];
  const protein = { min: round5(p.weightKg * plo), max: round5(p.weightKg * phi) };

  const goalText =
    p.goal === 'reduccion-gradual-conservando-musculo'
      ? 'Para bajar de a poco sin perder músculo, el rango queda un poco por debajo de lo que gastás, nunca por debajo de tu energía de base.'
      : p.goal === 'ganar-masa-muscular'
        ? 'Para sumar músculo, el rango queda un poco por encima de lo que gastás.'
        : 'El rango está cerca de lo que gastás en un día típico.';
  const explanation = `Calculado con tus datos y ${trainingDays === 1 ? '1 día' : `${trainingDays} días`} de entrenamiento por semana${
    extraSessions ? ` (${extraSessions === 1 ? 'uno con doble actividad' : `${extraSessions} con doble actividad`})` : ''
  }. ${goalText}`;

  return { kcal: { min, max }, protein, bmr: Math.round(bmr), tdee: Math.round(tdee), activityFactor, trainingDays, explanation };
}

/** Peso relativo de cada comida del día en el reparto. */
const SLOT_WEIGHT: Record<string, number> = { desayuno: 0.25, almuerzo: 0.32, merienda: 0.13, cena: 0.3 };

/** Rango orientativo para una comida en particular, repartiendo el total del día. */
export function mealTarget(p: Profile, slotKey: string, day: EnergyEstimate): { kcal: Range; protein: Range } {
  const weights = p.mealSlots.map((s) => SLOT_WEIGHT[s.key] ?? 0.12);
  const total = weights.reduce((a, b) => a + b, 0);
  const idx = p.mealSlots.findIndex((s) => s.key === slotKey);
  const share = idx >= 0 ? weights[idx]! / total : 0.15;
  return {
    kcal: { min: round50(day.kcal.min * share), max: Math.max(round50(day.kcal.max * share), round50(day.kcal.min * share) + 50) },
    protein: { min: round5(day.protein.min * share), max: Math.max(round5(day.protein.max * share), round5(day.protein.min * share) + 5) },
  };
}
