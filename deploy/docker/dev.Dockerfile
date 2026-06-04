# Development image for local `docker compose up`.
#
# Mirrors the former root `Dockerfile`: node 16, native build deps, npm ci to
# seed the `node_modules` named volume. App code is bind-mounted at runtime.

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
RUN npm ci --quiet \
  && npm rebuild sharp --build-from-source \
  && npm rebuild mmmagic --build-from-source
