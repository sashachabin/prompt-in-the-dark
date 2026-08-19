import type { GameState } from "../types.ts";

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFraction(sec: number): string {
  return Math.floor((sec % 1) * 100)
    .toString()
    .padStart(2, "0");
}

export function formatTimeHTML(sec: number): string {
  return `${formatTime(Math.floor(sec))}<span class="ms">.${formatFraction(sec)}</span>`;
}

export function getTimeLeftMs(state: GameState): number {
  if (!state.taskId) return 0;
  const end = state.startAt + state.duration * 1000;
  const now = state.paused ? (state.pausedAt ?? Date.now()) : Date.now();
  return Math.max(0, (end - now) / 1000);
}
