import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SALT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Middleware : exige un token valide
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifie' });
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// Middleware : exige le role admin (toi)
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Reserve a l\'administrateur' });
  }
  next();
}

export { JWT_SECRET };
