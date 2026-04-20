require("dotenv").config();
const PORT = process.env.PORT || 3000;

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO avec CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const fs = require("fs");
const path = require("path");
const { toListItem, toDetail, toGame, toAvatarGroup } = require("./mappers/animeMapper");

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Désactivé pour permettre le chargement des images
}));

// Middleware JSON
app.use(express.json());

// Routes d'authentification
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes");
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);

// Setup Socket.IO handlers
const setupSocketHandlers = require("./socket/socketHandler");
setupSocketHandlers(io);

app.use("/api/images", express.static(path.join(__dirname, "public/images")));

// ── Cache mémoire : tous les JSONs parsés une seule fois au démarrage ──
const gameCache = new Map();
(function loadCache() {
  const dossier = path.join(__dirname, "data");
  fs.readdirSync(dossier)
    .filter(f => f.endsWith(".json"))
    .forEach(fichier => {
      const data = JSON.parse(fs.readFileSync(path.join(dossier, fichier), "utf-8"));
      gameCache.set(data.id, data);
    });
  console.log(`Game cache loaded (${gameCache.size} animes)`);
})();

app.get("/api/animes", (req, res) => {
  res.json(Array.from(gameCache.values()).map(toListItem));
});

// Avatar picker : tous les animes avec leurs 10 premiers persos (id/name/image)
app.get("/api/animes/avatars", (req, res) => {
  res.json(Array.from(gameCache.values()).map(toAvatarGroup));
});

app.get("/api/anime/:id", (req, res) => {
  const data = gameCache.get(req.params.id);
  if (!data) return res.status(404).json({ error: "Anime introuvable" });

  if (req.query.view === "detail") {
    return res.json(toDetail(data));
  }

  res.json(toGame(data));
});

app.get("/api/daily/:id", (req, res) => {
  const id = req.params.id;
  const data = gameCache.get(id);
  if (!data) return res.status(404).json({ error: "Anime introuvable" });

  const characters = data.characters || [];

  if (characters.length === 0) {
    return res.status(400).json({ error: "Pas de personnages" });
  }

  // Date du jour UTC (même perso pour tout le monde dans le monde)
  const dateStr = new Date().toISOString().split('T')[0];

  // Hash déterministe : même seed = même perso
  const seed = `${id}-${dateStr}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
  }
  const index = Math.abs(hash) % characters.length;

  // Numéro du jour depuis le 01/01/2024
  const epoch = new Date('2024-01-01T00:00:00Z');
  const today = new Date(dateStr + 'T00:00:00Z');
  const dayNumber = Math.floor((today - epoch) / (1000 * 60 * 60 * 24));

  res.json({ characterIndex: index, date: dateStr, dayNumber });
});


server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Socket.IO enabled for multiplayer`);
});
