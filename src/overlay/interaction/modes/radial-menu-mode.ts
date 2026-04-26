import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';

const SEGMENTS = [
  { action: 'feed' as const, label: '🍖 Feed', angle: 0 },
  { action: 'play' as const, label: '🎾 Play', angle: 90 },
  { action: 'sleep' as const, label: '💤 Sleep', angle: 180 },
  { action: 'chat' as const, label: '💬 Chat', angle: 270 },
];

export class RadialMenuMode implements InteractionMode {
  readonly type = 'radial_menu' as const;
  readonly displayName = 'Radial Menu';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private el: HTMLDivElement | null = null;

  mount(context: ModeContext): void {
    this.ctx = context;
    if (!context.overlayContainer) return;

    this.el = document.createElement('div');
    this.el.className = 'radial-menu';
    this.el.style.cssText = [
      'position: absolute',
      'display: none',
      'pointer-events: auto',
      'width: 160px',
      'height: 160px',
    ].join(';');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    svg.setAttribute('width', '160');
    svg.setAttribute('height', '160');

    const cx = 80, cy = 80, r = 60;
    for (const seg of SEGMENTS) {
      const startRad = ((seg.angle - 45) * Math.PI) / 180;
      const endRad = ((seg.angle + 45) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const largeArc = seg.angle + 45 - (seg.angle - 45) > 180 ? 1 : 0;
      path.setAttribute('d', `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`);
      path.setAttribute('fill', '#f0f0f0');
      path.setAttribute('stroke', '#ccc');
      path.setAttribute('stroke-width', '1');
      path.classList.add('radial-segment');
      path.setAttribute('data-action', seg.action);
      path.style.cursor = 'pointer';

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const midRad = ((seg.angle) * Math.PI) / 180;
      label.setAttribute('x', String(cx + (r * 0.6) * Math.cos(midRad)));
      label.setAttribute('y', String(cy + (r * 0.6) * Math.sin(midRad)));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('pointer-events', 'none');
      label.textContent = seg.label;

      path.addEventListener('mouseenter', () => { path.setAttribute('fill', '#e0e0ff'); });
      path.addEventListener('mouseleave', () => { path.setAttribute('fill', '#f0f0f0'); });
      path.addEventListener('click', () => this.selectAction(seg.action));

      svg.appendChild(path);
      svg.appendChild(label);
    }

    this.el.appendChild(svg);
    context.overlayContainer.appendChild(this.el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    this.ctx = null;
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind === 'gesture' && output.type === 'context_menu') {
      this.open();
    }
  }

  // Handle gesture events routed through the router
  handleGestureEvent(gesture: string): void {
    if (gesture === 'context_menu') this.open();
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

  private selectAction(action: 'feed' | 'play' | 'chat' | 'sleep'): void {
    if (!this.ctx) return;
    this.ctx.dispatch({ kind: 'care_action', action });
    this.close();
  }
}
