import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sacudir el celu → Cachete se marea.
 * - Android y la mayoría de los navegadores: el movimiento llega sin pedir nada.
 * - iPhone (iOS 13+): hay que pedir permiso con un toque del usuario (DeviceMotionEvent.requestPermission).
 *   Una vez aceptado, se vuelve a confirmar en silencio en el primer toque de cada sesión.
 */
type MotionWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export type ShakeStatus = 'no-disponible' | 'pedir' | 'activo' | 'denegado';

const KEY = 'cn_motion';
const lsGet = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const lsSet = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* sin localStorage */
  }
};

/** Golpes fuertes seguidos (≈ 3 en menos de un segundo) cuentan como sacudida. */
const PEAK = 14; // m/s² de cambio entre lecturas
const PEAKS = 3;
const WINDOW_MS = 900;
const COOLDOWN_MS = 4000;

export function useShake(onShake: () => void) {
  const motion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window ? (window.DeviceMotionEvent as MotionWithPermission) : null;
  const needsPermission = !!motion?.requestPermission;
  const [status, setStatus] = useState<ShakeStatus>(() =>
    !motion ? 'no-disponible' : !needsPermission ? 'activo' : lsGet() === 'granted' ? 'pedir' : lsGet() === 'denied' ? 'denegado' : 'pedir',
  );
  const cb = useRef(onShake);
  cb.current = onShake;
  const st = useRef({ last: null as { x: number; y: number; z: number } | null, peaks: [] as number[], cooldownUntil: 0 });

  useEffect(() => {
    if (status !== 'activo') return;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const s = st.current;
      const now = Date.now();
      const cur = { x: a.x, y: a.y, z: a.z };
      if (s.last) {
        const delta = Math.abs(cur.x - s.last.x) + Math.abs(cur.y - s.last.y) + Math.abs(cur.z - s.last.z);
        if (delta > PEAK && now > s.cooldownUntil) {
          s.peaks = [...s.peaks.filter((t) => now - t < WINDOW_MS), now];
          if (s.peaks.length >= PEAKS) {
            s.peaks = [];
            s.cooldownUntil = now + COOLDOWN_MS;
            if (document.visibilityState === 'visible') cb.current();
          }
        }
      }
      s.last = cur;
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [status]);

  /** Pide (o confirma) el permiso. Tiene que llamarse desde un toque del usuario. */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!motion) return false;
    if (!motion.requestPermission) {
      setStatus('activo');
      return true;
    }
    try {
      const r = await motion.requestPermission();
      lsSet(r);
      setStatus(r === 'granted' ? 'activo' : 'denegado');
      return r === 'granted';
    } catch {
      // Fuera de un toque iOS rechaza el pedido: queda para el próximo
      return false;
    }
  }, [motion]);

  /** En iPhone, si ya lo había aceptado antes, se reactiva en silencio con el primer toque de la sesión. */
  const resumeOnTouch = useCallback(() => {
    if (status === 'pedir' && lsGet() === 'granted') void enable();
  }, [status, enable]);

  return { status, enable, resumeOnTouch };
}
