import type { ClientMessage, ServerMessage } from "../types.ts";

export interface SocketHandle {
  send: (data: ClientMessage | string) => void;
  close: () => void;
}

export function connectSocket(
  onMessage: (msg: ServerMessage) => void,
): SocketHandle {
  let ws: WebSocket | null = null;
  let closed = false;

  function open(): void {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${location.host}/ws`);

    ws.addEventListener("message", (event) => {
      try {
        onMessage(JSON.parse(event.data) as ServerMessage);
      } catch (e) {
        console.error(e);
      }
    });

    ws.addEventListener("error", () => ws?.close());

    ws.addEventListener("close", () => {
      if (!closed) setTimeout(open, 1000);
    });
  }

  open();

  return {
    send(data: ClientMessage | string) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}