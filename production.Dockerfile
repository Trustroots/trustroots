FROM phusion/passenger-nodejs:3.1.10 AS builder
RUN node -e "if (process.versions.node.split('.')[0] !== '24') process.exit(1)"

# Install prerequisites
# https://docs.docker.com/engine/articles/dockerfile_best-practices/#apt-get
# Base image should also have these already installed: gcc, git, make, python
# - `build-essential` and `make` are required by some Node modules
# - `unzip` & `wget` are required by API docs generator
RUN rm -f /etc/apt/sources.list.d/passenger.list \
  && apt-get -qq update && apt-get -q install -y \
  build-essential \
  graphicsmagick \
  openssl \
  unzip \
  wget \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN npm install -g --force pnpm@11.18.0

RUN mkdir -p /trustroots
WORKDIR /trustroots

# Copy `package.json` and `pnpm-lock.yaml` into the container. Then use `pnpm`
# inside the container to install packages.
# This does several things:
# - Ensures that local changes to your `node_modules/` folder are not copied to
#   the container
# - Allows docker to reuse previous build layers if these files do not change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/logger/package.json ./packages/logger/package.json
# This takes FOREVER if it's run in the passenger container, that's why we
# created the multi stage build with a build container first.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

# Copy code into the container
COPY .prettierrc.json .prettierignore eslint.config.cjs eslint.config.cts babel.config.* tsconfig.json vite.config.mts server.js server.mjs worker.js worker.mjs worker.mts ./
COPY bin bin
COPY config config
COPY migrations migrations
COPY layers layers
COPY modules modules
COPY packages packages
COPY public public
COPY testutils testutils

# Build the app
RUN pnpm run build

# The builder needs the full toolchain, but the published image only needs
# runtime dependencies. Prune after the build so Vite and other build tools
# remain available while assets are generated.
# CI mode allows pnpm to recreate node_modules without an interactive prompt.
RUN CI=true pnpm prune --prod --ignore-scripts

# ------------------------------------------------------------------------------
# Create the production container
# ------------------------------------------------------------------------------

FROM phusion/passenger-nodejs:3.1.10
RUN node -e "if (process.versions.node.split('.')[0] !== '24') process.exit(1)"

ARG TRUSTROOTS_BUILD_COMMIT
ARG TRUSTROOTS_BUILD_COMMITTED_AT
ARG TRUSTROOTS_BUILD_BRANCH

ENV TRUSTROOTS_BUILD_COMMIT=${TRUSTROOTS_BUILD_COMMIT} \
  TRUSTROOTS_BUILD_COMMITTED_AT=${TRUSTROOTS_BUILD_COMMITTED_AT} \
  TRUSTROOTS_BUILD_BRANCH=${TRUSTROOTS_BUILD_BRANCH}

# Enable nginx in the passenger container
RUN rm -f /etc/service/nginx/down

# Install the production dependencies into the production container
RUN rm -f /etc/apt/sources.list.d/passenger.list \
  && apt-get -qq update && apt-get -q install -y \
  graphicsmagick \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /home/app/trustroots

# TODO We should be able to just copy what we actually need from the builder
COPY --chown=app:app --from=builder /trustroots/ ./

COPY deploy/docker/nginx-confd.conf /etc/nginx/conf.d/nginx.conf
COPY deploy/docker/webapp.conf /etc/nginx/sites-enabled/default
COPY deploy/docker/seed-circle-images.sh /etc/my_init.d/10-seed-circle-images.sh
# Keep a copy outside the mount point. On startup the seed script fills a
# persistent circle-image directory without replacing files already stored there.
RUN chmod 755 /etc/my_init.d/10-seed-circle-images.sh \
  && mkdir -p /home/app/trustroots/circle-image-seed \
  && cp -a /home/app/trustroots/public/uploads-circle/. /home/app/trustroots/circle-image-seed/ \
  && chown -R app:app /home/app/trustroots/circle-image-seed

CMD ["/sbin/my_init"]
