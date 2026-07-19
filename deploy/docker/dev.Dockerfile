# Development image for local `docker compose up` and devcontainer.
#
# Node 24, native build deps, npm ci to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright Chromium is baked for E2E.

FROM node:24.18.0-bookworm-slim

RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  git \
  graphicsmagick \
  openssl \
  unzip \
  wget \
  python3 \
  pkg-config \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libatspi2.0-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libxkbcommon0 \
  libasound2 \
  libcairo2-dev \
  libpango1.0-dev \
  libpng-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENV PLAYWRIGHT_BROWSERS_PATH=/home/app/ms-playwright

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet

RUN mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" \
  && chmod 777 "$PLAYWRIGHT_BROWSERS_PATH" \
  && npx playwright install chromium \
  && chmod -R 777 "$PLAYWRIGHT_BROWSERS_PATH"
