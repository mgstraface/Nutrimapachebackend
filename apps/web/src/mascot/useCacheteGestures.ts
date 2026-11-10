import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { onHead } from './Cachete';

/**
 * Gestos sobre Cachete:
 * - toque → zona (cabeza, panza, mano, cinta…)
 * - doble toque → baile
 * - mantener apretado → abrazo
 * - deslizar de lado a lado sobre el cuerpo → mecerla
 * - frotar el dedo sobre la cabeza → rascarla
 * - mover el dedo → los ojos lo siguen
 * Coordenadas convertidas al dibujo (viewBox 0 0 200 220).
 */
export type Gesture = { kind: 'tap'; x: number; y: number } | { kind: 'double'; x: number; y: number } | { kind: 'hold' } | { kind: 'rock' } | { kind: 'rub' };

const HOLD_MS = 550;
const DOUBLE_MS = 280;
/** Mecer: cuántos cambios de dirección y en cuánto tiempo (antes era 3 en 1,6 s y costaba) */
const ROCK_FLIPS = 3;
const ROCK_WINDOW_MS = 2200;
/** Rascar: cuánto recorrido del dedo sobre la cabeza (en unidades del dibujo) */
const RUB_PATH = 130;

export function useCacheteGestures(onGesture: (g: Gesture) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [lookAt, setLookAt] = useState<{ x: number; y: number } | null>(null);
  const st = useRef({
    downAt: 0,
    sx: 0,
    sy: 0,
    lastX: 0,
    dir: 0,
    flips: 0,
    flipStart: 0,
    moved: false,
    fired: false,
    onHead: false,
    path: 0,
    px: 0,
    py: 0,
    holdTimer: 0 as number | ReturnType<typeof setTimeout>,
    tapTimer: 0 as number | ReturnType<typeof setTimeout>,
    lastTap: { t: 0, x: 0, y: 0 },
    clearLook: 0 as number | ReturnType<typeof setTimeout>,
  });
  const cb = useRef(onGesture);
  cb.current = onGesture;

  useEffect(
    () => () => {
      clearTimeout(st.current.holdTimer);
      clearTimeout(st.current.tapTimer);
      clearTimeout(st.current.clearLook);
    },
    [],
  );

  const toSvg = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 200, y: ((e.clientY - r.top) / r.height) * 220 };
  };

  const updateLook = (e: PointerEvent) => {
    const p = toSvg(e);
    // Centro de la cara en (100, 72). Normalizado a -1..1
    setLookAt({ x: (p.x - 100) / 70, y: (p.y - 72) / 70 });
    clearTimeout(st.current.clearLook);
    st.current.clearLook = setTimeout(() => setLookAt(null), 1400);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    // Sigue recibiendo el movimiento aunque el dedo salga del dibujo (para mecerla)
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura: igual funciona dentro del dibujo */
    }
    s.downAt = Date.now();
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.lastX = e.clientX;
    s.dir = 0;
    s.flips = 0;
    s.flipStart = Date.now();
    s.moved = false;
    s.fired = false;
    const p = toSvg(e);
    s.onHead = onHead(p.x, p.y);
    s.path = 0;
    s.px = p.x;
    s.py = p.y;
    updateLook(e);
    clearTimeout(s.holdTimer);
    s.holdTimer = setTimeout(() => {
      if (!s.moved && !s.fired) {
        s.fired = true;
        cb.current({ kind: 'hold' });
      }
    }, HOLD_MS);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    updateLook(e);
    const s = st.current;
    if (!s.downAt) return;
    if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 10) {
      s.moved = true;
      clearTimeout(s.holdTimer);
    }
    // Rascar: si arrancó sobre la cabeza, se mide cuánto se frota (en cualquier dirección)
    const p = toSvg(e);
    s.path += Math.hypot(p.x - s.px, p.y - s.py);
    s.px = p.x;
    s.py = p.y;
    if (s.onHead && !s.fired && s.path > RUB_PATH) {
      s.fired = true;
      cb.current({ kind: 'rub' });
      return;
    }
    if (s.onHead) return;
    const dx = e.clientX - s.lastX;
    if (Math.abs(dx) > 4) {
      const d = Math.sign(dx);
      if (s.dir && d !== s.dir) {
        if (Date.now() - s.flipStart > ROCK_WINDOW_MS) {
          s.flips = 0;
          s.flipStart = Date.now();
        }
        s.flips++;
        if (s.flips >= ROCK_FLIPS && !s.fired) {
          s.fired = true;
          cb.current({ kind: 'rock' });
        }
      }
      s.dir = d;
      s.lastX = e.clientX;
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    clearTimeout(s.holdTimer);
    const wasTap = s.downAt && !s.moved && !s.fired && Date.now() - s.downAt < HOLD_MS;
    s.downAt = 0;
    if (!wasTap) return;
    const p = toSvg(e);
    const now = Date.now();
    if (now - s.lastTap.t < DOUBLE_MS && Math.hypot(p.x - s.lastTap.x, p.y - s.lastTap.y) < 40) {
      clearTimeout(s.tapTimer);
      s.lastTap.t = 0;
      cb.current({ kind: 'double', x: p.x, y: p.y });
      return;
    }
    s.lastTap = { t: now, x: p.x, y: p.y };
    clearTimeout(s.tapTimer);
    s.tapTimer = setTimeout(() => cb.current({ kind: 'tap', x: p.x, y: p.y }), DOUBLE_MS);
  };

  const onPointerCancel = () => {
    clearTimeout(st.current.holdTimer);
    st.current.downAt = 0;
  };

  return {
    ref,
    lookAt,
    // Sin onPointerLeave: en Safari, si el dedo sale del dibujo mientras la mecés, cortaba el gesto.
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
