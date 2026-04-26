import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

export const COMMANDS = [
  '/feed', '/pet', '/play', '/sleep',
  '/say', '/move', '/come here', '/go away',
  '/dance', '/sit', '/wake up',
  '/status', '/mood',
  '/remember', '/recall',
  '/settings', '/help', '/clear',
];

const CARE_ACTIONS: Record<string, 'feed' | 'pet' | 'play' | 'sleep'> = {
  '/feed': 'feed',
  '/pet': 'pet',
  '/play': 'play',
  '/sleep': 'sleep',
};

export interface ParsedCommand {
  type: 'care_action' | 'chat_message' | 'command';
  action?: string;
  text?: string;
  verb?: string;
}

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (CARE_ACTIONS[trimmed]) {
    return { type: 'care_action', action: CARE_ACTIONS[trimmed] };
  }

  if (trimmed.startsWith('/say ')) {
    return { type: 'chat_message', text: trimmed.slice(5) };
  }

  if (trimmed.startsWith('/remember ')) {
    return { type: 'command', verb: 'remember', text: trimmed.slice(10) };
  }

  if (trimmed.startsWith('/recall ')) {
    return { type: 'command', verb: 'recall', text: trimmed.slice(8) };
  }

  const COMMAND_VERBS = ['/status', '/mood', '/help', '/settings', '/clear', '/dance', '/sit', '/wake up'];
  if (COMMAND_VERBS.includes(trimmed)) {
    return { type: 'command', verb: trimmed.slice(1) };
  }

  if (trimmed.startsWith('/move')) {
    return { type: 'command', verb: 'move', text: trimmed.slice(6) || undefined };
  }

  if (trimmed.startsWith('/')) {
    return { type: 'command', verb: trimmed.slice(1) };
  }

  return { type: 'chat_message', text: trimmed };
}

export class CommandInputMode implements InteractionMode {
  readonly type = 'command_input' as const;
  readonly displayName = 'Command Input';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private inputBar: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.inputBar = document.createElement('div');
      this.inputBar.className = 'command-input-bar';
      this.inputBar.style.cssText = [
        'position: absolute',
        'display: flex',
        'align-items: center',
        'background: rgba(30, 30, 30, 0.9)',
        'border: 1px solid rgba(100, 100, 255, 0.4)',
        'border-radius: 8px',
        'padding: 4px 8px',
        'width: 280px',
        'pointer-events: auto',
      ].join(';');

      this.inputEl = document.createElement('input');
      this.inputEl.type = 'text';
      this.inputEl.placeholder = 'Type a command or message...';
      this.inputEl.style.cssText = [
        'background: transparent',
        'border: none',
        'color: #eee',
        'font-size: 13px',
        'font-family: monospace',
        'outline: none',
        'width: 100%',
      ].join(';');

      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.inputEl) {
          this.submitText(this.inputEl.value);
          this.inputEl.value = '';
        }
      });

      this.inputBar.appendChild(this.inputEl);
      this.positionInput();
      context.overlayContainer.appendChild(this.inputBar);
    }
  }

  unmount(): void {
    this.inputBar?.remove();
    this.inputBar = null;
    this.inputEl = null;
    this.ctx = null;
  }

  handleOutput(_output: SystemOutput): void {
    // CommandInputMode does not react to system outputs
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: true,
      displaysChoices: false,
      triggersCareActions: true,
      requiresWebview: false,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  submitText(text: string): void {
    if (!this.ctx) return;

    const parsed = parseCommand(text);
    if (!parsed) return;

    switch (parsed.type) {
      case 'care_action':
        this.ctx.dispatch({
          kind: 'care_action',
          action: parsed.action as 'feed' | 'pet' | 'play' | 'sleep',
        });
        break;
      case 'chat_message':
        this.ctx.dispatch({
          kind: 'chat_message',
          text: parsed.text!,
        });
        break;
      case 'command':
        this.ctx.dispatch({
          kind: 'command',
          raw: text,
          parsed: { verb: parsed.verb!, ...(parsed.text ? { noun: parsed.text } : {}) },
        });
        break;
    }
  }

  private positionInput(): void {
    if (!this.inputBar || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.inputBar.style.left = `${pos.x + pos.width / 2 - 140}px`;
    this.inputBar.style.bottom = `${window.innerHeight - pos.y + 8}px`;
  }
}
