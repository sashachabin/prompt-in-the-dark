import { createServer } from "node:http";
import express from "express";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { GameManager, type Player, type GameState } from "./lib/game-manager.ts";
import { IMAGES_DIR, getTasks, checkTask } from "./lib/tasks.ts";
import { checkAdminPassword } from "./lib/password.ts";

dotenv.config({ path: "../.env" });

const game = new GameManager();
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
  | { type: "error"; message: string }
  | { type: "confetti" };

type ClientMessage =
  | { type: "start"; taskId: string; duration: number; password: string }
  | { type: "pause"; password: string }
  | { type: "resume"; password: string }
  | { type: "adjustTime"; delta: number; password: string }
  | { type: "stop"; password: string }
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
      game.start(taskId, Number(duration));
      send(socket, { type: "started", taskId, duration: Number(duration) });
      broadcast({ type: "state", state: game.getState() });
      return;
    }

    if (msg.type === "pause" || msg.type === "resume" || msg.type === "stop") {
      if (!checkAdminPassword(msg.password)) {
        send(socket, { type: "error", message: "Invalid admin password" });
        return;
      }
      if (msg.type === "pause") game.pause();
      else if (msg.type === "resume") game.resume();
      else game.stop();
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

server.listen(PORT, () => {
  console.log(`\x1b[1mListening on http://localhost:${PORT}\x1b[0m`);
});
