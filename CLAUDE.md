# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DLE-V2 is a Wordle-style anime character guessing game with solo and multiplayer (duo) modes. Players guess characters by their attributes and receive feedback (correct, close, wrong). Includes user authentication and stats tracking.

## Development Commands

### Backend (Express + Socket.IO)
```bash
cd backend
npm install
npm run dev    # Starts server with nodemon on port 3000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev         # Dev server with HMR (http://localhost:5173)
npm run dev-host    # Dev server accessible from network
npm run build       # Production build
npm run lint        # ESLint
```

Both servers must run simultaneously. Frontend proxies `/api/*` to backend.

## Architecture

**Monorepo with two packages:**
- `backend/` - Node.js/Express server with Socket.IO for real-time multiplayer
- `frontend/` - React SPA with Vite

### Backend Structure
- `main.js` - Express server, Socket.IO setup, REST endpoints (`/api/animes`, `/api/anime/:id`)
- `routes/authRoutes.js` - Authentication endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
- `routes/statsRoutes.js` - User stats endpoints (`/api/stats/:animeId`)
- `auth/authUtils.js` - JWT token generation/verification, password hashing (bcrypt)
- `auth/authMiddleware.js` - Express middleware for protected routes (`authMiddleware`, `optionalAuthMiddleware`)
- `db/database.js` - SQLite database (better-sqlite3) with users and user_stats tables
- `socket/socketHandler.js` - Socket.IO event handlers
- `socket/gameManager.js` - In-memory game state, matchmaking queue, room management
- `socket/feedbackUtils.js` - Guess feedback calculation (higher/lower, close, exact match)
- `data/*.json` - Anime game data files

### Frontend Structure
- `src/pages/` - Route components (Home, Game, DuoGame, Login, Register, Profile)
- `src/components/game/` - Multiplayer UI (WaitingRoom, TurnIndicator, RematchModal)
- `src/context/AuthContext.jsx` - Authentication state provider
- `src/hooks/useAuth.js` - Hook to access auth context
- `src/hooks/useSocket.js` - Socket.IO connection and state management hook

### Authentication Flow
- JWT tokens stored in localStorage, sent via `Authorization: Bearer` header
- `AuthProvider` wraps the app, validates token on mount via `/api/auth/me`
- Protected routes use `authMiddleware`, optional auth uses `optionalAuthMiddleware`

### Game Data Format
JSON files in `/backend/data/` define each anime's game:
```json
{
  "id": "anime-id",
  "name": "Anime Name",
  "characters": [...],
  "attributes": [
    { "key": "power", "label": "Power", "type": "number" },
    { "key": "arc", "label": "Arc", "type": "ordered", "order": [...] }
  ],
  "maxAttempts": 26
}
```

Attribute types: `number` (higher/lower feedback), `ordered` (positional), `text` (exact/partial match)

### Socket.IO Events
- `join-queue` / `leave-queue` - Matchmaking
- `match-found` - Game starts with two players
- `make-guess` - Submit guess, receives `guess-result` and broadcasts `opponent-guess`
- `request-rematch` / `rematch-starting` - Rematch flow

## Environment Variables

Backend `.env`:
- `PORT` - Server port (default: 3000)
- `FRONTEND_URL` - CORS origin for Socket.IO
- `JWT_SECRET` - Secret for JWT signing (defaults to dev secret)

Frontend (Vite):
- `VITE_SOCKET_URL` - Socket.IO server URL (defaults to http://localhost:3000)
