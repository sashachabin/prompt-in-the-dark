import { formatTimeHTML, getTimeLeftMs } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameState, Player, TaskInfo } from "../types.ts";

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
const roundStatusEl = document.getElementById("round-status") as HTMLSpanElement;
const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement;
const endBtn = document.getElementById("endBtn") as HTMLButtonElement;
const refImg = document.getElementById("refImg") as HTMLImageElement;
const imgName = document.getElementById("img-name") as HTMLDivElement;
const confettiBtn = document.getElementById("confettiBtn") as HTMLButtonElement;

let tasks: TaskInfo[] = [];
let selectedTaskId = "";
let currentTaskId: string | null = null;
let lastCodes: Record<Player, string> = { 1: "", 2: "" };
let lastState: GameState = {
  taskId: null,
  duration: 0,
  startAt: 0,
  paused: false,
  pausedAt: null,
  ended: false,
  codes: { 1: "", 2: "" },
};

const socket = connectSocket((msg) => {
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    loadTasks(msg.tasks);
    setRef();
  }
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "started") {
    statusEl.innerText = `Started task ${msg.taskId} for ${msg.duration / 60} minutes`;
  }
  if (msg.type === "error") alert(msg.message);
});

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

function setRef(): void {
  const t = tasks.find((x) => x.name === currentTaskId);
  refImg.src = t ? t.url : "";
  imgName.innerText = t ? t.name : "—";
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
  timeLeftEl.innerHTML = formatTimeHTML(getTimeLeftMs(lastState));
  roundStatusEl.className = `status-pill ${paused ? "paused" : "running"}`;
  roundStatusEl.innerText = paused ? "Paused" : "Running";
  pauseBtn.disabled = false;
  pauseBtn.innerText = paused ? "Resume" : "Pause";
}

function onState(state: GameState): void {
  lastState = state;
  updateTimer();
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
    if (state.taskId) {
      one.value = "";
      two.value = "";
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
    password: adminPassword,
  });
});

confettiBtn.addEventListener("click", () => {
  socket.send({ type: "confetti", password: adminPassword });
});

pauseBtn.addEventListener("click", () => {
  socket.send({ type: lastState.paused ? "resume" : "pause", password: adminPassword });
});

endBtn.addEventListener("click", () => {
  socket.send({ type: "stop", password: adminPassword });
});

document.querySelectorAll("[data-adjust]").forEach((btn) => {
  btn.addEventListener("click", () => {
    socket.send({
      type: "adjustTime",
      delta: Number((btn as HTMLElement).dataset["adjust"]),
      password: adminPassword,
    });
  });
});

setInterval(updateTimer, 100);
