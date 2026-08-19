export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getTimeLeft(state) {
  if (!state.taskId) return 0;
  const end = state.startAt + state.duration * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}
