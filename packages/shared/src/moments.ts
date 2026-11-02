import { z } from 'zod';

/* Notitas que el admin deja y Cachete entrega, y fechas especiales. */

export const noteInputSchema = z.object({
  text: z.string().trim().min(1, 'Escribí la notita').max(600),
  /** "YYYY-MM-DD": se entrega a partir de ese día. Vacío = ya. */
  deliverOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

export interface Note {
  id: string;
  text: string;
  fromName: string;
  deliverOn: string | null;
  openedAt: string | null;
  createdAt: string;
}

export const specialKindSchema = z.enum(['cumple', 'aniversario', 'otro']);
export type SpecialKind = z.infer<typeof specialKindSchema>;

export const specialDateInputSchema = z.object({
  /** "MM-DD": se repite todos los años */
  monthDay: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Fecha inválida'),
  label: z.string().trim().min(1).max(60),
  kind: specialKindSchema.default('otro'),
});

export interface SpecialDate {
  id: string;
  monthDay: string;
  label: string;
  kind: SpecialKind;
}

export interface Moments {
  /** Notitas listas para entregar */
  notes: Note[];
  /** Fechas especiales de hoy */
  special: SpecialDate[];
}

export function specialPhrase(s: SpecialDate, displayName: string): string {
  if (s.kind === 'cumple') return `¡Feliz cumple, ${displayName}! 🎂 Hoy todo es fiesta.`;
  if (s.kind === 'aniversario') return `¡Feliz ${s.label}! 💛`;
  return `¡Hoy es ${s.label}! ✨`;
}
