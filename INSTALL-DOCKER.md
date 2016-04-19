# Running Trustroots with Docker

Trustroots Docker containers are excellent for getting into development quickly.

Development with Docker might be little bit slower than running Mongo+NodeJS+NPM directly at your computer, but saves you from installing and configuring all the required dependencies.


## Prerequisites

* Install [Docker](https://www.docker.com/) on your system.
* Install [Docker Compose](http://docs.docker.com/compose/) on your system.
* Make sure you have [`git`](http://git-scm.com/) installed on your system (`git --version`, preinstalled on OSX)


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

See `config/env/local.sample.js` or `config/env/default.js` for more details if you want to change something (optional).


##### 3. Run the install script

```bash
docker-compose up
```

On OSX you need to run this inside _Docker Terminal_.

This will take a while. Good news is you just have to sit back and let it do it's magic.


##### 4. Done!

You can now access these from your browser:

###### On Linux:
* Node app via Nginx proxy: [`http://localhost:3080`](http://localhost:3080)
* Node app directly: [`http://localhost:3000`](http://localhost:3000)
* Maildev: [`http://localhost:1080`](http://localhost:1080)

###### On OSX/Windows:
* Node app via Nginx proxy: `http://YOUR_MACHINE_IP:3080`
* Node app directly: `http://YOUR_MACHINE_IP:3000`
* Maildev: `http://YOUR_MACHINE_IP:1080`

To check your Docker machine IP, run: `docker-machine ip default` (replace the word `default` with your machine name, if it differs). To check what your Docker machine's name is, run: `docker-machine ls`


##### 5. (optional) Configure `/etc/hosts` file

If you'd like to use easier-to-remember hostname, rather than IP, you can add a line to your hosts file.

Run this one-liner — just replace the word `default` with your machine name, if it differs:
```bash
printf "\n\n$(docker-machine ip default)\\ttrustroots.dev" | sudo tee -a /etc/hosts > /dev/null
```

This will add this line to your `/etc/hosts` file and it will ask for sudo password:

```
[DOCKER-MACHINE-IP]	trustroots.dev
```

You can now use `http://trustroots.dev:PORT` instead of machine IP.


### Running & development

- Hit `Ctrl+C` to turn off containers.
- Type `docker-compose up` to start them up again. You might want to run containers as daemon: `docker-compose up -d` and then attach to Node container to see the logs: `docker-compose logs trustroots`. Otherwise you'll see logs from all the containers. You can use a helper script: `scripts/docker/up.sh`
- If you see a lot of `Run migrate DB script on update` coming from Nginx container, it means NodeJS isn't up yet or it has stopped due error. You should see "Trustroots is up and running now." once Trustroots is really running.
- Type `docker-compose build` to rebuild them to have fresh install.
- When you do changes to any files, they get recompiled and the browser is refreshed. If this step feels too slow for your needs, it's because of Docker. This step is faster on local [install](INSTALL.md) so you might want to consider that.
- Keep an eye on console in case of compiling errors.
- To read and debug emails, open Maildev (http://YOUR_MACHINE_IP:1080) in your browser. Mails won't leave your Docker container unless you configure mailer settings from `config/env/local.js` to use e.g. [SparkPost](https://www.sparkpost.com/) or [Gmail](https://support.google.com/a/answer/176600?hl=en).
- To read and debug MongoDB use e.g. [Robomongo](https://robomongo.org/) to connect to your container's IP.
- Docker container has both, [GraphicsMagick](http://www.graphicsmagick.org/) and [ImageMagick](http://www.imagemagick.org/) installed.
- [Read more](https://github.com/Trustroots/trustroots/wiki/Development)


### Upgrading

```bash
git pull
docker-compose run trustroots npm update
```


### Running tests

- `docker-compose run trustroots npm test` (both client & server)
- `docker-compose run trustroots npm run test:client`
- `docker-compose run trustroots npm run test:server`
- `docker-compose run trustroots npm run test:server:watch` (run + watch for changes)


### Problems

- Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
- [Docker for development - common problems and solutions](https://medium.com/@rdsubhas/docker-for-development-common-problems-and-solutions-95b25cae41eb)
