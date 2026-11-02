/**
 * Soniditos de Cachete, generados con Web Audio (sin archivos).
 * El contexto se crea recién con el primer toque (requisito del iPhone).
 */
export type SoundKind = 'risita' | 'mimo' | 'choca' | 'boing' | 'abrazo' | 'baile' | 'bostezo' | 'carta' | 'agua' | 'mareo' | 'hola';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Una nota con envolvente suave. */
function tone(c: AudioContext, at: number, freq: number, dur: number, opts: { type?: OscillatorType; to?: number; vol?: number } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  const v = opts.vol ?? 0.12;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, at: number, dur: number, vol = 0.1) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

export function play(kind: SoundKind) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  switch (kind) {
    case 'risita':
      [0, 0.09, 0.18, 0.27].forEach((d, i) => tone(c, t + d, 720 + i * 90, 0.08, { type: 'triangle', to: 900 + i * 110, vol: 0.09 }));
      break;
    case 'mimo':
      tone(c, t, 523, 0.25, { vol: 0.1 });
      tone(c, t + 0.16, 784, 0.35, { vol: 0.09 });
      break;
    case 'choca':
      noise(c, t, 0.12, 0.25);
      tone(c, t + 0.04, 1046, 0.18, { type: 'triangle', vol: 0.07 });
      break;
    case 'boing':
      tone(c, t, 260, 0.35, { type: 'sine', to: 620, vol: 0.12 });
      tone(c, t + 0.3, 620, 0.25, { type: 'sine', to: 300, vol: 0.08 });
      break;
    case 'abrazo':
      [392, 494, 587].forEach((f) => tone(c, t, f, 0.9, { vol: 0.06 }));
      break;
    case 'baile':
      [523, 659, 784, 659, 880, 784].forEach((f, i) => tone(c, t + i * 0.14, f, 0.13, { type: 'square', vol: 0.04 }));
      break;
    case 'bostezo':
      tone(c, t, 480, 1.1, { type: 'sine', to: 180, vol: 0.08 });
      break;
    case 'carta':
      [659, 784, 988, 1318].forEach((f, i) => tone(c, t + i * 0.09, f, 0.3, { type: 'triangle', vol: 0.06 }));
      break;
    case 'agua':
      tone(c, t, 1400, 0.12, { to: 500, vol: 0.1 });
      break;
    case 'mareo':
      tone(c, t, 300, 0.6, { type: 'triangle', to: 900, vol: 0.06 });
      tone(c, t + 0.3, 900, 0.6, { type: 'triangle', to: 300, vol: 0.06 });
      break;
    case 'hola':
      tone(c, t, 659, 0.12, { type: 'triangle', vol: 0.08 });
      tone(c, t + 0.12, 880, 0.18, { type: 'triangle', vol: 0.08 });
      break;
  }
}
