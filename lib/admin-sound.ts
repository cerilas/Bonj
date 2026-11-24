let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

export function getCashierAudioState(): "running" | "suspended" | "unavailable" {
  const ctx = getAudioContext();
  if (!ctx) return "unavailable";
  return ctx.state === "running" ? "running" : "suspended";
}

export async function unlockCashierAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

function playBellTone(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  startAt: number,
  duration: number,
  peakGain: number,
) {
  const oscMain = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const gainMain = ctx.createGain();
  const gainHarmonic = ctx.createGain();

  oscMain.type = "sine";
  oscMain.frequency.setValueAtTime(freq, startAt);

  // Soft 2x harmonic gives a clear brass/chime body audible across a cafe counter
  oscHarmonic.type = "triangle";
  oscHarmonic.frequency.setValueAtTime(freq * 2, startAt);

  gainMain.gain.setValueAtTime(0.0001, startAt);
  gainMain.gain.linearRampToValueAtTime(peakGain, startAt + 0.014);
  gainMain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  gainHarmonic.gain.setValueAtTime(0.0001, startAt);
  gainHarmonic.gain.linearRampToValueAtTime(peakGain * 0.28, startAt + 0.012);
  gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.55);

  oscMain.connect(gainMain);
  oscHarmonic.connect(gainHarmonic);
  gainMain.connect(destination);
  gainHarmonic.connect(destination);

  oscMain.start(startAt);
  oscHarmonic.start(startAt);
  oscMain.stop(startAt + duration + 0.04);
  oscHarmonic.stop(startAt + duration * 0.6 + 0.04);
}

export async function playCashierAlertSound(variant: "order" | "table" = "order"): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== "running") return false;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200, ctx.currentTime);
  filter.connect(ctx.destination);

  const now = ctx.currentTime + 0.02;

  if (variant === "order") {
    // Rich cafe bell chime (G5 -> B5 -> D6, repeated clearly)
    playBellTone(ctx, filter, 783.99, now, 0.72, 0.34);
    playBellTone(ctx, filter, 987.77, now + 0.13, 0.78, 0.34);
    playBellTone(ctx, filter, 1174.66, now + 0.26, 0.92, 0.38);
    playBellTone(ctx, filter, 783.99, now + 0.78, 0.72, 0.32);
    playBellTone(ctx, filter, 987.77, now + 0.91, 0.78, 0.34);
    playBellTone(ctx, filter, 1174.66, now + 1.04, 1.05, 0.38);
  } else {
    // Crisp 2-note service chime (E5 -> B5) for waiter/busser table activity
    playBellTone(ctx, filter, 659.25, now, 0.65, 0.26);
    playBellTone(ctx, filter, 987.77, now + 0.14, 0.85, 0.3);
  }
  return true;
}
