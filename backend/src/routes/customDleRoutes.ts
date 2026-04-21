// @ts-nocheck
import express from 'express';
import { nanoid } from 'nanoid';
import {
  createCustomDle,
  findCustomDleById,
  findCustomDlesByOwner,
  findPublicCustomDles,
  updateCustomDle,
  deleteCustomDle,
} from '../db/database';
import { authMiddleware, optionalAuthMiddleware } from '../auth/authMiddleware';
import { validate } from '../validators/authValidator';
import { createCustomDleSchema } from '../validators/customDleValidator';
import { deleteImage } from '../services/cloudinaryService';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';

const router = express.Router();

// POST /api/custom-dles — créer
router.post('/', authMiddleware, validate(createCustomDleSchema), async (req, res, next) => {
  try {
    const id = nanoid(10);
    const payload = req.body;
    createCustomDle({
      id,
      ownerId: req.user.userId,
      name: payload.name,
      iconUrl: payload.iconUrl || null,
      iconPublicId: payload.iconPublicId || null,
      backgroundUrl: payload.backgroundUrl || null,
      backgroundPublicId: payload.backgroundPublicId || null,
      maxAttempts: payload.maxAttempts,
      attributes: payload.attributes,
      characters: payload.characters,
      visibility: payload.visibility,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

// GET /api/custom-dles/mine — lister les miens
router.get('/mine', authMiddleware, (req, res, next) => {
  try {
    const rows = findCustomDlesByOwner(req.user.userId);
    res.json(rows.map(toListItem));
  } catch (err) {
    next(err);
  }
});

// GET /api/custom-dles/public — lister tous les DLEs publics
router.get('/public', (_req, res, next) => {
  try {
    const rows = findPublicCustomDles();
    res.json(rows.map(toListItem));
  } catch (err) {
    next(err);
  }
});

// GET /api/custom-dles/:id — récupérer un DLE (pour le jouer ou pour la page détail)
router.get('/:id', optionalAuthMiddleware, (req, res, next) => {
  try {
    const dle = findCustomDleById(req.params.id);
    if (!dle) throw new NotFoundError('DLE');

    const isOwner = req.user && req.user.userId === dle.owner_id;
    if (dle.visibility === 'private' && !isOwner) {
      throw new UnauthorizedError();
    }

    if (req.query.view === 'detail') {
      return res.json(toDetail(dle, isOwner));
    }

    res.json(toGame(dle));
  } catch (err) {
    next(err);
  }
});

// PUT /api/custom-dles/:id — modifier
router.put('/:id', authMiddleware, validate(createCustomDleSchema), async (req, res, next) => {
  try {
    const existing = findCustomDleById(req.params.id);
    if (!existing) throw new NotFoundError('DLE');
    if (existing.owner_id !== req.user.userId) throw new UnauthorizedError();

    const payload = req.body;
    const newPayload = {
      name: payload.name,
      iconUrl: payload.iconUrl || null,
      iconPublicId: payload.iconPublicId || null,
      backgroundUrl: payload.backgroundUrl || null,
      backgroundPublicId: payload.backgroundPublicId || null,
      maxAttempts: payload.maxAttempts,
      attributes: payload.attributes,
      characters: payload.characters,
      visibility: payload.visibility,
    };

    // Collecter les publicIds obsolètes
    const oldIds = collectPublicIds(existing);
    const newIds = collectPublicIds({
      icon_public_id: newPayload.iconPublicId,
      background_public_id: newPayload.backgroundPublicId,
      characters: newPayload.characters,
    });
    const orphans = [...oldIds].filter((id) => !newIds.has(id));

    updateCustomDle(req.params.id, newPayload);
    await Promise.all(orphans.map(deleteImage));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/custom-dles/:id/daily — défi du jour pour un DLE custom
router.get('/:id/daily', optionalAuthMiddleware, (req, res, next) => {
  try {
    const dle = findCustomDleById(req.params.id);
    if (!dle) throw new NotFoundError('DLE');

    const isOwner = req.user && req.user.userId === dle.owner_id;
    if (dle.visibility === 'private' && !isOwner) {
      throw new UnauthorizedError();
    }

    const characters = dle.characters || [];
    if (characters.length === 0) {
      return res.status(400).json({ error: 'Pas de personnages' });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const seed = `${dle.id}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
    }
    const index = Math.abs(hash) % characters.length;

    const epoch = new Date('2024-01-01T00:00:00Z');
    const today = new Date(dateStr + 'T00:00:00Z');
    const dayNumber = Math.floor((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));

    res.json({ characterIndex: index, date: dateStr, dayNumber });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/custom-dles/:id — supprimer (+ cleanup Cloudinary)
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const dle = findCustomDleById(req.params.id);
    if (!dle) throw new NotFoundError('DLE');
    if (dle.owner_id !== req.user.userId) throw new UnauthorizedError();

    // Supprime les images Cloudinary
    const publicIds: string[] = [];
    if (dle.icon_public_id) publicIds.push(dle.icon_public_id);
    if (dle.background_public_id) publicIds.push(dle.background_public_id);
    for (const char of dle.characters) {
      if (char.imagePublicId) publicIds.push(char.imagePublicId);
    }
    await Promise.all(publicIds.map(deleteImage));

    deleteCustomDle(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

function toListItem(dle) {
  return {
    id: dle.id,
    name: dle.name,
    iconUrl: dle.icon_url,
    backgroundUrl: dle.background_url,
    maxAttempts: dle.max_attempts,
    visibility: dle.visibility,
    characterCount: dle.characters.length,
    attributeCount: dle.attributes.length,
    createdAt: dle.created_at,
    ownerUsername: dle.owner_username || null,
  };
}

function toGame(dle) {
  return {
    id: dle.id,
    name: dle.name,
    background: dle.background_url,
    icon: dle.icon_url,
    maxAttempts: dle.max_attempts,
    attributes: dle.attributes,
    characters: dle.characters,
    visibility: dle.visibility,
    ownerId: dle.owner_id,
    isCustom: true,
  };
}

function toDetail(dle, isOwner) {
  const chars = dle.characters || [];
  return {
    id: dle.id,
    name: dle.name,
    iconUrl: dle.icon_url,
    backgroundUrl: dle.background_url,
    maxAttempts: dle.max_attempts,
    visibility: dle.visibility,
    attributes: dle.attributes,
    characterCount: chars.length,
    attributeCount: (dle.attributes || []).length,
    characters: chars.slice(0, 8).map((c) => ({ id: c.id, name: c.name, image: c.image })),
    ownerId: dle.owner_id,
    ownerUsername: dle.owner_username || null,
    isOwner: !!isOwner,
    isCustom: true,
  };
}

function collectPublicIds(src) {
  const ids = new Set();
  if (src.icon_public_id) ids.add(src.icon_public_id);
  if (src.background_public_id) ids.add(src.background_public_id);
  (src.characters || []).forEach((c) => {
    if (c.imagePublicId) ids.add(c.imagePublicId);
  });
  return ids;
}

export default router;
