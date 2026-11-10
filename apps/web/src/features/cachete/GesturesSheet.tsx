import type { ShakeStatus } from '../../mascot/useShake';
import { Sheet } from './Sheet';

const GESTURES: { emoji: string; title: string; how: string }[] = [
  { emoji: '👋', title: 'Saludarla', how: 'Un toque en el cuerpo.' },
  { emoji: '💛', title: 'Mimo', how: 'Un toque en la cabeza.' },
  { emoji: '😌', title: 'Rascarle la cabeza', how: 'Frotá el dedo sobre la cabeza, de un lado a otro.' },
  { emoji: '☺️', title: 'Pellizcarle los cachetes', how: 'Tocale uno de los cachetes rosados.' },
  { emoji: '🤭', title: 'Cosquillas', how: 'Tocale la panza. Si seguís (tres veces seguidas), le agarra un ataque de risa.' },
  { emoji: '✋', title: 'Chocar los cinco', how: 'Tocale una de las manos.' },
  { emoji: '🎀', title: 'Hamacarla', how: 'Tocale la cintita de arriba.' },
  { emoji: '💃', title: 'Bailar', how: 'Doble toque rápido.' },
  { emoji: '🤗', title: 'Abrazo', how: 'Mantené el dedo apretado sobre ella.' },
  { emoji: '😵‍💫', title: 'Marearla', how: 'Apoyá el dedo en el cuerpo y movelo rápido de lado a lado, sin levantarlo. O sacudí el celu.' },
  { emoji: '🌙', title: 'Acunarla', how: 'De noche (de 21 a 6 h), mecerla de lado a lado la hace dormir en vez de marearse.' },
  { emoji: '👀', title: 'Que te siga con la mirada', how: 'Mové el dedo cerca de ella.' },
];

/** La lista de cosas que se le pueden hacer a Cachete (y el permiso para sacudir el celu). */
export function GesturesSheet({
  open,
  name,
  shake,
  onEnableShake,
  onClose,
}: {
  open: boolean;
  name: string;
  shake: ShakeStatus;
  onEnableShake: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} title={`¿Qué le puedo hacer a ${name}?`} onClose={onClose}>
      <ul className="gestures">
        {GESTURES.map((g) => (
          <li key={g.title}>
            <span className="gestures-emoji" aria-hidden="true">
              {g.emoji}
            </span>
            <span>
              <strong>{g.title}</strong>
              <br />
              <span className="hint">{g.how}</span>
            </span>
          </li>
        ))}
      </ul>
      {shake === 'pedir' && (
        <div className="gestures-shake">
          <p className="hint">Para que se maree cuando sacudís el celu, el iPhone pide permiso para usar el movimiento.</p>
          <button type="button" className="btn-primary btn-small" onClick={onEnableShake}>
            Activar sacudir el celu
          </button>
        </div>
      )}
      {shake === 'denegado' && (
        <p className="hint gestures-shake">
          El permiso de movimiento quedó desactivado. Para volver a activarlo hay que borrar los datos del sitio en los ajustes de Safari.
        </p>
      )}
      {shake === 'activo' && <p className="hint gestures-shake">Sacudir el celu está activado 📳</p>}
      <p className="hint">Cuando no la tocás un rato, hace sus cosas: bosteza, se estira, mira para los costados. Y cuando anotás algo, reacciona.</p>
    </Sheet>
  );
}
