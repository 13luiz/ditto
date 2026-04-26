import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const FLIP_THRESHOLD = 100;

export class SpeechBubbleMode implements InteractionMode {
  readonly type = 'speech_bubble' as const;
  readonly displayName = 'Speech Bubble';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private el: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;
  private chipsEl: HTMLDivElement | null = null;
  private quickReplies: string[] = [];

  mount(context: ModeContext): void {
    this.ctx = context;
    if (!context.overlayContainer) return;

    this.el = document.createElement('div');
    this.el.className = 'speech-bubble';
    this.el.style.cssText = [
      'position: absolute',
      'pointer-events: auto',
      'max-width: 260px',
      'background: white',
      'border-radius: 16px',
      'padding: 12px 16px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
      'font-family: system-ui, sans-serif',
      'font-size: 14px',
      'color: #333',
      'display: none',
    ].join(';');

    this.textEl = document.createElement('div');
    this.textEl.className = 'speech-bubble-text';
    this.textEl.style.cssText = 'line-height: 1.4; margin-bottom: 8px;';
    this.el.appendChild(this.textEl);

    this.chipsEl = document.createElement('div');
    this.chipsEl.className = 'speech-chips';
    this.chipsEl.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
    this.el.appendChild(this.chipsEl);

    context.overlayContainer.appendChild(this.el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    this.textEl = null;
    this.chipsEl = null;
    this.ctx = null;
    this.quickReplies = [];
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind !== 'agent_text') return;
    if (!this.el || !this.textEl) return;

    if (output.streaming) {
      this.textEl.textContent += output.text;
    } else {
      this.textEl.textContent = output.text;
    }

    this.renderChips();
    this.el.style.display = 'block';
    this.updatePosition();
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: false,
      displaysChoices: true,
      triggersCareActions: false,
      requiresWebview: false,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  setQuickReplies(replies: string[]): void {
    this.quickReplies = replies;
  }

  private renderChips(): void {
    if (!this.chipsEl || !this.ctx) return;
    this.chipsEl.innerHTML = '';

    for (const reply of this.quickReplies) {
      const chip = document.createElement('button');
      chip.className = 'speech-chip';
      chip.textContent = reply;
      chip.style.cssText = [
        'padding: 4px 12px',
        'border-radius: 12px',
        'border: 1px solid #ddd',
        'background: #f8f8f8',
        'cursor: pointer',
        'font-size: 13px',
        'color: #555',
      ].join(';');
      chip.addEventListener('click', () => {
        this.ctx!.dispatch({ kind: 'chat_message', text: reply });
      });
      this.chipsEl.appendChild(chip);
    }
  }

  private updatePosition(): void {
    if (!this.el || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    const centerX = pos.x + pos.width / 2;

    if (pos.y < FLIP_THRESHOLD) {
      this.el.style.left = `${centerX}px`;
      this.el.style.top = `${pos.y + pos.height + 12}px`;
      this.el.style.transform = 'translateX(-50%)';
    } else {
      this.el.style.left = `${centerX}px`;
      this.el.style.top = `${pos.y - this.el.offsetHeight - 12}px`;
      this.el.style.transform = 'translateX(-50%)';
    }
  }
}
