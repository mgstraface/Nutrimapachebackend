"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textAnalysisRequestSchema = exports.recipeSchema = exports.pantryRequestSchema = exports.mealTipsRequestSchema = exports.mealIdeaSchema = exports.inspirationRequestSchema = exports.photoAnalysisSchema = exports.photoAnalysisRequestSchema = void 0;
const zod_1 = require("zod");
const meal_1 = require("./meal");
const range_1 = require("./range");
/** Lo que manda la app: la foto ya achicada en el celular (JPEG en base64, sin metadatos). */
exports.photoAnalysisRequestSchema = zod_1.z.object({
    image: zod_1.z
        .string()
        .min(100)
        .max(4_000_000)
        .regex(/^[A-Za-z0-9+/=]+$/, 'Imagen inválida'),
    mediaType: zod_1.z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    /** Nombre de la comida del día ("Almuerzo"), para dar contexto. Nada personal. */
    slotLabel: zod_1.z.string().max(30).optional(),
});
exports.photoAnalysisSchema = zod_1.z.object({
    /** Descripción corta y neutra del plato */
    description: zod_1.z.string().max(280),
    items: zod_1.z.array(meal_1.mealItemSchema).max(20),
    /** La foto no parece mostrar comida */
    notFood: zod_1.z.boolean().default(false),
    /** Aviso sobre lo que la foto no deja ver (aceite, salsas, porciones tapadas...) */
    uncertaintyNote: zod_1.z.string().max(280).default(''),
});
/* ---------------- Inspiración: ideas de comidas ---------------- */
exports.inspirationRequestSchema = zod_1.z.object({
    slotKey: zod_1.z.string().min(1).max(24),
    /** Nombres de ideas ya mostradas, para no repetir al pedir otras */
    exclude: zod_1.z.array(zod_1.z.string().max(80)).max(12).default([]),
});
exports.mealIdeaSchema = zod_1.z.object({
    title: zod_1.z.string().max(80),
    description: zod_1.z.string().max(200),
    items: zod_1.z.array(meal_1.mealItemSchema).max(12),
    kcal: range_1.rangeSchema.optional(),
    protein: range_1.rangeSchema.optional(),
    prepMinutes: zod_1.z.number().int().min(0).max(240).optional(),
    tags: zod_1.z.array(zod_1.z.string().max(20)).max(4).default([]),
});
/* ---------------- "¿Cómo la mejoro?" ---------------- */
exports.mealTipsRequestSchema = zod_1.z.object({ mealId: zod_1.z.string().min(1).max(40) });
/* ---------------- Recetas con lo que hay en casa ---------------- */
exports.pantryRequestSchema = zod_1.z.object({
    ingredients: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).min(1).max(30),
    /** Para qué comida (opcional) */
    slotKey: zod_1.z.string().max(24).nullable().default(null),
    exclude: zod_1.z.array(zod_1.z.string().max(80)).max(12).default([]),
});
exports.recipeSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(80),
    description: zod_1.z.string().max(200).default(''),
    items: zod_1.z.array(meal_1.mealItemSchema).max(16),
    steps: zod_1.z.array(zod_1.z.string().max(240)).max(12).default([]),
    /** Ingredientes que no estaban en la lista (fuera de lo básico) */
    missing: zod_1.z.array(zod_1.z.string().max(40)).max(6).default([]),
    kcal: range_1.rangeSchema.optional(),
    protein: range_1.rangeSchema.optional(),
    prepMinutes: zod_1.z.number().int().min(0).max(240).optional(),
    servings: zod_1.z.number().int().min(1).max(8).default(1),
    tags: zod_1.z.array(zod_1.z.string().max(20)).max(4).default([]),
});
/** Estimar con IA a partir de texto (sin foto), para lo que no está en el catálogo. */
exports.textAnalysisRequestSchema = zod_1.z.object({
    description: zod_1.z.string().max(280).default(''),
    slotLabel: zod_1.z.string().max(30).optional(),
    items: zod_1.z
        .array(zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(60), quantity: zod_1.z.number().positive().max(10000).optional(), unit: zod_1.z.string().max(12).optional() }))
        .max(20)
        .default([]),
});
