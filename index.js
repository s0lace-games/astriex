import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(join(__dirname, "public")));
app.use("*", (_req, res) => {
  res.sendFile(join(__dirname, "public/index.html"));
});

export default app;
