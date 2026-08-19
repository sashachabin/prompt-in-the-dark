import * as monaco from "monaco-editor";
import { emmetHTML } from "emmet-monaco-es";
import { formatTimeHTML, getTimeLeftMs } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameState, Player, TaskInfo } from "../types.ts";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

const params = new URLSearchParams(location.search);
const timerEl = document.getElementById("timer") as HTMLDivElement;
const refImg = document.getElementById("ref") as HTMLImageElement;

let playerNumber = Number(params.get("player")) || Number(localStorage.getItem("player"));
while (!playerNumber) {
  playerNumber = Number(prompt("Введите номер игрока (1 или 2):")) || 0;
}
window.history.replaceState({}, "", "/game/");
localStorage.setItem("player", String(playerNumber));
const player = playerNumber as Player;

self.MonacoEnvironment = {
  getWorker: (_moduleId, _label) => new HtmlWorker(),
};

const editor = monaco.editor.create(document.getElementById("editor") as HTMLElement, {
  value: localStorage.getItem("value") || "",
  language: "html",
  theme: "vs-dark",
  fontSize: 15,
  automaticLayout: true,
  scrollBeyondLastLine: false,
});

emmetHTML(monaco);

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    setRef();
  }
});

socket.send({ type: "getTasks" });

let currentTaskId: string | null = null;
let tasks: TaskInfo[] = [];
let lastState: GameState = {
  taskId: null,
  duration: 0,
  startAt: 0,
  paused: false,
  pausedAt: null,
  ended: false,
  codes: { 1: "", 2: "" },
};

editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  localStorage.setItem("value", code);
  socket.send({ type: "code", player, code });
});

function setRef(): void {
  const t = tasks.find((x) => x.name === lastState.taskId);
  refImg.src = t ? t.url : "";
}

function renderTimer(): void {
  timerEl.innerHTML = lastState.taskId
    ? formatTimeHTML(getTimeLeftMs(lastState))
    : "Waiting for the start…";
}

function onState(state: GameState): void {
  lastState = state;
  renderTimer();
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
  }
}

setInterval(renderTimer, 100);
