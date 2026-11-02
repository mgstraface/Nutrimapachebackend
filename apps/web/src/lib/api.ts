export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Opts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** Llama a la API con la cookie de sesión. Tira ApiError con un mensaje listo para mostrar. */
export async function api<T>(path: string, { method = 'GET', body }: Opts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No hay conexión. Revisá internet y probá de nuevo.');
  }
  if (!res.ok) {
    let message = 'Algo no salió como esperábamos. Probá de nuevo.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Algo no salió como esperábamos.');
