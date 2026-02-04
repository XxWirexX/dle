const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dle.db'));

// Initialisation des tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anime_id TEXT NOT NULL,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    duo_played INTEGER DEFAULT 0,
    duo_wins INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, anime_id)
  );
`);

// Migration: ajouter les nouvelles colonnes si elles n'existent pas
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN duo_played INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN duo_wins INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN total_attempts INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }

// Migration avatars
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_color TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_image TEXT`);
} catch (e) { /* colonne existe déjà */ }

// Générer une couleur aléatoire pour l'avatar
function generateRandomColor() {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Fonctions utilisateurs
function createUser(email, passwordHash, username) {
  const avatarColor = generateRandomColor();
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash, username, avatar_color) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(email, passwordHash, username, avatarColor);
  return { id: result.lastInsertRowid, avatarColor };
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function findUserById(id) {
  const stmt = db.prepare('SELECT id, email, username, created_at, avatar_color, avatar_image FROM users WHERE id = ?');
  return stmt.get(id);
}

function updateUserAvatar(userId, avatarImage) {
  const stmt = db.prepare('UPDATE users SET avatar_image = ? WHERE id = ?');
  stmt.run(avatarImage, userId);
}

// Fonctions stats
function getStats(userId, animeId) {
  const stmt = db.prepare(
    'SELECT * FROM user_stats WHERE user_id = ? AND anime_id = ?'
  );
  const stats = stmt.get(userId, animeId);

  if (!stats) {
    return {
      games_played: 0,
      wins: 0,
      current_streak: 0,
      max_streak: 0,
      duo_played: 0,
      duo_wins: 0,
      total_attempts: 0
    };
  }

  return stats;
}

function getAllStatsForUser(userId) {
  const stmt = db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
  return stmt.all(userId);
}

function updateStats(userId, animeId, won, isDuo = false, attempts = 0) {
  // Récupérer les stats actuelles
  const current = getStats(userId, animeId);

  const gamesPlayed = current.games_played + 1;
  const wins = current.wins + (won ? 1 : 0);
  const currentStreak = won ? current.current_streak + 1 : 0;
  const maxStreak = Math.max(current.max_streak, currentStreak);
  const duoPlayed = current.duo_played + (isDuo ? 1 : 0);
  const duoWins = current.duo_wins + (isDuo && won ? 1 : 0);
  const totalAttempts = current.total_attempts + attempts;

  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, anime_id, games_played, wins, current_streak, max_streak, duo_played, duo_wins, total_attempts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      games_played = excluded.games_played,
      wins = excluded.wins,
      current_streak = excluded.current_streak,
      max_streak = excluded.max_streak,
      duo_played = excluded.duo_played,
      duo_wins = excluded.duo_wins,
      total_attempts = excluded.total_attempts
  `);

  stmt.run(userId, animeId, gamesPlayed, wins, currentStreak, maxStreak, duoPlayed, duoWins, totalAttempts);

  return {
    games_played: gamesPlayed,
    wins: wins,
    current_streak: currentStreak,
    max_streak: maxStreak,
    duo_played: duoPlayed,
    duo_wins: duoWins,
    total_attempts: totalAttempts
  };
}

module.exports = {
  db,
  createUser,
  findUserByEmail,
  findUserById,
  updateUserAvatar,
  getStats,
  getAllStatsForUser,
  updateStats
};
