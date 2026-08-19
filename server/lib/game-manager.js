export class GameManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.current = null;
    this.codes = { 1: "", 2: "" };
  }

  start(taskId, duration) {
    this.current = { taskId, duration, startAt: Date.now() };
    this.codes = { 1: "", 2: "" };
  }

  submitCode(player, code) {
    this.codes[player] = code;
  }

  getState() {
    if (!this.current) {
      return { taskId: null, duration: 0, timeLeft: 0, codes: this.codes };
    }
    return {
      taskId: this.current.taskId,
      duration: this.current.duration,
      startAt: this.current.startAt,
      codes: this.codes,
    };
  }
}
