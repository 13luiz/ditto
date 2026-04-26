import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

export interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ZoneName = 'head' | 'body' | 'belly' | 'tail' | 'limbs';

type ZoneMap = Record<ZoneName, ZoneRect>;

const HOVER_DELAY_MS = 500;

export class TouchZoneMode implements InteractionMode {
  readonly type = 'touch_zone' as const;
  readonly displayName = 'Touch Zone';
  readonly surface = 'dom' as const;
  readonly tier = 'passive' as const;

  private ctx: ModeContext | null = null;
  private overlay: HTMLDivElement | null = null;
  private highlight: HTMLDivElement | null = null;
  private zones: ZoneMap;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(zones: ZoneMap) {
    this.zones = zones;
  }

  mount(context: ModeContext): void {
    this.ctx = context;
    if (!context.overlayContainer) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'touch-zone-overlay';
    this.overlay.style.cssText = [
      'position: absolute',
      'pointer-events: none',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
    ].join(';');

    context.overlayContainer.appendChild(this.overlay);
  }

  unmount(): void {
    this.clearHoverTimer();
    this.overlay?.remove();
    this.overlay = null;
    this.ctx = null;
  }

  handleOutput(_output: SystemOutput): void {
    // Touch zones are input-only, no output handling
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

  hitTest(screenX: number, screenY: number): ZoneName | null {
    if (!this.ctx) return null;
    const pos = this.ctx.getPetPosition();
    const relX = screenX - pos.x;
    const relY = screenY - pos.y;

    for (const [name, rect] of Object.entries(this.zones) as [ZoneName, ZoneRect][]) {
      if (
        relX >= rect.x && relX <= rect.x + rect.width &&
        relY >= rect.y && relY <= rect.y + rect.height
      ) {
        return name;
      }
    }
    return null;
  }

  handleClick(screenX: number, screenY: number): void {
    const zone = this.hitTest(screenX, screenY);
    if (zone && this.ctx) {
      this.ctx.dispatch({ kind: 'touch', zone });
    }
  }

  handleMouseMove(screenX: number, screenY: number): void {
    this.clearHoverTimer();
    this.removeHighlight();

    const zone = this.hitTest(screenX, screenY);
    if (zone) {
      this.hoverTimer = setTimeout(() => this.showHighlight(zone, screenX, screenY), HOVER_DELAY_MS);
    }
  }

  private showHighlight(zone: ZoneName, _screenX: number, _screenY: number): void {
    if (!this.overlay || !this.ctx) return;
    this.removeHighlight();

    const rect = this.zones[zone];
    const pos = this.ctx.getPetPosition();

    this.highlight = document.createElement('div');
    this.highlight.className = 'zone-highlight';
    this.highlight.style.cssText = [
      'position: absolute',
      `left: ${pos.x + rect.x}px`,
      `top: ${pos.y + rect.y}px`,
      `width: ${rect.width}px`,
      `height: ${rect.height}px`,
      'background: rgba(100, 150, 255, 0.2)',
      'border: 1px solid rgba(100, 150, 255, 0.5)',
      'border-radius: 4px',
      'pointer-events: none',
    ].join(';');

    this.overlay.appendChild(this.highlight);
  }

  private removeHighlight(): void {
    this.highlight?.remove();
    this.highlight = null;
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }
}
