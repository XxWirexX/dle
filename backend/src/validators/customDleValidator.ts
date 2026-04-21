import { z } from 'zod';

const attributeSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/i, 'clé invalide'),
  label: z.string().min(1).max(40),
  type: z.enum(['number', 'ordered', 'text', 'multi']),
  order: z.array(z.string().min(1).max(60)).max(30).optional(),
  options: z.array(z.string().min(1).max(60)).max(30).optional(),
  hints: z.array(z.string().min(1).max(200)).max(10).optional(),
});

const characterSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  image: z.string().url('URL image invalide'),
}).catchall(z.union([z.string(), z.number()]));

export const createCustomDleSchema = z.object({
  name: z.string().min(2).max(60),
  iconUrl: z.string().url().optional().nullable(),
  iconPublicId: z.string().max(200).optional().nullable(),
  backgroundUrl: z.string().url().optional().nullable(),
  backgroundPublicId: z.string().max(200).optional().nullable(),
  maxAttempts: z.number().int().min(3).max(50),
  attributes: z.array(attributeSchema).min(1).max(15),
  characters: z.array(characterSchema).min(2).max(80),
  visibility: z.enum(['private', 'unlisted', 'public']),
});

export type CreateCustomDlePayload = z.infer<typeof createCustomDleSchema>;
