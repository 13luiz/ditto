import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

export class DialogPanelMode implements InteractionMode {
  readonly type = 'dialog_panel' as const;
  readonly displayName = 'Dialog Panel';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;

  mount(context: ModeContext): void {
    this.ctx = context;
  }

  unmount(): void {
    this.ctx = null;
  }

  handleOutput(_output: SystemOutput): void {
    // DialogPanel delegates all output handling to Pet Manager
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

  getTargetRoute(): string {
    return '/chat';
  }
}
