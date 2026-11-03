import mongoose, { Schema } from 'mongoose';

/* Usuarios: los crea el admin desde el panel. */
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const User = mongoose.model('User', userSchema);

/* Sesiones: el navegador guarda un token al azar en una cookie; acá solo su hash. */
const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.model('Session', sessionSchema);

/* Perfil: uno por usuario. El contenido se valida con el esquema compartido (Zod). */
const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);
export const Profile = mongoose.model('Profile', profileSchema);

/* Comidas: validadas con mealInputSchema antes de guardar. */
const mealSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    slotKey: { type: String, required: true },
    time: String,
    description: String,
    items: { type: [Schema.Types.Mixed], default: [] },
    origin: { type: String, default: 'manual' },
    feeling: Schema.Types.Mixed,
    note: String,
  },
  { timestamps: true, minimize: false },
);
mealSchema.index({ userId: 1, date: -1 });
export const Meal = mongoose.model('Meal', mealSchema);

/* Días: actividad (como la rutina, distinta o descanso), energía y agua. Uno por usuaria y fecha. */
const daySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    status: { type: String, default: null },
    activities: { type: [Schema.Types.Mixed], default: [] },
    energy: { type: Number, default: null },
    water: { type: Number, default: 0 },
    note: { type: String, default: '' },
    mood: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);
daySchema.index({ userId: 1, date: -1 }, { unique: true });
export const Day = mongoose.model('Day', daySchema);

/* Uso de IA: solo contadores para el tope diario y para saber cuánto se gasta. Nunca la foto. */
const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    /** foto | ideas */
    kind: { type: String, default: 'foto' },
    model: String,
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    ok: { type: Boolean, default: false },
  },
  { timestamps: true },
);
aiUsageSchema.index({ userId: 1, date: 1 });
export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);

/* Notitas que deja el admin y Cachete entrega. */
const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    fromName: { type: String, required: true },
    text: { type: String, required: true },
    deliverOn: { type: String, default: null },
    openedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
noteSchema.index({ userId: 1, openedAt: 1 });
export const Note = mongoose.model('Note', noteSchema);

/* Fechas especiales (se repiten cada año por "MM-DD"). */
const specialDateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    monthDay: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, default: 'otro' },
  },
  { timestamps: true },
);
specialDateSchema.index({ userId: 1, monthDay: 1 });
export const SpecialDate = mongoose.model('SpecialDate', specialDateSchema);

/* Catálogo de alimentos (compartido, lo edita el admin). Valores cada 100 g / 100 ml. */
const foodSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    group: { type: String, required: true },
    kcal: { type: Number, required: true },
    protein: { type: Number, required: true },
    unit: { type: String, required: true },
    qty: { type: Number, required: true },
    each: { type: Number },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true },
);
export const FoodItem = mongoose.model('FoodItem', foodSchema);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toFood(d: any) {
  return {
    id: String(d._id),
    name: d.name,
    group: d.group,
    kcal: d.kcal,
    protein: d.protein,
    unit: d.unit,
    qty: d.qty,
    ...(d.each ? { each: d.each } : {}),
    aliases: d.aliases ?? [],
  };
}

/** La primera vez carga el catálogo inicial; después no lo toca (lo maneja el admin). */
export async function seedFoods(defaults: { name: string }[]): Promise<void> {
  if ((await FoodItem.estimatedDocumentCount()) > 0) return;
  await FoodItem.insertMany(defaults, { ordered: false }).catch(() => undefined);
  console.log(`[foods] catálogo inicial cargado (${defaults.length} alimentos)`);
}

/* Recetas favoritas (guardadas desde ideas o desde "¿Qué hay en casa?"). */
const recipeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);
export const SavedRecipe = mongoose.model('SavedRecipe', recipeSchema);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toRecipe(doc: any) {
  return { ...doc.data, id: String(doc._id), createdAt: new Date(doc.createdAt).toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toNote(doc: any) {
  return {
    id: String(doc._id),
    text: doc.text,
    fromName: doc.fromName,
    deliverOn: doc.deliverOn ?? null,
    openedAt: doc.openedAt ? new Date(doc.openedAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSpecial(doc: any) {
  return { id: String(doc._id), monthDay: doc.monthDay, label: doc.label, kind: doc.kind ?? 'otro' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDay(doc: any) {
  return {
    date: doc.date,
    status: doc.status ?? null,
    activities: doc.activities ?? [],
    energy: doc.energy ?? null,
    water: doc.water ?? 0,
    note: doc.note ?? '',
    mood: doc.mood ?? null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMeal(doc: any) {
  return {
    id: String(doc._id),
    date: doc.date,
    slotKey: doc.slotKey,
    time: doc.time ?? undefined,
    description: doc.description ?? undefined,
    items: doc.items ?? [],
    origin: doc.origin ?? 'manual',
    feeling: doc.feeling ?? undefined,
    note: doc.note ?? undefined,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSessionUser(u: any) {
  return { id: String(u._id), username: u.username, displayName: u.displayName, role: u.role };
}
