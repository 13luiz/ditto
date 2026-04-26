import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const MAX_QUEUE = 3;
const HOLD_MS = 2500;
const FADE_MS = 500;

interface QueuedBark {
  text: string;
  timer: ReturnType<typeof setTimeout>;
  el: HTMLDivElement;
}

export class BarkMode implements InteractionMode {
  readonly type = 'bark' as const;
  readonly displayName = 'Bark';
  readonly surface = 'dom' as const;
  readonly tier = 'passive' as const;

  private ctx: ModeContext | null = null;
  private wrapper: HTMLDivElement | null = null;
  private queue: QueuedBark[] = [];

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'bark-container';
      this.wrapper.style.position = 'absolute';
      this.wrapper.style.pointerEvents = 'none';
      this.wrapper.style.display = 'flex';
      this.wrapper.style.flexDirection = 'column';
      this.wrapper.style.alignItems = 'center';
      this.wrapper.style.gap = '4px';
      this.wrapper.style.transition = 'none';
      context.overlayContainer.appendChild(this.wrapper);
      this.updatePosition();
    }
  }

  unmount(): void {
    for (const bark of this.queue) clearTimeout(bark.timer);
    this.queue = [];
    this.wrapper?.remove();
    this.wrapper = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    const text = this.extractText(output);
    if (text === null) return;

    if (this.queue.length >= MAX_QUEUE) {
      const oldest = this.queue.shift()!;
      clearTimeout(oldest.timer);
      oldest.el.remove();
    }

    this.showBark(text);
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

  queueLength(): number {
    return this.queue.length;
  }

  private extractText(output: SystemOutput): string | null {
    switch (output.kind) {
      case 'agent_text':
        return output.text;
      case 'care_need_critical':
        return this.criticalMessage(output.need, output.value);
      default:
        return null;
    }
  }

  private criticalMessage(need: string, value: number): string {
    const labels: Record<string, string> = {
      hunger: 'I\'m hungry...',
      happiness: 'I\'m feeling down...',
      energy: 'I\'m so tired...',
      social: 'I\'m lonely...',
    };
    return labels[need] ?? `My ${need} is low (${value})!`;
  }

  private showBark(text: string): void {
    if (!this.wrapper || !this.ctx) return;

    const el = document.createElement('div');
    el.className = 'bark-item';
    el.textContent = text;
    el.style.cssText = [
      'background: rgba(255,255,255,0.95)',
      'color: #333',
      'padding: 6px 12px',
      'border-radius: 12px',
      'font-size: 13px',
      'font-family: system-ui, sans-serif',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
      'max-width: 200px',
      'word-wrap: break-word',
      'transition: opacity 0.5s ease',
      'pointer-events: none',
    ].join(';');

    this.wrapper.appendChild(el);

    const bark: QueuedBark = { text, timer: 0 as unknown as ReturnType<typeof setTimeout>, el };
    bark.timer = setTimeout(() => this.fadeOut(bark), HOLD_MS);
    this.queue.push(bark);

    this.updatePosition();
  }

  private fadeOut(bark: QueuedBark): void {
    bark.el.style.opacity = '0';
    setTimeout(() => {
      bark.el.remove();
      const idx = this.queue.indexOf(bark);
      if (idx !== -1) this.queue.splice(idx, 1);
      this.updatePosition();
    }, FADE_MS);
  }

  private updatePosition(): void {
    if (!this.wrapper || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.wrapper.style.left = `${pos.x + pos.width / 2}px`;
    this.wrapper.style.transform = 'translateX(-50%)';
    this.wrapper.style.bottom = `${window.innerHeight - pos.y + 8}px`;
  }
}
