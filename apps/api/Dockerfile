FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/contract ./packages/contract
COPY apps/api ./apps/api
RUN pnpm --filter @exocortex/contract build && pnpm --filter @exocortex/api build
RUN pnpm deploy --filter @exocortex/api --prod /deploy

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ripgrep \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /deploy .
EXPOSE 11435
CMD ["node", "dist/index.js"]
