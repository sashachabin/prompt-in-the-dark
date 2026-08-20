export type Player = 1 | 2;
export type PlayerFocus = "none" | Player;

export type GameMode = "code" | "prompt";
export type TvShow = "prompt" | "result";

export interface GameState {
  taskId: string | null;
  duration: number;
  startAt: number;
  paused: boolean;
  pausedAt: number | null;
  ended: boolean;
  mode: GameMode;
  tvShow: TvShow;
  focus: PlayerFocus;
  codes: Record<Player, string>;
  players: Record<Player, string>;
}

export class GameManager {
  private current: {
    taskId: string;
    duration: number;
    startAt: number;
    paused: boolean;
    pausedAt: number | null;
    ended: boolean;
  } | null = null;
  private codes: Record<Player, string> = { 1: "", 2: "" };
  private htmls: Record<Player, string> = { 1: "", 2: "" };
  private mode: GameMode = "prompt";
  private tvShow: TvShow = "prompt";
  private focus: PlayerFocus = "none";
  private players: Record<Player, string> = { 1: "Player 1", 2: "Player 2" };
  private roundStartedAt: number | null = null;

  start(taskId: string, duration: number, mode: GameMode): void {
    this.current = {
      taskId,
      duration,
      startAt: Date.now(),
      paused: false,
      pausedAt: null,
      ended: false,
    };
    this.mode = mode;
    this.focus = "none";
    this.roundStartedAt = Date.now();
    this.codes = { 1: "", 2: "" };
    this.htmls = { 1: "", 2: "" };
  }

  getRoundStartedAt(): number | null {
    return this.roundStartedAt;
  }

  clearCodes(): void {
    this.codes = { 1: "", 2: "" };
  }

  submitCode(player: Player, code: string): void {
    this.codes[player] = code;
  }

  setHtml(player: Player, html: string): void {
    this.htmls[player] = html;
  }

  getHtmls(): Record<Player, string> {
    return this.htmls;
  }

  setTvShow(show: TvShow): void {
    this.tvShow = show;
  }

  setFocus(focus: PlayerFocus): void {
    this.focus = focus;
  }

  renamePlayer(player: Player, name: string): void {
    this.players[player] = name;
  }

  pause(): void {
    if (!this.current || this.current.paused) return;
    this.current.paused = true;
    this.current.pausedAt = Date.now();
  }

  resume(): void {
    if (!this.current || !this.current.paused) return;
    const now = Date.now();
    this.current.startAt += now - (this.current.pausedAt ?? now);
    this.current.paused = false;
    this.current.pausedAt = null;
  }

  adjustTime(deltaSec: number): void {
    if (!this.current) return;
    const elapsedSec = this.getElapsedSec();
    const remaining = Math.max(0, this.current.duration - elapsedSec);
    const newRemaining = Math.max(0, remaining + deltaSec);
    const newDuration = Math.max(newRemaining, this.current.duration + deltaSec);
    const elapsedMs = (newDuration - newRemaining) * 1000;
    if (this.current.paused) {
      this.current.pausedAt = this.current.startAt + elapsedMs;
    } else {
      this.current.startAt = Date.now() - elapsedMs;
    }
    this.current.duration = newDuration;
    if (newRemaining > 0) this.current.ended = false;
  }

  stop(): void {
    if (!this.current) return;
    this.current.startAt = Date.now() - this.current.duration * 1000;
    this.current.paused = false;
    this.current.pausedAt = null;
    this.current.ended = true;
  }

  private getElapsedSec(): number {
    if (!this.current) return 0;
    const anchor =
      this.current.paused && this.current.pausedAt !== null ? this.current.pausedAt : Date.now();
    return Math.max(0, (anchor - this.current.startAt) / 1000);
  }

  getState(): GameState {
    if (!this.current) {
      return {
        taskId: null,
        duration: 0,
        startAt: 0,
        paused: false,
        pausedAt: null,
        ended: false,
        mode: this.mode,
        tvShow: this.tvShow,
        focus: this.focus,
        codes: this.codes,
        players: this.players,
      };
    }
    return {
      taskId: this.current.taskId,
      duration: this.current.duration,
      startAt: this.current.startAt,
      paused: this.current.paused,
      pausedAt: this.current.pausedAt,
      ended: this.current.ended,
      mode: this.mode,
      tvShow: this.tvShow,
      focus: this.focus,
      codes: this.codes,
      players: this.players,
    };
  }
}
