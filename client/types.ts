export type Player = 1 | 2;

export interface GameState {
  taskId: string | null;
  duration: number;
  startAt: number;
  codes: Record<Player, string>;
}

export interface TaskInfo {
  name: string;
  url: string;
}

export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "tasks"; tasks: TaskInfo[] }
  | { type: "started"; taskId: string; duration: number }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "start"; taskId: string; duration: number; password: string }
  | { type: "code"; player: Player; code: string }
  | { type: "getTasks" };