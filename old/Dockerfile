FROM node:14

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

# Create working directory
RUN mkdir -p /trustroots
WORKDIR /trustroots

# Copies the local package.json and package-lock.json files to the container
# and utilities docker container cache to not needing to rebuild
# and install node_modules/ every time we build the docker, but only
# when the local package.json file changes.
# Install npm packages
COPY package*.json ./
RUN npm ci --quiet

# Set environment variables
ENV NODE_ENV development
ENV DB_1_PORT_27017_TCP_ADDR mongodb

# Share local directory on the docker container
# ...therefore the previous docker "layer" thats been cached will be used if possible
COPY . /trustroots

# Expose ports
# - Maildev            1080
# - Webpack-dev-server 3000
# - Nodemon server     3001
# - Node debug         5858
# - MongoDB            27017
EXPOSE 1080
EXPOSE 3000
EXPOSE 3001
EXPOSE 5858
EXPOSE 27017
CMD ["npm", "start"]
