FROM node:24.22.1-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY apps/nostranslation/server ./apps/nostranslation/server
COPY apps/nostranslation/shared.ts ./apps/nostranslation/shared.ts
RUN mkdir -p /data && chown node:node /data
ENV NOSTRANSLATION_DATABASE=/data/nostranslation.sqlite
USER node
EXPOSE 4310
CMD ["node", "apps/nostranslation/server/start.mts"]
