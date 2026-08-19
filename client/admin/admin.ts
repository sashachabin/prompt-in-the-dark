import { formatTime, getTimeLeft } from "../utils/formatTime.ts";
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
const refImg = document.getElementById("refImg") as HTMLImageElement;
const imgName = document.getElementById("img-name") as HTMLDivElement;

let tasks: TaskInfo[] = [];

const socket = connectSocket((msg) => {
  if (msg.type === "tasks") {
    loadTasks(msg.tasks);
    tasks = msg.tasks;
    setRef();
  }
  if (msg.type === "state") {
    onState(msg.state);
  }
  if (msg.type === "started") {
    statusEl.innerText = `Started task ${msg.taskId} for ${msg.duration / 60} minutes`;
  }
  if (msg.type === "error") {
    alert(msg.message);
  }
});

socket.send({ type: "getTasks" });

function loadTasks(arr: TaskInfo[]): void {
  const ul = document.getElementById("taskList") as HTMLUListElement;
  ul.style = "padding: 0;";
  ul.innerHTML = "";
  const sel = document.getElementById("taskSelect") as HTMLSelectElement;
  sel.innerHTML = "";
  arr.forEach((t) => {
    const li = document.createElement("li");
    li.style = "display: flex; gap: 8px; align-items: center; margin: 10px 0;";
    li.innerHTML = `
      <img src="${t.url}" alt=""
           style="width:72px;height:42px;object-fit:contain;
                  border-radius:2px;border:1px solid rgba(0,0,0,0.15)" />
      ${t.name}
    `;
    ul.appendChild(li);
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.innerText = t.name;
    sel.appendChild(opt);
  });
}

const startForm = document.getElementById("startForm") as HTMLFormElement;
startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  socket.send({
    type: "start",
    taskId: String(fd.get("taskId")),
    duration: Number(fd.get("duration")) * 60,
    password: adminPassword,
  });
});

let currentTaskId: string | null = null;
let lastCodes: Record<Player, string> = { 1: "", 2: "" };
let lastState: GameState = {
  taskId: null,
  duration: 0,
  startAt: 0,
  codes: { 1: "", 2: "" },
};

function setRef(): void {
  const t = tasks.find((x) => x.name === currentTaskId);
  refImg.src = t ? t.url : "";
  imgName.innerText = t ? t.name : "";
}

function onState(state: GameState): void {
  lastState = state;
  const timeLeft = getTimeLeft(state);
  if (state.taskId) {
    timeLeftEl.innerText = `(${formatTime(timeLeft)})`;
  }
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
    one.value = "";
    two.value = "";
    lastCodes = { 1: "", 2: "" };
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

setInterval(() => {
  const timeLeft = getTimeLeft(lastState);
  if (lastState.taskId) {
    timeLeftEl.innerText = `(${formatTime(timeLeft)})`;
  }
}, 250);