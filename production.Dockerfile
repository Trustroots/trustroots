FROM node:14 as builder

# Install prerequisites
# https://docs.docker.com/engine/articles/dockerfile_best-practices/#apt-get
# Base image should also have these already installed: gcc, git, make, python
# - `build-essential` and `make` are required by some Node modules
# - `unzip` & `wget` are required by API docs generator
RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  graphicsmagick \
  openssl \
  unzip \
  wget \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN mkdir -p /trustroots
WORKDIR /trustroots

# Copy `package.json` and `package-lock.json` into the container. Then use `npm`
# inside the container to install packages.
# This does several things:
# - Ensures that local changes to your `node_modules/` folder are not copied to
#   the container
# - Allows docker to reuse previous build layers if these files do not change
COPY package*.json ./
# This takes FOREVER if it's run in the passenger container, that's why we
# created the multi stage build with a build container first.
RUN npm ci --quiet

# Copy code into the container
COPY .prettierrc.json .eslint* babel.config.* server.js worker.js ./
COPY bin bin
COPY config config
COPY migrations migrations
COPY modules modules
COPY public public
COPY testutils testutils

# Build the app
# RUN npm run build
# BROKEN - The `npm run build` fails currently, so for testing, I'm building it
# on the host and copying it (above in the public folder).
RUN npm run build:generate-circle-images
RUN npm run build:webpack

# ------------------------------------------------------------------------------
# Create the production container
# ------------------------------------------------------------------------------

FROM phusion/passenger-nodejs:2.3.0

# Enable nginx in the passenger container
RUN rm -f /etc/service/nginx/down

# Install the production dependencies into the production container
RUN apt-get -qq update && apt-get -q install -y \
  graphicsmagick \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /home/app/trustroots

# TODO We should be able to just copy what we actually need from the builder
COPY --chown=app:app --from=builder /trustroots/ ./

COPY deploy/docker/nginx-confd.conf /etc/nginx/conf.d/nginx.conf
COPY deploy/docker/webapp.conf /etc/nginx/sites-enabled/default

CMD ["/sbin/my_init"]
