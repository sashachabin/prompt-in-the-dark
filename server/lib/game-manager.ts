export type Player = 1 | 2;

export interface GameState {
  taskId: string | null;
  duration: number;
  startAt: number;
  codes: Record<Player, string>;
}

export class GameManager {
  private current: { taskId: string; duration: number; startAt: number } | null = null;
  private codes: Record<Player, string> = { 1: "", 2: "" };

  start(taskId: string, duration: number): void {
    this.current = { taskId, duration, startAt: Date.now() };
    this.codes = { 1: "", 2: "" };
  }

  submitCode(player: Player, code: string): void {
    this.codes[player] = code;
  }

  getState(): GameState {
    if (!this.current) {
      return { taskId: null, duration: 0, startAt: 0, codes: this.codes };
    }
    return {
      taskId: this.current.taskId,
      duration: this.current.duration,
      startAt: this.current.startAt,
      codes: this.codes,
    };
  }
}
