import { useState } from 'react';
import { ACCESSORIES, SLOT_LABELS, type LookSlot } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';
import { errorText } from '../../lib/api';
import { play } from '../../lib/sound';
import { useStore } from '../../lib/store';
import { Sheet } from './Sheet';

const SLOTS: LookSlot[] = ['head', 'face', 'neck', 'ribbon'];

/** Vestir a Cachete con lo que fue desbloqueando. Nada se pierde nunca. */
export function LookSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const saveProfile = useStore((s) => s.saveProfile);
  const [error, setError] = useState<string | null>(null);
  const look = profile.look;

  const toggle = async (slot: LookSlot, key: string) => {
    setError(null);
    const next = { ...look, [slot]: look[slot] === key ? null : key };
    try {
      play('mimo');
      await saveProfile({ ...profile, look: next });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Sheet open={open} title={`Vestir a ${profile.mascotName}`} onClose={onClose}>
      <div className="look-preview">
        <Cachete expression="alegria" size={130} look={look} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {SLOTS.map((slot) => {
        const items = ACCESSORIES.filter((a) => a.slot === slot);
        return (
          <section key={slot} className="look-slot">
            <h3>{SLOT_LABELS[slot]}</h3>
            <div className="look-grid">
              {items.map((a) => {
                const unlocked = look.unlocked.includes(a.key);
                const on = look[slot] === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    className={`look-item${on ? ' is-on' : ''}${unlocked ? '' : ' is-locked'}`}
                    disabled={!unlocked}
                    aria-pressed={on}
                    onClick={() => void toggle(slot, a.key)}
                  >
                    <span className="look-emoji" aria-hidden="true">
                      {unlocked ? a.emoji : '🔒'}
                    </span>
                    <strong>{a.label}</strong>
                    <span className="look-how">{unlocked ? (on ? 'Puesto' : 'Tocá para ponérselo') : a.how}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="hint">De noche se pone su gorrito de dormir y en los días especiales, el de fiesta.</p>
    </Sheet>
  );
}
