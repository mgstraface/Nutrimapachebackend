import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cachete } from '../../mascot/Cachete';
import { play } from '../../lib/sound';

const IN = 4;
const OUT = 6;
const CYCLES = 6;

/**
 * Un minuto de calma: Cachete se infla al inhalar (4 s) y se desinfla al exhalar (6 s), 6 veces.
 * De noche termina arropándola con su mantita.
 */
export function BreathSheet({ open, night, name, onDone, onClose }: { open: boolean; night: boolean; name: string; onDone: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'in' | 'out' | 'done'>('ready');
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!open) {
      setPhase('ready');
      setCycle(0);
    }
  }, [open]);

  useEffect(() => {
    if (phase === 'in') {
      const t = setTimeout(() => setPhase('out'), IN * 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'out') {
      const t = setTimeout(() => {
        if (cycle + 1 >= CYCLES) {
          setPhase('done');
          if (night) play('bostezo');
          onDone();
        } else {
          setCycle(cycle + 1);
          setPhase('in');
        }
      }, OUT * 1000);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycle]);

  const scale = phase === 'in' ? 1.18 : 1;
  const dur = phase === 'in' ? IN : OUT;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="breath" role="dialog" aria-modal="true" aria-label="Un minuto de calma" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="breath-close link" onClick={onClose}>
            {phase === 'done' ? 'Listo' : 'Salir'}
          </button>
          <div className="breath-stage">
            <motion.div animate={{ scale }} transition={{ duration: phase === 'ready' || phase === 'done' ? 0.6 : dur, ease: 'easeInOut' }}>
              <Cachete expression="descanso" size={180} blanket={phase === 'done' && night} look={night ? { head: 'noche' } : undefined} />
            </motion.div>
          </div>
          <div className="breath-text" aria-live="polite">
            {phase === 'ready' && (
              <>
                <p>Respiremos juntas un minuto. Seguí a Cachete: cuando se infla, inhalá; cuando se desinfla, soltá el aire despacito.</p>
                <button type="button" className="btn-primary" onClick={() => setPhase('in')}>
                  Empezar
                </button>
              </>
            )}
            {(phase === 'in' || phase === 'out') && (
              <>
                <p className="breath-cue">{phase === 'in' ? 'Inhalá…' : 'Exhalá despacito…'}</p>
                <div className="breath-dots" aria-hidden="true">
                  {Array.from({ length: CYCLES }, (_, i) => (
                    <span key={i} className={i < cycle ? 'on' : i === cycle ? 'now' : ''} />
                  ))}
                </div>
              </>
            )}
            {phase === 'done' && (
              <>
                <p className="breath-cue">{night ? `Que descanses, ${name} 🌙` : 'Qué lindo. Gracias por este ratito.'}</p>
                <button type="button" className="btn-primary" onClick={onClose}>
                  {night ? 'Buenas noches' : 'Volver'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
