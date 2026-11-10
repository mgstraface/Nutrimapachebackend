import {
  foodGroupSchema,
  mealIdeaSchema,
  photoAnalysisSchema,
  recipeSchema,
  sumRanges,
  type MealIdea,
  type MealItem,
  type PhotoAnalysis,
  type PhotoAnalysisRequest,
  type Range,
  type Recipe,
  type TextAnalysisRequest,
} from '@nutrimapache/shared';
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

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Llama a Claude forzando una herramienta y devuelve lo que puso en ella. */
async function callClaude(opts: {
  system: string;
  tool: { name: string; description: string; input_schema: unknown };
  content: unknown[];
  maxTokens: number;
}): Promise<{ input: Record<string, unknown>; usage: Usage }> {
  if (!env.ANTHROPIC_API_KEY) throw new AnalysisError(503, 'Esta función todavía no está configurada.');
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
        max_tokens: opts.maxTokens,
        system: opts.system,
        tools: [opts.tool],
        tool_choice: { type: 'tool', name: opts.tool.name },
        messages: [{ role: 'user', content: opts.content }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error('[ia] sin respuesta de Anthropic:', (err as Error).message);
    throw new AnalysisError(502, 'No pudimos conectarnos ahora. Probá de nuevo en un ratito.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[ia] Anthropic ${res.status}: ${body.slice(0, 500)}`);
    if (res.status === 429 || res.status === 529) throw new AnalysisError(503, 'Está todo un poco ocupado. Probá de nuevo en un ratito.');
    throw new AnalysisError(502, 'No pudimos resolverlo ahora. Probá de nuevo en un ratito.');
  }
  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: Record<string, unknown> }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const usage = { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  const input = data.content?.find((c) => c.type === 'tool_use' && c.name === opts.tool.name)?.input;
  if (!input) throw new AnalysisError(502, 'No pudimos leer la respuesta. Probá de nuevo.');
  return { input, usage };
}

export interface AnalysisResult {
  analysis: PhotoAnalysis;
  usage: Usage;
}

export async function analyzePhoto(req: PhotoAnalysisRequest): Promise<AnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) throw new AnalysisError(503, 'El análisis con foto todavía no está configurado.');
  const { input: call, usage } = await callClaude({
    system: SYSTEM,
    tool: TOOL,
    maxTokens: 1200,
    content: [
      { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.image } },
      { type: 'text', text: req.slotLabel ? `Foto de: ${req.slotLabel}.` : 'Foto de una comida.' },
    ],
  });

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

/** Misma herramienta que la foto, pero desde lo que la persona escribió. */
export async function analyzeText(req: TextAnalysisRequest): Promise<AnalysisResult> {
  const lines = [
    req.slotLabel ? `Comida: ${req.slotLabel}.` : '',
    req.description ? `Lo que contó: ${req.description}` : '',
    req.items.length
      ? `Ingredientes que anotó (respetá nombres y cantidades; si falta la cantidad, asumí una porción normal):\n${req.items
          .map((i) => `- ${i.name}${i.quantity ? `: ${i.quantity} ${i.unit ?? 'g'}` : ''}`)
          .join('\n')}`
      : '',
    'No hay foto: estimá a partir de este texto. es_comida = true salvo que claramente no sea comida.',
  ].filter(Boolean);
  const { input: call, usage } = await callClaude({ system: SYSTEM, tool: TOOL, maxTokens: 1200, content: [{ type: 'text', text: lines.join('\n') }] });
  const rawItems = Array.isArray(call.ingredientes) ? (call.ingredientes as RawItem[]) : [];
  const items = rawItems.map(toItem).filter((x): x is MealItem => x !== null).slice(0, 20);
  const parsed = photoAnalysisSchema.safeParse({
    description: typeof call.descripcion === 'string' ? call.descripcion.trim().slice(0, 280) : req.description,
    items,
    notFood: false,
    uncertaintyNote: typeof call.aviso_incertidumbre === 'string' ? call.aviso_incertidumbre.trim().slice(0, 280) : '',
  });
  if (!parsed.success || !items.length) throw new AnalysisError(502, 'No pudimos calcularlo ahora. Probá de nuevo.');
  return { analysis: parsed.data, usage };
}

/* ---------------- Inspiración: ideas de comidas ---------------- */

const IDEAS_SYSTEM = `Proponés ideas de comidas para una app de hábitos alimentarios que acompaña sin culpa.

Reglas:
- Comida casera y simple, con ingredientes que se consiguen en cualquier súper o verdulería de Argentina. Nombres locales.
- Tres ideas bien distintas entre sí: al menos una rápida (15 minutos o menos).
- Ajustá las porciones para que cada idea quede dentro del rango orientativo de calorías y cerca de la proteína indicada. Si no hay rango, usá porciones normales para esa comida.
- Cantidades concretas por ingrediente (g, ml o unidades) y un rango de calorías y proteína por ingrediente.
- Nada de lenguaje de dieta ni de culpa ("light", "permitido", "pecado", "quemar", "detox"), ni suplementos, ayunos o productos de marca.
- Descripción en una oración amable, en español rioplatense.
- Si la comida es una vianda, que viaje bien y se pueda comer fría o recalentada.
Respondé solo usando la herramienta proponer_ideas.`;

const IDEA_TAGS = ['vianda', 'rápida', 'sin cocción', 'dulce', 'salada', 'económica', 'post-entreno'] as const;

const IDEAS_TOOL = {
  name: 'proponer_ideas',
  description: 'Tres ideas de comida para el momento indicado.',
  input_schema: {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', description: 'Nombre corto del plato' },
            descripcion: { type: 'string', description: 'Una oración' },
            minutos: { type: 'number', description: 'Minutos de preparación' },
            etiquetas: { type: 'array', items: { type: 'string', enum: IDEA_TAGS }, maxItems: 3 },
            ingredientes: TOOL.input_schema.properties.ingredientes,
          },
          required: ['titulo', 'descripcion', 'ingredientes'],
        },
      },
    },
    required: ['ideas'],
  },
} as const;

export interface IdeasContext {
  slotLabel: string;
  time: string;
  goalLabel: string;
  target: { kcal: Range; protein: Range } | null;
  vianda: boolean;
  trainedToday: boolean;
  exclude: string[];
}

export async function generateIdeas(ctx: IdeasContext): Promise<{ ideas: MealIdea[]; usage: Usage }> {
  const lines = [
    `Comida: ${ctx.slotLabel} (alrededor de las ${ctx.time}).`,
    `Objetivo general: ${ctx.goalLabel}.`,
    ctx.target
      ? `Rango orientativo para esta comida: ${ctx.target.kcal.min}–${ctx.target.kcal.max} kcal, con ${ctx.target.protein.min}–${ctx.target.protein.max} g de proteína.`
      : 'Sin rango de calorías: porciones normales.',
    ctx.vianda ? 'Es una vianda para llevar al trabajo.' : '',
    ctx.trainedToday ? 'Hoy entrenó: que tenga una buena fuente de proteína.' : '',
    ctx.exclude.length ? `No repitas estas ideas: ${ctx.exclude.join(', ')}.` : '',
  ].filter(Boolean);

  const { input, usage } = await callClaude({
    system: IDEAS_SYSTEM,
    tool: IDEAS_TOOL,
    maxTokens: 2000,
    content: [{ type: 'text', text: lines.join('\n') }],
  });

  const raw = Array.isArray(input.ideas) ? (input.ideas as Record<string, unknown>[]) : [];
  const ideas: MealIdea[] = [];
  for (const r of raw.slice(0, 3)) {
    const items = (Array.isArray(r.ingredientes) ? (r.ingredientes as RawItem[]) : [])
      .map(toItem)
      .filter((x): x is MealItem => x !== null)
      .slice(0, 12);
    const parsed = mealIdeaSchema.safeParse({
      title: typeof r.titulo === 'string' ? r.titulo.trim().slice(0, 80) : '',
      description: typeof r.descripcion === 'string' ? r.descripcion.trim().slice(0, 200) : '',
      items,
      // Los totales se calculan acá sumando ingredientes; no se confía en un total suelto.
      kcal: sumRanges(items.map((i) => i.kcal)),
      protein: sumRanges(items.map((i) => i.protein)),
      prepMinutes: num(r.minutos) !== undefined ? Math.min(240, Math.round(num(r.minutos)!)) : undefined,
      tags: Array.isArray(r.etiquetas) ? (r.etiquetas as unknown[]).filter((t): t is string => IDEA_TAGS.includes(t as (typeof IDEA_TAGS)[number])).slice(0, 3) : [],
    });
    if (parsed.success && parsed.data.title && parsed.data.items.length) ideas.push(parsed.data);
  }
  if (!ideas.length) throw new AnalysisError(502, 'No pudimos armar ideas ahora. Probá de nuevo.');
  return { ideas, usage };
}

/* ---------------- "¿Cómo la mejoro?" ---------------- */

const TIPS_SYSTEM = `Sos Cachete, la compañera de una app de hábitos alimentarios que acompaña sin culpa.
Te pasan una comida que la persona ya comió y tenés que darle 2 ideas concretas para una próxima vez parecida.

Reglas:
- Las ideas mantienen el plato que le gusta: cambiar la cocción (al horno en vez de frito), ajustar una porción, sumar verdura o proteína, cambiar un acompañamiento.
- Tono cálido y breve, en español rioplatense, una oración cada idea. Empezá con un verbo ("Probá…", "Sumale…", "La próxima…").
- Nada de culpa ni de dieta: no uses "mal", "exceso", "te pasaste", "prohibido", "compensar", "light", "quemar". No sugieras saltear comidas ni ayunos.
- Si la comida ya está equilibrada, una de las ideas puede ser solo para variar o hacerla más rica.
- Mirá el día entero, no solo esta comida: si vino más cargada que lo típico pero el día viene equilibrado o liviano, no lo trates como algo a corregir (no sugieras achicarla); en ese caso las ideas son para sumar nutrientes o variar. Si el día viene liviano, nunca sugieras comer menos. Lo mismo con la semana: si viene con margen, un día más cargado (típico del finde) está bien; si viene por encima, nunca propongas compensar comiendo de menos.
Respondé solo usando la herramienta dar_ideas.`;

const TIPS_TOOL = {
  name: 'dar_ideas',
  description: 'Dos ideas amables para una próxima vez.',
  input_schema: {
    type: 'object',
    properties: { ideas: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 } },
    required: ['ideas'],
  },
} as const;

const BAD_WORDS = /\b(mal|malo|exceso|te pasaste|prohibid|compensar|light|quemar|culpa|ayun)/i;

export async function generateMealTips(ctx: {
  slotLabel: string;
  goalLabel: string;
  description: string;
  items: MealItem[];
  target: { kcal: Range; protein: Range } | null;
  /** Cómo viene el día (lo comido antes, lo esperable a esta altura) y qué concluyó la miradita */
  day: { soFar: Range; expected: Range; day: Range; balance: string; verdict: string; meals: string[]; week?: string } | null;
}): Promise<{ tips: string[]; usage: Usage }> {
  const total = sumRanges(ctx.items.map((i) => i.kcal));
  const prot = sumRanges(ctx.items.map((i) => i.protein));
  const lines = [
    `Comida: ${ctx.slotLabel}. Objetivo general: ${ctx.goalLabel}.`,
    ctx.description ? `Descripción: ${ctx.description}.` : '',
    ctx.items.length
      ? `Ingredientes: ${ctx.items.map((i) => `${i.name}${i.quantity ? ` (${i.quantity} ${i.unit ?? 'g'})` : ''}`).join(', ')}.`
      : '',
    total ? `Estimado: ${total.min}–${total.max} kcal${prot ? `, ${prot.min}–${prot.max} g de proteína` : ''}.` : '',
    ctx.target ? `Rango orientativo para esta comida: ${ctx.target.kcal.min}–${ctx.target.kcal.max} kcal y ${ctx.target.protein.min}–${ctx.target.protein.max} g de proteína.` : '',
    ctx.day?.meals.length ? `Otras comidas del mismo día: ${ctx.day.meals.join(' · ')}.` : '',
    ctx.day
      ? `En el día, contando esta comida, lleva ${ctx.day.soFar.min}–${ctx.day.soFar.max} kcal; a esta altura lo esperable es ${ctx.day.expected.min}–${ctx.day.expected.max} y el rango del día es ${ctx.day.day.min}–${ctx.day.day.max}. ${
          ctx.day.balance === 'adelante' ? 'El día viene más cargado de lo esperable.' : ctx.day.balance === 'atras' ? 'El día viene más liviano de lo esperable.' : 'El día viene equilibrado.'
        }`
      : '',
    ctx.day?.week ? `Cómo viene la semana: ${ctx.day.week}` : '',
  ].filter(Boolean);
  const { input, usage } = await callClaude({ system: TIPS_SYSTEM, tool: TIPS_TOOL, maxTokens: 400, content: [{ type: 'text', text: lines.join('\n') }] });
  const tips = (Array.isArray(input.ideas) ? input.ideas : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().slice(0, 220))
    .filter((t) => t && !BAD_WORDS.test(t))
    .slice(0, 2);
  if (!tips.length) throw new AnalysisError(502, 'No pudimos armar ideas ahora. Probá de nuevo.');
  return { tips, usage };
}

/* ---------------- Recetas con lo que hay en casa ---------------- */

const PANTRY_SYSTEM = `Armás recetas caseras con lo que la persona tiene en su casa, para una app de hábitos alimentarios que acompaña sin culpa.

Reglas:
- Usá principalmente los ingredientes de la lista. Podés asumir que hay básicos: sal, pimienta, aceite, ajo, cebolla, especias secas, agua. Si una receta necesita algo más, ponelo en "faltan" (como mucho 2 cosas) y preferí recetas que no necesiten nada extra.
- Dos o tres recetas bien distintas entre sí, simples, con pasos cortos y concretos (máximo 6 pasos).
- Todo para UNA porción: cantidad de cada ingrediente y su rango de calorías y proteína para esa porción. Si hay un rango orientativo para la comida, ajustá las cantidades a ese rango.
- Nombres y expresiones de Argentina. Nada de lenguaje de dieta ni de culpa ("light", "permitido", "pecado", "quemar", "detox").
Respondé solo usando la herramienta proponer_recetas.`;

const RECIPE_TAGS = ['rápida', 'al horno', 'una olla', 'vianda', 'sin cocción', 'económica', 'dulce', 'salada'] as const;

const PANTRY_TOOL = {
  name: 'proponer_recetas',
  description: 'Recetas con lo que hay en casa.',
  input_schema: {
    type: 'object',
    properties: {
      recetas: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            descripcion: { type: 'string', description: 'Una oración' },
            minutos: { type: 'number' },
            etiquetas: { type: 'array', items: { type: 'string', enum: RECIPE_TAGS }, maxItems: 3 },
            faltan: { type: 'array', items: { type: 'string' }, maxItems: 2 },
            pasos: { type: 'array', items: { type: 'string' }, maxItems: 6 },
            ingredientes: TOOL.input_schema.properties.ingredientes,
          },
          required: ['titulo', 'descripcion', 'pasos', 'ingredientes'],
        },
      },
    },
    required: ['recetas'],
  },
} as const;

export async function generatePantryRecipes(ctx: {
  ingredients: string[];
  slotLabel: string | null;
  goalLabel: string;
  target: { kcal: Range; protein: Range } | null;
  exclude: string[];
}): Promise<{ recipes: Recipe[]; usage: Usage }> {
  const lines = [
    `Tengo en casa: ${ctx.ingredients.join(', ')}.`,
    ctx.slotLabel ? `Es para: ${ctx.slotLabel}. Una porción.` : 'Para cualquier momento del día. Una porción.',
    `Objetivo general: ${ctx.goalLabel}.`,
    ctx.target ? `Rango orientativo por porción: ${ctx.target.kcal.min}–${ctx.target.kcal.max} kcal y ${ctx.target.protein.min}–${ctx.target.protein.max} g de proteína.` : '',
    ctx.exclude.length ? `No repitas: ${ctx.exclude.join(', ')}.` : '',
  ].filter(Boolean);
  const { input, usage } = await callClaude({ system: PANTRY_SYSTEM, tool: PANTRY_TOOL, maxTokens: 2600, content: [{ type: 'text', text: lines.join('\n') }] });
  const raw = Array.isArray(input.recetas) ? (input.recetas as Record<string, unknown>[]) : [];
  const recipes: Recipe[] = [];
  for (const r of raw.slice(0, 3)) {
    const items = (Array.isArray(r.ingredientes) ? (r.ingredientes as RawItem[]) : []).map(toItem).filter((x): x is MealItem => x !== null).slice(0, 16);
    const strs = (v: unknown, max: number, len: number) =>
      (Array.isArray(v) ? v : [])
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        .map((x) => x.trim().slice(0, len))
        .slice(0, max);
    const parsed = recipeSchema.safeParse({
      title: typeof r.titulo === 'string' ? r.titulo.trim().slice(0, 80) : '',
      description: typeof r.descripcion === 'string' ? r.descripcion.trim().slice(0, 200) : '',
      items,
      steps: strs(r.pasos, 6, 240),
      missing: strs(r.faltan, 2, 40),
      kcal: sumRanges(items.map((i) => i.kcal)),
      protein: sumRanges(items.map((i) => i.protein)),
      prepMinutes: num(r.minutos) !== undefined ? Math.min(240, Math.round(num(r.minutos)!)) : undefined,
      servings: 1,
      tags: strs(r.etiquetas, 3, 20).filter((t) => RECIPE_TAGS.includes(t as (typeof RECIPE_TAGS)[number])),
    });
    if (parsed.success && parsed.data.items.length && parsed.data.steps.length) recipes.push(parsed.data);
  }
  if (!recipes.length) throw new AnalysisError(502, 'No pudimos armar recetas ahora. Probá de nuevo.');
  return { recipes, usage };
}

/** Fecha de hoy en Argentina, para contar el tope diario. */
export function todayAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}
