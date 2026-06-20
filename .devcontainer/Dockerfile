# Development image for local `docker compose up` and devcontainer.
#
# Node 16, native build deps, npm ci to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright Chromium is baked for E2E.

FROM node:16-bullseye-slim

RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  git \
  graphicsmagick \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  openssl \
  unzip \
  wget \
  python3 \
  pkg-config \
  libcairo2-dev \
  libdrm2 \
  libgbm1 \
  libpango1.0-dev \
  libpng-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Pin npm to v7 to satisfy `engines` in package.json (`npm >=6 <8`).
RUN npm -g i npm@latest-7

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet

RUN npx playwright install chromium
