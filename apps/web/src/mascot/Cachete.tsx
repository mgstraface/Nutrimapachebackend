import { useId } from 'react';
import type { Expression } from '@nutrimapache/shared';
import './cachete.css';

/**
 * Cachete: muñeca quitapenas envuelta en un tejido norteño, con capucha verde y cinta lila.
 * SVG por capas; las animaciones son CSS (transform-box: view-box) para que los giros
 * de brazos y cabeza roten siempre desde el hombro y el cuello.
 * Ninguna expresión es triste: el rango va de alegría a descanso.
 */

const C = {
  red: '#d93a5e',
  purple: '#8a4bb0',
  navy: '#28308f',
  turq: '#3fb6d0',
  turq2: '#2a8fb8',
  yellow: '#f6c445',
  orange: '#f08a3c',
  black: '#2a2233',
  white: '#f4f1ea',
  skin: '#f2dfb4',
  skin2: '#e3c995',
  green: '#2f9a4a',
  green2: '#237a39',
  lilac: '#b8a6ea',
  ink: '#2a2233',
  mouth: '#e04a5a',
  cheek: '#ff8fa3',
};

const BX = 65;
const BY = 92;
const BW = 70;
const BH = 116;


/** Acciones de interacción: duran unos segundos y pisan la expresión. */
export type CacheteAction =
  | 'mimo'
  | 'cosquillas'
  | 'choca-izq'
  | 'choca-der'
  | 'cinta'
  | 'saludo'
  | 'abrazo'
  | 'baile'
  | 'mareo'
  | 'dormida';

/** Lo que tiene puesto. Las claves vienen del catálogo de accesorios (o 'noche'/'fiesta' automáticos). */
export interface CacheteLook {
  head?: string | null;
  face?: string | null;
  neck?: string | null;
  ribbon?: string | null;
}

/** Ángulo de cada brazo (izq, der): 0 = colgando, 90 = horizontal, 150 = arriba, negativo = abrazo. */
const ARMS: Record<Expression, [number, number]> = {
  alegria: [150, 150],
  curiosidad: [20, 140],
  sorpresa: [100, 100],
  descanso: [-42, -42],
  acompañamiento: [15, 155],
};

const ACTION_EXPRESSION: Record<CacheteAction, Expression> = {
  mimo: 'alegria',
  cosquillas: 'alegria',
  'choca-izq': 'sorpresa',
  'choca-der': 'sorpresa',
  cinta: 'curiosidad',
  saludo: 'acompañamiento',
  abrazo: 'alegria',
  baile: 'alegria',
  mareo: 'sorpresa',
  dormida: 'descanso',
};

const ACTION_ARMS: Partial<Record<CacheteAction, [number, number]>> = {
  mimo: [25, 25],
  cosquillas: [-30, -30],
  'choca-izq': [168, 20],
  'choca-der': [20, 168],
  cinta: [120, 120],
  abrazo: [-46, -46],
  baile: [150, 150],
  mareo: [100, 100],
  dormida: [-42, -42],
};

export function armsFor(e: Expression, action?: CacheteAction | null): [number, number] {
  return (action && ACTION_ARMS[action]) || ARMS[action ? ACTION_EXPRESSION[action] : e];
}

export type CacheteZone = 'cinta' | 'cabeza' | 'mano-izq' | 'mano-der' | 'panza' | 'cuerpo';

/** Qué parte se tocó, en coordenadas del dibujo (viewBox 0 0 200 220). */
export function zoneAt(x: number, y: number, e: Expression, action?: CacheteAction | null): CacheteZone | null {
  const [la, ra] = armsFor(e, action);
  for (const [side, angle] of [
    [-1, la],
    [1, ra],
  ] as const) {
    const sx = 100 + side * 33;
    const sy = 120;
    const t = (-side * angle * Math.PI) / 180;
    const hx = sx - 29 * Math.sin(t);
    const hy = sy + 29 * Math.cos(t);
    if (Math.hypot(x - hx, y - hy) < 15) return side === -1 ? 'mano-izq' : 'mano-der';
  }
  if (y < 46 && Math.abs(x - 100) < 22) return 'cinta';
  if (Math.hypot(x - 100, y - 72) <= 33) return 'cabeza';
  if (x >= BX - 4 && x <= BX + BW + 4 && y >= 112 && y <= BY + BH) return 'panza';
  if (x >= 40 && x <= 160 && y >= 10 && y <= 215) return 'cuerpo';
  return null;
}

interface Props {
  expression: Expression;
  size?: number;
  /** Si está, Cachete es tocable como botón (usos simples). Para gestos completos usar el wrapper de la Home. */
  onPet?: () => void;
  label?: string;
  action?: CacheteAction | null;
  look?: CacheteLook;
  /** Hacia dónde mira, de -1 a 1 en cada eje */
  lookAt?: { x: number; y: number } | null;
  envelope?: boolean;
  blanket?: boolean;
  confetti?: boolean;
}

export function Cachete({ expression, size = 200, onPet, label = 'Cachete', action = null, look, lookAt = null, envelope, blanket, confetti }: Props) {
  const uid = useId().replace(/:/g, '');
  const e = action ? ACTION_EXPRESSION[action] : expression;
  const [la, ra] = armsFor(expression, action);
  const tilt = action === 'cinta' ? 0 : e === 'curiosidad' ? -9 : 0;
  const svg = (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      aria-hidden="true"
      className={`cachete-svg is-${e}${action ? ` act-${action}` : ''}`}
    >
      <ellipse className="cachete-shadow" cx="100" cy="212" rx="40" ry="5" fill="#000" opacity="0.2" />

      <g className="cachete-body">
        <Textile uid={uid} />
        <NeckAccessory k={look?.neck} />
        <Arm side={-1} angle={la} wave={false} className="arm-izq" />
        <Arm side={1} angle={ra} wave={!action && e === 'acompañamiento'} className="arm-der" />
        {blanket && <Blanket />}

        <g className="cachete-head" style={{ transform: `rotate(${tilt}deg)` }}>
          <path d="M84 46 C84 14 116 14 116 46" fill="none" stroke={C.lilac} strokeWidth="6" strokeLinecap="round" />
          <RibbonAccessory k={look?.ribbon} />
          <circle cx="100" cy="72" r="31" fill={C.green} />
          <path d="M72 84 A31 31 0 0 0 128 84 L120 84 A24 24 0 0 1 80 84 Z" fill={C.green2} />
          <circle cx="100" cy="73" r="26" fill={C.skin} />
          <path d="M82 56 Q92 50 102 50" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <Face e={e} action={action} lookAt={lookAt} />
          <FaceAccessory k={look?.face} />
          <HeadAccessory k={look?.head} />
        </g>
      </g>

      {action ? <ActionEffect action={action} /> : <Accessory e={e} />}
      {envelope && <Envelope />}
      {confetti && <Confetti />}
    </svg>
  );

  if (onPet) {
    return (
      <button type="button" className="cachete" aria-label={`${label}. Tocala para saludarla.`} onClick={onPet} style={{ width: size, height: size * 1.1 }}>
        {svg}
      </button>
    );
  }
  return (
    <div className="cachete" style={{ width: size, height: size * 1.1 }}>
      {svg}
    </div>
  );
}

function Textile({ uid }: { uid: string }) {
  const bands: JSX.Element[] = [];
  let y = BY;
  const band = (h: number, fill: string) => {
    bands.push(<rect key={`b${y}`} x={BX} y={y} width={BW} height={h} fill={fill} />);
    y += h;
  };
  const braid = () => {
    const cols = [C.yellow, C.orange, C.red, C.black];
    const yy = y;
    bands.push(
      <g key={`br${yy}`}>
        <rect x={BX} y={yy} width={BW} height="8" fill={C.purple} />
        {Array.from({ length: BW / 5 + 3 }, (_, i) => (
          <path key={i} d={`M${BX + (i - 1) * 5} ${yy + 7} l5 -6`} stroke={cols[(i + 3) % 4]} strokeWidth="2.6" strokeLinecap="round" />
        ))}
      </g>,
    );
    y += 8;
  };

  band(6, C.red);
  band(12, C.purple);
  band(10, C.navy);
  band(12, C.turq);
  braid();
  const py = y;
  const ph = 24;
  bands.push(
    <g key="panel">
      <rect x={BX} y={py} width={BW} height={ph} fill={C.navy} />
      {[0, 26, 52, 78].map((i) => (
        <path key={i} d={`M${BX - 8 + i} ${py + ph} L${BX + 5 + i} ${py + 3} L${BX + 18 + i} ${py + ph}`} fill={C.turq2} stroke={C.white} strokeWidth="1.6" />
      ))}
    </g>,
  );
  y += ph;
  band(5, C.purple);
  braid();
  band(12, C.turq);
  band(BY + BH - y + 4, C.navy);

  return (
    <g>
      <clipPath id={`cb-${uid}`}>
        <rect x={BX} y={BY} width={BW} height={BH} rx="18" />
      </clipPath>
      <g clipPath={`url(#cb-${uid})`}>
        {bands}
        <g stroke="#fff" strokeOpacity="0.07">
          {Array.from({ length: 40 }, (_, k) => (
            <path key={k} d={`M${BX} ${BY + k * 3} h${BW}`} />
          ))}
        </g>
      </g>
      <rect x={BX} y={BY} width={BW} height={BH} rx="18" fill="none" stroke={C.black} strokeOpacity="0.12" strokeWidth="1.5" />
    </g>
  );
}


function Arm({ side, angle, wave, className }: { side: -1 | 1; angle: number; wave: boolean; className?: string }) {
  const sx = 100 + side * 33;
  const sy = 120;
  const origin = `${sx}px ${sy}px`;
  return (
    <g className={`cachete-arm ${className ?? ''}`} style={{ transformOrigin: origin, transform: `rotate(${-side * angle}deg)` }}>
      <g className={wave ? 'cachete-wave' : 'cachete-arm-inner'} style={{ transformOrigin: origin }}>
        <rect x={sx - 7} y={sy - 4} width="14" height="30" rx="7" fill={C.purple} />
        <rect x={sx - 7} y={sy + 17} width="14" height="4" fill={C.yellow} />
        <circle cx={sx} cy={sy + 29} r="7.5" fill={C.skin} stroke={C.skin2} strokeWidth="1.2" />
      </g>
    </g>
  );
}

function Face({ e, action, lookAt }: { e: Expression; action: CacheteAction | null; lookAt: { x: number; y: number } | null }) {
  const ink = C.ink;
  let eyes: JSX.Element;
  let mouth: JSX.Element;
  const following = !!lookAt && !action && e !== 'descanso';

  if (action === 'mareo') {
    eyes = (
      <g fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" className="eyes-spin">
        <path d="M89 68 m0 0 a1.5 1.5 0 1 1 1.5 1.5 a3 3 0 1 1 -3 -3 a4.5 4.5 0 1 1 4.5 4.5" />
        <path d="M111 68 m0 0 a1.5 1.5 0 1 1 1.5 1.5 a3 3 0 1 1 -3 -3 a4.5 4.5 0 1 1 4.5 4.5" />
      </g>
    );
    mouth = <path d="M94 84 Q97 81 100 84 Q103 87 106 84" fill="none" stroke={C.mouth} strokeWidth="2.2" strokeLinecap="round" />;
  } else if (following) {
    // Mira hacia el dedo: pupilas desplazadas
    const dx = Math.max(-1, Math.min(1, lookAt!.x)) * 3.2;
    const dy = Math.max(-1, Math.min(1, lookAt!.y)) * 2.6;
    eyes = (
      <g>
        <circle cx={89 + dx} cy={68 + dy} r="3.8" fill={ink} />
        <circle cx={111 + dx} cy={68 + dy} r="3.8" fill={ink} />
        <circle cx={90.2 + dx} cy={66.7 + dy} r="1.2" fill="#fff" />
        <circle cx={112.2 + dx} cy={66.7 + dy} r="1.2" fill="#fff" />
      </g>
    );
    mouth = <path d="M95 81 Q100 86 105 81" fill="none" stroke={C.mouth} strokeWidth="2.4" strokeLinecap="round" />;
  } else {
    switch (e) {
      case 'alegria':
        eyes = (
          <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
            <path d="M84 70 Q89 64 94 70" />
            <path d="M106 70 Q111 64 116 70" />
          </g>
        );
        mouth = <path d="M94 81 Q100 89 106 81 Z" fill={C.mouth} />;
        break;
      case 'descanso':
        // Ojitos cerrados como en la muñeca real
        eyes = (
          <g fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round">
            <path d="M84 68 Q89 72 94 68" />
            <path d="M106 68 Q111 72 116 68" />
          </g>
        );
        mouth = <path d="M97.5 82 Q100 83.5 102.5 82" fill="none" stroke={C.mouth} strokeWidth="2.2" strokeLinecap="round" />;
        break;
      case 'sorpresa':
        eyes = (
          <g className="cachete-blink">
            <circle cx="89" cy="68" r="4" fill={ink} />
            <circle cx="111" cy="68" r="4" fill={ink} />
            <circle cx="90.3" cy="66.6" r="1.3" fill="#fff" />
            <circle cx="112.3" cy="66.6" r="1.3" fill="#fff" />
          </g>
        );
        mouth = <ellipse cx="100" cy="84" rx="3.6" ry="4.6" fill={C.mouth} />;
        break;
      case 'curiosidad':
        eyes = (
          <g className="cachete-blink">
            <circle cx="91" cy="68" r="3.2" fill={ink} />
            <circle cx="113" cy="68" r="3.2" fill={ink} />
            <circle cx="92" cy="67" r="1" fill="#fff" />
            <circle cx="114" cy="67" r="1" fill="#fff" />
          </g>
        );
        mouth = <circle cx="103" cy="83" r="2.4" fill={C.mouth} />;
        break;
      case 'acompañamiento':
      default:
        eyes = (
          <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
            <path d="M85 69 Q89 65.5 93 69" />
            <path d="M107 69 Q111 65.5 115 69" />
          </g>
        );
        mouth = <path d="M95 81 Q100 86 105 81" fill="none" stroke={C.mouth} strokeWidth="2.4" strokeLinecap="round" />;
    }
  }
  const warm = e === 'alegria' || e === 'acompañamiento' || action === 'abrazo' || action === 'mimo';
  return (
    <g>
      {eyes}
      <path d="M100 72 v5" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      {mouth}
      <g fill={C.cheek} opacity={warm ? 0.85 : 0.45} className="cachete-cheeks">
        <ellipse cx="82" cy="79" rx="5.5" ry="3.6" />
        <ellipse cx="118" cy="79" rx="5.5" ry="3.6" />
      </g>
    </g>
  );
}

/* ---------------- accesorios ---------------- */

function HeadAccessory({ k }: { k?: string | null }) {
  switch (k) {
    case 'noche':
      // Gorro de dormir que cae hacia un costado, con pompón
      return (
        <g className="acc-head">
          <path d="M70 62 Q76 36 100 38 Q130 36 148 58 Q140 46 130 50 Q124 44 116 45 L130 62 Z" fill="#3b3f9e" />
          <path d="M70 62 Q100 50 130 62 L130 66 Q100 55 70 66 Z" fill="#f4f1ea" />
          <circle cx="150" cy="60" r="6.5" fill="#f4f1ea" />
          <circle cx="92" cy="46" r="1.6" fill={C.yellow} />
          <circle cx="112" cy="44" r="1.3" fill={C.yellow} />
        </g>
      );
    case 'fiesta':
      return (
        <g className="acc-head acc-party">
          <path d="M86 46 L100 10 L114 46 Z" fill={C.yellow} />
          <path d="M90 36 L110 36 M94 26 L106 26" stroke={C.red} strokeWidth="3" />
          <circle cx="100" cy="10" r="4.5" fill={C.red} />
          <path d="M86 46 L114 46" stroke={C.purple} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'lana':
      return (
        <g className="acc-head">
          <path d="M70 62 Q72 34 100 33 Q128 34 130 62 Z" fill={C.red} />
          <path d="M72 50 Q100 40 128 50" stroke={C.yellow} strokeWidth="3" fill="none" />
          <rect x="68" y="58" width="64" height="9" rx="4.5" fill={C.purple} />
          <circle cx="100" cy="31" r="7" fill={C.yellow} />
        </g>
      );
    case 'corona':
      return (
        <g className="acc-head">
          <path d="M72 54 Q100 40 128 54" stroke={C.green2} strokeWidth="3" fill="none" />
          {[
            [76, 52, C.red],
            [88, 46, C.yellow],
            [100, 44, C.lilac],
            [112, 46, C.orange],
            [124, 52, C.red],
          ].map(([x, y, col]) => (
            <g key={String(x)}>
              <circle cx={x as number} cy={y as number} r="5" fill={col as string} />
              <circle cx={x as number} cy={y as number} r="1.8" fill={C.yellow} />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

function FaceAccessory({ k }: { k?: string | null }) {
  if (k === 'lentes') {
    return (
      <g className="acc-face">
        <rect x="80" y="62" width="17" height="11" rx="5" fill={C.ink} />
        <rect x="103" y="62" width="17" height="11" rx="5" fill={C.ink} />
        <path d="M97 66 Q100 64 103 66" stroke={C.ink} strokeWidth="2" fill="none" />
        <path d="M83 64 l5 0" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M106 64 l5 0" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }
  if (k === 'camara') {
    // Lupita curiosa en un ojo
    return (
      <g className="acc-face">
        <circle cx="111" cy="68" r="8" fill="#ffffff" fillOpacity="0.25" stroke={C.yellow} strokeWidth="2.5" />
        <path d="M117 74 L124 81" stroke={C.yellow} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

function NeckAccessory({ k }: { k?: string | null }) {
  if (k === 'bufanda') {
    return (
      <g className="acc-neck">
        <rect x="64" y="94" width="72" height="13" rx="6.5" fill={C.turq} />
        <path d="M70 100 h60" stroke={C.yellow} strokeWidth="3" strokeDasharray="6 5" />
        <path d="M118 104 l4 24 l10 -2 l-4 -22 z" fill={C.turq} />
        <path d="M121 126 l1 5 M125 125 l1 5 M129 124 l1 5" stroke={C.yellow} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  if (k === 'poncho') {
    return (
      <g className="acc-neck">
        <path d="M62 96 L138 96 L146 138 L54 138 Z" fill={C.red} />
        <path d="M58 118 L142 118" stroke={C.yellow} strokeWidth="3" />
        <path d="M62 126 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6" stroke="#fff" strokeWidth="1.5" fill="none" />
        <path d="M56 138 v5 M64 138 v5 M72 138 v5 M80 138 v5 M88 138 v5 M96 138 v5 M104 138 v5 M112 138 v5 M120 138 v5 M128 138 v5 M136 138 v5 M144 138 v5" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

function RibbonAccessory({ k }: { k?: string | null }) {
  if (k === 'flores') {
    return (
      <g className="acc-ribbon">
        {[
          [85, 34, C.yellow],
          [100, 18, C.red],
          [115, 34, C.yellow],
        ].map(([x, y, col]) => (
          <g key={String(x)}>
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={(x as number) + 3.2 * Math.cos((a * Math.PI) / 180)} cy={(y as number) + 3.2 * Math.sin((a * Math.PI) / 180)} r="2.4" fill={col as string} />
            ))}
            <circle cx={x as number} cy={y as number} r="1.8" fill="#fff" />
          </g>
        ))}
      </g>
    );
  }
  if (k === 'mono') {
    return (
      <g className="acc-ribbon">
        <path d="M100 18 L86 10 L86 26 Z" fill={C.red} />
        <path d="M100 18 L114 10 L114 26 Z" fill={C.red} />
        <circle cx="100" cy="18" r="3.5" fill={C.yellow} />
      </g>
    );
  }
  return null;
}

function Blanket() {
  return (
    <g className="acc-blanket">
      <path d="M52 140 Q100 126 148 140 L146 206 Q100 216 54 206 Z" fill={C.lilac} />
      <path d="M52 140 Q100 126 148 140 L148 150 Q100 138 52 150 Z" fill="#f4f1ea" />
      {[160, 176, 192].map((y) => (
        <path key={y} d={`M56 ${y} Q100 ${y - 8} 144 ${y}`} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 6" fill="none" />
      ))}
    </g>
  );
}

function Envelope() {
  return (
    <g className="acc-envelope">
      <rect x="140" y="138" width="34" height="24" rx="3" fill="#ffffff" stroke={C.lilac} strokeWidth="2" />
      <path d="M140 140 L157 153 L174 140" fill="none" stroke={C.lilac} strokeWidth="2" />
      <path d="M157 156 c-3 -4 -8 -1 -4 3 l4 4 l4 -4 c4 -4 -1 -7 -4 -3 z" fill={C.red} />
    </g>
  );
}

function Confetti() {
  const pieces = [
    [30, C.yellow, 0],
    [55, C.red, 0.3],
    [80, C.turq, 0.15],
    [120, C.purple, 0.45],
    [145, C.yellow, 0.1],
    [170, C.red, 0.35],
    [45, C.turq, 0.6],
    [160, C.orange, 0.7],
    [100, C.lilac, 0.5],
  ] as const;
  return (
    <g className="acc-confetti">
      {pieces.map(([x, col, d], i) => (
        <rect key={i} x={x} y={-10} width="5" height="9" rx="1.5" fill={col} style={{ animationDelay: `${d}s` }} />
      ))}
    </g>
  );
}

function ActionEffect({ action }: { action: CacheteAction }) {
  if (action === 'mimo' || action === 'abrazo') {
    return (
      <g className="fx-hearts" fill={C.red}>
        {[
          [62, 40, 0],
          [138, 34, 0.25],
          [100, 22, 0.5],
        ].map(([x, y, d]) => (
          <path key={x} d={`M${x} ${y} c-4 -6 -12 -1 -6 6 l6 6 l6 -6 c6 -7 -2 -12 -6 -6 z`} style={{ animationDelay: `${d}s` }} />
        ))}
      </g>
    );
  }
  if (action === 'choca-izq' || action === 'choca-der') {
    const x = action === 'choca-izq' ? 52 : 148;
    return (
      <g className="fx-star" fill={C.yellow}>
        <path d={`M${x} 70 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 z`} />
      </g>
    );
  }
  if (action === 'mareo') {
    return (
      <g className="fx-orbit" fill={C.yellow}>
        <path d="M70 32 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
        <path d="M130 32 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
      </g>
    );
  }
  if (action === 'dormida') {
    return (
      <g className="cachete-zz" fill={C.lilac} fontFamily="var(--font-display)" fontWeight="800">
        <text x="140" y="44" fontSize="20">z</text>
        <text x="157" y="28" fontSize="14">z</text>
      </g>
    );
  }
  if (action === 'baile') {
    return (
      <g className="fx-notes" fill={C.yellow} fontSize="20" fontWeight="800">
        <text x="40" y="50">♪</text>
        <text x="150" y="40">♫</text>
      </g>
    );
  }
  return null;
}

function Accessory({ e }: { e: Expression }) {
  if (e === 'sorpresa') {
    return (
      <g className="cachete-pop" fill={C.yellow}>
        {[
          [38, 34, 9],
          [160, 26, 7],
          [168, 70, 5],
        ].map(([x, y, s]) => (
          <path key={x} d={`M${x} ${y} l${s! * 0.3} ${s} l${s} ${s! * 0.3} l-${s} ${s! * 0.3} l-${s! * 0.3} ${s} l-${s! * 0.3} -${s} l-${s} -${s! * 0.3} l${s} -${s! * 0.3} z`} />
        ))}
      </g>
    );
  }
  if (e === 'descanso') {
    return (
      <g className="cachete-zz" fill={C.lilac} fontFamily="var(--font-display)" fontWeight="800">
        <text x="140" y="44" fontSize="20">
          z
        </text>
        <text x="157" y="28" fontSize="14">
          z
        </text>
      </g>
    );
  }
  if (e === 'curiosidad') {
    return (
      <text className="cachete-q" x="146" y="48" fontSize="28" fontFamily="var(--font-display)" fontWeight="800" fill={C.yellow}>
        ?
      </text>
    );
  }
  if (e === 'alegria') {
    return (
      <g className="cachete-pop" fill={C.red} opacity="0.85">
        {[
          [40, 40],
          [162, 34],
        ].map(([x, y]) => (
          <path key={x} d={`M${x} ${y} c-4 -6 -12 -1 -6 6 l6 6 l6 -6 c6 -7 -2 -12 -6 -6 z`} />
        ))}
      </g>
    );
  }
  return null;
}
