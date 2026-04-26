import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
  CareNeed,
} from '../types';

const NEED_ICONS: Record<CareNeed, string> = {
  hunger: '🍖',
  happiness: '😢',
  energy: '💤',
  social: '💬',
};

export class ThoughtBubbleMode implements InteractionMode {
  readonly type = 'thought_bubble' as const;
  readonly displayName = 'Thought Bubble';
  readonly surface = 'dom' as const;
  readonly tier = 'passive' as const;

  private ctx: ModeContext | null = null;
  private el: HTMLDivElement | null = null;
  private criticalNeeds = new Set<CareNeed>();

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.el = document.createElement('div');
      this.el.className = 'thought-bubble';
      this.el.style.cssText = [
        'position: absolute',
        'pointer-events: none',
        'display: flex',
        'gap: 4px',
        'align-items: center',
        'font-size: 24px',
        'padding: 8px 12px',
        'background: rgba(255,255,255,0.9)',
        'border-radius: 20px',
        'box-shadow: 0 2px 8px rgba(0,0,0,0.12)',
        'transition: opacity 0.3s ease',
      ].join(';');
      this.el.style.opacity = '0';
      context.overlayContainer.appendChild(this.el);
      this.updatePosition();
    }
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    this.criticalNeeds.clear();
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    switch (output.kind) {
      case 'care_need_critical':
        this.criticalNeeds.add(output.need);
        this.render();
        break;
      case 'care_state':
        this.updateFromCareState(output);
        break;
    }
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: false,
      acceptsTextInput: false,
      displaysChoices: false,
      triggersCareActions: true,
      requiresWebview: false,
      allowsConcurrent: true,
      supportsMultiAgent: false,
    };
  }

  private updateFromCareState(state: {
    hunger: number; happiness: number; energy: number; social: number;
  }): void {
    const threshold = 20;
    this.criticalNeeds.clear();
    if (state.hunger < threshold) this.criticalNeeds.add('hunger');
    if (state.happiness < threshold) this.criticalNeeds.add('happiness');
    if (state.energy < threshold) this.criticalNeeds.add('energy');
    if (state.social < threshold) this.criticalNeeds.add('social');
    this.render();
  }

  private render(): void {
    if (!this.el) return;

    this.el.innerHTML = '';
    const needs = Array.from(this.criticalNeeds);

    if (needs.length === 0) {
      this.el.style.opacity = '0';
      return;
    }

    for (const need of needs) {
      const icon = document.createElement('span');
      icon.textContent = NEED_ICONS[need];
      icon.style.cssText = 'line-height:1;';
      this.el.appendChild(icon);
    }

    const isCritical = needs.length > 0;
    this.el.classList.toggle('critical', isCritical);
    if (isCritical) {
      this.el.style.border = '2px solid #e74c3c';
    } else {
      this.el.style.border = 'none';
    }

    this.el.style.opacity = '1';
    this.updatePosition();
  }

  private updatePosition(): void {
    if (!this.el || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.el.style.left = `${pos.x + pos.width + 8}px`;
    this.el.style.top = `${pos.y - 16}px`;
  }
}
