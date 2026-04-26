import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const BOND_GATE_LEVEL = 6;

export class LetterMode implements InteractionMode {
  readonly type = 'letter' as const;
  readonly displayName = 'Letter';
  readonly surface = 'dom' as const;
  readonly tier = 'review' as const;

  private ctx: ModeContext | null = null;
  private envelopeEl: HTMLDivElement | null = null;
  private pendingLetters: Set<string> = new Set();

  mount(context: ModeContext): void {
    this.ctx = context;
  }

  unmount(): void {
    this.envelopeEl?.remove();
    this.envelopeEl = null;
    this.pendingLetters.clear();
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind !== 'letter_received') return;
    if (!this.ctx) return;

    const bondLevel = (this.ctx.config?.bondLevel as number) ?? 0;

    if (bondLevel < BOND_GATE_LEVEL) {
      this.showLocked();
      return;
    }

    this.pendingLetters.add(output.letterId);
    this.showEnvelope();
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: true,
      displaysChoices: false,
      triggersCareActions: false,
      requiresWebview: true,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  getPendingCount(): number {
    return this.pendingLetters.size;
  }

  sendReply(letterId: string, content: string): void {
    if (!this.ctx) return;
    this.ctx.dispatch({
      kind: 'letter_send',
      content,
    });
  }

  markRead(letterId: string): void {
    this.pendingLetters.delete(letterId);
    if (this.pendingLetters.size === 0) {
      this.envelopeEl?.remove();
      this.envelopeEl = null;
    }
  }

  private showEnvelope(): void {
    if (!this.ctx?.overlayContainer) return;
    this.envelopeEl?.remove();

    const el = document.createElement('div');
    el.className = 'letter-envelope';
    el.textContent = `✉ ${this.pendingLetters.size} letter${this.pendingLetters.size > 1 ? 's' : ''}`;
    el.style.cssText = [
      'position: absolute',
      'pointer-events: auto',
      'cursor: pointer',
      'font-size: 14px',
      'background: rgba(255, 245, 200, 0.9)',
      'color: #5a3e1b',
      'padding: 6px 12px',
      'border-radius: 8px',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
    ].join(';');

    const pos = this.ctx.getPetPosition();
    el.style.left = `${pos.x + pos.width + 10}px`;
    el.style.bottom = `${window.innerHeight - pos.y}px`;

    this.ctx.overlayContainer.appendChild(el);
    this.envelopeEl = el;
  }

  private showLocked(): void {
    if (!this.ctx?.overlayContainer) return;
    this.envelopeEl?.remove();

    const el = document.createElement('div');
    el.className = 'letter-envelope';
    el.textContent = `Reach Bond Lv.${BOND_GATE_LEVEL} to unlock Letters`;
    el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'font-size: 12px',
      'color: rgba(150, 150, 150, 0.8)',
      'background: rgba(80, 80, 80, 0.1)',
      'padding: 6px 10px',
      'border-radius: 8px',
    ].join(';');

    const pos = this.ctx.getPetPosition();
    el.style.left = `${pos.x + pos.width + 10}px`;
    el.style.bottom = `${window.innerHeight - pos.y}px`;

    this.ctx.overlayContainer.appendChild(el);
    this.envelopeEl = el;
  }
}
