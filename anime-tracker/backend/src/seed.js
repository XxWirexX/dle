import 'dotenv/config';
import db from './db.js';
import { hashPassword } from './auth.js';

async function upsertUser(username, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const hash = await hashPassword(password);
  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(hash, role, existing.id);
    console.log(`Compte mis a jour : ${username} (${role})`);
  } else {
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
    console.log(`Compte cree : ${username} (${role})`);
  }
}

async function main() {
  await upsertUser(process.env.ADMIN_USERNAME || 'moi', process.env.ADMIN_PASSWORD || 'admin1234', 'admin');
  await upsertUser(process.env.VIEWER_USERNAME || 'frere', process.env.VIEWER_PASSWORD || 'frere1234', 'viewer');

  // Anime d'exemple pour tester le lecteur (videos libres de droits)
  const count = db.prepare('SELECT COUNT(*) AS c FROM animes').get().c;
  if (count === 0) {
    const info = db.prepare('INSERT INTO animes (title, synopsis, cover_url) VALUES (?, ?, ?)').run(
      'Exemple (a supprimer)',
      'Anime de demonstration avec deux clips de test pour valider le lecteur.',
      'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
    );
    const animeId = info.lastInsertRowid;
    db.prepare('INSERT INTO episodes (anime_id, number, title, video_url) VALUES (?, ?, ?, ?)')
      .run(animeId, 1, 'Episode 1', 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4');
    db.prepare('INSERT INTO episodes (anime_id, number, title, video_url) VALUES (?, ?, ?, ?)')
      .run(animeId, 2, 'Episode 2', 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4');
    console.log('Anime de demonstration cree.');
  }

  console.log('\nSeed termine. Connexions :');
  console.log(`  ADMIN  -> ${process.env.ADMIN_USERNAME || 'moi'} / ${process.env.ADMIN_PASSWORD || 'admin1234'}`);
  console.log(`  VIEWER -> ${process.env.VIEWER_USERNAME || 'frere'} / ${process.env.VIEWER_PASSWORD || 'frere1234'}`);
}

main().then(() => process.exit(0));
