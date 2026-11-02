/**
 * La mascota (Cachete) reacciona a eventos, hora y día de rutina.
 * Regla de diseño: el contenido nutricional de una comida NUNCA entra acá.
 */
export const EXPRESSIONS = ['alegria', 'curiosidad', 'sorpresa', 'descanso', 'acompañamiento'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export type MascotEvent =
  | 'abrir-app'
  | 'comida-registrada'
  | 'foto-tomada'
  | 'receta-nueva'
  | 'entreno-registrado'
  | 'energia-baja'
  | 'vuelta-tras-pausa'
  | 'agua-registrada'
  | 'descanso-elegido'
  | 'caricia';

export interface MascotContext {
  event: MascotEvent;
  hour: number;
  isRestDay: boolean;
  name: string;
  displayName: string;
  /** Hubo registros en las últimas 48 h. Solo se usa para saludar distinto, nunca para reprochar. */
  daysSinceLastLog?: number;
}

export interface MascotState {
  expression: Expression;
  phrase: string;
}

/** Palabras que nunca pueden aparecer en una frase de la mascota. */
export const FORBIDDEN_WORDS = ['mal', 'prohibid', 'compensar', 'culpa', 'te pasaste', 'racha perdida', 'fallaste', 'deberías'];

const pick = <T>(arr: readonly T[], seed: number): T => arr[Math.abs(seed) % arr.length]!;

export function mascotState(ctx: MascotContext, seed = Date.now()): MascotState {
  const n = ctx.displayName;
  const night = ctx.hour >= 21 || ctx.hour < 6;
  switch (ctx.event) {
    case 'comida-registrada':
      return { expression: 'alegria', phrase: pick(['¡Anotado! Gracias por contarme 💛', '¡Listo! Me encanta saber cómo va tu día.', '¡Guardado! Seguimos juntos.'], seed) };
    case 'foto-tomada':
      return { expression: 'curiosidad', phrase: pick(['Mmm, ¿qué tenemos acá?', 'A ver, a ver… qué rico se ve.'], seed) };
    case 'receta-nueva':
      return { expression: 'sorpresa', phrase: pick(['¡Una receta nueva! Quiero probarla.', '¡Ohh! Esa no la conocía.'], seed) };
    case 'entreno-registrado':
      return { expression: 'descanso', phrase: pick(['Buen trabajo. Ahora a recuperar energía.', 'Qué bien moverse. Respirá hondo.'], seed) };
    case 'energia-baja':
      return { expression: 'acompañamiento', phrase: pick(['Hay días así. Estoy acá con vos.', 'Gracias por contarme. Tomalo con calma hoy.'], seed) };
    case 'agua-registrada':
      return { expression: 'alegria', phrase: pick(['¡Glu glu! 💧', '¡Salud! Bien ahí con el agua.', 'Un vasito más, qué bien.'], seed) };
    case 'descanso-elegido':
      return { expression: 'descanso', phrase: pick(['Descansar también suma. Disfrutalo.', 'Hoy el cuerpo recupera. Bien elegido.'], seed) };
    case 'vuelta-tras-pausa':
      return { expression: 'acompañamiento', phrase: `¡Hola de nuevo, ${n}! ¿Arrancamos con lo que viene?` };
    case 'caricia':
      return pick<MascotState>([
        { expression: 'alegria', phrase: '¡Jiji, cosquillas!' },
        { expression: 'sorpresa', phrase: '¡Uy! Hola 👋' },
      ], seed);
    case 'abrir-app':
    default: {
      if ((ctx.daysSinceLastLog ?? 0) >= 2) {
        return { expression: 'acompañamiento', phrase: `¡Hola de nuevo, ${n}! ¿Arrancamos con lo que viene?` };
      }
      if (night) return { expression: 'descanso', phrase: `Buenas noches, ${n}. Hoy fue un día más 🌙` };
      if (ctx.isRestDay) return { expression: 'descanso', phrase: `Día tranqui, ${n}. Disfrutalo.` };
      if (ctx.hour < 12) return { expression: 'alegria', phrase: `¡Buen día, ${n}! ¿Cómo arrancamos?` };
      if (ctx.hour < 19) return { expression: 'curiosidad', phrase: `¡Hola, ${n}! ¿Qué tal viene la tarde?` };
      return { expression: 'alegria', phrase: `¡Buenas, ${n}! ¿Cómo estuvo el día?` };
    }
  }
}
