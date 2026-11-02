import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** Hoja inferior genérica (mismo estilo que las demás). */
export function Sheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <header className="sheet-head">
              <h2>{title}</h2>
              <button type="button" className="link" onClick={onClose}>
                Cerrar
              </button>
            </header>
            <div className="sheet-body">{children}</div>
            {footer && <footer className="sheet-foot">{footer}</footer>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
