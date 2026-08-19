import { formatTime, getTimeLeft } from "../utils/formatTime";
import { connectSocket } from "../utils/socket";

let adminPassword = "";

function askPassword() {
  let savedPassword = localStorage.getItem("adminPassword") || "";
  let pwd;
  if (!pwd) {
    pwd = prompt("Enter password:", savedPassword) || "";
  }
  localStorage.setItem("adminPassword", pwd);
  return pwd;
}

adminPassword = askPassword();

const statusEl = document.getElementById("status");
let tasks = [];

const socket = connectSocket((msg) => {
  if (msg.type === "tasks") {
    loadTasks(msg.tasks);
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

function loadTasks(arr) {
  const ul = document.getElementById("taskList");
  ul.style = "padding: 0;";
  ul.innerHTML = "";
  const sel = document.getElementById("taskSelect");
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

document.getElementById("startForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  socket.send({
    type: "start",
    taskId: fd.get("taskId"),
    duration: fd.get("duration") * 60,
    password: adminPassword,
  });
});

function submitCode(player, code) {
  socket.send({ type: "code", player, code });
}

document
  .getElementById("one")
  .addEventListener("input", (e) => submitCode(1, e.target.value));
document
  .getElementById("two")
  .addEventListener("input", (e) => submitCode(2, e.target.value));

let currentTaskId = null;
let lastCodes = { 1: "", 2: "" };
let lastState = { taskId: null };

function onState(state) {
  lastState = state;
  const timeLeft = getTimeLeft(state);
  if (state.taskId) {
    document.getElementById("time-left").innerText =
      `(${formatTime(timeLeft)})`;
  }
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    const t = tasks.find((x) => x.name === state.taskId);
    const img = document.getElementById("refImg");
    img.src = t ? t.url : "";
    document.getElementById("img-name").innerText = t ? t.name : "";
    document.getElementById("one").value = "";
    document.getElementById("two").value = "";
    lastCodes = { 1: "", 2: "" };
  }
  if (state.codes[1] !== lastCodes[1]) {
    lastCodes[1] = state.codes[1];
    document.getElementById("one").value = lastCodes[1];
  }
  if (state.codes[2] !== lastCodes[2]) {
    lastCodes[2] = state.codes[2];
    document.getElementById("two").value = lastCodes[2];
  }
}

setInterval(() => {
  const timeLeft = getTimeLeft(lastState);
  if (lastState.taskId) {
    document.getElementById("time-left").innerText =
      `(${formatTime(timeLeft)})`;
  }
}, 250);
