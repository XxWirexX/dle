const express = require('express');
const { createUser, findUserByEmail, findUserById, updateUserAvatar } = require('../db/database');
const { hashPassword, verifyPassword, generateToken } = require('../auth/authUtils');
const { authMiddleware } = require('../auth/authMiddleware');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, mot de passe et username requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: 'Le username doit faire entre 2 et 20 caractères' });
    }

    // Vérifier si l'email existe déjà
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await hashPassword(password);
    const { id: userId, avatarColor } = createUser(email, passwordHash, username);

    const user = { id: userId, username };
    const token = generateToken(user);

    res.status(201).json({
      user: { id: userId, email, username, avatar_color: avatarColor, avatar_image: null },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_color: user.avatar_color,
        avatar_image: user.avatar_image
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/avatar
router.put('/avatar', authMiddleware, (req, res) => {
  try {
    const { avatarImage } = req.body;
    const userId = req.user.userId;

    // avatarImage peut être null (retour à l'avatar par défaut) ou un chemin d'image
    updateUserAvatar(userId, avatarImage || null);

    const user = findUserById(userId);
    res.json({ user });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
