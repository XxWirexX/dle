import { Router } from 'express';
import db from '../db.js';
import { verifyPassword, generateToken, requireAuth } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user });
});

export default router;
