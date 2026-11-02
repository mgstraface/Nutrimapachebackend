import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'No encontrado' });
};

/** Nunca devuelve trazas al cliente. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: first?.message && !first.message.startsWith('Required') ? first.message : 'Revisá los datos ingresados',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 11000) {
    res.status(409).json({ error: 'Ese dato ya existe' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'La foto es muy pesada. Probá con otra.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Algo no salió como esperábamos' });
};
