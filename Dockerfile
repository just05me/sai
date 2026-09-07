# syntax=docker/dockerfile:1.7

###############################################################################
#  STAGE 1 — deps
###############################################################################
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Полный набор зависимостей нужен build-стадии (next build + prisma generate).
RUN npm install --legacy-peer-deps --ignore-scripts

###############################################################################
#  STAGE 2 — build
###############################################################################
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npx esbuild prisma/seed.ts --bundle --platform=node --packages=external --outfile=prisma/seed.cjs

###############################################################################
#  STAGE 3 — runtime  (Next.js standalone, ≤500 МБ)
###############################################################################
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma

EXPOSE 3000
USER node
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
