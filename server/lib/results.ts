import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GameMode, Player } from "./game-manager.ts";

export const RESULTS_FILE = resolve(
  process.cwd(),
  `data/results-${process.env["SERVER_PORT"] || "4747"}.json`,
);

export interface RoundResult {
  taskId: string;
  startedAt: number;
  endedAt: number;
  mode: GameMode;
  duration: number;
  players: Record<Player, { name: string; code: string; html: string }>;
}

export async function saveRound(round: RoundResult): Promise<void> {
  await mkdir(dirname(RESULTS_FILE), { recursive: true });
  let rounds: RoundResult[] = [];
  try {
    rounds = JSON.parse(await readFile(RESULTS_FILE, "utf8")) as RoundResult[];
    if (!Array.isArray(rounds)) rounds = [];
  } catch {
    rounds = [];
  }
  rounds.push(round);
  await writeFile(RESULTS_FILE, JSON.stringify(rounds, null, 2), "utf8");
}
