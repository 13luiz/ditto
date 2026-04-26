import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const DISPLAY_MS = 4000;
const FADE_MS = 1000;
const MAX_DAILY_USES = 3;
const BOND_GATE_LEVEL = 5;

export class DreamNailMode implements InteractionMode {
  readonly type = 'dream_nail' as const;
  readonly displayName = 'Dream Nail';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private overlay: HTMLDivElement | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private removeTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyUses = 0;

  mount(context: ModeContext): void {
    this.ctx = context;
    this.dailyUses = 0;
  }

  unmount(): void {
    this.clearTimers();
    this.overlay?.remove();
    this.overlay = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind !== 'agent_inner_thought') return;
    if (!this.ctx) return;

    const bondLevel = (this.ctx.config?.bondLevel as number) ?? 0;

    if (bondLevel < BOND_GATE_LEVEL) {
      this.showLocked();
      return;
    }

    if (this.dailyUses >= MAX_DAILY_USES) {
      return;
    }

    this.dailyUses++;
    this.showThought(output.text);
    this.ctx.dispatch({ kind: 'dream_nail_activate' });
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: false,
      requiresWebview: false,
      allowsConcurrent: true,
      supportsMultiAgent: false,
    };
  }

  getDailyUseCount(): number {
    return this.dailyUses;
  }

  private showThought(text: string): void {
    if (!this.ctx?.overlayContainer) return;

    this.clearTimers();
    this.overlay?.remove();

    const el = document.createElement('div');
    el.className = 'dream-nail-overlay';
    el.textContent = text;
    el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'font-style: italic',
      'font-size: 13px',
      'font-family: Georgia, serif',
      'color: rgba(180, 140, 255, 0.9)',
      'background: rgba(60, 20, 120, 0.15)',
      'padding: 8px 14px',
      'border-radius: 12px',
      'max-width: 220px',
      'word-wrap: break-word',
      'text-align: center',
      `opacity: 0.85`,
      'transition: opacity 1s ease',
    ].join(';');

    this.positionAbove(el);
    this.ctx.overlayContainer.appendChild(el);
    this.overlay = el;

    this.fadeTimer = setTimeout(() => {
      el.style.opacity = '0';
    }, DISPLAY_MS);

    this.removeTimer = setTimeout(() => {
      el.remove();
      if (this.overlay === el) this.overlay = null;
    }, DISPLAY_MS + FADE_MS);
  }

  private showLocked(): void {
    if (!this.ctx?.overlayContainer) return;

    this.overlay?.remove();

    const el = document.createElement('div');
    el.className = 'dream-nail-overlay';
    el.textContent = `Reach Bond Lv.${BOND_GATE_LEVEL} to unlock Dream Nail`;
    el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'font-size: 12px',
      'font-family: system-ui, sans-serif',
      'color: rgba(150, 150, 150, 0.8)',
      'background: rgba(80, 80, 80, 0.1)',
      'padding: 6px 10px',
      'border-radius: 8px',
      'opacity: 0.7',
    ].join(';');

    this.positionAbove(el);
    this.ctx.overlayContainer.appendChild(el);
    this.overlay = el;

    this.removeTimer = setTimeout(() => {
      el.remove();
      if (this.overlay === el) this.overlay = null;
    }, 2500);
  }

  private positionAbove(el: HTMLDivElement): void {
    if (!this.ctx) return;
    const pos = this.ctx.getPetPosition();
    el.style.left = `${pos.x + pos.width / 2}px`;
    el.style.transform = 'translateX(-50%)';
    el.style.bottom = `${window.innerHeight - pos.y + 8}px`;
  }

  private clearTimers(): void {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.removeTimer) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
  }
}
