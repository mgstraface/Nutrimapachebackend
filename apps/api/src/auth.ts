import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { SessionUser } from '@nutrimapache/shared';
import { isProd } from './config/env';
import { Session, User, toSessionUser } from './models';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const COOKIE = 'cn_session';
const SESSION_DAYS = 180; // la app instalada queda logueada; se cierra a mano desde "Yo"

/* ---------- contraseñas (scrypt, sin dependencias extra) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ---------- sesiones ---------- */

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await Session.create({ tokenHash: sha256(token), userId, expiresAt });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (token) await Session.deleteOne({ tokenHash: sha256(token) });
  res.clearCookie(COOKIE, { path: '/' });
}

export async function endAllSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId });
}

/** Si hay una cookie válida, deja el usuario en req.user. */
export const loadUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE];
    if (token) {
      const s = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
      if (s) {
        const u = await User.findById(s.userId).lean();
        if (u && u.active) req.user = toSessionUser(u) as SessionUser;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Necesitás iniciar sesión' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Necesitás iniciar sesión' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Solo para el admin' });
    return;
  }
  next();
}

/* ---------- freno a intentos de login (en memoria, alcanza para una instancia) ---------- */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() > a.until) {
    attempts.delete(key);
    return false;
  }
  return a.count >= MAX_FAILS;
}

export function loginFailed(key: string): void {
  const a = attempts.get(key);
  if (!a || Date.now() > a.until) attempts.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else a.count += 1;
}

export function loginOk(key: string): void {
  attempts.delete(key);
}

/* ---------- admin inicial ---------- */

export async function ensureAdmin(username: string, password?: string): Promise<void> {
  const exists = await User.exists({ role: 'admin' });
  if (exists) return;
  if (!password) {
    console.warn('[auth] No hay ningún admin y falta ADMIN_PASSWORD en el .env');
    return;
  }
  await User.create({
    username: username.toLowerCase(),
    displayName: username,
    passwordHash: await hashPassword(password),
    role: 'admin',
  });
  console.log(`[auth] Admin inicial creado: ${username}`);
}
