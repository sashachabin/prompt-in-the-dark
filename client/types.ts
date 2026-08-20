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

export interface TaskInfo {
  name: string;
  url: string;
}

export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "tasks"; tasks: TaskInfo[] }
  | { type: "started"; taskId: string; duration: number }
  | { type: "generateStarted"; player: Player }
  | { type: "htmls"; htmls: Record<Player, string> }
  | { type: "speak"; player: Player }
  | { type: "stopSpeak" }
  | { type: "error"; message: string }
  | { type: "confetti" }
  | { type: "tick"; remainingMs: number; sentAt: number };

export type ClientMessage =
  | { type: "start"; taskId: string; duration: number; mode?: GameMode; password: string }
  | { type: "pause"; password: string }
  | { type: "resume"; password: string }
  | { type: "adjustTime"; delta: number; password: string }
  | { type: "stop"; password: string }
  | { type: "tvShow"; show: TvShow; password: string }
  | { type: "focus"; player: PlayerFocus; password: string }
  | { type: "speak"; player: Player; password: string }
  | { type: "stopSpeak"; password: string }
  | { type: "generateHtml"; player: Player; password: string }
  | { type: "renamePlayer"; player: Player; name: string; password: string }
  | { type: "clearCodes"; password: string }
  | { type: "code"; player: Player; code: string }
  | { type: "confetti"; password: string }
  | { type: "getTasks" };
