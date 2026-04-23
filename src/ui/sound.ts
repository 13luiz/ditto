type SoundId = 'happy' | 'sad' | 'hungry' | 'pet' | 'feed' | 'sleep' | 'chat' | 'greeting';

const ctx: AudioContext | null = null;
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playHappy(): void {
  const ctx = getCtx();
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.15, 'sine', 0.12), i * 100);
  });
}

function playSad(): void {
  playTone(330, 0.4, 'sine', 0.1);
  setTimeout(() => playTone(294, 0.5, 'sine', 0.08), 300);
}

function playHungry(): void {
  playTone(220, 0.15, 'square', 0.06);
  setTimeout(() => playTone(196, 0.2, 'square', 0.05), 150);
}

function playPet(): void {
  playTone(880, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(1047, 0.12, 'sine', 0.08), 80);
}

function playFeed(): void {
  playTone(440, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(554, 0.08, 'sine', 0.1), 70);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.08), 140);
}

function playSleep(): void {
  playTone(262, 0.3, 'sine', 0.08);
  setTimeout(() => playTone(196, 0.5, 'sine', 0.06), 300);
}

function playChat(): void {
  playTone(698, 0.06, 'triangle', 0.1);
  setTimeout(() => playTone(784, 0.08, 'triangle', 0.08), 60);
}

function playGreeting(): void {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.12, 'sine', 0.1), i * 120);
  });
}

export function playSound(id: SoundId): void {
  try {
    switch (id) {
      case 'happy': playHappy(); break;
      case 'sad': playSad(); break;
      case 'hungry': playHungry(); break;
      case 'pet': playPet(); break;
      case 'feed': playFeed(); break;
      case 'sleep': playSleep(); break;
      case 'chat': playChat(); break;
      case 'greeting': playGreeting(); break;
    }
  } catch {
    // Audio not available (e.g. no user gesture yet)
  }
}
