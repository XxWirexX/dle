// @ts-nocheck
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const db = new Database(path.join(__dirname, '../../db/dle.db'));

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

  CREATE TABLE IF NOT EXISTS custom_dles (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon_url TEXT,
    icon_public_id TEXT,
    background_url TEXT,
    background_public_id TEXT,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    attributes TEXT NOT NULL,
    characters TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
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

// Migration daily challenge
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN daily_played INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN daily_wins INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN daily_streak INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN daily_max_streak INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE user_stats ADD COLUMN last_daily_date TEXT`);
} catch (e) { /* colonne existe déjà */ }

// Migration avatars
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_color TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_image TEXT`);
} catch (e) { /* colonne existe déjà */ }

// Migration username unique
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
} catch (e) { /* index existe déjà */ }

// Migration email verification
try {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN verification_token_expires DATETIME`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`);
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

// Générer un token sécurisé
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Fonctions utilisateurs
function createUser(email, passwordHash, username) {
  const avatarColor = generateRandomColor();
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  const stmt = db.prepare(
    `INSERT INTO users (email, password_hash, username, avatar_color, email_verified, verification_token, verification_token_expires)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  );
  const result = stmt.run(email, passwordHash, username, avatarColor, verificationToken, tokenExpires);
  return { id: result.lastInsertRowid, avatarColor, verificationToken };
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function findUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
  return stmt.get(username);
}

function findUserById(id) {
  const stmt = db.prepare('SELECT id, email, username, created_at, avatar_color, avatar_image, email_verified FROM users WHERE id = ?');
  return stmt.get(id);
}

function findUserByVerificationToken(token) {
  const stmt = db.prepare('SELECT * FROM users WHERE verification_token = ?');
  return stmt.get(token);
}

function verifyUserEmail(userId) {
  const stmt = db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?');
  stmt.run(userId);
}

function createPasswordResetToken(userId) {
  const resetToken = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  const stmt = db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?');
  stmt.run(resetToken, expires, userId);
  return resetToken;
}

function findUserByResetToken(token) {
  const stmt = db.prepare('SELECT * FROM users WHERE password_reset_token = ?');
  return stmt.get(token);
}

function updateUserPassword(userId, newPasswordHash) {
  const stmt = db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?');
  stmt.run(newPasswordHash, userId);
}

function resendVerificationToken(userId) {
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare('UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?');
  stmt.run(verificationToken, tokenExpires, userId);
  return verificationToken;
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

function updateStats(userId, animeId, won, isDuo = false, attempts = 0, isDaily = false) {
  const current = getStats(userId, animeId);

  const gamesPlayed = current.games_played + 1;
  const wins = current.wins + (won ? 1 : 0);
  const currentStreak = won ? current.current_streak + 1 : 0;
  const maxStreak = Math.max(current.max_streak, currentStreak);
  const duoPlayed = current.duo_played + (isDuo ? 1 : 0);
  const duoWins = current.duo_wins + (isDuo && won ? 1 : 0);
  const totalAttempts = current.total_attempts + attempts;

  // Daily stats — ne compter qu'une fois par jour
  let dailyPlayed = current.daily_played || 0;
  let dailyWins = current.daily_wins || 0;
  let dailyStreak = current.daily_streak || 0;
  let dailyMaxStreak = current.daily_max_streak || 0;
  let lastDailyDate = current.last_daily_date || null;

  const today = new Date().toISOString().split('T')[0];
  if (isDaily && lastDailyDate !== today) {
    dailyPlayed += 1;
    dailyWins += won ? 1 : 0;
    dailyStreak = won ? dailyStreak + 1 : 0;
    dailyMaxStreak = Math.max(dailyMaxStreak, dailyStreak);
    lastDailyDate = today;
  }

  const stmt = db.prepare(`
    INSERT INTO user_stats (
      user_id, anime_id, games_played, wins, current_streak, max_streak,
      duo_played, duo_wins, total_attempts,
      daily_played, daily_wins, daily_streak, daily_max_streak, last_daily_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET
      games_played = excluded.games_played,
      wins = excluded.wins,
      current_streak = excluded.current_streak,
      max_streak = excluded.max_streak,
      duo_played = excluded.duo_played,
      duo_wins = excluded.duo_wins,
      total_attempts = excluded.total_attempts,
      daily_played = excluded.daily_played,
      daily_wins = excluded.daily_wins,
      daily_streak = excluded.daily_streak,
      daily_max_streak = excluded.daily_max_streak,
      last_daily_date = excluded.last_daily_date
  `);

  stmt.run(
    userId, animeId, gamesPlayed, wins, currentStreak, maxStreak,
    duoPlayed, duoWins, totalAttempts,
    dailyPlayed, dailyWins, dailyStreak, dailyMaxStreak, lastDailyDate
  );

  return {
    games_played: gamesPlayed,
    wins,
    current_streak: currentStreak,
    max_streak: maxStreak,
    duo_played: duoPlayed,
    duo_wins: duoWins,
    total_attempts: totalAttempts,
    daily_played: dailyPlayed,
    daily_wins: dailyWins,
    daily_streak: dailyStreak,
    daily_max_streak: dailyMaxStreak
  };
}

// Fonctions DLE custom
function createCustomDle(data) {
  const stmt = db.prepare(`
    INSERT INTO custom_dles (
      id, owner_id, name, icon_url, icon_public_id,
      background_url, background_public_id, max_attempts,
      attributes, characters, visibility
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id, data.ownerId, data.name,
    data.iconUrl, data.iconPublicId,
    data.backgroundUrl, data.backgroundPublicId,
    data.maxAttempts,
    JSON.stringify(data.attributes),
    JSON.stringify(data.characters),
    data.visibility
  );
}

function findCustomDleById(id) {
  const stmt = db.prepare(`
    SELECT cd.*, u.username AS owner_username
    FROM custom_dles cd
    LEFT JOIN users u ON u.id = cd.owner_id
    WHERE cd.id = ?
  `);
  const row = stmt.get(id);
  if (!row) return null;
  return hydrateCustomDle(row);
}

function findCustomDlesByOwner(ownerId) {
  const stmt = db.prepare('SELECT * FROM custom_dles WHERE owner_id = ? ORDER BY created_at DESC');
  return stmt.all(ownerId).map(hydrateCustomDle);
}

function findPublicCustomDles() {
  const stmt = db.prepare(`
    SELECT cd.*, u.username AS owner_username
    FROM custom_dles cd
    JOIN users u ON u.id = cd.owner_id
    WHERE cd.visibility = 'public'
    ORDER BY cd.created_at DESC
  `);
  return stmt.all().map(hydrateCustomDle);
}

function updateCustomDle(id, data) {
  const stmt = db.prepare(`
    UPDATE custom_dles SET
      name = ?,
      icon_url = ?,
      icon_public_id = ?,
      background_url = ?,
      background_public_id = ?,
      max_attempts = ?,
      attributes = ?,
      characters = ?,
      visibility = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    data.name,
    data.iconUrl,
    data.iconPublicId,
    data.backgroundUrl,
    data.backgroundPublicId,
    data.maxAttempts,
    JSON.stringify(data.attributes),
    JSON.stringify(data.characters),
    data.visibility,
    id
  );
}

function deleteCustomDle(id) {
  const stmt = db.prepare('DELETE FROM custom_dles WHERE id = ?');
  stmt.run(id);
}

function findCustomDlesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT id, name, icon_url FROM custom_dles WHERE id IN (${placeholders})`);
  return stmt.all(...ids);
}

function hydrateCustomDle(row) {
  return {
    ...row,
    attributes: JSON.parse(row.attributes),
    characters: JSON.parse(row.characters),
  };
}

export {
  db,
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  findUserByVerificationToken,
  verifyUserEmail,
  createPasswordResetToken,
  findUserByResetToken,
  updateUserPassword,
  resendVerificationToken,
  updateUserAvatar,
  getStats,
  getAllStatsForUser,
  updateStats,
  createCustomDle,
  findCustomDleById,
  findCustomDlesByOwner,
  findPublicCustomDles,
  findCustomDlesByIds,
  updateCustomDle,
  deleteCustomDle,
};
