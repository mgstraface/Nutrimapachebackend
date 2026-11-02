import { MOODS, type Mood } from '@nutrimapache/shared';
import { Sheet } from './Sheet';

/** ¿Cómo estás? Un toque y Cachete acompaña. Nada se evalúa. */
export function MoodSheet({ open, current, onPick, onClose }: { open: boolean; current: Mood | null; onPick: (m: Mood) => void; onClose: () => void }) {
  return (
    <Sheet open={open} title="¿Cómo estás?" onClose={onClose}>
      <p className="hint">Elegí lo que más se parezca. Queda solo para vos.</p>
      <div className="mood-grid">
        {MOODS.map((m) => (
          <button key={m.key} type="button" className={`mood-btn${current === m.key ? ' is-on' : ''}`} aria-pressed={current === m.key} onClick={() => onPick(m.key)}>
            <span className="mood-emoji" aria-hidden="true">
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
