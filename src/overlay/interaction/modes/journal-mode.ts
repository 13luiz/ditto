import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const BOND_GATE_LEVEL = 7;

export interface JournalEntryData {
  date: string;
  content: string;
  mood: string;
  milestone?: string;
}

export class JournalMode implements InteractionMode {
  readonly type = 'journal' as const;
  readonly displayName = 'Journal';
  readonly surface = 'dom' as const;
  readonly tier = 'review' as const;

  private ctx: ModeContext | null = null;
  private indicator: HTMLDivElement | null = null;
  private entries: JournalEntryData[] = [];

  mount(context: ModeContext): void {
    this.ctx = context;
    const bondLevel = (context.config?.bondLevel as number) ?? 0;

    if (context.overlayContainer) {
      this.indicator = document.createElement('div');
      this.indicator.className = 'journal-indicator';

      if (bondLevel >= BOND_GATE_LEVEL) {
        this.indicator.textContent = '📓 Journal';
        this.indicator.style.cssText = [
          'position: absolute',
          'pointer-events: auto',
          'cursor: pointer',
          'font-size: 13px',
          'background: rgba(200, 220, 255, 0.85)',
          'color: #2a4a7f',
          'padding: 4px 10px',
          'border-radius: 6px',
        ].join(';');
      } else {
        this.indicator.textContent = `Reach Bond Lv.${BOND_GATE_LEVEL} to unlock Journal`;
        this.indicator.style.cssText = [
          'position: absolute',
          'pointer-events: none',
          'font-size: 12px',
          'color: rgba(150, 150, 150, 0.8)',
          'background: rgba(80, 80, 80, 0.1)',
          'padding: 4px 8px',
          'border-radius: 6px',
        ].join(';');
      }

      const pos = context.getPetPosition();
      this.indicator.style.left = `${pos.x + pos.width + 10}px`;
      this.indicator.style.bottom = `${window.innerHeight - pos.y + 20}px`;

      context.overlayContainer.appendChild(this.indicator);
    }
  }

  unmount(): void {
    this.indicator?.remove();
    this.indicator = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind === 'journal_entry_generated') {
      this.addEntry(output.date, output.content, 'neutral');
      this.showEntryNotification(output.content);
    }
  }

  private showEntryNotification(content: string): void {
    if (!this.ctx?.overlayContainer) return;

    const el = document.createElement('div');
    el.className = 'journal-notification';
    const preview = content.length > 80 ? content.slice(0, 80) + '...' : content;
    el.textContent = `📓 ${preview}`;
    el.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'font-size: 12px',
      'color: rgba(200, 220, 255, 0.9)',
      'background: rgba(42, 74, 127, 0.7)',
      'padding: 6px 12px',
      'border-radius: 8px',
      'max-width: 220px',
      'transition: opacity 1s ease',
    ].join(';');

    const pos = this.ctx.getPetPosition();
    el.style.left = `${pos.x + pos.width / 2}px`;
    el.style.transform = 'translateX(-50%)';
    el.style.bottom = `${window.innerHeight - pos.y + 30}px`;

    this.ctx.overlayContainer.appendChild(el);

    setTimeout(() => { el.style.opacity = '0'; }, 3000);
    setTimeout(() => el.remove(), 4000);
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

  getEntryCount(): number {
    return this.entries.length;
  }

  getEntries(): JournalEntryData[] {
    return [...this.entries];
  }

  getEntriesByRange(start: string, end: string): JournalEntryData[] {
    return this.entries.filter(e => e.date >= start && e.date <= end);
  }

  addEntry(date: string, content: string, mood: string, milestone?: string): void {
    const bondLevel = (this.ctx?.config?.bondLevel as number) ?? 0;
    if (bondLevel < BOND_GATE_LEVEL) return;

    this.entries.push({ date, content, mood, milestone });
  }

  clearEntries(): void {
    this.entries = [];
  }
}
