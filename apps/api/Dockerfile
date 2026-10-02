# syntax=docker/dockerfile:1

# --- Base: manifests only, so dependency layers cache well -----------------
FROM node:22-alpine AS base
WORKDIR /app
ENV npm_config_update_notifier=false

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json

# --- Build: install the api workspace (incl. dev) and bundle with tsup -----
FROM base AS build
RUN npm ci --workspace @lumen/api --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace @lumen/api

# --- Runner: api production deps + built output + migrations ---------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci --omit=dev --workspace @lumen/api --include-workspace-root \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./dist
# dist/db/migrate.js resolves ../../drizzle -> /app/drizzle
COPY --from=build /app/apps/api/drizzle ./drizzle

USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
