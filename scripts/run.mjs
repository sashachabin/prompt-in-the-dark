import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);
const isDev = command === "dev";

function parsePort(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null;
}

let serverPort = null;
let clientPort = null;
for (const arg of rest) {
  const eq = arg.indexOf("=");
  const isFlag = arg.startsWith("--");
  const key = isFlag ? (eq >= 0 ? arg.slice(2, eq) : arg.slice(2)) : "";
  const val = eq >= 0 ? arg.slice(eq + 1) : null;
  if (isFlag && key === "port") {
    const n = parsePort(val);
    if (n !== null) {
      if (isDev) clientPort = n;
      else serverPort = n;
    } else {
      console.warn(`Ignoring invalid port "${val}"`);
    }
  } else if (isFlag && key === "server-port") {
    const n = parsePort(val);
    if (n !== null) serverPort = n;
    else console.warn(`Ignoring invalid server port "${val}"`);
  } else if (isFlag && key === "client-port") {
    const n = parsePort(val);
    if (n !== null) clientPort = n;
    else console.warn(`Ignoring invalid client port "${val}"`);
  } else if (!isFlag) {
    const n = parsePort(arg);
    if (n !== null) {
      if (isDev) clientPort = n;
      else serverPort = n;
    } else {
      console.warn(`Ignoring invalid port "${arg}"`);
    }
  }
}

if (serverPort) process.env.SERVER_PORT = String(serverPort);
if (clientPort) process.env.CLIENT_DEV_PORT = String(clientPort);

const target = command === "start" ? "start:core" : command === "dev" ? "dev:core" : null;
if (!target) {
  console.error("Usage: npm run <start|dev> -- [--port N] [--server-port N] [--client-port N]");
  process.exit(1);
}
if (clientPort) console.log(`CLIENT_DEV_PORT=${clientPort}`);
if (serverPort) console.log(`SERVER_PORT=${serverPort}`);

const child = spawn("npm", ["run", target], { stdio: "inherit", cwd: import.meta.dirname });
child.on("exit", (code) => process.exit(code ?? 1));
