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
    graphicsmagick \
    imagemagick \
    openssl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install Dump-init
# https://github.com/Yelp/dumb-init
RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.0.0/dumb-init_1.0.0_amd64.deb
RUN dpkg -i dumb-init_*.deb

# Create working directory
RUN mkdir -p /trustroots

# Install global node modules
RUN npm install -g -y gulp --quiet
RUN npm install -g -y bower --quiet
RUN npm install -g -y faker --quiet

# Install local node modules
ADD package.json /trustroots/package.json
RUN cd /trustroots && npm install --quiet

# Set environment variables
ENV NODE_ENV development
ENV DB_1_PORT_27017_TCP_ADDR mongodb
ENV PORT 3000
ENV DOMAIN trustroots.dev

# Load application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR /trustroots
ADD . /trustroots

# Expose ports
# - Nginx proxy     80
# - Node debug      5858
# - Nodemon server  3000
# - LiveReload      35729
EXPOSE 80
EXPOSE 3000
EXPOSE 5858
EXPOSE 35729
CMD ["dumb-init", "npm", "start"]
