import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const { readFileSync, writeFileSync, existsSync } = fs;

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(join(__dirname, "public")));

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || "changeme";
const USE_REDIS   = !!(REDIS_URL && REDIS_TOKEN);

// ── LOCAL FILE FALLBACK (for self-hosters without Redis) ──
const DATA_FILE = "/tmp/data.json";

function readData() {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {}
  return { pending: [], approved: [] };
}

function writeData(data) {
  try { writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// ── REDIS HELPERS ──
async function redisCmd(...args) {
  if (!USE_REDIS) return null;
  try {
    const res = await fetch(`${REDIS_URL}/${args.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    return (await res.json()).result;
  } catch { return null; }
}

// ── UNIFIED GET/SET that works with both Redis and local file ──
async function getPending() {
  if (USE_REDIS) {
    try {
      const ids = await redisCmd("lrange", "pending", "0", "-1");
      if (!ids?.length) return [];
      const games = await Promise.all(ids.map(id => redisCmd("get", `game:${id}`)));
      return games.filter(Boolean).map(g => JSON.parse(g));
    } catch { return []; }
  }
  return readData().pending;
}

async function getApproved() {
  if (USE_REDIS) {
    try {
      const ids = await redisCmd("lrange", "approved", "0", "-1");
      if (!ids?.length) return [];
      const games = await Promise.all(ids.map(id => redisCmd("get", `game:${id}`)));
      return games.filter(Boolean).map(g => JSON.parse(g));
    } catch { return []; }
  }
  return readData().approved;
}

async function addPending(game) {
  if (USE_REDIS) {
    await redisCmd("set", `game:${game.id}`, JSON.stringify(game));
    await redisCmd("rpush", "pending", game.id);
  } else {
    const data = readData();
    data.pending.push(game);
    writeData(data);
  }
}

async function approveGame(id) {
  if (USE_REDIS) {
    const raw = await redisCmd("get", `game:${id}`);
    if (!raw) return false;
    await redisCmd("lrem", "pending", "0", id);
    await redisCmd("rpush", "approved", id);
    return true;
  } else {
    const data = readData();
    const idx = data.pending.findIndex(g => g.id === id);
    if (idx === -1) return false;
    const [game] = data.pending.splice(idx, 1);
    data.approved.push(game);
    writeData(data);
    return true;
  }
}

async function denyGame(id) {
  if (USE_REDIS) {
    await redisCmd("lrem", "pending", "0", id);
    await redisCmd("del", `game:${id}`);
  } else {
    const data = readData();
    data.pending = data.pending.filter(g => g.id !== id);
    writeData(data);
  }
}

// ── ROUTES ──
app.get("/g",     (_req, res) => res.sendFile(join(__dirname, "public/games.html")));
app.get("/m",     (_req, res) => res.sendFile(join(__dirname, "public/media.html")));
app.get("/s",     (_req, res) => res.sendFile(join(__dirname, "public/settings.html")));
app.get("/admin", (_req, res) => res.sendFile(join(__dirname, "public/admin.html")));

app.get("/api/games", async (_req, res) => {
  try {
    let base = [];
    try {
      base = JSON.parse(readFileSync(join(__dirname, "public/games/games-list.json"), "utf8"));
    } catch {}
    const approved = await getApproved();
    res.json([...base, ...approved]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public read-only endpoint — forks call this to get approved community games
// No auth needed, CORS open so any domain can fetch it
// Handle CORS preflight for all /api routes
app.options("/api/*", (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

app.get("/api/community-games", async (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  try {
    const approved = await getApproved();
    res.json(approved);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/submit", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  try {
    const { title, url, blobContent, thumbnail } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    if (!url && !blobContent) return res.status(400).json({ error: "url or html required" });
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const game = { id, title, url: url||null, blobContent: blobContent||null, thumbnail: thumbnail||null, submittedAt: new Date().toISOString() };
    await addPending(game);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function auth(req, res, next) {
  if (req.headers["x-admin-password"] !== ADMIN_PASS) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/api/admin/pending",        auth, async (_req, res) => { try { res.json(await getPending()); } catch(e) { res.status(500).json({error:e.message}); } });
app.post("/api/admin/approve/:id",   auth, async (req, res)  => { try { const ok = await approveGame(req.params.id); ok ? res.json({ok:true}) : res.status(404).json({error:"not found"}); } catch(e) { res.status(500).json({error:e.message}); } });
app.post("/api/admin/deny/:id",      auth, async (req, res)  => { try { await denyGame(req.params.id); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });

app.use("*", (_req, res) => res.sendFile(join(__dirname, "public/index.html")));

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => console.log(`Running on ${port}`));
}

export default app;
