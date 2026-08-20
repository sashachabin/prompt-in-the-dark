import { formatTimeHTML, getTimeLeftSec, setServerTick } from "../utils/formatTime.ts";
import { connectSocket } from "../utils/socket.ts";
import type { GameState, Player, TaskInfo } from "../types.ts";
import { triggerConfetti } from "./trigger-confetti.ts";

const player1Result = document.getElementById("frame1") as HTMLIFrameElement;
const player2Result = document.getElementById("frame2") as HTMLIFrameElement;
const prompt1 = document.getElementById("prompt1") as HTMLPreElement;
const prompt2 = document.getElementById("prompt2") as HTMLPreElement;
const timerEl = document.getElementById("timer") as HTMLDivElement;
const voiceHint = document.getElementById("voiceHint") as HTMLDivElement;
const title1 = document.getElementById("title1") as HTMLHeadingElement;
const title2 = document.getElementById("title2") as HTMLHeadingElement;

let currentTaskId: string | null = null;
let lastCodes: Record<Player, string> = { 1: "", 2: "" };
let htmls: Record<Player, string> = { 1: "", 2: "" };
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
let tasks: TaskInfo[] = [];

const socket = connectSocket((msg) => {
  if (msg.type === "state") onState(msg.state);
  if (msg.type === "tasks") {
    tasks = msg.tasks;
    setRef();
  }
  if (msg.type === "htmls") {
    htmls = msg.htmls;
    renderColumns();
  }
  if (msg.type === "confetti") {
    triggerConfetti();
  }
  if (msg.type === "speak") {
    speak(msg.player);
  }
  if (msg.type === "stopSpeak") {
    stopSpeaking();
  }
  if (msg.type === "tick") {
    setServerTick(msg.remainingMs);
    renderTimer();
  }
});

socket.send({ type: "getTasks" });

voiceHint.addEventListener(
  "pointerdown",
  () => {
    voiceHint.hidden = true;
  },
  { once: true },
);

function setRef(): void {
  const t = tasks.find((x) => x.name === currentTaskId);
  const img = document.getElementById("refImg") as HTMLImageElement;
  img.src = t ? t.url : "";
}

function renderTimer(): void {
  if (!lastState.taskId) {
    timerEl.innerHTML = "0:00";
    return;
  }
  const sec = getTimeLeftSec(lastState);
  bumpIfJump(Math.floor(sec));
  timerEl.innerHTML = formatTimeHTML(sec);
}

let lastSec = -1;

function bumpIfJump(newSec: number): void {
  const diff = newSec - lastSec;
  lastSec = newSec;
  if (diff > 0 || diff < -1) {
    timerEl.classList.remove("bump");
    void timerEl.offsetWidth;
    timerEl.classList.add("bump");
  }
}

function setPromptText(el: HTMLPreElement, text: string): void {
  el.textContent = text;
  const caret = document.createElement("span");
  caret.className = "caret";
  el.append(caret);
  el.scrollTop = el.scrollHeight;
}

const FIT_WRAPPER =
  "<style>html,body{width:100%;height:100%;margin:0;overflow:hidden!important}</style>" +
  "<script>function fit(){var vw=window.innerWidth,vh=window.innerHeight,w=document.documentElement.scrollWidth,h=document.documentElement.scrollHeight,s=Math.min(vw/w,vh/h,2);if(s!==1){document.documentElement.style.transformOrigin='0 0';document.documentElement.style.transform='scale('+s+')';}}window.addEventListener('load',function(){fit();setTimeout(fit,300);setTimeout(fit,1000);});<\/script>";

function renderHtml(html: string): string {
  return FIT_WRAPPER + html;
}

function renderColumns(): void {
  const promptMode = lastState.mode === "prompt";
  const showPrompts = promptMode && lastState.tvShow === "prompt";
  const showFrames = !promptMode || lastState.tvShow === "result";
  const focused = lastState.focus === 1 || lastState.focus === 2;

  document.body.classList.toggle("focus-1", lastState.focus === 1);
  document.body.classList.toggle("focus-2", lastState.focus === 2);

  prompt1.hidden = !showPrompts;
  prompt2.hidden = !showPrompts;
  player1Result.hidden = !showFrames;
  player2Result.hidden = !showFrames;

  if (showPrompts) {
    setPromptText(prompt1, lastCodes[1] || "…");
    setPromptText(prompt2, lastCodes[2] || "…");
  }
  if (showFrames) {
    player1Result.srcdoc = renderHtml(promptMode ? htmls[1] : lastCodes[1]);
    player2Result.srcdoc = renderHtml(promptMode ? htmls[2] : lastCodes[2]);
  }
  if (focused) updateFocusScale();
}

function updateFocusScale(): void {
  const s = Math.min((innerHeight * 0.8) / 800, (innerWidth * 0.95) / 600, 2);
  document.documentElement.style.setProperty("--focus-scale", String(s));
}

addEventListener("resize", () => {
  if (lastState.focus === 1 || lastState.focus === 2) updateFocusScale();
});

function onState(state: GameState): void {
  lastState = state;
  renderTimer();
  title1.textContent = state.players[1];
  title2.textContent = state.players[2];
  if (state.taskId !== currentTaskId) {
    currentTaskId = state.taskId;
    setRef();
    player1Result.srcdoc = "";
    player2Result.srcdoc = "";
    lastCodes = { 1: "", 2: "" };
    stopSpeaking();
  }
  if (state.codes[1] !== lastCodes[1]) {
    lastCodes[1] = state.codes[1];
  }
  if (state.codes[2] !== lastCodes[2]) {
    lastCodes[2] = state.codes[2];
  }
  renderColumns();
}

function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

function speak(player: Player): void {
  const text = lastCodes[player];
  if (!text.trim()) return;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

setInterval(renderTimer, 100);
