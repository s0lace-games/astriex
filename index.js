import { createServer } from "http";
import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bare = createBareServer("/bare/");
const app = express();

app.use(express.static(join(__dirname, "public")));
app.use("*", (req, res) => {
  res.sendFile(join(__dirname, "public/index.html"));
});

const server = createServer();
server.on("request", (req, res) => {
  if (bare.shouldRoute(req)) bare.routeRequest(req, res);
  else app(req, res);
});
server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) bare.routeUpgrade(req, socket, head);
  else socket.destroy();
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Running on port", process.env.PORT || 3000)
);

export default app;
