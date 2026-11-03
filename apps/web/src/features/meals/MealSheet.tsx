import { useEffect, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatRange, mealFeedback, sumRanges, type AnalysisQuota, type Meal, type MealFeedback, type MealItem, type MealTipsResponse, type PhotoAnalysis, type Range } from '@nutrimapache/shared';
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
type ItemDraft = Partial<MealItem> & { name: string; baseQty?: number; baseKcal?: Range; baseProtein?: Range };

const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cda'] as const;

function guessSlot(slots: { key: string; time: string }[], time: string): string {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const now = toMin(time);
  return slots.reduce((best, s) => (Math.abs(toMin(s.time) - now) < Math.abs(toMin(best.time) - now) ? s : best), slots[0]!).key;
}

const toDraft = (i: MealItem): ItemDraft => ({ ...i, baseQty: i.quantity, baseKcal: i.kcal, baseProtein: i.protein });

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

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems(items.map((x, i) => (i === idx ? { ...x, ...patch, editedByUser: true } : x)));

  const changeQty = (idx: number, quantity: number | undefined) => {
    const it = items[idx]!;
    // Si había una estimación para otra cantidad, la reescala proporcionalmente.
    const k = quantity && it.baseQty ? quantity / it.baseQty : null;
    updateItem(idx, {
      quantity,
      kcal: k ? scale(it.baseKcal, k) : quantity ? it.kcal : undefined,
      protein: k ? scale(it.baseProtein, k) : quantity ? it.protein : undefined,
    });
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
    const cleanItems: MealItem[] = items
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
      }));
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
      if (editing) {
        await updateMeal(editing.id, data);
        onClose();
        return;
      }
      const meal = await addMeal({ ...data, date: localDate(), origin: fromAi ? 'ia' : 'manual' });
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
                      <input aria-label="Ingrediente" placeholder="Ingrediente" value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
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
                      <select aria-label="Unidad" value={it.unit ?? 'g'} onChange={(e) => updateItem(idx, { unit: e.target.value as MealItem['unit'] })}>
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
                    ) : null}
                  </div>
                ))}
                <button type="button" className="link" onClick={() => setItems([...items, { name: '', unit: 'g' }])}>
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
              <button type="button" className="btn-primary" disabled={!canSave || busy || analyzing} onClick={() => void save()}>
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
