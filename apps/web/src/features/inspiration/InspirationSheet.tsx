import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatRange, missingForEnergy, type InspirationResponse, type MealIdea } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';
import { api, errorText } from '../../lib/api';
import { useStore } from '../../lib/store';
import { useOpenMealSheet } from '../meals/registerContext';

interface Props {
  slotKey: string | null;
  onClose: () => void;
}

/** "Inspiración": tres ideas para una comida, pensadas para el rango orientativo de esa comida. */
export function InspirationSheet({ slotKey, onClose }: Props) {
  const profile = useStore((s) => s.profile)!;
  const refreshAi = useStore((s) => s.refreshAi);
  const openMeal = useOpenMealSheet();
  const [data, setData] = useState<InspirationResponse | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (exclude: string[]) => {
    if (!slotKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<InspirationResponse>('/inspiration', { method: 'POST', body: { slotKey, exclude } });
      setData(res);
      setSeen([...exclude, ...res.ideas.map((i) => i.title)].slice(-12));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      void refreshAi();
    }
  };

  useEffect(() => {
    setData(null);
    setSeen([]);
    if (slotKey) void load([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);

  const slotLabel = profile.mealSlots.find((s) => s.key === slotKey)?.label ?? 'esta comida';
  const { showCalories, showMacros } = profile.view;
  const missing = missingForEnergy(profile);

  const pickIdea = (idea: MealIdea) => {
    if (!slotKey) return;
    onClose();
    openMeal({
      mode: 'new',
      slotKey,
      prefill: { description: idea.title, items: idea.items, note: 'Es una idea de Cachete: ajustá las cantidades a lo que comiste de verdad.' },
    });
  };

  return (
    <AnimatePresence>
      {slotKey && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insp-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <header className="sheet-head">
              <h2 id="insp-title">Ideas para {slotLabel.toLowerCase()}</h2>
              <button type="button" className="link" onClick={onClose}>
                Cerrar
              </button>
            </header>

            <div className="sheet-body">
              {data?.target && (showCalories || showMacros) ? (
                <p className="hint insp-target">
                  Pensadas para alrededor de{' '}
                  {[showCalories ? formatRange(data.target.kcal, 'kcal') : null, showMacros ? `${formatRange(data.target.protein, 'g')} de proteína` : null]
                    .filter(Boolean)
                    .join(' y ')}
                  . Es orientativo: comé según tu hambre.
                </p>
              ) : missing.length > 0 ? (
                <p className="hint insp-target">Para ajustar las ideas a tu energía del día, completá {missing.join(', ')} en Yo.</p>
              ) : (
                <p className="hint insp-target">Pensadas para tu objetivo. Es orientativo: comé según tu hambre.</p>
              )}

              {loading && (
                <div className="insp-loading">
                  <Cachete expression="curiosidad" size={110} />
                  <p>Pensando ideas ricas…</p>
                </div>
              )}

              {error && !loading && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              {!loading &&
                data?.ideas.map((idea) => (
                  <article key={idea.title} className="idea">
                    <div className="idea-head">
                      <h3>{idea.title}</h3>
                      {idea.prepMinutes ? <span className="idea-time">{idea.prepMinutes} min</span> : null}
                    </div>
                    <p className="idea-desc">{idea.description}</p>
                    {idea.tags.length > 0 && (
                      <div className="idea-tags">
                        {idea.tags.map((t) => (
                          <span key={t} className="chip chip-quiet">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <ul className="idea-items">
                      {idea.items.map((it, i) => (
                        <li key={i}>
                          {it.name}
                          {it.quantity ? ` · ${it.quantity} ${unitLabel(it.unit, it.quantity)}` : ''}
                        </li>
                      ))}
                    </ul>
                    {(showCalories && idea.kcal) || (showMacros && idea.protein) ? (
                      <p className="item-est">
                        {[showCalories && idea.kcal ? `aprox. ${formatRange(idea.kcal, 'kcal')}` : null, showMacros && idea.protein ? `proteína ${formatRange(idea.protein, 'g')}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <button type="button" className="btn-primary btn-small" onClick={() => pickIdea(idea)}>
                      Anotar esta
                    </button>
                  </article>
                ))}
            </div>

            <footer className="sheet-foot">
              <button type="button" className="btn-quiet" disabled={loading} onClick={() => void load(seen)}>
                {loading ? 'Pensando…' : 'Otras ideas'}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const PLURAL: Record<string, string> = { unidad: 'unidades', porción: 'porciones', taza: 'tazas', cda: 'cdas' };
const unitLabel = (unit: string | undefined, qty: number) => (qty !== 1 && unit && PLURAL[unit] ? PLURAL[unit] : unit ?? 'g');
