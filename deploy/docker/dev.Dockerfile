# Development image for local `docker compose up` and devcontainer.
#
# Node 16, native build deps, npm ci to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright Chromium is baked for E2E.

FROM node:16-bullseye-slim

RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  graphicsmagick \
  openssl \
  unzip \
  wget \
  python3 \
  pkg-config \
  libcairo2-dev \
  libpango1.0-dev \
  libpng-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Pin npm to v7 to satisfy `engines` in package.json (`npm >=6 <8`).
RUN npm -g i npm@latest-7

ENV PLAYWRIGHT_BROWSERS_PATH=/home/app/ms-playwright

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet \
  && npm rebuild mmmagic --build-from-source

RUN mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" \
  && chmod 777 "$PLAYWRIGHT_BROWSERS_PATH" \
  && npx playwright install chromium \
  && chmod -R 777 "$PLAYWRIGHT_BROWSERS_PATH"
