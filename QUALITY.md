# Plan de qualité de code — DLE

Comparaison avec ATS (Symfony + Angular TypeScript) et roadmap pour s'en rapprocher.

---

## Stack actuelle vs cible

| Couche | Actuel | Cible |
|--------|--------|-------|
| Backend lang | JS (CommonJS) | TypeScript (ESM) |
| Backend framework | Express brut | Express + validation layer |
| Frontend lang | JS / JSX | TypeScript / TSX |
| Validation | Regex à la main | Zod (front + back) |
| Auth front | Token passé en param | Intercepteur centralisé |
| Guards | `if (!user) navigate()` dans les composants | Composant `<RequireAuth>` au niveau du routeur |
| Enums | Magic strings | Fichiers enum centralisés |
| Errors | catch générique → 500 | Classes d'erreur + middleware global |
| Tests | Aucun | Vitest (front) + Jest (back) |

---

## 1. TypeScript — priorité absolue

C'est le changement le plus impactant. Tout le reste en découle.

### Frontend (Vite supporte TSX nativement)

```bash
cd frontend
npm install -D typescript @types/react @types/react-dom @types/node
```

Renommer progressivement :
```
*.jsx → *.tsx
*.js  → *.ts
```

Créer `frontend/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

Mettre à jour `vite.config.js` → `vite.config.ts`.

### Backend

```bash
cd backend
npm install -D typescript ts-node @types/node @types/express @types/bcrypt @types/jsonwebtoken nodemon
```

`backend/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

Déplacer les sources dans `backend/src/`, script de dev :
```json
"dev": "nodemon --exec ts-node src/main.ts"
```

---

## 2. Enums — faisable immédiatement même en JS

Créer `frontend/src/constants/enums.ts` (ou `.js` si pas encore migré) :

```ts
export enum FeedbackType {
  Correct = "correct",
  Wrong   = "wrong",
  Higher  = "higher",
  Lower   = "lower",
  Close   = "close",
}

export enum AttributeType {
  Number  = "number",
  Ordered = "ordered",
  Text    = "text",
  Multi   = "multi",
}

export enum GameMode {
  Solo  = "solo",
  Daily = "daily",
  Duo   = "duo",
}
```

Remplacer partout les magic strings :
```ts
// Avant
if (fb?.type === "correct") ...
if (attr.type === "number") ...

// Après
if (fb?.type === FeedbackType.Correct) ...
if (attr.type === AttributeType.Number) ...
```

---

## 3. Types / DTOs frontend

Créer `frontend/src/types/` :

```ts
// types/anime.ts
export interface AnimeListItem {
  id: string;
  name: string;
  icon: string;
  background: string;
  maxAttempts: number;
  characterCount: number;
  attributeCount: number;
}

export interface Attribute {
  key: string;
  label: string;
  type: AttributeType;
  order?: string[];
  hints?: string[];
}

export interface Character {
  id: string;
  name: string;
  image: string;
  [key: string]: string | number; // attributs dynamiques
}

export interface AnimeGame {
  id: string;
  name: string;
  background: string;
  maxAttempts: number;
  attributes: Attribute[];
  characters: Character[];
}

// types/feedback.ts
export interface FieldFeedback {
  type: FeedbackType;
  label: string;
}

export interface AttemptEntry {
  guess: Character;
  feedback: Record<string, FieldFeedback>;
  isCorrect: boolean;
}

// types/stats.ts
export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
}

// types/auth.ts
export interface User {
  id: number;
  username: string;
  email: string;
  avatar_image: string | null;
  avatar_color: string;
}
```

Typer ensuite les services :
```ts
// services/animeService.ts
const animeService = {
  getAll: (): Promise<AnimeListItem[]> => request('/api/animes'),
  getDetail: (id: string): Promise<AnimeDetail>  => request(`/api/anime/${id}?view=detail`),
  getGame:   (id: string): Promise<AnimeGame>    => request(`/api/anime/${id}`),
  getAllAvatars: (): Promise<AvatarGroup[]>       => request('/api/animes/avatars'),
};
```

---

## 4. Token interceptor — plus de token en paramètre

Actuellement `statsService.getOne(animeId, token)` — le token se balade dans tous les appels.

Refactorer `services/api.ts` pour lire le token automatiquement :

```ts
// services/api.ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = { ...options.headers };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  if (options.body) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}
```

Les services n'ont plus besoin du token :
```ts
// Avant
statsService.getOne(animeId, token)
statsService.update(animeId, token, data)

// Après
statsService.getOne(animeId)
statsService.update(animeId, data)
```

Supprimer `authHeader()` et le paramètre `token` de tous les services.

---

## 5. Guard au niveau du routeur

Actuellement la logique d'auth est éparpillée dans les composants.

Créer `src/components/RequireAuth.tsx` :

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading">Chargement...</div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  return <>{children}</>;
}
```

Dans `App.tsx` :
```tsx
<Route path="/profile"          element={<RequireAuth><Profile /></RequireAuth>} />
<Route path="/anime/:id/play"   element={<Game />} />  {/* Game gère duo en interne */}
```

Supprimer tous les `if (!user) navigate('/login')` dans les composants.

---

## 6. Validation backend avec Zod

```bash
cd backend
npm install zod
```

Créer `src/validators/authValidator.ts` :

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  username: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_]+$/),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});
```

Middleware de validation générique :
```ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation échouée',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
```

Dans les routes :
```ts
router.post('/register', validate(registerSchema), registerController);
```

---

## 7. Error handling structuré

Créer `src/errors/AppError.ts` :

```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} introuvable`, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'Non autorisé', 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}
```

Middleware global à brancher en dernier dans `main.ts` :
```ts
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur', code: 'INTERNAL_ERROR' });
});
```

Dans les routes/services, throw au lieu de res.status() :
```ts
// Avant
if (!data) return res.status(404).send("Anime introuvable");

// Après
if (!data) throw new NotFoundError('Anime');
```

---

## 8. Tests

### Frontend — Vitest

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

`vite.config.ts` :
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
}
```

Priorités à tester :
- `utils/feedback.ts` — logique pure, zéro dépendance
- `utils/gameUtils.ts`
- `services/api.ts` (mock fetch)
- `hooks/useStats.ts`

Exemple `utils/feedback.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { computeFieldFeedback } from '../feedback';

describe('computeFieldFeedback', () => {
  it('returns correct when values match', () => {
    const result = computeFieldFeedback('Fire', 'Fire', { type: 'text' });
    expect(result.type).toBe('correct');
  });

  it('returns higher when guess > target for number', () => {
    const result = computeFieldFeedback('10', '5', { type: 'number' });
    expect(result.type).toBe('higher');
  });
});
```

### Backend — Jest

```bash
cd backend
npm install -D jest @types/jest ts-jest
```

Priorités : `mappers/animeMapper.ts`, validators, auth utils.

---

## Ordre d'exécution recommandé

| Étape | Effort | Impact |
|-------|--------|--------|
| 1. Enums + types de base | Faible | Moyen |
| 2. Token interceptor (plus de token en param) | Faible | Moyen |
| 3. RequireAuth guard | Faible | Moyen |
| 4. Migration TypeScript frontend | Élevé | Très élevé |
| 5. Zod validation backend | Moyen | Élevé |
| 6. Error handling structuré backend | Moyen | Élevé |
| 7. Migration TypeScript backend | Élevé | Élevé |
| 8. Tests utils + services critiques | Moyen | Élevé |

Les étapes 1-3 sont faisables en quelques heures sans casser quoi que ce soit.
La migration TypeScript (4 + 7) est le vrai saut de qualité — à faire en une session dédiée par couche.
