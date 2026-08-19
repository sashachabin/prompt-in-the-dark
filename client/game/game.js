import * as monaco from "monaco-editor";
import { emmetHTML } from "emmet-monaco-es";

import { formatTime, getTimeLeft } from "../utils/formatTime";
import { connectSocket } from "../utils/socket";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

const params = new URLSearchParams(location.search);
const timerEl = document.getElementById("timer");
const refImg = document.getElementById("ref");

let PLAYER =
  Number(params.get("player")) || Number(localStorage.getItem("player"));
while (!PLAYER) {
  PLAYER = Number(prompt("Введите номер игрока (1 или 2):"));
}
window.history.replaceState({}, "", "/game/");
localStorage.setItem("player", PLAYER);

self.MonacoEnvironment = {
  getWorker: (moduleId, label) => {
    return new HtmlWorker();
  },
};
const editor = monaco.editor.create(document.getElementById("editor"), {
  value: localStorage.getItem("value") || "",
  language: "html",
  theme: "vs-dark",
  fontSize: 15,
  automaticLayout: true,
  "editor.scrollBeyondLastLine": false,
});

emmetHTML(monaco);

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") tasks = msg.tasks;
});

socket.send({ type: "getTasks" });

let currentTaskId = null;
let tasks = [];
let lastState = { taskId: null };

editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  localStorage.setItem("value", code);
  socket.send({ type: "code", player: PLAYER, code });
});

function onState(state) {
  lastState = state;
  timerEl.textContent = state.taskId
    ? `${formatTime(getTimeLeft(state))}`
    : "Waiting for the start…";
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    const t = tasks.find((x) => x.name === state.taskId);
    refImg.src = t ? t.url : "";
  }
}

setInterval(() => {
  const timeLeft = getTimeLeft(lastState);
  timerEl.textContent = lastState.taskId
    ? `${formatTime(timeLeft)}`
    : "Waiting for the start…";
}, 250);
