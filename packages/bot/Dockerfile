# Build stage
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/bot/package.json ./packages/bot/

RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/bot ./packages/bot

# Build shared → bot
RUN pnpm --filter @blog-study/shared build && \
    pnpm --filter @blog-study/bot build

# Production stage
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/bot/package.json ./packages/bot/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/bot/dist ./packages/bot/dist

ENV NODE_ENV=production

# Expose API server port
EXPOSE 3001

CMD ["node", "packages/bot/dist/index.js"]
