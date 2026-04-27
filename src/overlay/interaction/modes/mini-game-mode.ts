import type {
  InteractionMode,
  ModeContext,
  SystemOutput,
  ModeCapabilities,
} from '../types';
import { invoke } from '@tauri-apps/api/core';

type GameState = 'idle' | 'select_game' | 'playing_rps' | 'playing_catch' | 'result';
type RpsChoice = 'rock' | 'paper' | 'scissors';

const RPS_CHOICES: RpsChoice[] = ['rock', 'paper', 'scissors'];
const RPS_ICONS: Record<RpsChoice, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_MAX_ROUNDS = 5;
const CATCH_DURATION_S = 30;
const CATCH_FOOD_EMOJIS = ['🍎', '🍕', '🍩', '🥕', '🍰'];
const CATCH_PET_STEAL_CHANCE = 0.2;

export class MiniGameMode implements InteractionMode {
  readonly type = 'mini_game' as const;
  readonly displayName = 'Mini Game';
  readonly surface = 'dom' as const;
  readonly tier = 'active' as const;

  private ctx: ModeContext | null = null;
  private container: HTMLDivElement | null = null;
  private state: GameState = 'idle';

  // RPS state
  private rpsRound = 0;
  private rpsPlayerScore = 0;
  private rpsPetScore = 0;

  // Catch state
  private catchScore = 0;
  private catchTimeLeft = CATCH_DURATION_S;
  private catchTimer: ReturnType<typeof setInterval> | null = null;
  private catchSpawnTimer: ReturnType<typeof setInterval> | null = null;

  // Result state
  private lastGameType = '';
  private lastScore = 0;
  private lastWon = false;

  mount(context: ModeContext): void {
    this.ctx = context;
    if (context.overlayContainer) {
      this.container = document.createElement('div');
      this.container.className = 'mini-game-container';
      this.container.style.cssText = [
        'position: absolute',
        'display: none',
        'flex-direction: column',
        'align-items: center',
        'gap: 8px',
        'pointer-events: auto',
        'z-index: 200',
        'background: rgba(30,30,40,0.95)',
        'padding: 12px',
        'border-radius: 12px',
        'min-width: 180px',
      ].join(';');
      context.overlayContainer.appendChild(this.container);
    }
  }

  unmount(): void {
    this.cleanup();
    this.state = 'idle';
    this.container?.remove();
    this.container = null;
    this.ctx = null;
  }

  private cleanup(): void {
    if (this.catchTimer) { clearInterval(this.catchTimer); this.catchTimer = null; }
    if (this.catchSpawnTimer) { clearInterval(this.catchSpawnTimer); this.catchSpawnTimer = null; }
  }

  handleOutput(output: SystemOutput): void {
    if (output.kind === 'care_action_play') {
      this.showGameSelection();
    }
  }

  capabilities(): ModeCapabilities {
    return {
      displaysText: true,
      acceptsTextInput: false,
      displaysChoices: true,
      triggersCareActions: true,
      requiresWebview: false,
      allowsConcurrent: false,
      supportsMultiAgent: false,
    };
  }

  getState(): GameState {
    return this.state;
  }

  private showGameSelection(): void {
    if (!this.container) return;
    this.state = 'select_game';
    this.container.style.display = 'flex';
    this.updatePosition();

    this.container.innerHTML = '';
    const heading = this.makeEl('div', 'Play with me!', 'font-size: 14px; font-weight: bold; color: white; margin-bottom: 4px;');
    this.container.appendChild(heading);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px;';

    const rpsBtn = this.makeEl('button', '🪨 RPS', 'cursor: pointer; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; padding: 8px 12px; font-size: 13px;');
    rpsBtn.onclick = () => this.startRps();
    btnRow.appendChild(rpsBtn);

    const catchBtn = this.makeEl('button', '🍎 Catch', 'cursor: pointer; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; padding: 8px 12px; font-size: 13px;');
    catchBtn.onclick = () => this.startCatch();
    btnRow.appendChild(catchBtn);

    this.container.appendChild(btnRow);

    const closeBtn = this.makeEl('button', 'Close', 'cursor: pointer; border: none; border-radius: 6px; background: rgba(255,255,255,0.05); color: #888; padding: 4px 10px; font-size: 11px; margin-top: 4px;');
    closeBtn.onclick = () => this.hide();
    this.container.appendChild(closeBtn);
  }

  private async startRps(): Promise<void> {
    this.state = 'playing_rps';
    this.rpsRound = 0;
    this.rpsPlayerScore = 0;
    this.rpsPetScore = 0;
    try { await invoke('start_mini_game', { gameType: 'rps' }); } catch { /* ok */ }
    this.renderRps();
  }

  private renderRps(roundResult?: string): void {
    if (!this.container) return;
    this.container.innerHTML = '';

    const title = this.makeEl('div', 'Rock Paper Scissors', 'font-size: 13px; font-weight: bold; color: white;');
    this.container.appendChild(title);

    const score = this.makeEl('div', `You: ${this.rpsPlayerScore} | Pet: ${this.rpsPetScore} | Round ${this.rpsRound}/${RPS_MAX_ROUNDS}`, 'font-size: 11px; color: #aaa;');
    this.container.appendChild(score);

    if (roundResult) {
      const result = this.makeEl('div', roundResult, 'font-size: 12px; color: #ffd700; margin: 2px 0;');
      this.container.appendChild(result);
    }

    if (this.rpsRound >= RPS_MAX_ROUNDS) {
      this.endRps();
      return;
    }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px;';
    for (const c of RPS_CHOICES) {
      const btn = this.makeEl('button', RPS_ICONS[c], 'cursor: pointer; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); padding: 6px 10px; font-size: 20px;');
      btn.onclick = () => this.playRpsRound(c);
      btnRow.appendChild(btn);
    }
    this.container.appendChild(btnRow);
  }

  private playRpsRound(playerChoice: RpsChoice): void {
    const petChoice = RPS_CHOICES[Math.floor(Math.random() * 3)];
    this.rpsRound++;

    let result: string;
    if (playerChoice === petChoice) {
      result = 'Draw!';
    } else if (
      (playerChoice === 'rock' && petChoice === 'scissors') ||
      (playerChoice === 'paper' && petChoice === 'rock') ||
      (playerChoice === 'scissors' && petChoice === 'paper')
    ) {
      this.rpsPlayerScore++;
      result = 'You win!';
    } else {
      this.rpsPetScore++;
      result = 'Pet wins!';
    }

    this.renderRps(`${RPS_ICONS[playerChoice]} vs ${RPS_ICONS[petChoice]} — ${result}`);
  }

  private async endRps(): Promise<void> {
    const won = this.rpsPlayerScore > this.rpsPetScore;
    this.lastGameType = 'rps';
    this.lastScore = this.rpsPlayerScore;
    this.lastWon = won;

    try {
      await invoke('submit_mini_game_result', { gameType: 'rps', score: this.rpsPlayerScore, won });
    } catch { /* ok */ }

    this.showResult(
      won ? 'You won the match!' : this.rpsPlayerScore === this.rpsPetScore ? 'Tie!' : 'Pet won!',
      `Score: ${this.rpsPlayerScore} - ${this.rpsPetScore}`,
    );
  }

  private startCatch(): void {
    this.state = 'playing_catch';
    this.catchScore = 0;
    this.catchTimeLeft = CATCH_DURATION_S;
    this.renderCatch();

    this.catchTimer = setInterval(() => {
      this.catchTimeLeft--;
      if (this.catchTimeLeft <= 0) {
        this.endCatch();
      } else {
        this.renderCatch();
      }
    }, 1000);

    this.catchSpawnTimer = setInterval(() => {
      this.spawnFood();
    }, 1200);
  }

  private renderCatch(): void {
    if (!this.container || this.state !== 'playing_catch') return;
    this.container.innerHTML = '';

    const title = this.makeEl('div', 'Catch the Food!', 'font-size: 13px; font-weight: bold; color: white;');
    this.container.appendChild(title);

    const info = this.makeEl('div', `Score: ${this.catchScore} | ${this.catchTimeLeft}s`, 'font-size: 11px; color: #aaa;');
    this.container.appendChild(info);

    // Game area
    const area = document.createElement('div');
    area.className = 'catch-area';
    area.style.cssText = 'position: relative; width: 200px; height: 160px; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden;';
    this.container.appendChild(area);

    // Spawn existing food items
    for (const food of this.container.querySelectorAll('.catch-food')) {
      area.appendChild(food);
    }

    this.updatePosition();
  }

  private spawnFood(): void {
    if (!this.container || this.state !== 'playing_catch') return;
    const area = this.container.querySelector('.catch-area');
    if (!area) return;

    const emoji = CATCH_FOOD_EMOJIS[Math.floor(Math.random() * CATCH_FOOD_EMOJIS.length)];
    const el = document.createElement('div');
    el.className = 'catch-food';
    el.textContent = emoji;
    el.style.cssText = [
      'position: absolute',
      'top: 0',
      `left: ${Math.random() * 160}px`,
      'font-size: 20px',
      'cursor: pointer',
      'transition: top 2s linear',
      'pointer-events: auto',
    ].join(';');

    // Pet steal check
    if (Math.random() < CATCH_PET_STEAL_CHANCE) {
      const stealEl = document.createElement('div');
      stealEl.textContent = `🐾 ${emoji}`;
      stealEl.style.cssText = 'position: absolute; bottom: 4px; right: 4px; font-size: 14px;';
      area.appendChild(stealEl);
      setTimeout(() => stealEl.remove(), 1500);
      return;
    }

    el.onclick = () => {
      this.catchScore++;
      el.remove();
      // Update score display
      const info = this.container!.querySelector('.catch-info');
      if (info) info.textContent = `Score: ${this.catchScore} | ${this.catchTimeLeft}s`;
    };

    area.appendChild(el);
    // Animate falling
    requestAnimationFrame(() => {
      el.style.top = '140px';
    });

    // Remove if not clicked
    setTimeout(() => el.remove(), 2500);
  }

  private async endCatch(): Promise<void> {
    this.cleanup();
    this.lastGameType = 'catch';
    this.lastScore = this.catchScore;
    this.lastWon = this.catchScore > 5;

    try {
      await invoke('submit_mini_game_result', { gameType: 'catch', score: this.catchScore, won: this.lastWon });
    } catch { /* ok */ }

    this.showResult(
      `You caught ${this.catchScore} items!`,
      this.lastWon ? 'Great job!' : 'Keep trying!',
    );
  }

  private showResult(title: string, subtitle: string): void {
    if (!this.container) return;
    this.state = 'result';
    this.container.innerHTML = '';

    const t = this.makeEl('div', title, 'font-size: 14px; font-weight: bold; color: #4ade80;');
    this.container.appendChild(t);

    const s = this.makeEl('div', subtitle, 'font-size: 12px; color: #aaa; margin: 2px 0;');
    this.container.appendChild(s);

    const closeBtn = this.makeEl('button', 'Close', 'cursor: pointer; border: none; border-radius: 6px; background: rgba(59,130,246,0.8); color: white; padding: 6px 16px; font-size: 12px;');
    closeBtn.onclick = () => {
      if (this.ctx) {
        this.ctx.dispatch({
          kind: 'mini_game_result',
          game: this.lastGameType,
          score: this.lastScore,
          won: this.lastWon,
        });
      }
      this.hide();
    };
    this.container.appendChild(closeBtn);
  }

  private hide(): void {
    this.state = 'idle';
    this.cleanup();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }
  }

  private updatePosition(): void {
    if (!this.container || !this.ctx) return;
    const pos = this.ctx.getPetPosition();
    this.container.style.left = `${pos.x + pos.width + 12}px`;
    this.container.style.top = `${pos.y}px`;
  }

  private makeEl(tag: string, text: string, style: string): HTMLElement {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.cssText = style;
    return el;
  }
}
