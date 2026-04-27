import type {
  InteractionMode,
  InteractionModeType,
  InteractionEvent,
  SystemOutput,
  GestureMap,
  GestureType,
} from './types';
import { MUTUALLY_EXCLUSIVE_GROUPS, ALWAYS_CONCURRENT } from './types';

type EventHandler = (event: InteractionEvent) => void;

const BOND_GATES: Partial<Record<InteractionModeType, number>> = {
  dream_nail: 5,
  letter: 6,
  journal: 7,
  mini_game: 7,
};

export class InteractionRouter {
  private modes = new Map<InteractionModeType, InteractionMode>();
  private gestureMap: GestureMap = {};
  private eventHandlers: EventHandler[] = [];
  private overlayContainer: HTMLDivElement | null = null;
  private bondLevel = 0;

  setOverlayContainer(container: HTMLDivElement): void {
    this.overlayContainer = container;
  }

  setBondLevel(level: number): void {
    this.bondLevel = level;
  }

  activeModes(): InteractionModeType[] {
    return Array.from(this.modes.keys());
  }

  enableMode(mode: InteractionMode): void {
    const requiredLevel = BOND_GATES[mode.type];
    if (requiredLevel !== undefined && this.bondLevel < requiredLevel) {
      throw new Error(
        `Cannot enable ${mode.type}: requires Bond Lv.${requiredLevel}, current is ${this.bondLevel}`,
      );
    }

    const existing = this.modes.get(mode.type);
    if (existing) {
      existing.unmount();
    }

    if (!this.isAlwaysConcurrent(mode.type)) {
      this.enforceCompatibility(mode.type);
    }

    this.modes.set(mode.type, mode);
    mode.mount({
      canvas: null,
      overlayContainer: this.overlayContainer,
      getPetPosition: () => ({ x: 0, y: 0, width: 64, height: 64 }),
      getPetState: () => 'idle',
      dispatch: (event) => this.dispatch(event),
    });
  }

  disableMode(type: InteractionModeType): void {
    const mode = this.modes.get(type);
    if (mode) {
      mode.unmount();
      this.modes.delete(type);
    }
  }

  handleOutput(output: SystemOutput): void {
    for (const mode of this.modes.values()) {
      mode.handleOutput(output);
    }
  }

  handleGesture(gesture: GestureType): boolean {
    const target = this.gestureMap[gesture];
    if (!target || !this.modes.has(target)) return false;
    const gestureOutput: SystemOutput = { kind: 'gesture', type: gesture };
    const targetMode = this.modes.get(target)!;
    targetMode.handleOutput(gestureOutput);
    this.dispatch({ kind: 'gesture', type: gesture });
    return true;
  }

  setGestureMap(map: GestureMap): void {
    this.gestureMap = map;
  }

  dispatch(event: InteractionEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }

    // Bridge care_action:play to mini_game mode
    if (event.kind === 'care_action' && event.action === 'play') {
      this.handleOutput({ kind: 'care_action_play' });
    }
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  private isAlwaysConcurrent(type: InteractionModeType): boolean {
    return ALWAYS_CONCURRENT.includes(type);
  }

  private enforceCompatibility(newType: InteractionModeType): void {
    for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
      if (!group.includes(newType)) continue;
      for (const existingType of this.modes.keys()) {
        if (group.includes(existingType)) {
          throw new Error(
            `Cannot enable ${newType}: mutually exclusive with active ${existingType}`,
          );
        }
      }
    }
  }
}
