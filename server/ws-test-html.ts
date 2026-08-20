import http from "node:http";
import { readFile, rm } from "node:fs/promises";
import WebSocket from "ws";

const ai = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const parsed = JSON.parse(body);
    const system = parsed.messages.find((m: { role: string }) => m.role === "system").content;
    if (!String(system).includes("600x800")) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "missing 600x800 constraint" }));
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: "```html\n<div>hello worl</div>\n```" } }],
      }),
    );
  });
});
await new Promise<void>((r) => ai.listen(9999, r));

process.env.AI_BASE_URL = "http://localhost:9999/v1";
process.env.OPENAI_API_KEY = "mock";
process.env.AI_MODEL = "mock-model";

const server = (await import("./index.ts")) as unknown as {
  game: { getHtmls: () => Record<number, string> };
  startServer: (port: number) => Promise<{ port: number; close: () => Promise<void> }>;
};
const { game } = server;
const { port, close } = await server.startServer(0);

function connect(): Promise<{
  ws: WebSocket;
  next: (type: string, match?: (m: Record<string, unknown>) => boolean) => Promise<unknown>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const queue: unknown[] = [];
    const waiters: Array<{
      type: string;
      match?: (m: Record<string, unknown>) => boolean;
      timer: ReturnType<typeof setTimeout>;
      resolve: (v: unknown) => void;
    }> = [];
    ws.on("message", (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      const idx = waiters.findIndex((w) => w.type === msg.type && (!w.match || w.match(msg)));
      if (idx >= 0) {
        const [w] = waiters.splice(idx, 1);
        clearTimeout(w.timer);
        w.resolve(msg);
      } else {
        queue.push(msg);
      }
    });
    ws.on("open", () => {
      resolve({
        ws,
        next: (type: string, match?: (m: Record<string, unknown>) => boolean) =>
          new Promise((resolveNext, rejectNext) => {
            const idx = queue.findIndex(
              (m) =>
                (m as { type: string }).type === type &&
                (!match || match(m as Record<string, unknown>)),
            );
            if (idx >= 0) {
              const [m] = queue.splice(idx, 1);
              resolveNext(m);
              return;
            }
            const timer = setTimeout(
              () => rejectNext(new Error(`timeout waiting for ${type}`)),
              3000,
            );
            waiters.push({ type, match, timer, resolve: resolveNext });
          }),
      });
    });
    ws.on("error", reject);
  });
}

let failed = false;
function check(cond: boolean, label: string): void {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) failed = true;
}

const { ws: adminWs, next: adminNext } = await connect();
const { ws: player1Ws, next: player1Next } = await connect();

await player1Next("state");
await player1Next("htmls");

adminWs.send(
  JSON.stringify({ type: "start", taskId: "accounts.png", duration: 60, password: "pass" }),
);
await adminNext("started");
const stateAfterStart = (await player1Next("state")) as { state: { mode: string } };
check(stateAfterStart.state.mode === "prompt", "default mode is prompt");

const tick1 = (await player1Next("tick")) as { remainingMs: number };
await new Promise((r) => setTimeout(r, 500));
const tick2 = (await player1Next("tick")) as { remainingMs: number };
check(tick1.remainingMs > tick2.remainingMs, "ticks broadcast and count down");

adminWs.send(JSON.stringify({ type: "renamePlayer", player: 1, name: "Alice", password: "pass" }));
const renamed = (await player1Next(
  "state",
  (m) => (m.state as { players: Record<number, string> }).players[1] === "Alice",
)) as {
  state: { players: Record<number, string> };
};
check(renamed.state.players[1] === "Alice", "player renamed and broadcast");

adminWs.send(JSON.stringify({ type: "renamePlayer", player: 1, name: "   ", password: "pass" }));
const nameErr = (await adminNext("error")) as { message: string };
check(nameErr.message.includes("empty"), "empty name rejected");

player1Ws.send(JSON.stringify({ type: "code", player: 1, code: "hello world" }));
let st = (await adminNext(
  "state",
  (m) => (m.state as { codes: Record<number, string> }).codes[1] === "hello world",
)) as {
  state: { codes: Record<number, string> };
};
check(st.state.codes[1] === "hello world", "code saved, no auto-generation");
await new Promise((r) => setTimeout(r, 2000));
check(game.getHtmls()[1] === "", "no html generated automatically");

adminWs.send(JSON.stringify({ type: "generateHtml", player: 1, password: "pass" }));
await adminNext("generateStarted");
const htmlMsg = (await adminNext(
  "htmls",
  (m) => (m.htmls as Record<number, string>)[1] !== "",
)) as {
  htmls: Record<number, string>;
};
check(htmlMsg.htmls[1] === "<div>hello worl</div>", "markdown fences stripped from html");
check(game.getHtmls()[1] === "<div>hello worl</div>", "html stored in game manager");

adminWs.send(JSON.stringify({ type: "generateHtml", player: 2, password: "bad" }));
const err = (await adminNext("error")) as { message: string };
check(err.message.includes("Invalid"), "bad password rejected");

adminWs.send(JSON.stringify({ type: "generateHtml", player: 2, password: "pass" }));
await adminNext("generateStarted");
const emptyErr = (await adminNext("error")) as { message: string };
check(emptyErr.message.includes("empty"), "empty prompt reported as error");

adminWs.send(JSON.stringify({ type: "focus", player: 1, password: "pass" }));
const focused = (await player1Next(
  "state",
  (m) => (m.state as { focus: unknown }).focus === 1,
)) as { state: { focus: number | string } };
check(focused.state.focus === 1, "focus player 1 broadcast");

adminWs.send(JSON.stringify({ type: "focus", player: "none", password: "pass" }));
const unfocused = (await player1Next(
  "state",
  (m) => (m.state as { focus: unknown }).focus === "none",
)) as { state: { focus: number | string } };
check(unfocused.state.focus === "none", "focus none broadcast");

adminWs.send(JSON.stringify({ type: "confetti", password: "pass" }));
await player1Next("confetti");
check(true, "confetti broadcast works");

await rm("data/results-4747.json", { force: true });
adminWs.send(JSON.stringify({ type: "stop", password: "pass" }));
await new Promise((r) => setTimeout(r, 200));
const saved = JSON.parse(await readFile("data/results-4747.json", "utf8")) as Array<{
  taskId: string;
  mode: string;
  players: Record<number, { name: string; code: string; html: string }>;
}>;
check(saved.length === 1, "round saved to results.json");
check(saved[0].mode === "prompt", "saved round has correct mode");
check(saved[0].players[1].code === "hello world", "saved player code");
check(saved[0].players[1].html === "<div>hello worl</div>", "saved generated html");
check(saved[0].players[1].name === "Alice", "saved player name");
await rm("data/results-4747.json", { force: true });

adminWs.send(JSON.stringify({ type: "clearCodes", password: "pass" }));
const cleared = (await adminNext(
  "state",
  (m) => (m.state as { codes: Record<number, string> }).codes[1] === "",
)) as {
  state: { codes: Record<number, string> };
};
check(
  cleared.state.codes[1] === "" && cleared.state.codes[2] === "",
  "clearCodes empties both players",
);

adminWs.close();
player1Ws.close();
await close();
ai.close();
process.exit(failed ? 1 : 0);
