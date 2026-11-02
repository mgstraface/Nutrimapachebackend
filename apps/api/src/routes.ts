import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import {
  PROFILE_TEMPLATES,
  createUserSchema,
  GOAL_LABELS,
  dayLogSchema,
  estimateEnergy,
  inspirationRequestSchema,
  loginSchema,
  mealTarget,
  photoAnalysisRequestSchema,
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
import { AnalysisError, analyzePhoto, generateIdeas, todayAR } from './analysis';
import { dbReady } from './config/db';
import { env } from './config/env';
import { AiUsage, Day, Meal, Profile, User, toDay, toMeal, toSessionUser } from './models';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

const oid = (id: string) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null);

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
      res.json({ user: toSessionUser(user), profile: profile?.data ?? null });
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
      res.json({ user: req.user, profile: profile?.data ?? null });
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
      const target = energy ? mealTarget(profile, slotKey, energy) : null;
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
        Profile.deleteOne({ userId: id }),
        endAllSessions(String(id)),
        User.deleteOne({ _id: id }),
      ]);
      res.status(204).end();
    }),
  );

  return r;
}
