import { createServer } from "node:http";
import express from "express";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { GameManager } from "./lib/game-manager.js";
import { IMAGES_DIR, getTasks, checkTask } from "./lib/tasks.js";
import { checkAdminPassword } from "./lib/password.js";

dotenv.config({ path: "../.env" });

const game = new GameManager();
const app = express();
const PORT = process.env.SERVER_PORT || 4747;

app.use("/tasks", express.static(IMAGES_DIR));

if (process.env.NODE_ENV !== "development") {
  app.use("/", express.static("../client/dist"));
}

app.use((req, res) => res.status(404).send("Not found"));

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

function send(socket, msg) {
  socket.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

wss.on("connection", (socket) => {
  send(socket, { type: "state", state: game.getState() });
  getTasks().then((tasks) =>
    send(socket, {
      type: "tasks",
      tasks: tasks.map((x) => ({ name: x, url: `/tasks/${x}` })),
    }),
  );

  socket.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(socket, { type: "error", message: "Invalid message" });
    }

    if (msg.type === "start") {
      const { taskId, duration, password } = msg;
      if (!checkAdminPassword(password)) {
        return send(socket, {
          type: "error",
          message: "Invalid admin password",
        });
      }
      if (!(await checkTask(taskId)) || !Number(duration)) {
        return send(socket, { type: "error", message: "Bad task or duration" });
      }
      game.start(taskId, Number(duration));
      send(socket, { type: "started", taskId, duration: Number(duration) });
      return broadcast({ type: "state", state: game.getState() });
    }

    if (msg.type === "code") {
      const { player, code } = msg;
      if ((player !== 1 && player !== 2) || typeof code !== "string") {
        return send(socket, { type: "error", message: "Invalid code data" });
      }
      game.submitCode(player, code);
      return broadcast({ type: "state", state: game.getState() });
    }

    if (msg.type === "getTasks") {
      return getTasks().then((tasks) =>
        send(socket, {
          type: "tasks",
          tasks: tasks.map((x) => ({ name: x, url: `/tasks/${x}` })),
        }),
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`\x1b[1mListening on http://localhost:${PORT}\x1b[0m`);
});
