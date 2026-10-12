# Development image for local `docker compose up` and devcontainer.
#
# Node 24, native build deps, pnpm install to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright Chromium is baked for E2E.

FROM node:24.21.0-bookworm-slim

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

# Keep the package manager consistent with `packageManager` in package.json.
RUN npm -g i pnpm@11.18.0

WORKDIR /home/app/trustroots

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

RUN pnpm exec playwright install chromium
