import { createBareServer } from "@tomphttp/bare-server-node";
import { createServer } from "http";

const bare = createBareServer("/", { logErrors: true });

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
    res.end(JSON.stringify({ status: "ok" }));
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// Keep Render free tier awake - ping self every 14 minutes
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL) {
  setInterval(() => {
    import("https").then(({ default: https }) => {
      https.get(SELF_URL, (res) => {
        console.log("Keep-alive ping:", res.statusCode);
      }).on("error", (e) => console.error("Ping error:", e.message));
    });
  }, 14 * 60 * 1000);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => console.log("Bare server on port", PORT));
