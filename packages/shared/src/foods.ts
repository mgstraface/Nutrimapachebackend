import type { FoodGroup, MealItem } from './meal';
import type { Range } from './range';

/**
 * Catálogo local de alimentos comunes en Argentina, para estimar sin IA.
 * Valores aproximados por 100 g (o 100 ml) de alimento listo para comer, de tablas
 * nutricionales generales. Siempre se muestran como rango: es una orientación.
 */
export interface Food {
  name: string;
  group: FoodGroup;
  /** kcal y proteína (g) cada 100 g / 100 ml */
  kcal: number;
  protein: number;
  /** Unidad sugerida al elegirlo */
  unit: 'g' | 'ml' | 'unidad' | 'porción' | 'taza' | 'cda';
  /** Cantidad sugerida en esa unidad */
  qty: number;
  /** Gramos de una unidad / porción (si aplica) */
  each?: number;
  /** Gramos de una taza y una cucharada, si difieren de lo normal */
  cup?: number;
  spoon?: number;
  aliases?: string[];
}

type Row = [name: string, group: FoodGroup, kcal: number, protein: number, unit: Food['unit'], qty: number, each?: number, aliases?: string];

// prettier-ignore
const ROWS: Row[] = [
  // proteínas
  ['Huevo', 'proteína', 143, 12.6, 'unidad', 1, 55, 'huevos,huevo duro,huevo frito,huevo revuelto'],
  ['Clara de huevo', 'proteína', 52, 10.9, 'unidad', 2, 33, 'claras'],
  ['Pechuga de pollo', 'proteína', 165, 31, 'g', 150, undefined, 'pollo,suprema,pollo a la plancha,pollo grillado'],
  ['Pata muslo de pollo', 'proteína', 210, 26, 'unidad', 1, 180, 'muslo,pata muslo'],
  ['Milanesa de pollo', 'proteína', 230, 20, 'unidad', 1, 130, 'mila de pollo'],
  ['Milanesa de carne', 'proteína', 260, 19, 'unidad', 1, 130, 'milanesa,mila'],
  ['Carne vacuna magra', 'proteína', 180, 28, 'g', 150, undefined, 'carne,bife,lomo,peceto,cuadril,nalga,bola de lomo'],
  ['Asado', 'proteína', 300, 24, 'g', 200, undefined, 'tira de asado,vacío,matambre,entraña'],
  ['Carne picada', 'proteína', 220, 25, 'g', 150, undefined, 'picada,carne molida'],
  ['Hamburguesa', 'proteína', 250, 17, 'unidad', 1, 110, 'medallón,burger'],
  ['Cerdo (bondiola, carré)', 'proteína', 210, 27, 'g', 150, undefined, 'cerdo,bondiola,carré,solomillo'],
  ['Chorizo', 'proteína', 330, 15, 'unidad', 1, 100, 'choripán sin pan'],
  ['Salchicha', 'proteína', 270, 12, 'unidad', 1, 45, 'pancho sin pan,vienissima'],
  ['Merluza', 'proteína', 90, 18, 'g', 150, undefined, 'pescado,filet de merluza,pescado blanco'],
  ['Salmón', 'proteína', 208, 20, 'g', 150, undefined],
  ['Atún al natural', 'proteína', 116, 26, 'g', 120, undefined, 'atun,lata de atún'],
  ['Atún en aceite', 'proteína', 198, 25, 'g', 120, undefined],
  ['Jamón cocido', 'proteína', 120, 18, 'g', 40, undefined, 'jamón,feta de jamón'],
  ['Jamón crudo', 'proteína', 240, 26, 'g', 30, undefined],
  ['Tofu', 'proteína', 120, 13, 'g', 120, undefined],
  ['Lentejas cocidas', 'proteína', 116, 9, 'g', 180, undefined, 'lentejas,guiso de lentejas'],
  ['Garbanzos cocidos', 'proteína', 164, 8.9, 'g', 150, undefined, 'garbanzos,hummus'],
  ['Porotos cocidos', 'proteína', 127, 8.7, 'g', 150, undefined, 'porotos,frijoles,alubias'],
  ['Arvejas', 'verdura', 81, 5.4, 'g', 100, undefined, 'arvejas en lata'],
  ['Proteína en polvo', 'proteína', 390, 78, 'g', 30, undefined, 'whey,scoop,proteína'],
  // lácteos
  ['Leche', 'lácteo', 62, 3.2, 'ml', 200, undefined, 'leche entera'],
  ['Leche descremada', 'lácteo', 35, 3.3, 'ml', 200, undefined, 'leche light'],
  ['Yogur natural', 'lácteo', 65, 3.8, 'g', 190, undefined, 'yogurt,yogur'],
  ['Yogur griego', 'lácteo', 110, 8, 'g', 150, undefined, 'griego'],
  ['Yogur bebible', 'lácteo', 80, 2.8, 'ml', 200, undefined],
  ['Queso cremoso', 'lácteo', 300, 20, 'g', 40, undefined, 'queso,cremoso,queso por salut,port salut'],
  ['Queso untable', 'lácteo', 200, 8, 'g', 20, undefined, 'queso crema,casancrem,finlandia,queso blanco'],
  ['Queso rallado', 'lácteo', 400, 33, 'cda', 1, undefined, 'parmesano,reggianito'],
  ['Queso de máquina', 'lácteo', 330, 25, 'g', 30, undefined, 'queso en fetas,feta de queso,dambo,tybo'],
  ['Ricota', 'lácteo', 150, 11, 'g', 80, undefined],
  ['Mozzarella', 'lácteo', 280, 22, 'g', 50, undefined, 'muzzarella'],
  ['Manteca', 'grasa', 717, 0.9, 'g', 10, undefined, 'mantequilla'],
  ['Dulce de leche', 'otro', 315, 6.8, 'cda', 1, undefined],
  ['Helado', 'otro', 210, 3.5, 'g', 150, undefined, 'helado de crema'],
  // cereales y panificados
  ['Pan francés', 'cereal', 270, 9, 'unidad', 1, 60, 'pan,flauta,mignon,pancito'],
  ['Pan lactal', 'cereal', 260, 8.5, 'unidad', 2, 25, 'pan de molde,rodaja de pan,feta de pan'],
  ['Pan integral', 'cereal', 240, 10, 'unidad', 2, 30, 'pan de salvado,pan negro'],
  ['Tostadas', 'cereal', 390, 11, 'unidad', 2, 10, 'tostada,tostadas de arroz,galleta de arroz'],
  ['Galletitas de agua', 'cereal', 430, 10, 'unidad', 4, 7, 'galletas de agua,criollitas,crackers'],
  ['Galletitas dulces', 'otro', 470, 6, 'unidad', 3, 10, 'galletitas,galletas'],
  ['Medialuna', 'cereal', 410, 7, 'unidad', 1, 45, 'medialunas,factura,facturas'],
  ['Tortilla de trigo', 'cereal', 300, 8, 'unidad', 1, 45, 'wrap,rapidita,tortilla mexicana'],
  ['Arroz cocido', 'cereal', 130, 2.7, 'g', 180, undefined, 'arroz,arroz blanco'],
  ['Arroz integral cocido', 'cereal', 112, 2.6, 'g', 180, undefined, 'arroz integral'],
  ['Fideos cocidos', 'cereal', 157, 5.8, 'g', 220, undefined, 'fideos,pasta,spaghetti,tallarines,mostachol,tirabuzón'],
  ['Ravioles', 'cereal', 210, 8, 'g', 250, undefined, 'raviolones,sorrentinos,pasta rellena'],
  ['Ñoquis', 'cereal', 160, 4, 'g', 250, undefined, 'ñoqui'],
  ['Polenta cocida', 'cereal', 70, 1.6, 'g', 250, undefined, 'polenta'],
  ['Avena', 'cereal', 380, 13, 'cda', 3, undefined, 'avena arrollada,copos de avena'],
  ['Granola', 'cereal', 450, 10, 'g', 40, undefined],
  ['Copos de maíz', 'cereal', 380, 7, 'g', 30, undefined, 'cereales,corn flakes'],
  ['Quinoa cocida', 'cereal', 120, 4.4, 'g', 150, undefined, 'quinoa'],
  ['Papa', 'cereal', 87, 1.9, 'g', 200, undefined, 'papas,papa hervida,papa al horno'],
  ['Puré de papa', 'cereal', 110, 2, 'g', 200, undefined, 'puré'],
  ['Papas fritas', 'cereal', 312, 3.4, 'g', 150, undefined, 'fritas'],
  ['Batata', 'cereal', 90, 2, 'g', 200, undefined, 'boniato,camote'],
  ['Choclo', 'verdura', 96, 3.4, 'g', 100, undefined, 'maíz,granos de choclo'],
  ['Pizza', 'cereal', 270, 11, 'porción', 2, 110, 'porción de pizza,muzza,pizza de muzzarella'],
  ['Empanada', 'cereal', 280, 10, 'unidad', 2, 90, 'empanadas'],
  ['Tarta de verdura', 'cereal', 230, 7, 'porción', 1, 180, 'tarta,pascualina'],
  ['Tarta de jamón y queso', 'cereal', 280, 12, 'porción', 1, 180],
  ['Sándwich de miga', 'cereal', 250, 9, 'unidad', 2, 45, 'sanguchito de miga,miga'],
  ['Alfajor', 'otro', 440, 5, 'unidad', 1, 50, 'alfajores'],
  ['Bizcochuelo', 'otro', 330, 6, 'porción', 1, 70, 'torta,budín'],
  // verduras
  ['Lechuga', 'verdura', 15, 1.4, 'g', 60, undefined, 'ensalada verde,rúcula,hojas verdes'],
  ['Tomate', 'verdura', 18, 0.9, 'unidad', 1, 120, 'tomates,tomate cherry'],
  ['Zanahoria', 'verdura', 41, 0.9, 'unidad', 1, 80, 'zanahorias,zanahoria rallada'],
  ['Cebolla', 'verdura', 40, 1.1, 'unidad', 1, 110, 'cebollas'],
  ['Morrón', 'verdura', 26, 1, 'unidad', 1, 150, 'pimiento,morrón rojo'],
  ['Zapallo', 'verdura', 26, 1, 'g', 200, undefined, 'calabaza,zapallo anco,puré de calabaza'],
  ['Zapallito', 'verdura', 17, 1.2, 'unidad', 1, 200, 'zucchini,zapallitos'],
  ['Berenjena', 'verdura', 25, 1, 'g', 150, undefined],
  ['Brócoli', 'verdura', 34, 2.8, 'g', 150, undefined, 'brocoli'],
  ['Espinaca', 'verdura', 23, 2.9, 'g', 100, undefined, 'acelga,espinacas'],
  ['Champiñones', 'verdura', 22, 3.1, 'g', 100, undefined, 'hongos'],
  ['Pepino', 'verdura', 15, 0.7, 'g', 100, undefined],
  ['Remolacha', 'verdura', 43, 1.6, 'g', 100, undefined],
  ['Repollo', 'verdura', 25, 1.3, 'g', 100, undefined, 'repollo colorado,coleslaw'],
  ['Verduras salteadas', 'verdura', 60, 2, 'g', 200, undefined, 'wok de verduras,salteado'],
  ['Ensalada mixta', 'verdura', 25, 1.2, 'porción', 1, 200, 'ensalada,lechuga tomate cebolla'],
  ['Palta', 'grasa', 160, 2, 'unidad', 0.5, 150, 'aguacate'],
  // frutas
  ['Banana', 'fruta', 89, 1.1, 'unidad', 1, 120, 'plátano,bananas'],
  ['Manzana', 'fruta', 52, 0.3, 'unidad', 1, 180, 'manzanas'],
  ['Naranja', 'fruta', 47, 0.9, 'unidad', 1, 180, 'naranjas,mandarina'],
  ['Pera', 'fruta', 57, 0.4, 'unidad', 1, 170],
  ['Frutillas', 'fruta', 32, 0.7, 'g', 150, undefined, 'frutilla,fresas'],
  ['Durazno', 'fruta', 39, 0.9, 'unidad', 1, 150, 'pelón,nectarina'],
  ['Uvas', 'fruta', 69, 0.7, 'g', 150, undefined, 'uva'],
  ['Kiwi', 'fruta', 61, 1.1, 'unidad', 1, 75],
  ['Ananá', 'fruta', 50, 0.5, 'g', 150, undefined, 'piña'],
  ['Sandía', 'fruta', 30, 0.6, 'g', 250, undefined, 'melón'],
  ['Ensalada de frutas', 'fruta', 55, 0.6, 'g', 200, undefined, 'macedonia'],
  ['Frutos secos', 'grasa', 600, 18, 'g', 30, undefined, 'nueces,almendras,maní,mix de frutos secos'],
  ['Pasas de uva', 'fruta', 300, 3, 'g', 30, undefined, 'pasas,frutas secas'],
  // grasas y extras
  ['Aceite', 'grasa', 884, 0, 'cda', 1, undefined, 'aceite de oliva,aceite de girasol'],
  ['Mayonesa', 'grasa', 680, 1, 'cda', 1, undefined, 'mayo'],
  ['Mayonesa light', 'grasa', 330, 1, 'cda', 1, undefined],
  ['Ketchup', 'otro', 110, 1.2, 'cda', 1, undefined, 'salsa golf,mostaza'],
  ['Salsa de tomate', 'verdura', 45, 1.5, 'g', 100, undefined, 'tuco,salsa fileto'],
  ['Mermelada', 'otro', 250, 0.4, 'cda', 1, undefined, 'dulce,jalea'],
  ['Miel', 'otro', 304, 0.3, 'cda', 1, undefined],
  ['Azúcar', 'otro', 400, 0, 'cda', 1, undefined, 'azucar'],
  ['Mantequilla de maní', 'grasa', 590, 25, 'cda', 1, undefined, 'pasta de maní'],
  ['Chocolate', 'otro', 540, 6, 'g', 25, undefined, 'chocolate con leche,barrita de chocolate'],
  ['Barrita de cereal', 'otro', 400, 6, 'unidad', 1, 25, 'barra de cereal'],
  // bebidas
  ['Café con leche', 'bebida', 40, 2, 'ml', 200, undefined, 'cafe con leche,cortado,lágrima,latte'],
  ['Café', 'bebida', 2, 0.1, 'ml', 150, undefined, 'café solo,espresso,café negro'],
  ['Mate', 'bebida', 3, 0, 'porción', 1, 500, 'mates,tereré'],
  ['Té', 'bebida', 1, 0, 'ml', 200, undefined, 'te,té de hierbas,infusión'],
  ['Jugo de naranja', 'bebida', 45, 0.7, 'ml', 200, undefined, 'jugo exprimido'],
  ['Jugo en polvo', 'bebida', 10, 0, 'ml', 250, undefined, 'jugo,tang,clight'],
  ['Gaseosa', 'bebida', 42, 0, 'ml', 350, undefined, 'coca,coca cola,sprite,fanta,gaseosa común'],
  ['Gaseosa sin azúcar', 'bebida', 1, 0, 'ml', 350, undefined, 'coca zero,light'],
  ['Agua saborizada', 'bebida', 20, 0, 'ml', 500, undefined, 'levité,aquarius'],
  ['Cerveza', 'bebida', 43, 0.5, 'ml', 473, undefined, 'birra,lata de cerveza'],
  ['Vino', 'bebida', 85, 0.1, 'ml', 150, undefined, 'copa de vino'],
  ['Licuado de banana', 'bebida', 85, 3, 'ml', 300, undefined, 'licuado,smoothie'],
];

export const FOODS: Food[] = ROWS.map(([name, group, kcal, protein, unit, qty, each, aliases]) => ({
  name,
  group,
  kcal,
  protein,
  unit,
  qty,
  each,
  aliases: aliases ? aliases.split(',') : [],
}));

/** minúsculas y sin tildes, para comparar */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const INDEX = FOODS.map((f) => ({ food: f, keys: [fold(f.name), ...(f.aliases ?? []).map(fold)] }));

/** Busca alimentos para el autocompletado: primero los que empiezan igual, después los que contienen. */
export function searchFoods(query: string, limit = 6): Food[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const { food, keys } of INDEX) {
    let best = 0;
    for (const [i, k] of keys.entries()) {
      const s = k === q ? 4 : k.startsWith(q) ? 3 : k.split(' ').some((w) => w.startsWith(q)) ? 2 : k.includes(q) ? 1 : 0;
      // El nombre principal pesa un poco más que los alias
      best = Math.max(best, s ? s + (i === 0 ? 0.5 : 0) : 0);
    }
    if (best) scored.push({ food, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((x) => x.food);
}

/** Encuentra el alimento que mejor coincide con un nombre escrito a mano (o null). */
export function matchFood(name: string): Food | null {
  const q = fold(name);
  if (q.length < 2) return null;
  const exact = INDEX.find(({ keys }) => keys.includes(q));
  if (exact) return exact.food;
  // Singular simple: "tostadas" → "tostada", "huevos" → "huevo"
  const sing = q.replace(/(es|s)$/, '');
  const bySing = INDEX.find(({ keys }) => keys.some((k) => k === sing || k.replace(/(es|s)$/, '') === sing));
  if (bySing) return bySing.food;
  const first = searchFoods(name, 1)[0];
  // Solo si la coincidencia es por palabra completa al inicio, para no inventar
  return first && INDEX.find((x) => x.food === first)!.keys.some((k) => k.startsWith(q) || q.startsWith(k)) ? first : null;
}

/** Gramos (o ml) que representa una cantidad en cierta unidad para ese alimento. */
export function gramsFor(food: Food, quantity: number, unit: MealItem['unit']): number | null {
  switch (unit ?? 'g') {
    case 'g':
    case 'ml':
      return quantity;
    case 'unidad':
    case 'porción':
      return food.each ? quantity * food.each : unit === 'porción' ? quantity * 150 : null;
    case 'taza':
      return quantity * (food.cup ?? 240);
    case 'cda':
      return quantity * (food.spoon ?? (food.group === 'grasa' ? 13 : food.group === 'cereal' ? 10 : 20));
    default:
      return null;
  }
}

const spread = (v: number, pct: number): Range => ({ min: Math.max(0, Math.round(v * (1 - pct))), max: Math.round(v * (1 + pct)) });

/** Estimación desde el catálogo: rango ±10–15 %. */
export function estimateFromFood(food: Food, quantity: number | undefined, unit: MealItem['unit']): Pick<MealItem, 'kcal' | 'protein' | 'group' | 'confidence'> {
  const g = quantity ? gramsFor(food, quantity, unit) : null;
  if (!g) return { group: food.group, confidence: 'baja' };
  const pct = unit === 'g' || unit === 'ml' ? 0.1 : 0.15;
  const kcal = (food.kcal * g) / 100;
  const protein = (food.protein * g) / 100;
  return {
    group: food.group,
    kcal: spread(kcal, pct),
    protein: { min: Math.floor(protein * (1 - pct)), max: Math.ceil(protein * (1 + pct)) },
    confidence: unit === 'g' || unit === 'ml' ? 'media' : 'baja',
  };
}

/** Completa calorías y proteína de los ingredientes que no las tienen, usando el catálogo. */
export function fillFromCatalog(items: MealItem[]): MealItem[] {
  return items.map((it) => {
    if (it.kcal || !it.quantity) return it;
    const food = matchFood(it.name);
    if (!food) return it;
    const est = estimateFromFood(food, it.quantity, it.unit);
    return est.kcal ? { ...it, ...est, group: it.group && it.group !== 'otro' ? it.group : est.group, source: 'catálogo' } : it;
  });
}
