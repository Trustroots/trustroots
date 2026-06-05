# Test image for client, server, and E2E suites (local + CI).
#
# Bakes Linux node_modules, native deps, and Playwright Chromium. App source is
# bind-mounted at runtime so code edits do not require rebuilds.

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

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet

RUN npx playwright install chromium
