export function connectSocket(onMessage) {
  let ws = null;
  let closed = false;

  function open() {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${location.host}/ws`);

    ws.addEventListener("message", (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (e) {
        console.error(e);
      }
    });

    ws.addEventListener("error", () => ws.close());

    ws.addEventListener("close", () => {
      if (!closed) setTimeout(open, 1000);
    });
  }

  open();

  return {
    send(data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
    close() {
      closed = true;
      if (ws) ws.close();
    },
  };
}
