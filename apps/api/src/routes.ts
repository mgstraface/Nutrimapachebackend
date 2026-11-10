import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import {
  PROFILE_TEMPLATES,
  createUserSchema,
  GOAL_LABELS,
  dayLogSchema,
  bodyEntrySchema,
  estimateEnergy,
  inspirationRequestSchema,
  loginSchema,
  mealTarget,
  mealFeedback,
  remainingTarget,
  weekStart,
  addDays,
  weekSummary,
  type DayMeal,
  mealTipsRequestSchema,
  noteInputSchema,
  pantryRequestSchema,
  recipeSchema,
  photoAnalysisRequestSchema,
  foodInputSchema,
  foodBulkSchema,
  fold,
  textAnalysisRequestSchema,
  specialDateInputSchema,
  plannedFor,
  type Profile as ProfileData,
  mealInputSchema,
  profileSchema,
  updateUserSchema,
} from '@nutrimapache/shared';
import {
  endAllSessions,
  endSession,
  hashPassword,
  loginBlocked,
  loginFailed,
  loginOk,
  requireAdmin,
  requireUser,
  startSession,
  verifyPassword,
} from './auth';
import { AnalysisError, analyzePhoto, analyzeText, generateIdeas, generateMealTips, generatePantryRecipes, todayAR, type Usage } from './analysis';
import { dbReady } from './config/db';
import { env } from './config/env';
import { AiUsage, BodyEntry, Day, FoodItem, Meal, Note, Profile, SavedRecipe, SpecialDate, User, toBody, toDay, toFood, toMeal, toNote, toRecipe, toSessionUser, toSpecial } from './models';

/** Comidas anotadas de una fecha, en la forma mínima que usa el análisis del día. */
async function mealsOfDay(userId: string, date: string, skipId?: unknown): Promise<DayMeal[]> {
  const docs = await Meal.find({ userId, date, ...(skipId ? { _id: { $ne: skipId } } : {}) }).lean();
  return docs.map((m) => ({ slotKey: m.slotKey as string, time: (m.time as string | undefined) ?? undefined, items: (m.items ?? []) as never }));
}

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

const oid = (id: string) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null);

/**
 * Corre una consulta a la IA respetando el tope diario y registrando el uso.
 * Responde el error amable si algo falla; devuelve null en ese caso.
 */
async function withAi<T>(req: Request, res: Response, kind: string, fn: () => Promise<{ usage: Usage } & T>): Promise<T | null> {
  const date = todayAR();
  const used = await AiUsage.countDocuments({ userId: req.user!.id, date });
  if (used >= env.AI_DAILY_LIMIT) {
    res.status(429).json({ error: 'Por hoy ya usamos todas las consultas a la IA. Mañana seguimos.' });
    return null;
  }
  try {
    const out = await fn();
    await AiUsage.create({ userId: req.user!.id, date, kind, model: env.AI_MODEL, ...out.usage, ok: true });
    return out;
  } catch (err) {
    if (err instanceof AnalysisError) {
      if (err.status !== 503 || env.ANTHROPIC_API_KEY) await AiUsage.create({ userId: req.user!.id, date, kind, model: env.AI_MODEL, ok: false });
      res.status(err.status).json({ error: err.message });
      return null;
    }
    throw err;
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Perfiles guardados con versiones viejas: se completan con los valores por defecto nuevos. */
const normalizeProfile = (data: unknown) => {
  if (!data) return null;
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? parsed.data : data;
};

export function apiRouter(): Router {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true, db: dbReady() ? 'up' : 'down' });
  });

  r.get('/profile-templates', (_req, res) => {
    res.json(PROFILE_TEMPLATES);
  });

  /* ---------------- auth ---------------- */

  r.post(
    '/auth/login',
    h(async (req, res) => {
      const key = req.ip ?? 'desconocido';
      if (loginBlocked(key)) {
        res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' });
        return;
      }
      const parsed = loginSchema.safeParse(req.body);
      const user = parsed.success ? await User.findOne({ username: parsed.data.username }) : null;
      const ok = !!user && user.active && parsed.success && (await verifyPassword(parsed.data.password, user.passwordHash));
      if (!ok || !user) {
        loginFailed(key);
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        return;
      }
      loginOk(key);
      await startSession(res, String(user._id));
      const profile = await Profile.findOne({ userId: user._id }).lean();
      res.json({ user: toSessionUser(user), profile: normalizeProfile(profile?.data) });
    }),
  );

  r.post(
    '/auth/logout',
    h(async (req, res) => {
      await endSession(req, res);
      res.status(204).end();
    }),
  );

  r.get(
    '/auth/me',
    requireUser,
    h(async (req, res) => {
      const profile = await Profile.findOne({ userId: req.user!.id }).lean();
      res.json({ user: req.user, profile: normalizeProfile(profile?.data) });
    }),
  );

  /* ---------------- perfil ---------------- */

  r.put(
    '/profile',
    requireUser,
    h(async (req, res) => {
      const data = profileSchema.parse(req.body);
      await Profile.updateOne({ userId: req.user!.id }, { $set: { data } }, { upsert: true });
      res.json(data);
    }),
  );

  /* ---------------- comidas ---------------- */

  r.get(
    '/meals',
    requireUser,
    h(async (req, res) => {
      const q: Record<string, unknown> = { userId: req.user!.id };
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      if (from || to) q.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
      const docs = await Meal.find(q).sort({ date: -1, time: 1 }).limit(3000).lean();
      res.json(docs.map(toMeal));
    }),
  );

  r.post(
    '/meals',
    requireUser,
    h(async (req, res) => {
      const data = mealInputSchema.parse(req.body);
      const doc = await Meal.create({ ...data, userId: req.user!.id });
      res.status(201).json(toMeal(doc.toObject()));
    }),
  );

  r.patch(
    '/meals/:id',
    requireUser,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      const data = mealInputSchema.partial().parse(req.body);
      const doc = id ? await Meal.findOneAndUpdate({ _id: id, userId: req.user!.id }, { $set: data }, { new: true }).lean() : null;
      if (!doc) {
        res.status(404).json({ error: 'No encontramos esa comida' });
        return;
      }
      res.json(toMeal(doc));
    }),
  );

  r.delete(
    '/meals/:id',
    requireUser,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (id) await Meal.deleteOne({ _id: id, userId: req.user!.id });
      res.status(204).end();
    }),
  );

  /* ---------------- días: actividad, energía, agua ---------------- */

  r.get(
    '/days',
    requireUser,
    h(async (req, res) => {
      const q: Record<string, unknown> = { userId: req.user!.id };
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      if (from || to) q.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
      const docs = await Day.find(q).sort({ date: -1 }).limit(1000).lean();
      res.json(docs.map(toDay));
    }),
  );

  r.put(
    '/days/:date',
    requireUser,
    h(async (req, res) => {
      const date = req.params.date!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Fecha inválida' });
        return;
      }
      const data = dayLogSchema.parse(req.body);
      const doc = await Day.findOneAndUpdate(
        { userId: req.user!.id, date },
        { $set: data },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      res.json(toDay(doc));
    }),
  );

  /* ---------------- peso y medidas ---------------- */

  r.get(
    '/body',
    requireUser,
    h(async (req, res) => {
      const docs = await BodyEntry.find({ userId: req.user!.id }).sort({ date: 1 }).limit(2000).lean();
      res.json(docs.map(toBody));
    }),
  );

  r.put(
    '/body/:date',
    requireUser,
    h(async (req, res) => {
      const date = req.params.date!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayAR()) {
        res.status(400).json({ error: 'Fecha inválida' });
        return;
      }
      const data = bodyEntrySchema.parse(req.body);
      const doc = await BodyEntry.findOneAndUpdate({ userId: req.user!.id, date }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
      // Si es el peso más reciente, también pasa a ser el peso del perfil (así el rango de energía queda al día)
      let profileWeight: number | null = null;
      if (data.weightKg !== null) {
        const newer = await BodyEntry.exists({ userId: req.user!.id, date: { $gt: date }, weightKg: { $ne: null } });
        if (!newer) {
          await Profile.updateOne({ userId: req.user!.id }, { $set: { 'data.weightKg': data.weightKg } });
          profileWeight = data.weightKg;
        }
      }
      res.json({ entry: toBody(doc), profileWeight });
    }),
  );

  r.delete(
    '/body/:date',
    requireUser,
    h(async (req, res) => {
      await BodyEntry.deleteOne({ userId: req.user!.id, date: req.params.date });
      res.status(204).end();
    }),
  );

  /* ---------------- análisis de fotos con IA ---------------- */

  r.get(
    '/analysis/quota',
    requireUser,
    h(async (req, res) => {
      const usedToday = await AiUsage.countDocuments({ userId: req.user!.id, date: todayAR() });
      res.json({ enabled: !!env.ANTHROPIC_API_KEY && env.AI_DAILY_LIMIT > 0, usedToday, dailyLimit: env.AI_DAILY_LIMIT });
    }),
  );

  r.post(
    '/analysis/photo',
    requireUser,
    h(async (req, res) => {
      const profile = await Profile.findOne({ userId: req.user!.id }).lean();
      const consents = (profile?.data as { consents?: { aiAnalysis?: boolean } } | undefined)?.consents;
      if (!consents?.aiAnalysis) {
        res.status(409).json({ error: 'Primero tenés que aceptar el análisis de fotos.' });
        return;
      }
      const date = todayAR();
      const used = await AiUsage.countDocuments({ userId: req.user!.id, date });
      if (used >= env.AI_DAILY_LIMIT) {
        res.status(429).json({ error: 'Por hoy ya usamos todas las consultas a la IA. Mañana seguimos; mientras, podés anotar a mano.' });
        return;
      }
      const input = photoAnalysisRequestSchema.parse(req.body);
      try {
        const { analysis, usage } = await analyzePhoto(input);
        await AiUsage.create({ userId: req.user!.id, date, kind: 'foto', model: env.AI_MODEL, ...usage, ok: true });
        res.json(analysis);
      } catch (err) {
        if (err instanceof AnalysisError) {
          // Los intentos fallidos también cuentan para el tope (protege el gasto), salvo que falte la clave.
          if (err.status !== 503 || env.ANTHROPIC_API_KEY) await AiUsage.create({ userId: req.user!.id, date, kind: 'foto', model: env.AI_MODEL, ok: false });
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  /** Estimación desde texto, para lo que no está en el catálogo. Sin fotos ni datos personales. */
  r.post(
    '/analysis/text',
    requireUser,
    h(async (req, res) => {
      const input = textAnalysisRequestSchema.parse(req.body);
      if (!input.description.trim() && !input.items.length) {
        res.status(400).json({ error: 'Contá qué comiste o sumá algún ingrediente.' });
        return;
      }
      const out = await withAi(req, res, 'texto', async () => {
        const r = await analyzeText(input);
        return { usage: r.usage, analysis: r.analysis };
      });
      if (out) res.json(out.analysis);
    }),
  );

  /** Ideas de comidas para un momento del día, ajustadas al rango orientativo de esa comida. */
  r.post(
    '/inspiration',
    requireUser,
    h(async (req, res) => {
      const { slotKey, exclude } = inspirationRequestSchema.parse(req.body);
      const doc = await Profile.findOne({ userId: req.user!.id }).lean();
      const profile = doc?.data as ProfileData | undefined;
      if (!profile) {
        res.status(409).json({ error: 'Primero armá tu perfil.' });
        return;
      }
      const date = todayAR();
      const used = await AiUsage.countDocuments({ userId: req.user!.id, date });
      if (used >= env.AI_DAILY_LIMIT) {
        res.status(429).json({ error: 'Por hoy ya usamos todas las consultas a la IA. Mañana seguimos.' });
        return;
      }
      const slot = profile.mealSlots.find((s) => s.key === slotKey);
      const slotLabel = slot?.label ?? 'Comida';
      const energy = estimateEnergy(profile);
      // El rango se ajusta a lo que ya comió hoy: si el almuerzo fue liviano, la cena puede ser más completa.
      const dayMeals = await mealsOfDay(req.user!.id, date);
      const target = energy ? remainingTarget(profile, slotKey, energy, dayMeals) : null;
      const dayLog = await Day.findOne({ userId: req.user!.id, date }).lean();
      const trainedToday =
        dayLog?.status === 'como-plan' || dayLog?.status === 'distinto' || (!dayLog?.status && !!plannedFor(profile, new Date()));
      const vianda = /vianda/i.test(profile.workContext ?? '') && /almuerzo/i.test(`${slotKey} ${slotLabel}`);
      try {
        const { ideas, usage } = await generateIdeas({
          slotLabel,
          time: slot?.time ?? '',
          goalLabel: GOAL_LABELS[profile.goal],
          target,
          vianda,
          trainedToday,
          exclude,
        });
        await AiUsage.create({ userId: req.user!.id, date, kind: 'ideas', model: env.AI_MODEL, ...usage, ok: true });
        res.json({ slotLabel, target, ideas });
      } catch (err) {
        if (err instanceof AnalysisError) {
          if (err.status !== 503 || env.ANTHROPIC_API_KEY) await AiUsage.create({ userId: req.user!.id, date, kind: 'ideas', model: env.AI_MODEL, ok: false });
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }),
  );

  /* ---------------- catálogo de alimentos ---------------- */

  r.get(
    '/foods',
    requireUser,
    h(async (_req, res) => {
      const docs = await FoodItem.find().sort({ name: 1 }).lean();
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.json(docs.map(toFood));
    }),
  );

  r.post(
    '/admin/foods',
    requireAdmin,
    h(async (req, res) => {
      const data = foodInputSchema.parse(req.body);
      if (await FoodItem.exists({ name: new RegExp(`^${escapeRe(data.name)}$`, 'i') })) {
        res.status(409).json({ error: `Ya hay un alimento llamado "${data.name}".` });
        return;
      }
      const doc = await FoodItem.create(data);
      res.status(201).json(toFood(doc.toObject()));
    }),
  );

  /** Carga masiva desde la planilla: actualiza por nombre (sin distinguir mayúsculas ni tildes) o crea. */
  r.post(
    '/admin/foods/bulk',
    requireAdmin,
    h(async (req, res) => {
      const { foods } = foodBulkSchema.parse(req.body);
      const existing = await FoodItem.find({}, { name: 1 }).lean();
      const byName = new Map(existing.map((d) => [fold(d.name as string), d._id]));
      const ops = foods.map((f) => {
        const id = byName.get(fold(f.name));
        return id
          ? { updateOne: { filter: { _id: id }, update: { $set: f, ...(f.each ? {} : { $unset: { each: 1 } }) } } }
          : { insertOne: { document: f } };
      });
      await FoodItem.bulkWrite(ops as never, { ordered: false });
      const updated = ops.filter((o) => 'updateOne' in o).length;
      res.json({ created: ops.length - updated, updated });
    }),
  );

  r.put(
    '/admin/foods/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      const data = foodInputSchema.parse(req.body);
      if (id && (await FoodItem.exists({ _id: { $ne: id }, name: new RegExp(`^${escapeRe(data.name)}$`, 'i') }))) {
        res.status(409).json({ error: `Ya hay otro alimento llamado "${data.name}".` });
        return;
      }
      const doc = id ? await FoodItem.findByIdAndUpdate(id, { $set: data, ...(data.each ? {} : { $unset: { each: 1 } }) }, { new: true }).lean() : null;
      if (!doc) {
        res.status(404).json({ error: 'No encontramos ese alimento' });
        return;
      }
      res.json(toFood(doc));
    }),
  );

  r.delete(
    '/admin/foods/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (id) await FoodItem.deleteOne({ _id: id });
      res.status(204).end();
    }),
  );

  /* ---------------- "¿Cómo la mejoro?" ---------------- */

  r.post(
    '/meal-tips',
    requireUser,
    h(async (req, res) => {
      const { mealId } = mealTipsRequestSchema.parse(req.body);
      const id = oid(mealId);
      const [meal, doc] = await Promise.all([
        id ? Meal.findOne({ _id: id, userId: req.user!.id }).lean() : null,
        Profile.findOne({ userId: req.user!.id }).lean(),
      ]);
      const profile = doc?.data as ProfileData | undefined;
      if (!meal || !profile) {
        res.status(404).json({ error: 'No encontramos esa comida' });
        return;
      }
      const energy = estimateEnergy(profile);
      const slot = profile.mealSlots.find((s) => s.key === meal.slotKey);
      // Las ideas también miran el día: una merienda cargada después de un almuerzo liviano no es algo a corregir.
      const others = await mealsOfDay(req.user!.id, meal.date as string, meal._id);
      const items = (meal.items ?? []) as never;
      // …y la semana: un finde más cargado después de una semana liviana no es algo a corregir.
      const ws = weekStart(meal.date as string);
      const weekDocs = await Meal.find({ userId: req.user!.id, date: { $gte: ws, $lte: addDays(ws, 6) } }).lean();
      const week = weekSummary(
        profile,
        weekDocs.map((m) => ({ date: m.date as string, slotKey: m.slotKey as string, time: (m.time as string | undefined) ?? undefined, items: (m.items ?? []) as never })),
        meal.date as string,
      );
      const fb = mealFeedback(profile, meal.slotKey as string, items, true, others, (meal.time as string | undefined) ?? undefined, week?.flex);
      const label = (key: string) => profile.mealSlots.find((s) => s.key === key)?.label ?? 'Otra cosa';
      const out = await withAi(req, res, 'mejora', () =>
        generateMealTips({
          slotLabel: slot?.label ?? 'Comida',
          goalLabel: GOAL_LABELS[profile.goal],
          description: (meal.description as string | undefined) ?? '',
          items,
          target: energy && slot ? mealTarget(profile, slot.key, energy) : null,
          day: fb.day
            ? {
                ...fb.day,
                verdict: fb.level,
                week: week && week.level !== 'arranca' ? week.line : undefined,
                meals: others.map((o) => `${label(o.slotKey)}: ${o.items.map((i) => `${i.name}${i.quantity ? ` ${i.quantity} ${i.unit ?? 'g'}` : ''}`).join(', ') || 'sin detalle'}`),
              }
            : null,
        }),
      );
      if (out) res.json({ tips: out.tips });
    }),
  );

  /* ---------------- recetas con lo que hay en casa ---------------- */

  r.post(
    '/pantry-recipes',
    requireUser,
    h(async (req, res) => {
      const body = pantryRequestSchema.parse(req.body);
      const doc = await Profile.findOne({ userId: req.user!.id }).lean();
      const profile = doc?.data as ProfileData | undefined;
      if (!profile) {
        res.status(409).json({ error: 'Primero armá tu perfil.' });
        return;
      }
      const slot = body.slotKey ? profile.mealSlots.find((s) => s.key === body.slotKey) : undefined;
      const energy = estimateEnergy(profile);
      const target = energy && slot ? remainingTarget(profile, slot.key, energy, await mealsOfDay(req.user!.id, todayAR())) : null;
      const out = await withAi(req, res, 'recetas', () =>
        generatePantryRecipes({
          ingredients: body.ingredients,
          slotLabel: slot?.label ?? null,
          goalLabel: GOAL_LABELS[profile.goal],
          target,
          exclude: body.exclude,
        }),
      );
      if (out) res.json({ target, recipes: out.recipes });
    }),
  );

  r.get(
    '/recipes',
    requireUser,
    h(async (req, res) => {
      const docs = await SavedRecipe.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(200).lean();
      res.json(docs.map(toRecipe));
    }),
  );

  r.post(
    '/recipes',
    requireUser,
    h(async (req, res) => {
      const data = recipeSchema.parse(req.body);
      if ((await SavedRecipe.countDocuments({ userId: req.user!.id })) >= 200) {
        res.status(409).json({ error: 'Ya tenés 200 recetas guardadas. Borrá alguna para sumar otra.' });
        return;
      }
      const doc = await SavedRecipe.create({ userId: req.user!.id, data });
      res.status(201).json(toRecipe(doc.toObject()));
    }),
  );

  r.delete(
    '/recipes/:id',
    requireUser,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (id) await SavedRecipe.deleteOne({ _id: id, userId: req.user!.id });
      res.status(204).end();
    }),
  );

  /* ---------------- momentos: notitas y fechas especiales ---------------- */

  r.get(
    '/moments',
    requireUser,
    h(async (req, res) => {
      const today = todayAR();
      const [notes, special] = await Promise.all([
        Note.find({ userId: req.user!.id, openedAt: null, $or: [{ deliverOn: null }, { deliverOn: { $lte: today } }] })
          .sort({ createdAt: 1 })
          .lean(),
        SpecialDate.find({ userId: req.user!.id, monthDay: today.slice(5) }).lean(),
      ]);
      res.json({ notes: notes.map(toNote), special: special.map(toSpecial) });
    }),
  );

  /** Notitas ya abiertas, para releerlas. */
  r.get(
    '/notes',
    requireUser,
    h(async (req, res) => {
      const notes = await Note.find({ userId: req.user!.id, openedAt: { $ne: null } }).sort({ openedAt: -1 }).limit(200).lean();
      res.json(notes.map(toNote));
    }),
  );

  r.post(
    '/notes/:id/open',
    requireUser,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      const doc = id
        ? await Note.findOneAndUpdate({ _id: id, userId: req.user!.id, openedAt: null }, { $set: { openedAt: new Date() } }, { new: true }).lean()
        : null;
      res.json(doc ? toNote(doc) : null);
    }),
  );

  /* ---------------- privacidad ---------------- */

  r.get(
    '/privacy/export',
    requireUser,
    h(async (req, res) => {
      const [profile, meals, days] = await Promise.all([
        Profile.findOne({ userId: req.user!.id }).lean(),
        Meal.find({ userId: req.user!.id }).sort({ date: 1, time: 1 }).lean(),
        Day.find({ userId: req.user!.id }).sort({ date: 1 }).lean(),
      ]);
      const day = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Disposition', `attachment; filename="cachete-nutri-${day}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        user: { username: req.user!.username, displayName: req.user!.displayName },
        profile: profile?.data ?? null,
        meals: meals.map(toMeal),
        days: days.map(toDay),
        notes: (await Note.find({ userId: req.user!.id, openedAt: { $ne: null } }).lean()).map(toNote),
        recipes: (await SavedRecipe.find({ userId: req.user!.id }).lean()).map(toRecipe),
        body: (await BodyEntry.find({ userId: req.user!.id }).sort({ date: 1 }).lean()).map(toBody),
      });
    }),
  );

  /** Borra perfil y comidas de la usuaria. La cuenta queda (la borra el admin). */
  r.delete(
    '/privacy/data',
    requireUser,
    h(async (req, res) => {
      await Promise.all([
        Profile.deleteOne({ userId: req.user!.id }),
        Meal.deleteMany({ userId: req.user!.id }),
        Day.deleteMany({ userId: req.user!.id }),
        SavedRecipe.deleteMany({ userId: req.user!.id }),
        BodyEntry.deleteMany({ userId: req.user!.id }),
      ]);
      res.status(204).end();
    }),
  );

  /* ---------------- admin ---------------- */

  r.get(
    '/admin/users',
    requireAdmin,
    h(async (_req, res) => {
      const users = await User.find().sort({ createdAt: 1 }).lean();
      const ids = users.map((u) => u._id);
      const [profiles, stats] = await Promise.all([
        Profile.find({ userId: { $in: ids } }, { userId: 1 }).lean(),
        Meal.aggregate<{ _id: Types.ObjectId; count: number; last: Date }>([
          { $match: { userId: { $in: ids } } },
          { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
        ]),
      ]);
      const withProfile = new Set(profiles.map((p) => String(p.userId)));
      const byUser = new Map(stats.map((s) => [String(s._id), s]));
      res.json(
        users.map((u) => {
          const s = byUser.get(String(u._id));
          return {
            ...toSessionUser(u),
            active: u.active,
            hasProfile: withProfile.has(String(u._id)),
            mealCount: s?.count ?? 0,
            lastMealAt: s?.last ? new Date(s.last).toISOString() : null,
            createdAt: new Date(u.createdAt).toISOString(),
          };
        }),
      );
    }),
  );

  r.post(
    '/admin/users',
    requireAdmin,
    h(async (req, res) => {
      const data = createUserSchema.parse(req.body);
      if (await User.exists({ username: data.username })) {
        res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
        return;
      }
      const u = await User.create({
        username: data.username,
        displayName: data.displayName,
        role: data.role,
        passwordHash: await hashPassword(data.password),
      });
      res.status(201).json(toSessionUser(u));
    }),
  );

  r.patch(
    '/admin/users/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      const data = updateUserSchema.parse(req.body);
      const u = id ? await User.findById(id) : null;
      if (!u) {
        res.status(404).json({ error: 'No encontramos ese usuario' });
        return;
      }
      if (data.active === false && String(u._id) === req.user!.id) {
        res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
        return;
      }
      if (data.displayName) u.displayName = data.displayName;
      if (typeof data.active === 'boolean') u.active = data.active;
      if (data.password) u.passwordHash = await hashPassword(data.password);
      await u.save();
      // Cambio de contraseña o desactivación: cierra las sesiones abiertas de esa cuenta (menos la propia).
      if ((data.password || data.active === false) && String(u._id) !== req.user!.id) await endAllSessions(String(u._id));
      res.json(toSessionUser(u));
    }),
  );

  /** Borra la cuenta y todos sus datos. */
  r.delete(
    '/admin/users/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (!id) {
        res.status(404).json({ error: 'No encontramos ese usuario' });
        return;
      }
      if (String(id) === req.user!.id) {
        res.status(400).json({ error: 'No podés borrar tu propia cuenta' });
        return;
      }
      await Promise.all([
        Meal.deleteMany({ userId: id }),
        Day.deleteMany({ userId: id }),
        AiUsage.deleteMany({ userId: id }),
        Note.deleteMany({ userId: id }),
        SpecialDate.deleteMany({ userId: id }),
        SavedRecipe.deleteMany({ userId: id }),
        BodyEntry.deleteMany({ userId: id }),
        Profile.deleteOne({ userId: id }),
        endAllSessions(String(id)),
        User.deleteOne({ _id: id }),
      ]);
      res.status(204).end();
    }),
  );

  /* ---------------- admin: notitas y fechas de cada usuaria ---------------- */

  r.get(
    '/admin/users/:id/extras',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (!id) {
        res.status(404).json({ error: 'No encontramos ese usuario' });
        return;
      }
      const [notes, dates] = await Promise.all([
        Note.find({ userId: id }).sort({ createdAt: -1 }).limit(100).lean(),
        SpecialDate.find({ userId: id }).sort({ monthDay: 1 }).lean(),
      ]);
      res.json({ notes: notes.map(toNote), dates: dates.map(toSpecial) });
    }),
  );

  r.post(
    '/admin/users/:id/notes',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (!id || !(await User.exists({ _id: id }))) {
        res.status(404).json({ error: 'No encontramos ese usuario' });
        return;
      }
      const data = noteInputSchema.parse(req.body);
      const doc = await Note.create({ userId: id, fromName: req.user!.displayName, text: data.text, deliverOn: data.deliverOn });
      res.status(201).json(toNote(doc.toObject()));
    }),
  );

  r.delete(
    '/admin/notes/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (id) await Note.deleteOne({ _id: id });
      res.status(204).end();
    }),
  );

  r.post(
    '/admin/users/:id/dates',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (!id || !(await User.exists({ _id: id }))) {
        res.status(404).json({ error: 'No encontramos ese usuario' });
        return;
      }
      const data = specialDateInputSchema.parse(req.body);
      const doc = await SpecialDate.create({ userId: id, ...data });
      res.status(201).json(toSpecial(doc.toObject()));
    }),
  );

  r.delete(
    '/admin/dates/:id',
    requireAdmin,
    h(async (req, res) => {
      const id = oid(req.params.id!);
      if (id) await SpecialDate.deleteOne({ _id: id });
      res.status(204).end();
    }),
  );

  return r;
}
