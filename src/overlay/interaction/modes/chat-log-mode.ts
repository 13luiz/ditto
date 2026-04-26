import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

export type LogEntryType = 'chat' | 'system' | 'memory';
export type LogTab = 'chat' | 'system' | 'memory' | 'all';

export interface LogEntry {
  type: LogEntryType;
  content: string;
  timestamp: string;
  icon?: string;
}

const MAX_ENTRIES = 200;

export class ChatLogMode implements InteractionMode {
  readonly type = 'chat_log' as const;
  readonly displayName = 'Chat Log';
  readonly surface = 'dom' as const;
  readonly tier = 'review' as const;

  private ctx: ModeContext | null = null;
  private container: HTMLDivElement | null = null;
  private entries: LogEntry[] = [];

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.container = document.createElement('div');
      this.container.className = 'chat-log-container';
      this.container.style.display = 'none'; // Hidden by default, shown in Pet Manager
      context.overlayContainer.appendChild(this.container);
    }
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    const entry = this.toEntry(output);
    if (!entry) return;

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: false,
      requiresWebview: true,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByTab(tab: LogTab): LogEntry[] {
    if (tab === 'all') return [...this.entries];
    return this.entries.filter(e => e.type === tab);
  }

  clearEntries(): void {
    this.entries = [];
  }

  private toEntry(output: SystemOutput): LogEntry | null {
    const timestamp = new Date().toISOString();

    switch (output.kind) {
      case 'agent_text':
        return { type: 'chat', content: output.text, timestamp, icon: '💬' };
      case 'fsm_transition':
        return {
          type: 'system',
          content: `State: ${output.from} → ${output.to}`,
          timestamp,
          icon: '⚙️',
        };
      case 'bond_level_up':
        return {
          type: 'system',
          content: `Bond Lv.${output.oldLevel} → Lv.${output.newLevel}`,
          timestamp,
          icon: '💛',
        };
      case 'agent_tool_call':
        if (output.tool === 'remember' || output.tool === 'recall') {
          return {
            type: 'memory',
            content: `${output.tool}: ${JSON.stringify(output.params)}`,
            timestamp,
            icon: '🧠',
          };
        }
        return null;
      default:
        return null;
    }
  }
}
