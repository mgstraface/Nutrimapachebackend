"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialDateInputSchema = exports.specialKindSchema = exports.noteInputSchema = void 0;
exports.specialPhrase = specialPhrase;
const zod_1 = require("zod");
/* Notitas que el admin deja y Cachete entrega, y fechas especiales. */
exports.noteInputSchema = zod_1.z.object({
    text: zod_1.z.string().trim().min(1, 'Escribí la notita').max(600),
    /** "YYYY-MM-DD": se entrega a partir de ese día. Vacío = ya. */
    deliverOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});
exports.specialKindSchema = zod_1.z.enum(['cumple', 'aniversario', 'otro']);
exports.specialDateInputSchema = zod_1.z.object({
    /** "MM-DD": se repite todos los años */
    monthDay: zod_1.z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Fecha inválida'),
    label: zod_1.z.string().trim().min(1).max(60),
    kind: exports.specialKindSchema.default('otro'),
});
function specialPhrase(s, displayName) {
    if (s.kind === 'cumple')
        return `¡Feliz cumple, ${displayName}! 🎂 Hoy todo es fiesta.`;
    if (s.kind === 'aniversario')
        return `¡Feliz ${s.label}! 💛`;
    return `¡Hoy es ${s.label}! ✨`;
}
