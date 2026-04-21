# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend (TypeScript)
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY --from=backend-builder /app/dist ./dist
COPY backend/data ./data
COPY backend/public/images ./public/images
COPY --from=frontend-builder /app/frontend/dist ./public/dist
RUN mkdir -p db

EXPOSE 3000

CMD ["node", "dist/main.js"]
