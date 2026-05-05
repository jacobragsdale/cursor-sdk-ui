# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app

ARG CURSOR_API_KEY
ARG CURSOR_MODEL=composer-2
ENV CURSOR_API_KEY=${CURSOR_API_KEY}
ENV CURSOR_MODEL=${CURSOR_MODEL}

COPY . .
RUN npm run build

FROM deps AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG CURSOR_API_KEY
ARG CURSOR_MODEL=composer-2
ENV CURSOR_API_KEY=${CURSOR_API_KEY}
ENV CURSOR_MODEL=${CURSOR_MODEL}

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/data ./data
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p .workspace && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
