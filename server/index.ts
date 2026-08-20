import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import type { AddressInfo } from "node:net";
import express from "express";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import {
  GameManager,
  type Player,
  type PlayerFocus,
  type GameState,
  type GameMode,
  type TvShow,
} from "./lib/game-manager.ts";
import { generateHtml } from "./lib/ai.ts";
import { IMAGES_DIR, getTasks, checkTask } from "./lib/tasks.ts";
import { checkAdminPassword } from "./lib/password.ts";
import { saveRound } from "./lib/results.ts";

dotenv.config({ path: "../.env" });

const game = new GameManager();
export { game };
const app = express();
const PORT = Number(process.env["SERVER_PORT"]) || 4747;

app.use("/tasks", express.static(IMAGES_DIR));

if (process.env["NODE_ENV"] !== "development") {
  app.use("/", express.static("../client/dist"));
}

app.use((_req, res) => {
  res.status(404).send("Not found");
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

interface TaskInfo {
  name: string;
  url: string;
}

type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "tasks"; tasks: TaskInfo[] }
  | { type: "started"; taskId: string; duration: number }
  | { type: "generateStarted"; player: Player }
  | { type: "htmls"; htmls: Record<Player, string> }
  | { type: "speak"; player: Player }
  | { type: "stopSpeak" }
  | { type: "error"; message: string }
  | { type: "confetti" }
  | { type: "tick"; remainingMs: number; sentAt: number };

type ClientMessage =
  | { type: "start"; taskId: string; duration: number; mode?: GameMode; password: string }
  | { type: "pause"; password: string }
  | { type: "resume"; password: string }
  | { type: "adjustTime"; delta: number; password: string }
  | { type: "stop"; password: string }
  | { type: "tvShow"; show: TvShow; password: string }
  | { type: "focus"; player: PlayerFocus; password: string }
  | { type: "speak"; player: Player; password: string }
  | { type: "stopSpeak"; password: string }
  | { type: "generateHtml"; player: Player; password: string }
  | { type: "renamePlayer"; player: Player; name: string; password: string }
  | { type: "clearCodes"; password: string }
  | { type: "code"; player: Player; code: string }
  | { type: "getTasks" }
  | { type: "confetti"; password: string };

function toTaskInfos(tasks: string[]): TaskInfo[] {
  return tasks.map((name) => ({ name, url: `/tasks/${name}` }));
}

function send(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

setInterval(() => {
  const state = game.getState();
  if (!state.taskId) return;
  const anchor = state.paused && state.pausedAt !== null ? state.pausedAt : Date.now();
  const remainingMs = Math.max(0, state.duration * 1000 - (anchor - state.startAt));
  broadcast({ type: "tick", remainingMs, sentAt: Date.now() });
}, 100);

function parseMessage(raw: RawData): ClientMessage | null {
  let text: string;
  try {
    text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(text) as ClientMessage & { type?: unknown };
    if (!data || typeof data.type !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

wss.on("connection", (socket) => {
  send(socket, { type: "state", state: game.getState() });
  send(socket, { type: "htmls", htmls: game.getHtmls() });
  getTasks().then((tasks) => send(socket, { type: "tasks", tasks: toTaskInfos(tasks) }));

  socket.on("message", async (raw) => {
    const msg = parseMessage(raw);
    if (!msg) {
      send(socket, { type: "error", message: "Invalid message" });
      return;
    }

    if (msg.type === "start") {
      const { taskId, duration, password } = msg;
      if (!checkAdminPassword(password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (!(await checkTask(taskId)) || !Number(duration)) {
        send(socket, { type: "error", message: "Bad task or duration" });
        return;
      }
      game.start(taskId, Number(duration), msg.mode === "code" ? "code" : "prompt");
      send(socket, { type: "started", taskId, duration: Number(duration) });
      broadcast({ type: "state", state: game.getState() });
      broadcast({ type: "htmls", htmls: game.getHtmls() });
      return;
    }

    if (msg.type === "pause" || msg.type === "resume" || msg.type === "stop") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (msg.type === "pause") game.pause();
      else if (msg.type === "resume") game.resume();
      else {
        game.stop();
        const state = game.getState();
        const startedAt = game.getRoundStartedAt() ?? Date.now();
        if (state.taskId) {
          await saveRound({
            taskId: state.taskId,
            startedAt,
            endedAt: Date.now(),
            mode: state.mode,
            duration: state.duration,
            players: {
              1: { name: state.players[1], code: state.codes[1], html: game.getHtmls()[1] },
              2: { name: state.players[2], code: state.codes[2], html: game.getHtmls()[2] },
            },
          });
        }
      }
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "clearCodes") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      game.clearCodes();
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "adjustTime") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      const delta = Number(msg.delta);
      if (!Number.isFinite(delta)) {
        send(socket, { type: "error", message: "Bad time delta" });
        return;
      }
      game.adjustTime(delta);
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "confetti") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      broadcast({ type: "confetti" });
      return;
    }

    if (msg.type === "tvShow") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      game.setTvShow(msg.show === "result" ? "result" : "prompt");
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "focus") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      const focus = msg.player === 1 || msg.player === 2 ? msg.player : "none";
      game.setFocus(focus);
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "speak" || msg.type === "stopSpeak") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (msg.type === "speak") {
        if (msg.player !== 1 && msg.player !== 2) {
          send(socket, { type: "error", message: "Invalid player" });
          return;
        }
        broadcast({ type: "speak", player: msg.player });
      } else {
        broadcast({ type: "stopSpeak" });
      }
      return;
    }

    if (msg.type === "generateHtml") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (msg.player !== 1 && msg.player !== 2) {
        send(socket, { type: "error", message: "Invalid player" });
        return;
      }
      const prompt = game.getState().codes[msg.player];
      send(socket, { type: "generateStarted", player: msg.player });
      const result = await generateHtml(prompt);
      if ("html" in result) {
        game.setHtml(msg.player, result.html);
        broadcast({ type: "htmls", htmls: game.getHtmls() });
      } else {
        send(socket, { type: "error", message: result.error });
      }
      return;
    }

    if (msg.type === "renamePlayer") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (msg.player !== 1 && msg.player !== 2) {
        send(socket, { type: "error", message: "Invalid player" });
        return;
      }
      const name = typeof msg.name === "string" ? msg.name.trim().slice(0, 40) : "";
      if (!name) {
        send(socket, { type: "error", message: "Player name cannot be empty" });
        return;
      }
      game.renamePlayer(msg.player, name);
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "code") {
      const { player, code } = msg;
      if ((player !== 1 && player !== 2) || typeof code !== "string") {
        send(socket, { type: "error", message: "Invalid code data" });
        return;
      }
      game.submitCode(player, code);
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "getTasks") {
      const tasks = await getTasks();
      send(socket, { type: "tasks", tasks: toTaskInfos(tasks) });
    }
  });
});

function getExternalAddress(): string | null {
  const skipNames =
    /^(utun|tun|tap|awdl|llw|vnic|vmnet|docker|br-|veth|tailscale|virbr|vEthernet|bridge|ap\d)/i;
  const skipIps = /^(169\.254\.|198\.18\.|198\.19\.)/;
  const candidates: string[] = [];
  for (const [name, infos] of Object.entries(networkInterfaces())) {
    if (skipNames.test(name)) continue;
    for (const info of infos ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (skipIps.test(info.address)) continue;
      candidates.push(info.address);
    }
  }
  return candidates[0] ?? null;
}

export async function startServer(
  port = PORT,
): Promise<{ port: number; close: () => Promise<void> }> {
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const actualPort = (server.address() as AddressInfo).port;
  const network = getExternalAddress();
  console.log(`\x1b[1m➜  Local:   http://localhost:${actualPort}/\x1b[0m`);
  if (network) console.log(`\x1b[1m➜  Network: http://${network}:${actualPort}/\x1b[0m`);
  return {
    port: actualPort,
    close: () =>
      new Promise((resolve) => {
        wss.close();
        server.close(() => resolve());
      }),
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  await startServer();
}
