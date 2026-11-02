import { foodGroupSchema, photoAnalysisSchema, type MealItem, type PhotoAnalysis, type PhotoAnalysisRequest } from '@nutrimapache/shared';
import { env } from './config/env';

/**
 * Análisis de foto con Claude (API de Anthropic).
 * - La clave vive solo acá (variable de entorno del servidor).
 * - Se manda solo la imagen y el nombre de la comida del día: nada que identifique a la persona.
 * - La foto no se guarda: se analiza y se descarta.
 */

export class AnalysisError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const GROUPS = foodGroupSchema.options;
const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cda'] as const;

const SYSTEM = `Ayudás a una app de hábitos alimentarios que acompaña sin culpa. Te llega la foto de una comida y tenés que identificar qué hay en el plato.

Reglas:
- Describí con neutralidad. Nunca califiques la comida (nada de "sano", "poco saludable", "bueno", "malo", "pesado", "liviano") ni hagas recomendaciones, diagnósticos o comentarios sobre el cuerpo.
- Usá nombres comunes en Argentina (ej.: "milanesa", "zapallo", "frutillas").
- Estimá la cantidad de cada ingrediente (g, ml o unidades) y un rango de calorías y de proteína por ingrediente. Los rangos tienen que ser honestos: más amplios cuando la foto no deja ver bien la porción.
- Mencioná en el aviso lo que la foto no permite saber (aceite, manteca, salsas, lo que está tapado), en una oración corta y sin alarmar.
- Máximo 10 ingredientes: agrupá condimentos o cosas mínimas.
- Si la foto no muestra comida ni bebida, marcá es_comida = false y dejá la lista vacía.
Respondé solo usando la herramienta registrar_comida.`;

const TOOL = {
  name: 'registrar_comida',
  description: 'Registra lo identificado en la foto de la comida.',
  input_schema: {
    type: 'object',
    properties: {
      es_comida: { type: 'boolean', description: 'La foto muestra comida o bebida' },
      descripcion: { type: 'string', description: 'Descripción corta y neutra del plato, máximo 120 caracteres' },
      ingredientes: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            cantidad: { type: 'number', description: 'Cantidad estimada' },
            unidad: { type: 'string', enum: UNITS },
            grupo: { type: 'string', enum: GROUPS },
            kcal_min: { type: 'number' },
            kcal_max: { type: 'number' },
            proteina_min_g: { type: 'number' },
            proteina_max_g: { type: 'number' },
            confianza: { type: 'string', enum: ['baja', 'media', 'alta'] },
          },
          required: ['nombre', 'grupo', 'kcal_min', 'kcal_max', 'proteina_min_g', 'proteina_max_g', 'confianza'],
        },
      },
      aviso_incertidumbre: { type: 'string', description: 'Qué no se puede saber desde la foto, una oración' },
    },
    required: ['es_comida', 'descripcion', 'ingredientes', 'aviso_incertidumbre'],
  },
} as const;

interface RawItem {
  nombre?: unknown;
  cantidad?: unknown;
  unidad?: unknown;
  grupo?: unknown;
  kcal_min?: unknown;
  kcal_max?: unknown;
  proteina_min_g?: unknown;
  proteina_max_g?: unknown;
  confianza?: unknown;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const range = (a: unknown, b: unknown, cap: number) => {
  const x = num(a);
  const y = num(b);
  if (x === undefined && y === undefined) return undefined;
  const lo = Math.min(x ?? y!, y ?? x!, cap);
  const hi = Math.min(Math.max(x ?? y!, y ?? x!), cap);
  return { min: Math.round(lo), max: Math.round(hi) };
};

function toItem(r: RawItem): MealItem | null {
  const name = typeof r.nombre === 'string' ? r.nombre.trim().slice(0, 60) : '';
  if (!name) return null;
  const qty = num(r.cantidad);
  const unit = UNITS.includes(r.unidad as (typeof UNITS)[number]) ? (r.unidad as (typeof UNITS)[number]) : undefined;
  return {
    name,
    quantity: qty && qty > 0 ? Math.round(qty * 10) / 10 : undefined,
    unit: qty && qty > 0 ? unit ?? 'g' : undefined,
    group: GROUPS.includes(r.grupo as (typeof GROUPS)[number]) ? (r.grupo as MealItem['group']) : 'otro',
    kcal: range(r.kcal_min, r.kcal_max, 3000),
    protein: range(r.proteina_min_g, r.proteina_max_g, 300),
    confidence: r.confianza === 'alta' || r.confianza === 'media' ? r.confianza : 'baja',
    source: 'ia',
    editedByUser: false,
  };
}

export interface AnalysisResult {
  analysis: PhotoAnalysis;
  usage: { inputTokens: number; outputTokens: number };
}

export async function analyzePhoto(req: PhotoAnalysisRequest): Promise<AnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) throw new AnalysisError(503, 'El análisis con foto todavía no está configurado.');

  const userText = req.slotLabel ? `Foto de: ${req.slotLabel}.` : 'Foto de una comida.';
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.image } },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error('[analysis] sin respuesta de Anthropic:', (err as Error).message);
    throw new AnalysisError(502, 'No pudimos analizar la foto ahora. Probá de nuevo o anotala a mano.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[analysis] Anthropic ${res.status}: ${body.slice(0, 500)}`);
    if (res.status === 429 || res.status === 529) throw new AnalysisError(503, 'El análisis está ocupado. Probá de nuevo en un ratito.');
    throw new AnalysisError(502, 'No pudimos analizar la foto ahora. Probá de nuevo o anotala a mano.');
  }

  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: Record<string, unknown> }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const usage = { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  const call = data.content?.find((c) => c.type === 'tool_use' && c.name === TOOL.name)?.input;
  if (!call) throw new AnalysisError(502, 'No pudimos leer la foto. Probá con otra o anotala a mano.');

  const rawItems = Array.isArray(call.ingredientes) ? (call.ingredientes as RawItem[]) : [];
  const items = rawItems.map(toItem).filter((x): x is MealItem => x !== null).slice(0, 10);
  const parsed = photoAnalysisSchema.safeParse({
    description: typeof call.descripcion === 'string' ? call.descripcion.trim().slice(0, 280) : '',
    items,
    notFood: call.es_comida === false,
    uncertaintyNote: typeof call.aviso_incertidumbre === 'string' ? call.aviso_incertidumbre.trim().slice(0, 280) : '',
  });
  if (!parsed.success) {
    console.error('[analysis] respuesta fuera de formato', parsed.error.issues.slice(0, 3));
    throw new AnalysisError(502, 'No pudimos leer la foto. Probá con otra o anotala a mano.');
  }
  return { analysis: parsed.data, usage };
}

/** Fecha de hoy en Argentina, para contar el tope diario. */
export function todayAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}
