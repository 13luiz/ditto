import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const EMOTE_SLOTS = [
  { emote: 'wave', label: '👋 Wave', angle: 0 },
  { emote: 'cheer', label: '🎉 Cheer', angle: 90 },
  { emote: 'scold', label: '😠 Scold', angle: 180 },
  { emote: 'dance', label: '💃 Dance', angle: 270 },
] as const;

const EMOTE_STATE_MAP: Record<string, string> = {
  wave: 'happy',
  cheer: 'happy',
  scold: 'sad',
  dance: 'play',
};

const EMOTE_BARK_MAP: Record<string, string> = {
  wave: '*waves happily*',
  cheer: 'Yay!',
  scold: '...',
  dance: '~dance dance~',
};

export class EmoteWheelMode implements InteractionMode {
  readonly type = 'emote_wheel' as const;
  readonly displayName = 'Emote Wheel';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private el: HTMLDivElement | null = null;

  mount(context: ModeContext): void {
    this.ctx = context;
    if (!context.overlayContainer) return;

    this.el = document.createElement('div');
    this.el.className = 'emote-wheel';
    this.el.style.cssText = [
      'position: absolute',
      'display: none',
      'pointer-events: auto',
      'width: 160px',
      'height: 160px',
    ].join(';');

    const grid = document.createElement('div');
    grid.style.cssText = [
      'display: grid',
      'grid-template-columns: 1fr 1fr',
      'grid-template-rows: 1fr 1fr',
      'width: 100%',
      'height: 100%',
      'background: rgba(255,255,255,0.95)',
      'border-radius: 16px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
      'overflow: hidden',
    ].join(';');

    for (const slot of EMOTE_SLOTS) {
      const btn = document.createElement('div');
      btn.className = 'emote-slot';
      btn.setAttribute('data-emote', slot.emote);
      btn.textContent = slot.label;
      btn.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'cursor: pointer',
        'font-size: 14px',
        'padding: 8px',
        'border-bottom: 1px solid #eee',
        'border-right: 1px solid #eee',
        'transition: background 0.15s ease',
        'user-select: none',
      ].join(';');

      btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f0ff'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = ''; });
      btn.addEventListener('click', () => this.selectEmote(slot.emote));

      grid.appendChild(btn);
    }

    this.el.appendChild(grid);
    context.overlayContainer.appendChild(this.el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind === 'gesture' && output.type === 'emote_key') {
      this.open();
    }
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: false,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: true,
      requiresWebview: false,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  emoteToState(emote: string): string {
    return EMOTE_STATE_MAP[emote] ?? 'idle';
  }

  emoteToBark(emote: string): string {
    return EMOTE_BARK_MAP[emote] ?? '';
  }

  private open(): void {
    if (!this.el || !this.ctx) return;
    this.el.style.display = 'block';
    const pos = this.ctx.getPetPosition();
    this.el.style.left = `${pos.x + pos.width / 2 - 80}px`;
    this.el.style.top = `${pos.y + pos.height / 2 - 80}px`;
  }

  private close(): void {
    if (this.el) this.el.style.display = 'none';
  }

  private selectEmote(emote: string): void {
    if (!this.ctx) return;
    this.ctx.dispatch({ kind: 'emote', emote });
    this.close();
  }
}
