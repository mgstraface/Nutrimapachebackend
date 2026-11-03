import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { formatRange, type PantryResponse, type Recipe, type SavedRecipe } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';
import { api, errorText } from '../../lib/api';
import { useStore } from '../../lib/store';
import { useOpenMealSheet } from '../meals/registerContext';

/** Cosas que suele haber en casa: un toque y se suman a la lista. */
const STAPLES = ['huevos', 'arroz', 'fideos', 'tomate', 'zanahoria', 'papa', 'queso', 'pollo', 'atún', 'lentejas', 'avena', 'banana', 'yogur', 'zapallo', 'espinaca', 'pan'];

const norm = (s: string) => s.trim().toLowerCase();

/**
 * "¿Qué hay en casa?": la usuaria anota lo que tiene y Cachete arma recetas con eso.
 * La lista queda guardada en el perfil para la próxima vez.
 */
export function RecipesScreen() {
  const profile = useStore((s) => s.profile)!;
  const saveProfile = useStore((s) => s.saveProfile);
  const ai = useStore((s) => s.ai);
  const refreshAi = useStore((s) => s.refreshAi);
  const openMeal = useOpenMealSheet();

  const [pantry, setPantry] = useState<string[]>(profile.pantry ?? []);
  const [draft, setDraft] = useState('');
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PantryResponse | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null);

  useEffect(() => {
    api<SavedRecipe[]>('/recipes')
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  const persist = (next: string[]) => {
    setPantry(next);
    saveProfile({ ...useStore.getState().profile!, pantry: next }).catch((err) => setError(errorText(err)));
  };

  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((p) => p.trim().slice(0, 40))
      .filter(Boolean);
    const next = [...pantry];
    for (const p of parts) if (!next.some((x) => norm(x) === norm(p)) && next.length < 40) next.push(p);
    if (next.length !== pantry.length) persist(next);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add(draft);
    setDraft('');
  };

  const cook = async (exclude: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<PantryResponse>('/pantry-recipes', { method: 'POST', body: { ingredients: pantry.slice(0, 30), slotKey, exclude: exclude.slice(-12) } });
      setResult(r);
      setSeen([...exclude, ...r.recipes.map((x) => x.title)]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      void refreshAi();
    }
  };

  const logIt = (recipe: Recipe) =>
    openMeal({
      mode: 'new',
      slotKey: slotKey ?? undefined,
      prefill: { description: recipe.title, items: recipe.items, note: 'Receta de Cachete: ajustá las cantidades a lo que comiste de verdad.' },
    });

  const keep = async (recipe: Recipe) => {
    setError(null);
    try {
      const r = await api<SavedRecipe>('/recipes', { method: 'POST', body: recipe });
      setSaved((s) => [r, ...(s ?? [])]);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const drop = async (id: string) => {
    setSaved((s) => s?.filter((r) => r.id !== id) ?? null);
    try {
      await api(`/recipes/${id}`, { method: 'DELETE' });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const suggestions = STAPLES.filter((s) => !pantry.some((p) => norm(p).includes(s))).slice(0, 8);
  const savedTitles = new Set((saved ?? []).map((r) => norm(r.title)));
  const left = ai ? Math.max(0, ai.dailyLimit - ai.usedToday) : 0;

  return (
    <div className="page recipes">
      <h1 className="page-title">¿Qué hay en casa?</h1>
      <p className="hint">Anotá lo que tenés y {profile.mascotName} te arma recetas con eso. La lista queda guardada.</p>

      <form className="pantry-add" onSubmit={onSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ej: huevos, espinaca, queso"
          aria-label="Agregar ingredientes"
          maxLength={200}
          enterKeyHint="done"
        />
        <button type="submit" className="btn-primary btn-small" disabled={!draft.trim()}>
          Sumar
        </button>
      </form>

      {pantry.length > 0 ? (
        <ul className="pantry" aria-label="Lo que hay en casa">
          {pantry.map((p) => (
            <li key={p} className="pantry-chip">
              {p}
              <button type="button" aria-label={`Sacar ${p}`} onClick={() => persist(pantry.filter((x) => x !== p))}>
                ×
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="link pantry-clear" onClick={() => persist([])}>
              Vaciar
            </button>
          </li>
        </ul>
      ) : (
        <p className="empty pantry-empty">Todavía no anotaste nada. Podés empezar con alguno de estos:</p>
      )}

      {suggestions.length > 0 && (
        <div className="pantry-suggest" aria-label="Sugerencias">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip-btn" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}

      <fieldset className="pantry-slot">
        <legend>¿Para qué comida?</legend>
        <div className="chips">
          <button type="button" className={`chip-btn${slotKey === null ? ' is-on' : ''}`} onClick={() => setSlotKey(null)}>
            Cualquiera
          </button>
          {profile.mealSlots.map((s) => (
            <button key={s.key} type="button" className={`chip-btn${slotKey === s.key ? ' is-on' : ''}`} onClick={() => setSlotKey(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {ai?.enabled ? (
        <button type="button" className="btn-primary pantry-go" disabled={loading || pantry.length === 0 || left === 0} onClick={() => void cook([])}>
          {loading ? 'Cocinando ideas…' : left === 0 ? 'Mañana seguimos' : `Armame recetas`}
        </button>
      ) : (
        <p className="hint">Las recetas usan la IA del servidor, que ahora no está disponible.</p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <div className="insp-loading">
          <Cachete expression="curiosidad" size={110} />
          <p>Revolviendo la alacena…</p>
        </div>
      )}

      {!loading && result && (
        <section className="recipe-results" aria-label="Recetas para vos">
          {result.recipes.map((r) => (
            <RecipeCard key={r.title} recipe={r} open>
              <button type="button" className="btn-primary btn-small" onClick={() => logIt(r)}>
                Anotar como comida
              </button>
              <button type="button" className="btn-quiet btn-small" disabled={savedTitles.has(norm(r.title))} onClick={() => void keep(r)}>
                {savedTitles.has(norm(r.title)) ? 'Guardada ♥' : 'Guardar ♡'}
              </button>
            </RecipeCard>
          ))}
          <button type="button" className="btn-quiet" disabled={left === 0} onClick={() => void cook(seen)}>
            Otras recetas
          </button>
        </section>
      )}

      {saved && saved.length > 0 && (
        <section className="saved-recipes" aria-labelledby="saved-title">
          <h2 id="saved-title" className="day-title">
            Tus recetas guardadas
          </h2>
          {saved.map((r) => (
            <RecipeCard key={r.id} recipe={r}>
              <button type="button" className="btn-primary btn-small" onClick={() => logIt(r)}>
                Anotar como comida
              </button>
              <button type="button" className="btn-quiet btn-small" onClick={() => void drop(r.id)}>
                Borrar
              </button>
            </RecipeCard>
          ))}
        </section>
      )}
    </div>
  );
}

function RecipeCard({ recipe, open, children }: { recipe: Recipe; open?: boolean; children: ReactNode }) {
  const { showCalories, showMacros } = useStore((s) => s.profile!.view);
  const est = [
    showCalories && recipe.kcal ? `aprox. ${formatRange(recipe.kcal, 'kcal')}` : null,
    showMacros && recipe.protein ? `proteína ${formatRange(recipe.protein, 'g')}` : null,
  ].filter(Boolean);
  return (
    <details className="idea recipe" open={open}>
      <summary className="idea-head">
        <h3>{recipe.title}</h3>
        {recipe.prepMinutes ? <span className="idea-time">{recipe.prepMinutes} min</span> : null}
      </summary>
      <p className="idea-desc">{recipe.description}</p>
      {recipe.tags.length > 0 && (
        <div className="idea-tags">
          {recipe.tags.map((t) => (
            <span key={t} className="chip chip-quiet">
              {t}
            </span>
          ))}
        </div>
      )}
      <ul className="idea-items">
        {recipe.items.map((it, i) => (
          <li key={i}>
            {it.name}
            {it.quantity ? ` · ${it.quantity} ${unitLabel(it.unit, it.quantity)}` : ''}
          </li>
        ))}
      </ul>
      {recipe.missing.length > 0 && <p className="recipe-missing">Te faltaría: {recipe.missing.join(', ')}</p>}
      <ol className="recipe-steps">
        {recipe.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {est.length > 0 && <p className="item-est">{est.join(' · ')} · 1 porción</p>}
      <div className="recipe-actions">{children}</div>
    </details>
  );
}

const PLURAL: Record<string, string> = { unidad: 'unidades', porción: 'porciones', taza: 'tazas', cda: 'cdas' };
const unitLabel = (unit: string | undefined, qty: number) => (qty !== 1 && unit && PLURAL[unit] ? PLURAL[unit] : unit ?? 'g');
