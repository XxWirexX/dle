// @ts-nocheck
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { toListItem, toDetail, toGame, toAvatarGroup } from './mappers/animeMapper';
import authRoutes from './routes/authRoutes';
import statsRoutes from './routes/statsRoutes';
import setupSocketHandlers from './socket/socketHandler';
import { AppError } from './errors/AppError';

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);

setupSocketHandlers(io);

app.use('/api/images', express.static(path.join(__dirname, '../../public/images')));

const gameCache = new Map<string, Record<string, unknown>>();
(function loadCache() {
  const dossier = path.join(__dirname, '../data');
  fs.readdirSync(dossier)
    .filter(f => f.endsWith('.json'))
    .forEach(fichier => {
      const data = JSON.parse(fs.readFileSync(path.join(dossier, fichier), 'utf-8'));
      gameCache.set(data.id as string, data);
    });
  console.log(`Game cache loaded (${gameCache.size} animes)`);
})();

app.get('/api/animes', (_req: Request, res: Response) => {
  res.json(Array.from(gameCache.values()).map(toListItem));
});

app.get('/api/animes/avatars', (_req: Request, res: Response) => {
  res.json(Array.from(gameCache.values()).map(toAvatarGroup));
});

app.get('/api/anime/:id', (req: Request, res: Response) => {
  const data = gameCache.get(req.params.id);
  if (!data) return res.status(404).json({ error: 'Anime introuvable' });

  if (req.query.view === 'detail') {
    return res.json(toDetail(data));
  }

  res.json(toGame(data));
});

app.get('/api/daily/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const data = gameCache.get(id);
  if (!data) return res.status(404).json({ error: 'Anime introuvable' });

  const characters = (data.characters as unknown[]) || [];
  if (characters.length === 0) {
    return res.status(400).json({ error: 'Pas de personnages' });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const seed = `${id}-${dateStr}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
  }
  const index = Math.abs(hash) % characters.length;

  const epoch = new Date('2024-01-01T00:00:00Z');
  const today = new Date(dateStr + 'T00:00:00Z');
  const dayNumber = Math.floor((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));

  res.json({ characterIndex: index, date: dateStr, dayNumber });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur', code: 'INTERNAL_ERROR' });
});

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log('Socket.IO enabled for multiplayer');
});
