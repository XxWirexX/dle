// @ts-nocheck
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createUser, findUserByEmail, findUserByUsername, findUserById,
  findUserByVerificationToken, verifyUserEmail, createPasswordResetToken,
  findUserByResetToken, updateUserPassword, resendVerificationToken, updateUserAvatar,
} from '../db/database';
import { hashPassword, verifyPassword, generateToken } from '../auth/authUtils';
import { authMiddleware } from '../auth/authMiddleware';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { validate, registerSchema, loginSchema, resetPasswordSchema } from '../validators/authValidator';

const router = Router();

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion échouées, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, username } = req.body;

    const existingEmail = findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const existingUsername = findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    const passwordHash = await hashPassword(password);
    const { id: userId, avatarColor, verificationToken } = createUser(email, passwordHash, username);

    await sendVerificationEmail(email, username, verificationToken);

    const user = { id: userId, username };
    const token = generateToken(user);

    res.status(201).json({
      user: { id: userId, email, username, avatar_color: avatarColor, avatar_image: null, email_verified: 0 },
      token,
      message: 'Un email de vérification a été envoyé'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', [authLimiter, strictLimiter], validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

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
        avatar_image: user.avatar_image,
        email_verified: user.email_verified
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }

    const user = findUserByVerificationToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    if (new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expiré, demandez un nouveau lien' });
    }

    verifyUserEmail(user.id);

    res.json({ message: 'Email vérifié avec succès' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, authMiddleware, async (req, res, next) => {
  try {
    const user = findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    const verificationToken = resendVerificationToken(user.id);
    await sendVerificationEmail(user.email, user.username, verificationToken);

    res.json({ message: 'Email de vérification envoyé' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const user = findUserByEmail(email);

    if (!user) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    const resetToken = createPasswordResetToken(user.id);
    await sendPasswordResetEmail(email, user.username, resetToken);

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expiré, demandez un nouveau lien' });
    }

    const passwordHash = await hashPassword(password);
    updateUserPassword(user.id, passwordHash);

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res, next) => {
  try {
    const user = findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/avatar
router.put('/avatar', authMiddleware, (req, res, next) => {
  try {
    const { avatarImage } = req.body;
    const userId = req.user.userId;

    updateUserAvatar(userId, avatarImage || null);

    const user = findUserById(userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
