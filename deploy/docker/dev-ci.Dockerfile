# Non-production image for local `deploy/docker` development and CI test jobs.
#
# Node 24, native build deps, npm ci to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright Chromium is baked for E2E.

FROM node:24.18.0-bookworm-slim

RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  graphicsmagick \
  openssl \
  unzip \
  wget \
  python3 \
  pkg-config \
  libvips-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libpng-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  procps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet

RUN npx playwright install chromium
