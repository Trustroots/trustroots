# Running Trustroots with Docker

Trustroots Docker containers are excellent for getting into development quickly.

Development with Docker might be little bit slower than running Mongo+NodeJS+NPM directly at your computer, but saves you from installing and configuring all the required dependencies.

_Note that we are not keeping too close an eye on the Docker setup so things might break unexpectedly. Feel free to help us maintain the docker setup!_

## Prerequisites

- Install [Docker](https://www.docker.com/get-started) on your system.
- Make sure you have [`git`](http://git-scm.com/) installed on your system (`git --version`, preinstalled on MacOS)

## Install

##### 1. Clone the repository

```bash
git clone https://github.com/Trustroots/trustroots.git
cd trustroots
```

##### 2. Create a config file

This will do:

```bash
cp config/env/local.docker.js config/env/local.js
```

Optional: See `config/env/local.sample.js` or `config/env/default.js` for details if you want to change something.

##### 3. Run the install script

```bash
docker-compose up
```

This will take a while. Good news is you just have to sit back and let it do its magic.

##### 4. Done!

You can now access these from your browser:

- Node app directly: [`http://localhost:3000`](http://localhost:3000)
- Node app via Nginx proxy: [`http://localhost:3080`](http://localhost:3080)
- Maildev: [`http://localhost:1080`](http://localhost:1080)

### Running & development

- Hit `Ctrl+C` to turn off containers.
- Type `docker-compose up` to start them up again.
- You might want to run containers as daemon: `docker-compose up -d` and then read the logs only from "trustroots" container: `docker-compose logs trustroots`. You can use a helper script: `./scripts/docker/up.sh`
- If you see a lot of `Run migrate DB script on update` coming from Nginx container, it means NodeJS isn't up yet or it has stopped due to errors. You should see "Trustroots server is up and running now." once Trustroots is really running.
- Type `docker-compose build --no-cache trustroots` to rebuild them to have fresh install.
- When you do changes to any files, they get recompiled and the browser is refreshed. If this step feels too slow for your needs, it's because of Docker. This step is faster on local install so you might want to consider that.
- Keep an eye on console in case of compiling errors.
- To read and debug emails, open Maildev [http://localhost:1080](http://localhost:1080) in your browser. Mails won't leave your Docker container unless you configure mailer settings from `config/env/local.js` to use e.g. [SparkPost](https://www.sparkpost.com/) or [Gmail](https://support.google.com/a/answer/176600?hl=en).
- To read and debug MongoDB use e.g. [Robomongo](https://robomongo.org/) to connect to `localhost` on port `27017`.

Refer to regular Install documentations for how to seed content, [how to run tests](https://team.trustroots.org/Install.html#running-tests) etc.

Just prepend `docker-compose run trustroots` to each command instructed at the documentation, for example:

```bash
npm run test:server
```

Becomes:

```bash
docker-compose run trustroots npm run test:server
```

The app is installed to `/trustroots` folder inside the container but working directory is set so that any commands default to that folder.

### Problems

- [Docker for development - common problems and solutions](https://medium.com/@rdsubhas/docker-for-development-common-problems-and-solutions-95b25cae41eb)
- Check with https://trustroots.slack.com/ and https://meta.trustroots.org/
