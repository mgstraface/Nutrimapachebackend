import { useEffect, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { estimateFromFood, fillFromCatalog, formatRange, matchFood, mealFeedback, searchFoods, sumRanges, type Food, type AnalysisQuota, type Meal, type MealFeedback, type MealItem, type MealTipsResponse, type PhotoAnalysis, type Range } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';
import { api, errorText } from '../../lib/api';
import { preparePhoto } from '../../lib/photo';
import { localDate, localTime, useStore } from '../../lib/store';

export type MealSheetTarget =
  | { mode: 'new'; slotKey?: string; prefill?: { description: string; items: MealItem[]; note?: string } }
  | { mode: 'edit'; mealId: string };

interface Props {
  target: MealSheetTarget | null;
  onClose: () => void;
}

/** Ingrediente en edición. base* guarda la estimación original para reescalar si cambia la cantidad. */
type ItemDraft = Partial<MealItem> & { name: string; baseQty?: number; baseKcal?: Range; baseProtein?: Range; food?: Food | null };

const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cda'] as const;

function guessSlot(slots: { key: string; time: string }[], time: string): string {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const now = toMin(time);
  return slots.reduce((best, s) => (Math.abs(toMin(s.time) - now) < Math.abs(toMin(best.time) - now) ? s : best), slots[0]!).key;
}

const toDraft = (i: MealItem): ItemDraft =>
  i.kcal ? { ...i, baseQty: i.quantity, baseKcal: i.kcal, baseProtein: i.protein } : reestimate({ ...i });

/**
 * Recalcula la estimación de un ingrediente:
 * - si vino de la IA o de una idea, reescala su estimación original según la cantidad;
 * - si no, la busca en el catálogo local (sin IA) por el alimento elegido o por el nombre.
 */
function reestimate(d: ItemDraft): ItemDraft {
  if (d.baseKcal && d.baseQty && d.quantity) {
    const k = d.quantity / d.baseQty;
    return { ...d, kcal: scale(d.baseKcal, k), protein: scale(d.baseProtein, k) };
  }
  if (d.baseKcal && !d.baseQty) return d;
  const food = d.food ?? matchFood(d.name);
  if (food && d.quantity) {
    const est = estimateFromFood(food, d.quantity, d.unit ?? 'g');
    if (est.kcal) return { ...d, ...est, source: 'catálogo' };
  }
  return { ...d, kcal: undefined, protein: undefined, source: d.source === 'catálogo' ? 'usuaria' : d.source };
}

const scale = (r: Range | undefined, k: number): Range | undefined => (r ? { min: Math.round(r.min * k), max: Math.round(r.max * k) } : undefined);

export function MealSheet({ target, onClose }: Props) {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const addMeal = useStore((s) => s.addMeal);
  const updateMeal = useStore((s) => s.updateMeal);
  const deleteMeal = useStore((s) => s.deleteMeal);
  const saveProfile = useStore((s) => s.saveProfile);
  const emit = useStore((s) => s.emit);

  const editing = target?.mode === 'edit' ? meals.find((m) => m.id === target.mealId) : undefined;

  const [slotKey, setSlotKey] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [energy, setEnergy] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quota, setQuota] = useState<AnalysisQuota | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  /** Ingrediente con el buscador abierto */
  const [suggestFor, setSuggestFor] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  /** Después de guardar: la "miradita" de Cachete sobre la comida */
  const [review, setReview] = useState<{ meal: Meal; fb: MealFeedback } | null>(null);
  const [tips, setTips] = useState<string[] | null>(null);
  const [tipsBusy, setTipsBusy] = useState(false);

  useEffect(() => {
    if (!target || !profile) return;
    setBusy(false);
    setError(null);
    setAskConsent(false);
    setPhoto(null);
    setAnalyzing(false);
    setAiNote(null);
    setReview(null);
    setTips(null);
    setTipsBusy(false);
    if (editing) {
      setSlotKey(editing.slotKey);
      setTime(editing.time ?? '');
      setDescription(editing.description ?? '');
      setItems(editing.items.map(toDraft));
      setEnergy(editing.feeling?.energy);
    } else {
      const t = localTime();
      setSlotKey(target.mode === 'new' && target.slotKey ? target.slotKey : guessSlot(profile.mealSlots, t));
      setTime(t);
      const prefill = target.mode === 'new' ? target.prefill : undefined;
      setDescription(prefill?.description ?? '');
      setItems(prefill ? prefill.items.map(toDraft) : []);
      if (prefill) setAiNote(prefill.note ?? 'Es una idea: ajustá las cantidades a lo que comiste de verdad.');
      setEnergy(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, editing?.id]);

  // ¿Está disponible el análisis de fotos? (sin clave en el servidor, la opción no aparece)
  useEffect(() => {
    if (!target) return;
    api<AnalysisQuota>('/analysis/quota')
      .then((q) => {
        setQuota(q);
        useStore.setState({ ai: q });
      })
      .catch(() => setQuota(null));
  }, [target]);

  if (!profile) return null;

  const canSave = description.trim().length > 0 || items.some((i) => i.name.trim());
  const consented = profile.consents.aiAnalysis;
  const photoAvailable = !!quota?.enabled && !editing;
  const photoLeft = quota ? Math.max(0, quota.dailyLimit - quota.usedToday) : 0;

  /** Cambia algo del ingrediente y recalcula su estimación. */
  const editItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((x, i) => (i === idx ? reestimate({ ...x, ...patch, editedByUser: true }) : x)));

  const changeQty = (idx: number, quantity: number | undefined) => editItem(idx, { quantity });

  const changeName = (idx: number, name: string) => {
    const it = items[idx]!;
    // Si cambia el nombre, deja de ser el alimento elegido o la estimación de la IA.
    editItem(idx, { name, food: null, baseKcal: undefined, baseProtein: undefined, baseQty: undefined, source: it.source === 'ia' ? 'usuaria' : it.source });
    setSuggestFor(idx);
  };

  const pickFood = (idx: number, food: Food) => {
    const it = items[idx]!;
    const keepQty = it.quantity && it.unit && it.unit !== 'g' ? it.unit === food.unit : !!it.quantity;
    editItem(idx, {
      name: food.name,
      food,
      quantity: keepQty ? it.quantity : food.qty,
      unit: keepQty ? it.unit : food.unit,
      group: food.group,
      baseKcal: undefined,
      baseProtein: undefined,
      baseQty: undefined,
    });
    setSuggestFor(null);
  };

  /** Para lo que no está en la lista: estimación con IA a partir del texto (sin fotos). */
  const estimateWithAi = async () => {
    setEstimating(true);
    setError(null);
    try {
      const slotLabel = profile.mealSlots.find((s) => s.key === slotKey)?.label;
      const r = await api<PhotoAnalysis>('/analysis/text', {
        method: 'POST',
        body: {
          description: description.trim(),
          slotLabel,
          items: items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: i.quantity, unit: i.quantity ? i.unit ?? 'g' : undefined })),
        },
      });
      setQuota((q) => (q ? { ...q, usedToday: q.usedToday + 1 } : q));
      // Lo que ya tenía estimación del catálogo se mantiene; se completa el resto.
      const known = items.filter((i) => i.name.trim() && i.kcal);
      const fresh = r.items.filter((n) => !known.some((k) => k.name.trim().toLowerCase() === n.name.toLowerCase())).map(toDraft);
      setItems([...known, ...fresh]);
      setAiNote(r.uncertaintyNote || 'Es una estimación aproximada: revisá y corregí lo que haga falta.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setEstimating(false);
    }
  };

  const acceptConsent = async () => {
    setError(null);
    try {
      await saveProfile({ ...profile, consents: { ...profile.consents, aiAnalysis: true, acceptedAt: new Date().toISOString() } });
      setAskConsent(false);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setAiNote(null);
    try {
      const { base64, dataUrl } = await preparePhoto(file);
      setPhoto(dataUrl);
      setAnalyzing(true);
      emit('foto-tomada');
      const slotLabel = profile.mealSlots.find((s) => s.key === slotKey)?.label;
      const result = await api<PhotoAnalysis>('/analysis/photo', { method: 'POST', body: { image: base64, mediaType: 'image/jpeg', slotLabel } });
      setQuota((q) => (q ? { ...q, usedToday: q.usedToday + 1 } : q));
      if (result.notFood) {
        setError('No encontramos comida en esa foto. Probá con otra o anotalo a mano.');
      } else {
        if (!description.trim()) setDescription(result.description);
        setItems([...items.filter((i) => i.name.trim()), ...result.items.map(toDraft)]);
        setAiNote(result.uncertaintyNote || 'Es una estimación aproximada: revisá y corregí lo que haga falta.');
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const cleanItems: MealItem[] = fillFromCatalog(items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        unit: i.quantity ? i.unit ?? 'g' : undefined,
        group: i.group ?? 'otro',
        kcal: i.kcal,
        protein: i.protein,
        confidence: i.confidence ?? 'baja',
        source: i.source ?? 'usuaria',
        editedByUser: i.editedByUser ?? true,
      })));
    const fromAi = cleanItems.some((i) => i.source === 'ia');
    const data = {
      slotKey,
      time: time || undefined,
      // Al editar, un texto vacío tiene que viajar como '' para que se borre en el servidor.
      description: description.trim() || (editing ? '' : undefined),
      items: cleanItems,
      feeling: energy ? { energy } : undefined,
    };
    setBusy(true);
    setError(null);
    try {
      const meal = editing ? await updateMeal(editing.id, data) : await addMeal({ ...data, date: localDate(), origin: fromAi ? 'ia' : 'manual' });
      if (cleanItems.length === 0) {
        onClose();
        return;
      }
      setReview({ meal, fb: mealFeedback(profile, slotKey, cleanItems, profile.view.showCalories) });
      setBusy(false);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const askTips = async () => {
    if (!review) return;
    setTipsBusy(true);
    setError(null);
    try {
      const r = await api<MealTipsResponse>('/meal-tips', { method: 'POST', body: { mealId: review.meal.id } });
      setTips(r.tips.length ? r.tips : ['Así como está, viene muy bien. ¡A disfrutarla!']);
      void useStore.getState().refreshAi();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setTipsBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMeal(editing.id);
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const { showCalories, showMacros } = profile.view;
  const totalKcal = sumRanges(items.map((i) => i.kcal));
  const totalProtein = sumRanges(items.map((i) => i.protein));
  const hasEstimates = items.some((i) => i.kcal || i.protein);

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <header className="sheet-head">
              <h2 id="sheet-title">{review ? '¡Anotada!' : editing ? 'Tu comida' : '¿Qué comiste?'}</h2>
              <button type="button" className="link" onClick={onClose}>
                Cerrar
              </button>
            </header>

            {review ? (
              <MealReview review={review} showNumbers={showCalories} tips={tips} tipsBusy={tipsBusy} canAsk={!!quota?.enabled} onAsk={() => void askTips()} />
            ) : (
            <div className="sheet-body">
              {photoAvailable && (
                <div className="photo-box">
                  {photo && (
                    <div className={`photo-preview${analyzing ? ' is-busy' : ''}`}>
                      <img src={photo} alt="Tu foto" />
                      {analyzing && <span className="photo-status">Mirando tu plato…</span>}
                    </div>
                  )}

                  {askConsent ? (
                    <div className="consent">
                      <strong>Antes de usar fotos</strong>
                      <p>
                        Para reconocer lo que hay en el plato, la foto se envía achicada y sin datos tuyos a Claude, el servicio de IA de Anthropic. No guardamos la
                        foto: se analiza y se descarta. Lo que te devuelve es una estimación que podés corregir.
                      </p>
                      <p className="hint">Lo podés desactivar cuando quieras desde Yo.</p>
                      <div className="consent-actions">
                        <button type="button" className="btn-quiet btn-small" onClick={() => setAskConsent(false)}>
                          Mejor no
                        </button>
                        <button type="button" className="btn-primary btn-small" onClick={() => void acceptConsent()}>
                          Acepto
                        </button>
                      </div>
                    </div>
                  ) : consented ? (
                    photoLeft > 0 ? (
                      <label className={`btn-photo${analyzing ? ' is-disabled' : ''}`}>
                        <input type="file" accept="image/*" onChange={(e) => void onPhoto(e)} disabled={analyzing} hidden />
                        <span aria-hidden="true">📷</span> {photo ? 'Probar con otra foto' : 'Sacar foto o elegir de la galería'}
                      </label>
                    ) : (
                      <p className="hint">Por hoy ya analizamos todas las fotos posibles. Mañana seguimos; mientras, anotalo a mano.</p>
                    )
                  ) : (
                    <button type="button" className="btn-photo" onClick={() => setAskConsent(true)}>
                      <span aria-hidden="true">📷</span> Anotar con una foto
                    </button>
                  )}
                </div>
              )}

              <fieldset className="field">
                <legend>Momento</legend>
                <div className="chips">
                  {profile.mealSlots.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={`chip-btn${slotKey === s.key ? ' is-on' : ''}`}
                      aria-pressed={slotKey === s.key}
                      onClick={() => setSlotKey(s.key)}
                    >
                      {s.label}
                    </button>
                  ))}
                  <button type="button" className={`chip-btn${slotKey === 'extra' ? ' is-on' : ''}`} aria-pressed={slotKey === 'extra'} onClick={() => setSlotKey('extra')}>
                    Otro momento
                  </button>
                </div>
              </fieldset>

              <label className="field">
                <span>Hora</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>

              <label className="field">
                <span>Contalo como quieras</span>
                <textarea
                  rows={2}
                  placeholder="Ej.: tarta de verdura y una mandarina"
                  value={description}
                  maxLength={280}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="field">
                <span>Ingredientes (opcional)</span>
                {aiNote && <p className="ai-note">{aiNote}</p>}
                {items.map((it, idx) => (
                  <div key={idx} className={`item-card${it.source === 'ia' && !it.editedByUser ? ' is-ai' : ''}`}>
                    <div className="item-row">
                      <div className="item-name">
                        <input
                          aria-label="Ingrediente"
                          placeholder="Buscá: huevo, arroz, tostadas…"
                          value={it.name}
                          autoComplete="off"
                          onChange={(e) => changeName(idx, e.target.value)}
                          onFocus={() => setSuggestFor(idx)}
                          onBlur={() => setTimeout(() => setSuggestFor((v) => (v === idx ? null : v)), 150)}
                        />
                        {suggestFor === idx && <FoodSuggestions query={it.name} current={it.food ?? null} onPick={(f) => pickFood(idx, f)} />}
                      </div>
                      <input
                        aria-label="Cantidad"
                        inputMode="decimal"
                        placeholder="Cant."
                        className="item-qty"
                        value={it.quantity ?? ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value.replace(',', '.'));
                          changeQty(idx, Number.isFinite(v) && v > 0 ? v : undefined);
                        }}
                      />
                      <select aria-label="Unidad" value={it.unit ?? 'g'} onChange={(e) => editItem(idx, { unit: e.target.value as MealItem['unit'] })}>
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                      <button type="button" className="icon-btn" aria-label={`Quitar ${it.name || 'ingrediente'}`} onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        ×
                      </button>
                    </div>
                    {(showCalories && it.kcal) || (showMacros && it.protein) ? (
                      <p className="item-est">
                        {showCalories && it.kcal ? `aprox. ${formatRange(it.kcal, 'kcal')}` : ''}
                        {showCalories && it.kcal && showMacros && it.protein ? ' · ' : ''}
                        {showMacros && it.protein ? `proteína ${formatRange(it.protein, 'g')}` : ''}
                      </p>
                    ) : it.name.trim().length > 1 && !it.kcal ? (
                      <p className="item-est is-missing">{it.quantity ? 'No lo tengo en mi lista' : 'Poné la cantidad y te digo cuánto es'}</p>
                    ) : null}
                  </div>
                ))}
                {quota?.enabled && items.some((i) => i.name.trim().length > 1 && i.quantity && !i.kcal) && (
                  <button type="button" className="btn-soft" disabled={estimating || photoLeft === 0} onClick={() => void estimateWithAi()}>
                    {estimating ? 'Calculando…' : '✨ Calcular lo que falta con IA'}
                  </button>
                )}
                <button type="button" className="link" onClick={() => { setItems([...items, { name: '', unit: 'g' }]); setSuggestFor(items.length); }}>
                  Sumar ingrediente
                </button>
                {hasEstimates && (showCalories || showMacros) && (
                  <p className="hint">
                    Total aproximado:{' '}
                    {[showCalories && totalKcal ? formatRange(totalKcal, 'kcal') : null, showMacros && totalProtein ? `${formatRange(totalProtein, 'g')} de proteína` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>

              <fieldset className="field">
                <legend>¿Cómo está tu energía? (opcional)</legend>
                <div className="scale" role="radiogroup">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={energy === n}
                      className={`scale-btn${energy === n ? ' is-on' : ''}`}
                      onClick={() => setEnergy(energy === n ? undefined : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="hint">1 = con poca energía · 5 = a pleno</p>
              </fieldset>
            </div>
            )}

            {error && (
              <p className="form-error sheet-error" role="alert">
                {error}
              </p>
            )}
            {review ? (
              <footer className="sheet-foot">
                <button type="button" className="btn-primary" onClick={onClose}>
                  Listo
                </button>
              </footer>
            ) : (
            <footer className="sheet-foot">
              {editing && (
                <button type="button" className="btn-quiet" disabled={busy} onClick={() => void remove()}>
                  Borrar
                </button>
              )}
              <button type="button" className="btn-primary" disabled={!canSave || busy || analyzing || estimating} onClick={() => void save()}>
                {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar comida'}
              </button>
            </footer>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const REVIEW_FACE = { dentro: 'alegria', generosa: 'acompañamiento', liviana: 'curiosidad', 'sin-datos': 'alegria' } as const;

/** La miradita: frase suave, barrita del rango sugerido y, si quiere, ideas para mejorarla. */
export function MealReview(props: {
  review: { meal: Meal; fb: MealFeedback };
  showNumbers: boolean;
  tips: string[] | null;
  tipsBusy: boolean;
  canAsk: boolean;
  onAsk: () => void;
}) {
  const { fb } = props.review;
  const { kcal, target } = fb;
  // Escala de la barrita: hasta 1,6 veces el máximo sugerido para que lo "generoso" se vea sin dramatismo.
  const scaleMax = target ? target.kcal.max * 1.6 : 1;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / scaleMax) * 100))}%`;
  const mid = kcal ? (kcal.min + kcal.max) / 2 : 0;
  return (
    <div className="sheet-body review">
      <div className={`review-hero is-${fb.level}`}>
        <Cachete expression={REVIEW_FACE[fb.level]} size={88} />
        <p className="review-headline">{fb.headline}</p>
      </div>

      {kcal && target && (
        <div className="review-meter" aria-hidden={!props.showNumbers}>
          <div className="meter-track">
            <span className="meter-band" style={{ left: pct(target.kcal.min), width: `calc(${pct(target.kcal.max)} - ${pct(target.kcal.min)})` }} />
            <span className={`meter-dot is-${fb.level}`} style={{ left: pct(mid) }} />
          </div>
          {props.showNumbers ? (
            <p className="hint">
              Esta comida: {formatRange(kcal)} kcal · sugerido: {formatRange(target.kcal)} kcal
              {fb.protein ? ` · proteína ${formatRange(fb.protein)} g (sugerido ${formatRange(target.protein)} g)` : ''}
            </p>
          ) : (
            <p className="hint">La franja es lo que te sugiero para esta comida; el puntito, cómo vino.</p>
          )}
        </div>
      )}

      {fb.suggestions.length > 0 && (
        <ul className="review-tips">
          {fb.suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      {props.tips ? (
        <div className="review-ai">
          <p className="review-ai-title">Ideas de Cachete</p>
          <ul className="review-tips">
            {props.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : (
        props.canAsk && (
          <button type="button" className="btn-soft" disabled={props.tipsBusy} onClick={props.onAsk}>
            {props.tipsBusy ? 'Pensando…' : '✨ ¿Cómo la mejoro?'}
          </button>
        )
      )}
      <p className="hint review-foot">Son estimaciones aproximadas. Un plato no define nada: lo que cuenta es el conjunto.</p>
    </div>
  );
}

/** Lista desplegable del buscador de alimentos (catálogo local, sin IA). */
function FoodSuggestions({ query, current, onPick }: { query: string; current: Food | null; onPick: (f: Food) => void }) {
  const list = searchFoods(query).filter((f) => f !== current);
  if (!list.length) return null;
  return (
    <ul className="food-suggest" role="listbox" aria-label="Alimentos">
      {list.map((f) => (
        <li key={f.name}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            // onMouseDown para que se elija antes de que el input pierda el foco
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(f);
            }}
          >
            <span>{f.name}</span>
            <span className="food-suggest-hint">
              {f.qty} {f.unit}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
