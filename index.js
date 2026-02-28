import { createBareServer } from "@tomphttp/bare-server-node";
import { createServer } from "http";

const bare = createBareServer("/", {
  logErrors: true,
});

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "bare" }));
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.on("error", (err) => console.error("Server error:", err));

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => console.log("Bare server on port", PORT));
