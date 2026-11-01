import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MealItem } from '@nutrimapache/shared';
import { localDate, localTime, useStore } from '../../lib/store';

export type MealSheetTarget = { mode: 'new'; slotKey?: string } | { mode: 'edit'; mealId: string };

interface Props {
  target: MealSheetTarget | null;
  onClose: () => void;
}

type ItemDraft = Pick<MealItem, 'name' | 'quantity' | 'unit'>;

const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cda'] as const;

function guessSlot(slots: { key: string; time: string }[], time: string): string {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const now = toMin(time);
  return slots.reduce((best, s) => (Math.abs(toMin(s.time) - now) < Math.abs(toMin(best.time) - now) ? s : best), slots[0]!).key;
}

export function MealSheet({ target, onClose }: Props) {
  const profile = useStore((s) => s.profile);
  const meals = useStore((s) => s.meals);
  const addMeal = useStore((s) => s.addMeal);
  const updateMeal = useStore((s) => s.updateMeal);
  const deleteMeal = useStore((s) => s.deleteMeal);

  const editing = target?.mode === 'edit' ? meals.find((m) => m.id === target.mealId) : undefined;

  const [slotKey, setSlotKey] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [energy, setEnergy] = useState<number | undefined>();

  useEffect(() => {
    if (!target || !profile) return;
    if (editing) {
      setSlotKey(editing.slotKey);
      setTime(editing.time ?? '');
      setDescription(editing.description ?? '');
      setItems(editing.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })));
      setEnergy(editing.feeling?.energy);
    } else {
      const t = localTime();
      setSlotKey(target.mode === 'new' && target.slotKey ? target.slotKey : guessSlot(profile.mealSlots, t));
      setTime(t);
      setDescription('');
      setItems([]);
      setEnergy(undefined);
    }
  }, [target, editing, profile]);

  if (!profile) return null;

  const canSave = description.trim().length > 0 || items.some((i) => i.name.trim());

  const save = () => {
    const cleanItems: MealItem[] = items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        unit: i.quantity ? i.unit ?? 'g' : undefined,
        group: 'otro',
        confidence: 'baja',
        source: 'usuaria',
        editedByUser: true,
      }));
    const data = {
      slotKey,
      time: time || undefined,
      description: description.trim() || undefined,
      items: cleanItems,
      feeling: energy ? { energy } : undefined,
    };
    if (editing) updateMeal(editing.id, data);
    else addMeal({ ...data, date: localDate(), origin: 'manual' });
    onClose();
  };

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
              <h2 id="sheet-title">{editing ? 'Tu comida' : '¿Qué comiste?'}</h2>
              <button type="button" className="link" onClick={onClose}>
                Cerrar
              </button>
            </header>

            <div className="sheet-body">
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
                {items.map((it, idx) => (
                  <div key={idx} className="item-row">
                    <input
                      aria-label="Ingrediente"
                      placeholder="Ingrediente"
                      value={it.name}
                      onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      aria-label="Cantidad"
                      inputMode="decimal"
                      placeholder="Cant."
                      className="item-qty"
                      value={it.quantity ?? ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value.replace(',', '.'));
                        setItems(items.map((x, i) => (i === idx ? { ...x, quantity: Number.isFinite(v) && v > 0 ? v : undefined } : x)));
                      }}
                    />
                    <select
                      aria-label="Unidad"
                      value={it.unit ?? 'g'}
                      onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, unit: e.target.value as ItemDraft['unit'] } : x)))}
                    >
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                    <button type="button" className="icon-btn" aria-label={`Quitar ${it.name || 'ingrediente'}`} onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="link" onClick={() => setItems([...items, { name: '', unit: 'g' }])}>
                  Sumar ingrediente
                </button>
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

            <footer className="sheet-foot">
              {editing && (
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => {
                    deleteMeal(editing.id);
                    onClose();
                  }}
                >
                  Borrar
                </button>
              )}
              <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>
                {editing ? 'Guardar cambios' : 'Guardar comida'}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
