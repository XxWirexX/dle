# --- deps : dépendances (dev incluses, nécessaires pour build et migrate) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build : produit .output/ (bundle Nitro autonome, node_modules tracés) ---
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# --- migrate : image "outil", jamais déployée en continu — voir le
# service `migrate` de docker-compose.yml (npm run db:migrate via tsx,
# qui a besoin des devDependencies et des fichiers source, pas de build).
FROM deps AS migrate
WORKDIR /app
COPY . .
CMD ["npm", "run", "db:migrate"]

# --- runtime : image de prod, seulement le bundle buildé ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
