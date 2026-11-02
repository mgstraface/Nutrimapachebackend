import { AnimatePresence, motion } from 'framer-motion';
import type { Note } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';

/** La carta que trae Cachete. */
export function NoteModal({ note, onClose }: { note: Note | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {note && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="letter"
            role="dialog"
            aria-modal="true"
            aria-label={`Notita de ${note.fromName}`}
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            <div className="letter-cachete">
              <Cachete expression="alegria" action="mimo" size={92} />
            </div>
            <p className="letter-from">De {note.fromName} 💌</p>
            <p className="letter-text">{note.text}</p>
            <button type="button" className="btn-primary" onClick={onClose}>
              Guardar en mis notitas
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
