// Tiny synthesized sound effects (Web Audio), so no audio files are needed.
// The mute choice is remembered in localStorage.

const KEY = 'algebra3d.muted';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, vol = 0.18) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** A bright two-note "ding"; the pitch climbs with the answer streak. */
export function playCorrect(combo = 0) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const base = 660 * 2 ** (Math.min(combo, 7) / 12); // up a semitone per answer in a row
  tone(c, base, t, 0.16);
  tone(c, base * 1.5, t + 0.09, 0.28);
}
