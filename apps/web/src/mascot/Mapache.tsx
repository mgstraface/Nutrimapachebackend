import { motion, useReducedMotion } from 'framer-motion';
import type { Expression } from '@nutrimapache/shared';

interface Props {
  expression: Expression;
  size?: number;
  onPet?: () => void;
}

/**
 * Mapache en SVG por capas: cola, cuerpo, cabeza, máscara, ojos, boca y accesorio.
 * Cada expresión cambia ojos, boca, postura y un pequeño accesorio.
 * Ninguna expresión es triste: el rango es alegría → descanso.
 */
export function Mapache({ expression, size = 200, onPet }: Props) {
  const reduce = useReducedMotion();
  const tilt = expression === 'curiosidad' ? -8 : 0;

  return (
    <motion.button
      type="button"
      className="mapache"
      aria-label="Tu mapache. Tocalo para saludarlo."
      onClick={onPet}
      style={{ width: size, height: size, background: 'none', border: 0, padding: 0 }}
      whileTap={reduce ? undefined : { scale: 0.94 }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-hidden="true">
        {/* sombra en el piso */}
        <ellipse cx="100" cy="188" rx="52" ry="7" fill="#000" opacity="0.18" />

        {/* respiración / salto: todo el cuerpo */}
        <motion.g
          key={expression}
          style={{ originX: '100px', originY: '188px' }}
          initial={reduce ? false : { y: expression === 'alegria' || expression === 'sorpresa' ? -14 : 0 }}
          animate={reduce ? undefined : { y: 0, scaleY: [1, 1.025, 1] }}
          transition={{ y: { type: 'spring', stiffness: 380, damping: 11 }, scaleY: { duration: expression === 'descanso' ? 4.5 : 3, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <Tail wag={!reduce && expression !== 'descanso'} fast={expression === 'alegria'} />

          {/* cuerpo */}
          <ellipse cx="100" cy="150" rx="44" ry="36" fill="var(--fur)" />
          <ellipse cx="100" cy="158" rx="28" ry="24" fill="var(--fur-light)" />
          {/* patitas */}
          <ellipse cx="78" cy="182" rx="13" ry="7" fill="var(--mask)" />
          <ellipse cx="122" cy="182" rx="13" ry="7" fill="var(--mask)" />
          {expression !== 'acompañamiento' && (
            <>
              <ellipse cx="80" cy="150" rx="9" ry="12" fill="var(--mask)" />
              <ellipse cx="120" cy="150" rx="9" ry="12" fill="var(--mask)" />
            </>
          )}
          {expression === 'acompañamiento' && (
            <>
              <ellipse cx="120" cy="150" rx="9" ry="12" fill="var(--mask)" />
              <motion.g
                style={{ originX: '72px', originY: '148px' }}
                animate={reduce ? undefined : { rotate: [0, 16, 0, 16, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4 }}
              >
                <path d="M72 150 Q48 146 34 130" stroke="var(--fur)" strokeWidth="14" strokeLinecap="round" fill="none" />
                <ellipse cx="31" cy="125" rx="9" ry="11" fill="var(--mask)" transform="rotate(-35 31 125)" />
              </motion.g>
            </>
          )}

          {/* cabeza */}
          <motion.g
            style={{ originX: '100px', originY: '130px' }}
            animate={{ rotate: tilt }}
            transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          >
            {/* orejas */}
            <path d="M52 70 L58 30 L86 54 Z" fill="var(--fur)" strokeLinejoin="round" stroke="var(--fur)" strokeWidth="8" />
            <path d="M148 70 L142 30 L114 54 Z" fill="var(--fur)" strokeLinejoin="round" stroke="var(--fur)" strokeWidth="8" />
            <path d="M60 60 L62 40 L78 54 Z" fill="var(--mask)" opacity="0.8" />
            <path d="M140 60 L138 40 L122 54 Z" fill="var(--mask)" opacity="0.8" />

            <ellipse cx="100" cy="90" rx="58" ry="46" fill="var(--fur)" />
            {/* frente y hocico claros */}
            <path d="M100 52 C88 64 80 72 76 82 L124 82 C120 72 112 64 100 52 Z" fill="var(--fur-light)" />
            <ellipse cx="100" cy="112" rx="34" ry="22" fill="var(--fur-light)" />
            {/* máscara */}
            <path
              d="M46 92 C50 76 66 72 80 76 C90 79 95 84 100 84 C105 84 110 79 120 76 C134 72 150 76 154 92 C150 104 134 108 120 102 C112 99 106 96 100 96 C94 96 88 99 80 102 C66 108 50 104 46 92 Z"
              fill="var(--mask)"
            />

            <Eyes expression={expression} reduce={!!reduce} />

            {/* nariz */}
            <path d="M93 104 Q100 99 107 104 Q104 110 100 111 Q96 110 93 104 Z" fill="var(--mask)" />
            <Mouth expression={expression} />
            {/* cachetes */}
            {(expression === 'alegria' || expression === 'acompañamiento') && (
              <>
                <ellipse cx="68" cy="114" rx="8" ry="5" fill="#ff9fb5" opacity="0.55" />
                <ellipse cx="132" cy="114" rx="8" ry="5" fill="#ff9fb5" opacity="0.55" />
              </>
            )}
          </motion.g>

          <Accessory expression={expression} reduce={!!reduce} />
        </motion.g>
      </svg>
    </motion.button>
  );
}

function Tail({ wag, fast }: { wag: boolean; fast: boolean }) {
  return (
    <motion.g
      style={{ originX: '132px', originY: '168px' }}
      animate={wag ? { rotate: [0, 10, 0, 10, 0] } : { rotate: 0 }}
      transition={{ duration: fast ? 0.9 : 2.4, repeat: Infinity, repeatDelay: fast ? 0.2 : 1.5 }}
    >
      <g transform="rotate(-38 160 140)">
        <ellipse cx="160" cy="140" rx="17" ry="44" fill="var(--fur)" />
        <clipPath id="tail-clip">
          <ellipse cx="160" cy="140" rx="17" ry="44" />
        </clipPath>
        <g clipPath="url(#tail-clip)" fill="var(--mask)">
          <rect x="140" y="98" width="40" height="11" />
          <rect x="140" y="118" width="40" height="11" />
          <rect x="140" y="138" width="40" height="11" />
          <rect x="140" y="158" width="40" height="11" />
        </g>
      </g>
    </motion.g>
  );
}

function Eyes({ expression, reduce }: { expression: Expression; reduce: boolean }) {
  if (expression === 'alegria') {
    return (
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
        <path d="M68 92 Q78 81 88 92" />
        <path d="M112 92 Q122 81 132 92" />
      </g>
    );
  }
  if (expression === 'descanso') {
    return (
      <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
        <path d="M68 89 Q78 97 88 89" />
        <path d="M112 89 Q122 97 132 89" />
      </g>
    );
  }
  const big = expression === 'sorpresa';
  const r = big ? 11 : 9;
  const pr = big ? 6 : 5.5;
  const look = expression === 'curiosidad' ? { x: 3, y: -2 } : { x: 0, y: 1 };
  return (
    <motion.g
      style={{ originX: '100px', originY: '90px' }}
      animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1] }}
      transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }}
    >
      {[78, 122].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="90" r={r} fill="#fff" />
          <circle cx={cx + look.x} cy={90 + look.y} r={pr} fill="var(--ink)" />
          <circle cx={cx + look.x + 2} cy={90 + look.y - 2.5} r="2" fill="#fff" />
        </g>
      ))}
    </motion.g>
  );
}

function Mouth({ expression }: { expression: Expression }) {
  switch (expression) {
    case 'alegria':
      return (
        <g>
          <path d="M88 114 Q100 132 112 114 Z" fill="var(--mask)" />
          <path d="M94 121 Q100 129 106 121 Q100 124 94 121 Z" fill="#ff8fa8" />
        </g>
      );
    case 'sorpresa':
      return <ellipse cx="100" cy="121" rx="6" ry="8" fill="var(--mask)" />;
    case 'curiosidad':
      return <ellipse cx="104" cy="119" rx="3.5" ry="4" fill="var(--mask)" />;
    case 'descanso':
      return <path d="M95 117 Q100 120 105 117" fill="none" stroke="var(--mask)" strokeWidth="3" strokeLinecap="round" />;
    case 'acompañamiento':
    default:
      return <path d="M90 115 Q100 125 110 115" fill="none" stroke="var(--mask)" strokeWidth="3.5" strokeLinecap="round" />;
  }
}

function Accessory({ expression, reduce }: { expression: Expression; reduce: boolean }) {
  if (expression === 'sorpresa') {
    return (
      <motion.g
        fill="var(--lamp)"
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ originX: '100px', originY: '60px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 12 }}
      >
        <path d="M34 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
        <path d="M166 30 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" />
        <path d="M172 76 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
      </motion.g>
    );
  }
  if (expression === 'descanso') {
    return (
      <motion.g
        fill="var(--fur-light)"
        fontFamily="var(--font-display)"
        fontWeight="800"
        animate={reduce ? undefined : { y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <text x="150" y="44" fontSize="20">z</text>
        <text x="166" y="28" fontSize="14">z</text>
      </motion.g>
    );
  }
  if (expression === 'curiosidad') {
    return (
      <motion.text
        x="158"
        y="48"
        fontSize="28"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fill="var(--lamp)"
        animate={reduce ? undefined : { rotate: [0, 12, 0] }}
        style={{ originX: '166px', originY: '40px' }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ?
      </motion.text>
    );
  }
  return null;
}
