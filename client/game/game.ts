import * as monaco from "monaco-editor";
import { emmetHTML } from "emmet-monaco-es";
import { formatTimeHTML, getTimeLeftSec, setServerTick } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameMode, GameState, Player, TaskInfo } from "../types.ts";
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

const storageKey = `code-${player}`;
const editor = monaco.editor.create(document.getElementById("editor") as HTMLElement, {
  value: localStorage.getItem(storageKey) || "",
  language: "html",
  theme: "vs-dark",
  fontSize: 15,
  automaticLayout: true,
  scrollBeyondLastLine: false,
});

emmetHTML(monaco);

const editorEl = document.getElementById("editor") as HTMLDivElement;
const promptInput = document.getElementById("promptInput") as HTMLTextAreaElement;
promptInput.value = localStorage.getItem(storageKey) || "";

function applyMode(mode: "code" | "prompt"): void {
  const promptMode = mode === "prompt";
  editorEl.hidden = promptMode;
  promptInput.hidden = !promptMode;
  if (promptMode) promptInput.focus();
}

promptInput.addEventListener("input", () => {
  localStorage.setItem(storageKey, promptInput.value);
  socket.send({ type: "code", player, code: promptInput.value });
});

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    setRef();
  }
  if (msg.type === "tick") {
    setServerTick(msg.remainingMs);
    renderTimer();
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
  mode: "prompt",
  tvShow: "prompt",
  focus: "none",
  codes: { 1: "", 2: "" },
  players: { 1: "Player 1", 2: "Player 2" },
};

let lastSec = -1;
let lastAppliedMode: GameMode | null = null;

function bumpIfJump(newSec: number): void {
  const diff = newSec - lastSec;
  lastSec = newSec;
  if (diff > 0 || diff < -1) {
    timerEl.classList.remove("bump");
    void timerEl.offsetWidth;
    timerEl.classList.add("bump");
  }
}

editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  localStorage.setItem(storageKey, code);
  socket.send({ type: "code", player, code });
});

function setRef(): void {
  const t = tasks.find((x) => x.name === lastState.taskId);
  refImg.src = t ? t.url : "";
}

function renderTimer(): void {
  if (!lastState.taskId) {
    timerEl.innerHTML = "Waiting for the start…";
    return;
  }
  const sec = getTimeLeftSec(lastState);
  bumpIfJump(Math.floor(sec));
  timerEl.innerHTML = formatTimeHTML(sec);
}

function onState(state: GameState): void {
  lastState = state;
  renderTimer();
  if (state.mode !== lastAppliedMode) {
    lastAppliedMode = state.mode;
    applyMode(state.mode);
  }
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
  }
}

setInterval(renderTimer, 100);
