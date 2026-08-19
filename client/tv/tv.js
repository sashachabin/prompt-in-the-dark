import { formatTime, getTimeLeft } from "../utils/formatTime";
import { connectSocket } from "../utils/socket";

const player1Result = document.getElementById("frame1");
const player2Result = document.getElementById("frame2");
const timerEl = document.getElementById("timer");

let currentTaskId = null;
let lastCodes = { 1: "", 2: "" };
let lastState = { taskId: null };
let tasks = [];

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") tasks = msg.tasks;
});

socket.send({ type: "getTasks" });

function onState(state) {
  lastState = state;
  timerEl.innerText = formatTime(getTimeLeft(state));
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    const t = tasks.find((x) => x.name === state.taskId);
    const img = document.getElementById("refImg");
    img.src = t ? t.url : "";
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
