import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const CEREMONY_DURATION_MS = 3000;

export class BondIndicatorMode implements InteractionMode {
  readonly type = 'bond_level' as const;
  readonly displayName = 'Bond Indicator';
  readonly surface = 'dom' as const;
  readonly tier = 'passive' as const;

  private ctx: ModeContext | null = null;
  private el: HTMLDivElement | null = null;
  private levelText: HTMLSpanElement | null = null;
  private progressFill: HTMLDivElement | null = null;
  private currentLevel = 1;
  private ceremonyTimer: ReturnType<typeof setTimeout> | null = null;
  private ceremonyEl: HTMLDivElement | null = null;

  mount(context: ModeContext): void {
    this.ctx = context;
    if (!context.overlayContainer) return;

    this.el = document.createElement('div');
    this.el.className = 'bond-indicator';
    this.el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'font-family: system-ui, sans-serif',
      'font-size: 12px',
      'color: #e74c3c',
    ].join(';');

    const heart = document.createElement('span');
    heart.textContent = '❤';
    heart.style.cssText = 'font-size: 14px;';

    this.levelText = document.createElement('span');
    this.levelText.className = 'bond-level-text';
    this.levelText.textContent = 'Lv.1';

    const progressBg = document.createElement('div');
    progressBg.style.cssText = [
      'width: 40px',
      'height: 4px',
      'background: #eee',
      'border-radius: 2px',
      'overflow: hidden',
    ].join(';');

    this.progressFill = document.createElement('div');
    this.progressFill.className = 'bond-progress-fill';
    this.progressFill.style.cssText = [
      'height: 100%',
      'background: #e74c3c',
      'border-radius: 2px',
      'transition: width 0.3s ease',
    ].join(';');
    this.progressFill.style.width = '0%';

    progressBg.appendChild(this.progressFill);

    this.el.appendChild(heart);
    this.el.appendChild(this.levelText);
    this.el.appendChild(progressBg);

    context.overlayContainer.appendChild(this.el);
    this.updatePosition();
  }

  unmount(): void {
    this.clearCeremonyTimer();
    this.ceremonyEl?.remove();
    this.ceremonyEl = null;
    this.el?.remove();
    this.el = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind !== 'bond_level_up') return;
    this.currentLevel = output.newLevel;
    this.updateDisplay();
    this.showCeremony(output.oldLevel, output.newLevel);
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

  setLevel(level: number, points: number, threshold: number): void {
    this.currentLevel = level;
    if (this.levelText) this.levelText.textContent = `Lv.${level}`;
    if (this.progressFill) {
      const pct = Math.min(100, Math.round((points / threshold) * 100));
      this.progressFill.style.width = `${pct}%`;
    }
  }

  private updateDisplay(): void {
    if (this.levelText) this.levelText.textContent = `Lv.${this.currentLevel}`;
    this.updatePosition();
  }

  private updatePosition(): void {
    if (!this.el || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.el.style.left = `${pos.x + pos.width / 2 - 40}px`;
    this.el.style.top = `${pos.y + pos.height + 4}px`;
  }

  private showCeremony(_oldLevel: number, _newLevel: number): void {
    if (!this.el || !this.ctx) return;

    this.clearCeremonyTimer();

    const ceremony = document.createElement('div');
    ceremony.className = 'bond-ceremony';
    ceremony.style.cssText = [
      'position: fixed',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'pointer-events: none',
      'text-align: center',
      'font-family: system-ui, sans-serif',
      'z-index: 9999',
    ].join(';');

    const sparkle = document.createElement('div');
    sparkle.textContent = '✨';
    sparkle.style.cssText = 'font-size: 48px; animation: pulse 0.5s ease infinite alternate;';

    const text = document.createElement('div');
    text.textContent = 'BOND UP!';
    text.style.cssText = [
      'font-size: 24px',
      'font-weight: bold',
      'color: #e74c3c',
      'margin-top: 8px',
    ].join(';');

    const level = document.createElement('div');
    level.textContent = `Lv.${this.currentLevel}`;
    level.style.cssText = [
      'font-size: 18px',
      'color: #333',
      'margin-top: 4px',
    ].join(';');

    ceremony.appendChild(sparkle);
    ceremony.appendChild(text);
    ceremony.appendChild(level);
    this.ctx.overlayContainer!.appendChild(ceremony);
    this.ceremonyEl = ceremony;

    this.ceremonyTimer = setTimeout(() => {
      ceremony.remove();
      this.ceremonyEl = null;
    }, CEREMONY_DURATION_MS);
  }

  private clearCeremonyTimer(): void {
    if (this.ceremonyTimer) {
      clearTimeout(this.ceremonyTimer);
      this.ceremonyTimer = null;
    }
  }
}
