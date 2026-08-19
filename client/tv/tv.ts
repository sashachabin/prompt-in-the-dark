import { formatTime, getTimeLeft } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameState, TaskInfo } from "../types.ts";

const player1Result = document.getElementById("frame1") as HTMLIFrameElement;
const player2Result = document.getElementById("frame2") as HTMLIFrameElement;
const timerEl = document.getElementById("timer") as HTMLDivElement;

let currentTaskId: string | null = null;
let lastCodes: Record<1 | 2, string> = { 1: "", 2: "" };
let lastState: GameState = {
  taskId: null,
  duration: 0,
  startAt: 0,
  codes: { 1: "", 2: "" },
};
let tasks: TaskInfo[] = [];

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    setRef();
  }
});

socket.send({ type: "getTasks" });

function setRef(): void {
  const t = tasks.find((x) => x.name === currentTaskId);
  const img = document.getElementById("refImg") as HTMLImageElement;
  img.src = t ? t.url : "";
}

function onState(state: GameState): void {
  lastState = state;
  timerEl.innerText = formatTime(getTimeLeft(state));
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
    player1Result.srcdoc = "";
    player2Result.srcdoc = "";
    lastCodes = { 1: "", 2: "" };
  }
  if (state.codes[1] !== lastCodes[1]) {
    lastCodes[1] = state.codes[1];
    player1Result.srcdoc = lastCodes[1];
  }
  if (state.codes[2] !== lastCodes[2]) {
    lastCodes[2] = state.codes[2];
    player2Result.srcdoc = lastCodes[2];
  }
}

setInterval(() => {
  timerEl.innerText = formatTime(getTimeLeft(lastState));
}, 250);
