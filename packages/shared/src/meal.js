"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealInputSchema = exports.mealItemSchema = exports.unitSchema = exports.foodGroupSchema = void 0;
const zod_1 = require("zod");
const range_1 = require("./range");
exports.foodGroupSchema = zod_1.z.enum(['proteína', 'verdura', 'fruta', 'cereal', 'lácteo', 'grasa', 'bebida', 'otro']);
exports.unitSchema = zod_1.z.enum(['g', 'ml', 'porción', 'unidad', 'taza', 'cda']);
exports.mealItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(60),
    quantity: zod_1.z.number().positive().optional(),
    unit: exports.unitSchema.optional(),
    group: exports.foodGroupSchema.default('otro'),
    kcal: range_1.rangeSchema.optional(),
    protein: range_1.rangeSchema.optional(),
    confidence: range_1.confidenceSchema.default('baja'),
    source: zod_1.z.enum(['usuaria', 'catálogo', 'ia']).default('usuaria'),
    editedByUser: zod_1.z.boolean().default(false),
});
exports.mealInputSchema = zod_1.z.object({
    /** Día local "YYYY-MM-DD". */
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** key de un mealSlot del perfil, o "extra". */
    slotKey: zod_1.z.string().min(1).max(24),
    time: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    description: zod_1.z.string().max(280).optional(),
    items: zod_1.z.array(exports.mealItemSchema).max(30).default([]),
    origin: zod_1.z.enum(['manual', 'ia', 'plan', 'receta']).default('manual'),
    feeling: zod_1.z
        .object({
        fullness: zod_1.z.number().int().min(1).max(5).optional(),
        energy: zod_1.z.number().int().min(1).max(5).optional(),
    })
        .optional(),
    note: zod_1.z.string().max(280).optional(),
});
