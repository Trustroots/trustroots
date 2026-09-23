# Non-production image for local `deploy/docker` development and CI test jobs.
#
# Node 24, native build deps, npm ci to seed the `node_modules` named volume.
# App code is bind-mounted at runtime. Playwright browsers are baked for E2E.

FROM node:24.21.0-bookworm-slim

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

# Keep the package manager consistent across runtime images.
RUN npm -g i npm@11.19.0

WORKDIR /home/app/trustroots

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --quiet \
  && npm rebuild sharp --build-from-source \
  && npm rebuild mmmagic --build-from-source

RUN npx playwright install chromium firefox
