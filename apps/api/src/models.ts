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
