# syntax=docker/dockerfile:1

# ---- build: server (tsc) + client (vite) ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

COPY client ./client
RUN npm run build --prefix client

# ---- runtime: production deps + compiled output only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist

# Overridden by the Railway volume mount when one is attached.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 4000
CMD ["node", "dist/server.js"]
