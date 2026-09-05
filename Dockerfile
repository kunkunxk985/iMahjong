# Multi-stage production build for iMahjong Game Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/rules/package.json ./packages/rules/
COPY packages/server-core/package.json ./packages/server-core/
COPY apps/server/package.json ./apps/server/

RUN npm ci

# Copy sources and build
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/
COPY tsconfig.json ./

# Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=27985

COPY --from=builder /app ./

EXPOSE 27985

CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
