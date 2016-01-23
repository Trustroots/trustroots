FROM node:4.2

# Install prerequisites
# https://docs.docker.com/engine/articles/dockerfile_best-practices/#apt-get
# Base image should also have these already installed: gcc, git, make, python
# - `build-essential` and `make` are required by some Node modules
# - `unzip` & `wget` are required by API docs generator
RUN apt-get -qq update && apt-get -q install -y \
    build-essential \
    unzip \
    wget \
    openssl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/trustroots
WORKDIR /srv/trustroots

# Install node modules
RUN npm install -g -y gulp
RUN npm install -g -y bower
RUN npm install -g -y faker
COPY package.json /srv/trustroots/
RUN npm install

# Run Bower
COPY .bowerrc /srv/trustroots/
COPY bower.json /srv/trustroots/
RUN bower install --allow-root --config.interactive=false

# Generate docs
#COPY public/developers/swagger.json /srv/trustroots/public/developers/swagger.json
#COPY scripts/generate-docks.sh /srv/trustroots/scripts/generate-docks.sh
#RUN npm run docs

# Set environment variables
ENV NODE_ENV development
ENV DB_1_PORT_27017_TCP_ADDR mongodb
ENV PORT 3000
ENV DOMAIN trustroots.dev

# Make everything available for start
COPY . /srv/trustroots

# Build assets
RUN npm run build

# Port 3000 for server
# Port 35729 for LiveReload
EXPOSE 3000
EXPOSE 35729
CMD ["npm", "start"]

FROM jwilder/nginx-proxy
RUN { \
      echo 'sendfile off;'; \
      echo 'expires off;'; \
      echo 'client_max_body_size 10m;'; \
    } > /etc/nginx/conf.d/trustroots.conf
