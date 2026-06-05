FROM node:16-bullseye-slim

# Install native build, project tooling, and the MongoDB shell for dev use.
RUN apt-get -qq update && apt-get -q install -y \
  build-essential \
  ca-certificates \
  git \
  gnupg \
  graphicsmagick \
  openssh-client \
  openssl \
  unzip \
  wget \
  python3 \
  && wget -qO- https://pgp.mongodb.com/server-7.0.asc | gpg --batch --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  && echo "deb [ arch=amd64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
  && apt-get -qq update \
  && apt-get -q install -y mongodb-mongosh \
  && ln -s /usr/bin/mongosh /usr/local/bin/mongo \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN mkdir -p /trustroots
WORKDIR /trustroots

RUN npm -g i npm@latest-7

COPY package*.json ./
RUN npm ci --quiet

ENV NODE_ENV development
ENV DB_1_PORT_27017_TCP_ADDR mongodb

COPY . /trustroots

EXPOSE 1080
EXPOSE 3000
EXPOSE 3001
EXPOSE 5858
EXPOSE 27017

CMD ["npm", "start"]
