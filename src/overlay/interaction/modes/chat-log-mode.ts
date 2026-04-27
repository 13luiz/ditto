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
const VISIBLE_COUNT = 3;
const VISIBLE_DURATION_MS = 4000;

export class ChatLogMode implements InteractionMode {
  readonly type = 'chat_log' as const;
  readonly displayName = 'Chat Log';
  readonly surface = 'dom' as const;
  readonly tier = 'review' as const;

  private ctx: ModeContext | null = null;
  private container: HTMLDivElement | null = null;
  private entries: LogEntry[] = [];
  private visibleEls: HTMLDivElement[] = [];
  private fadeTimers: ReturnType<typeof setTimeout>[] = [];

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.container = document.createElement('div');
      this.container.className = 'chat-log-container';
      this.container.style.cssText = [
        'position: absolute',
        'display: flex',
        'flex-direction: column',
        'gap: 4px',
        'pointer-events: none',
        'z-index: 100',
        'max-width: 240px',
      ].join(';');
      context.overlayContainer.appendChild(this.container);
      this.updatePosition();
    }
  }

  unmount(): void {
    for (const t of this.fadeTimers) clearTimeout(t);
    this.fadeTimers = [];
    this.visibleEls = [];
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
    this.renderRecentEntries();
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

  getVisibleCount(): number {
    return this.visibleEls.length;
  }

  private renderRecentEntries(): void {
    if (!this.container) return;

    // Remove oldest visible elements beyond VISIBLE_COUNT
    while (this.visibleEls.length >= VISIBLE_COUNT) {
      const oldest = this.visibleEls.shift();
      oldest?.remove();
      if (this.fadeTimers.length > 0) {
        clearTimeout(this.fadeTimers.shift());
      }
    }

    // Add the new entry as a visible element
    const entry = this.entries[this.entries.length - 1];
    const el = document.createElement('div');
    el.style.cssText = [
      'background: rgba(30,30,40,0.85)',
      'color: #eee',
      'padding: 4px 8px',
      'border-radius: 6px',
      'font-size: 12px',
      'max-width: 240px',
      'overflow: hidden',
      'text-overflow: ellipsis',
      'white-space: nowrap',
      'transition: opacity 0.5s ease',
    ].join(';');
    el.textContent = `${entry.icon || ''} ${entry.content}`.trim();

    this.container.appendChild(el);
    this.visibleEls.push(el);
    this.updatePosition();

    // Auto-fade after duration
    const timer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => {
        el.remove();
        const idx = this.visibleEls.indexOf(el);
        if (idx >= 0) this.visibleEls.splice(idx, 1);
      }, 500);
    }, VISIBLE_DURATION_MS);
    this.fadeTimers.push(timer);
  }

  private updatePosition(): void {
    if (!this.container || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.container.style.left = `${pos.x + pos.width + 8}px`;
    this.container.style.bottom = `${window.innerHeight - pos.y}px`;
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
