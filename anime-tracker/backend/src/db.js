import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tracker.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer'
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS animes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    synopsis   TEXT DEFAULT '',
    cover_url  TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    anime_id   INTEGER NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
    number     INTEGER NOT NULL,
    title      TEXT DEFAULT '',
    video_url  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(anime_id, number)
  );

  CREATE TABLE IF NOT EXISTS progress (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    position    REAL NOT NULL DEFAULT 0,    -- secondes regardees (pour reprendre)
    completed   INTEGER NOT NULL DEFAULT 0, -- 0 / 1
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, episode_id)
  );
`);

export default db;
