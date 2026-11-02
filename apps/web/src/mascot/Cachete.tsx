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

/** Ángulo de cada brazo (izq, der): 0 = colgando, 90 = horizontal, 150 = arriba, negativo = abrazo. */
const ARMS: Record<Expression, [number, number]> = {
  alegria: [150, 150],
  curiosidad: [20, 140],
  sorpresa: [100, 100],
  descanso: [-42, -42],
  acompañamiento: [15, 155],
};

interface Props {
  expression: Expression;
  size?: number;
  onPet?: () => void;
  label?: string;
}

export function Cachete({ expression: e, size = 200, onPet, label = 'Cachete' }: Props) {
  const uid = useId().replace(/:/g, '');
  const [la, ra] = ARMS[e];

  return (
    <button type="button" className="cachete" aria-label={`${label}. Tocala para saludarla.`} onClick={onPet} style={{ width: size, height: size * 1.1 }}>
      <svg viewBox="0 0 200 220" width={size} height={size * 1.1} aria-hidden="true" className={`cachete-svg is-${e}`}>
        <ellipse className="cachete-shadow" cx="100" cy="212" rx="40" ry="5" fill="#000" opacity="0.2" />

        <g className="cachete-body">
          <Textile uid={uid} />
          <Arm side={-1} angle={la} wave={false} />
          <Arm side={1} angle={ra} wave={e === 'acompañamiento'} />

          <g className="cachete-head" style={{ transform: `rotate(${e === 'curiosidad' ? -9 : 0}deg)` }}>
            <path d="M84 46 C84 14 116 14 116 46" fill="none" stroke={C.lilac} strokeWidth="6" strokeLinecap="round" />
            <circle cx="100" cy="72" r="31" fill={C.green} />
            <path d="M72 84 A31 31 0 0 0 128 84 L120 84 A24 24 0 0 1 80 84 Z" fill={C.green2} />
            <circle cx="100" cy="73" r="26" fill={C.skin} />
            <path d="M82 56 Q92 50 102 50" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <Face e={e} />
          </g>
        </g>

        <Accessory e={e} />
      </svg>
    </button>
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

function Arm({ side, angle, wave }: { side: -1 | 1; angle: number; wave: boolean }) {
  const sx = 100 + side * 33;
  const sy = 120;
  const origin = `${sx}px ${sy}px`;
  return (
    <g className="cachete-arm" style={{ transformOrigin: origin, transform: `rotate(${-side * angle}deg)` }}>
      <g className={wave ? 'cachete-wave' : undefined} style={{ transformOrigin: origin }}>
        <rect x={sx - 7} y={sy - 4} width="14" height="30" rx="7" fill={C.purple} />
        <rect x={sx - 7} y={sy + 17} width="14" height="4" fill={C.yellow} />
        <circle cx={sx} cy={sy + 29} r="7.5" fill={C.skin} stroke={C.skin2} strokeWidth="1.2" />
      </g>
    </g>
  );
}

function Face({ e }: { e: Expression }) {
  const ink = C.ink;
  let eyes: JSX.Element;
  let mouth: JSX.Element;
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
  const warm = e === 'alegria' || e === 'acompañamiento';
  return (
    <g>
      {eyes}
      <path d="M100 72 v5" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      {mouth}
      <g fill={C.cheek} opacity={warm ? 0.75 : 0.45} className="cachete-cheeks">
        <ellipse cx="82" cy="79" rx="5.5" ry="3.6" />
        <ellipse cx="118" cy="79" rx="5.5" ry="3.6" />
      </g>
    </g>
  );
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
