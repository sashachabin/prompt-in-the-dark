import { formatTimeHTML, getTimeLeftSec, setServerTick } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameMode, GameState, Player, TaskInfo } from "../types.ts";

function askPassword(): string {
  const savedPassword = localStorage.getItem("adminPassword") || "";
  const pwd = prompt("Enter password:", savedPassword) || "";
  localStorage.setItem("adminPassword", pwd);
  return pwd;
}

const adminPassword = askPassword();

const statusEl = document.getElementById("status") as HTMLDivElement;
const one = document.getElementById("one") as HTMLTextAreaElement;
const two = document.getElementById("two") as HTMLTextAreaElement;
const timeLeftEl = document.getElementById("time-left") as HTMLSpanElement;
const timeDeltaEl = document.getElementById("timeDelta") as HTMLSpanElement;
const roundStatusEl = document.getElementById("round-status") as HTMLSpanElement;
const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement;
const endBtn = document.getElementById("endBtn") as HTMLButtonElement;
const confettiBtn = document.getElementById("confettiBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const refImg = document.getElementById("refImg") as HTMLImageElement;
const imgName = document.getElementById("img-name") as HTMLDivElement;
const modeCodeBtn = document.getElementById("modeCodeBtn") as HTMLButtonElement;
const modePromptBtn = document.getElementById("modePromptBtn") as HTMLButtonElement;
const tvControls = document.getElementById("tvControls") as HTMLDivElement;
const tvPromptBtn = document.getElementById("tvPromptBtn") as HTMLButtonElement;
const tvResultBtn = document.getElementById("tvResultBtn") as HTMLButtonElement;
const focus1Btn = document.getElementById("focus1Btn") as HTMLButtonElement;
const focus2Btn = document.getElementById("focus2Btn") as HTMLButtonElement;
const focusNoneBtn = document.getElementById("focusNoneBtn") as HTMLButtonElement;
const speak1Btn = document.getElementById("speak1Btn") as HTMLButtonElement;
const speak2Btn = document.getElementById("speak2Btn") as HTMLButtonElement;
const speakStopBtn = document.getElementById("speakStopBtn") as HTMLButtonElement;
const playersTitle = document.getElementById("playersTitle") as HTMLHeadingElement;
const genBtn1 = document.getElementById("genBtn1") as HTMLButtonElement;
const genBtn2 = document.getElementById("genBtn2") as HTMLButtonElement;
const nameInput1 = document.getElementById("name1") as HTMLInputElement;
const nameInput2 = document.getElementById("name2") as HTMLInputElement;
const html1 = document.getElementById("html1") as HTMLTextAreaElement;
const html2 = document.getElementById("html2") as HTMLTextAreaElement;

let tasks: TaskInfo[] = [];
let selectedTaskId = "";
let selectedMode: GameMode = "prompt";
let currentTaskId: string | null = null;
let lastCodes: Record<Player, string> = { 1: "", 2: "" };
let lastPlayers: Record<Player, string> = { 1: "Player 1", 2: "Player 2" };
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

const socket = connectSocket((msg) => {
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    loadTasks(msg.tasks);
    setRef();
  }
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "htmls") {
    html1.value = msg.htmls[1];
    html2.value = msg.htmls[2];
    finishGeneration();
  }
  if (msg.type === "started") {
    statusEl.className = "status-message";
    statusEl.innerText = `Started task ${msg.taskId} for ${msg.duration / 60} minutes`;
  }
  if (msg.type === "generateStarted") {
    generating[msg.player] = true;
    genBtn1.textContent = generating[1] ? "Generating…" : "⚙️ Generate";
    genBtn2.textContent = generating[2] ? "Generating…" : "⚙️ Generate";
    statusEl.className = "status-message working";
    statusEl.innerText = `Generating ${lastState.players[msg.player]} layout…`;
    updateTvControls();
  }
  if (msg.type === "error") {
    statusEl.className = "status-message error";
    statusEl.innerText = msg.message;
    finishGeneration();
  }
  if (msg.type === "tick") {
    setServerTick(msg.remainingMs);
    updateTimer();
  }
});

let generating: Record<Player, boolean> = { 1: false, 2: false };

function finishGeneration(): void {
  generating = { 1: false, 2: false };
  genBtn1.textContent = "⚙️ Generate";
  genBtn2.textContent = "⚙️ Generate";
  updateTvControls();
}

socket.send({ type: "getTasks" });

function loadTasks(arr: TaskInfo[]): void {
  const grid = document.getElementById("taskGrid") as HTMLDivElement;
  grid.innerHTML = "";
  arr.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-card";
    btn.innerHTML = `
      <img src="${t.url}" alt="" />
      <span>${t.name}</span>
    `;
    btn.addEventListener("click", () => selectTask(btn, t.name));
    grid.appendChild(btn);
    if (i === 0) selectTask(btn, t.name);
  });
}

function selectTask(el: HTMLButtonElement, name: string): void {
  document.querySelectorAll(".task-card.selected").forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
  selectedTaskId = name;
}

function setMode(mode: GameMode): void {
  selectedMode = mode;
  modeCodeBtn.classList.toggle("selected", mode === "code");
  modePromptBtn.classList.toggle("selected", mode === "prompt");
}

modeCodeBtn.addEventListener("click", () => setMode("code"));
modePromptBtn.addEventListener("click", () => setMode("prompt"));

function setRef(): void {
  const t = tasks.find((x) => x.name === currentTaskId);
  refImg.src = t ? t.url : "";
  imgName.innerText = t ? t.name : "—";
}

let lastSec = -1;
let deltaTimer: ReturnType<typeof setTimeout> | null = null;

function bumpIfJump(newSec: number): void {
  const diff = newSec - lastSec;
  lastSec = newSec;
  if (diff > 0 || diff < -1) {
    timeLeftEl.classList.remove("bump");
    void timeLeftEl.offsetWidth;
    timeLeftEl.classList.add("bump");
  }
}

function showDelta(deltaSec: number): void {
  timeDeltaEl.textContent = `${deltaSec > 0 ? "+" : "−"}${Math.abs(deltaSec)}s`;
  timeDeltaEl.classList.remove("show");
  void timeDeltaEl.offsetWidth;
  timeDeltaEl.classList.add("show");
  if (deltaTimer) clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => timeDeltaEl.classList.remove("show"), 1600);
}

function updateTimer(): void {
  if (!lastState.taskId) {
    timeLeftEl.innerText = "—";
    roundStatusEl.className = "status-pill";
    roundStatusEl.innerText = "Waiting";
    pauseBtn.disabled = true;
    return;
  }
  if (lastState.ended) {
    timeLeftEl.innerText = "0:00";
    roundStatusEl.className = "status-pill ended";
    roundStatusEl.innerText = "Ended";
    pauseBtn.disabled = true;
    return;
  }
  const paused = lastState.paused;
  const sec = getTimeLeftSec(lastState);
  bumpIfJump(Math.floor(sec));
  timeLeftEl.innerHTML = formatTimeHTML(sec);
  roundStatusEl.className = `status-pill ${paused ? "paused" : "running"}`;
  roundStatusEl.innerText = paused ? "Paused" : "Running";
  pauseBtn.disabled = false;
  pauseBtn.innerText = paused ? "Resume" : "Pause";
}

function updateTvControls(): void {
  const promptMode = lastState.mode === "prompt";
  tvControls.hidden = !promptMode;
  speak1Btn.hidden = !promptMode;
  speak2Btn.hidden = !promptMode;
  genBtn1.hidden = !promptMode;
  genBtn2.hidden = !promptMode;
  html1.hidden = !promptMode;
  html2.hidden = !promptMode;
  playersTitle.innerText = promptMode ? "Players' prompts" : "Players' html";
  if (!promptMode) return;
  genBtn1.disabled = !lastCodes[1].trim() || generating[1];
  genBtn2.disabled = !lastCodes[2].trim() || generating[2];
  const showResults = lastState.tvShow === "result";
  tvPromptBtn.classList.toggle("selected", !showResults);
  tvResultBtn.classList.toggle("selected", showResults);
  focus1Btn.classList.toggle("selected", lastState.focus === 1);
  focus2Btn.classList.toggle("selected", lastState.focus === 2);
  focusNoneBtn.classList.toggle("selected", lastState.focus === "none");
}

function onState(state: GameState): void {
  lastState = state;
  updateTimer();
  updateTvControls();
  if (state.players[1] !== lastPlayers[1]) {
    if (document.activeElement !== nameInput1) nameInput1.value = state.players[1];
  }
  if (state.players[2] !== lastPlayers[2]) {
    if (document.activeElement !== nameInput2) nameInput2.value = state.players[2];
  }
  lastPlayers = state.players;
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
    if (state.taskId) {
      one.value = "";
      two.value = "";
      html1.value = "";
      html2.value = "";
      lastCodes = { 1: "", 2: "" };
    }
  }
  if (state.codes[1] !== lastCodes[1]) {
    lastCodes[1] = state.codes[1];
    one.value = lastCodes[1];
  }
  if (state.codes[2] !== lastCodes[2]) {
    lastCodes[2] = state.codes[2];
    two.value = lastCodes[2];
  }
}

const startForm = document.getElementById("startForm") as HTMLFormElement;
startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  socket.send({
    type: "start",
    taskId: selectedTaskId,
    duration: Number(fd.get("duration")) * 60,
    mode: selectedMode,
    password: adminPassword,
  });
});

confettiBtn.addEventListener("click", () => {
  socket.send({ type: "confetti", password: adminPassword });
});

clearBtn.addEventListener("click", () => {
  socket.send({ type: "clearCodes", password: adminPassword });
});

pauseBtn.addEventListener("click", () => {
  socket.send({ type: lastState.paused ? "resume" : "pause", password: adminPassword });
});

endBtn.addEventListener("click", () => {
  socket.send({ type: "stop", password: adminPassword });
});

tvPromptBtn.addEventListener("click", () => {
  socket.send({ type: "tvShow", show: "prompt", password: adminPassword });
});

tvResultBtn.addEventListener("click", () => {
  socket.send({ type: "tvShow", show: "result", password: adminPassword });
});

focus1Btn.addEventListener("click", () => {
  socket.send({ type: "focus", player: 1, password: adminPassword });
});

focus2Btn.addEventListener("click", () => {
  socket.send({ type: "focus", player: 2, password: adminPassword });
});

focusNoneBtn.addEventListener("click", () => {
  socket.send({ type: "focus", player: "none", password: adminPassword });
});

speak1Btn.addEventListener("click", () => {
  socket.send({ type: "speak", player: 1, password: adminPassword });
});

speak2Btn.addEventListener("click", () => {
  socket.send({ type: "speak", player: 2, password: adminPassword });
});

speakStopBtn.addEventListener("click", () => {
  socket.send({ type: "stopSpeak", password: adminPassword });
});

speak1Btn.addEventListener("click", () => {
  socket.send({ type: "speak", player: 1, password: adminPassword });
});

speak2Btn.addEventListener("click", () => {
  socket.send({ type: "speak", player: 2, password: adminPassword });
});

genBtn1.addEventListener("click", () => {
  socket.send({ type: "generateHtml", player: 1, password: adminPassword });
});

genBtn2.addEventListener("click", () => {
  socket.send({ type: "generateHtml", player: 2, password: adminPassword });
});

function saveName(player: Player): void {
  const input = player === 1 ? nameInput1 : nameInput2;
  const name = input.value.trim().slice(0, 40);
  if (!name) {
    input.value = lastState.players[player];
    return;
  }
  if (name === lastState.players[player]) return;
  socket.send({ type: "renamePlayer", player, name, password: adminPassword });
}

nameInput1.addEventListener("change", () => saveName(1));
nameInput2.addEventListener("change", () => saveName(2));
nameInput1.addEventListener("keydown", (e) => {
  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
});
nameInput2.addEventListener("keydown", (e) => {
  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
});

document.querySelectorAll("[data-adjust]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const delta = Number((btn as HTMLElement).dataset["adjust"]);
    showDelta(delta);
    socket.send({ type: "adjustTime", delta, password: adminPassword });
  });
});

setInterval(updateTimer, 100);
