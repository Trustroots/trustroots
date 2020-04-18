FROM node:12

# Install prerequisites
# https://docs.docker.com/engine/articles/dockerfile_best-practices/#apt-get
# Base image should also have these already installed: gcc, git, make, python
# - `build-essential` and `make` are required by some Node modules
# - `unzip` & `wget` are required by API docs generator
RUN apt-get -qq update && apt-get -q install -y \
    build-essential \
    unzip \
    wget \
    graphicsmagick \
    imagemagick \
    openssl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Dump-init
# https://github.com/Yelp/dumb-init
RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.0.0/dumb-init_1.0.0_amd64.deb
RUN dpkg -i dumb-init_*.deb

# Create working directory
RUN mkdir -p /trustroots
WORKDIR /trustroots

# Copies the local package.json file to the container
# and utilities docker container cache to not needing to rebuild
# and install node_modules/ every time we build the docker, but only
# when the local package.json file changes.
# Install npm packages
COPY package.json /trustroots/
RUN npm install --quiet

# Set environment variables
ENV NODE_ENV development
ENV DB_1_PORT_27017_TCP_ADDR mongodb
ENV PORT 3000

# Share local directory on the docker container
# ...therefore the previous docker "layer" thats been cached will be used if possible
COPY . /trustroots

# Expose ports
# - Nginx proxy     80
# - Nodemon server  3000
# - Node debug      5858
# - MongoDB         27017
EXPOSE 80
EXPOSE 3000
EXPOSE 5858
EXPOSE 27017
CMD ["dumb-init", "npm", "start:docker"]
