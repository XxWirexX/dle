import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const registerSchema = z.object({
  email:    z.string().email("Format d'email invalide"),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre'),
  username: z.string()
    .min(2, 'Le pseudo doit faire au moins 2 caractères')
    .max(20, 'Le pseudo doit faire au maximum 20 caractères')
    .regex(/^[a-zA-Z0-9_]+$/, 'Le pseudo ne peut contenir que des lettres, chiffres et underscores'),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  token:    z.string().min(1),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const firstError = (Object.values(fieldErrors).flat() as string[])[0];
      return res.status(400).json({
        error: firstError || 'Validation échouée',
        details: fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
