import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'No encontrado' });
};

/** Nunca devuelve trazas al cliente. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Datos inválidos', issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Algo no salió como esperábamos' });
};
