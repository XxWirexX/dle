require("dotenv").config();
const PORT = process.env.PORT || 3000;

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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

app.get("/api/animes", (req, res) => {
    const dossier = path.join(__dirname, "data");

    const fichiers = fs.readdirSync(dossier);
    const fichiersJson = fichiers.filter(f => f.endsWith(".json"));

    const objets = fichiersJson.map(fichier => {
        const contenu = fs.readFileSync(path.join(dossier, fichier), "utf-8");
        return JSON.parse(contenu);
    });


    res.send(objets)
});

app.get("/api/anime/:id", (req, res) => {
  const id = req.params.id;
  const dossier = path.join(__dirname, "data");
  const cheminFichier = path.join(dossier, `${id}.json`);

  if (!fs.existsSync(cheminFichier)) {
    return res.status(404).send("Anime introuvable");
  }

  const contenu = fs.readFileSync(cheminFichier, "utf-8");
  const objet = JSON.parse(contenu);

  res.json(objet);
});


// En production, servir le frontend build
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendPath));

  // Toutes les routes non-API renvoient vers index.html (pour React Router)
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(frontendPath, "index.html"));
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Socket.IO enabled for multiplayer`);
  console.log(`Mode: ${process.env.NODE_ENV || "development"}`);
});
