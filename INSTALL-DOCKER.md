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

##### 4. Configure `/etc/hosts` file

Check what is your Docker machine's name by running `docker-machine ls` — often it's `default`.

Then run this one-liner — just replace `default` with your machine name, if it differs:
```bash
printf "\n\n$(docker-machine ip default)\\ttrustroots.dev\n$(docker-machine ip default)\ttrustroots.maildev" | sudo tee -a /etc/hosts > /dev/null
```

This will add these lines to your `/etc/hosts` file and it will ask for sudo password:

```
[DOCKER-MACHINE-IP]	trustroots.dev
[DOCKER-MACHINE-IP]	trustroots.maildev
```

This will allow you to access Trustroots Node app via Nginx proxy giving you similar setup to our production environment.

> Tip: If you would like to skip Nginx, you can access NodeJS directly with `http://[DOCKER-MACHINE-IP]:3000/`
> If you're OSX user, you need to follow [these instructions for OSX](https://labs.ctl.io/tutorials/docker-on-the-mac-without-boot2docker/) (not required on Linux).

##### 4. Done!

Open [http://trustroots.dev/](http://trustroots.dev/) and [http://trustroots.maildev/](http://trustroots.maildev/) in your browser.

### Running & development

- Hit `Ctrl+C` to turn off containers.
- Type `docker-compose up` to start them up again. You might want to run containers as daemon: `docker-compose up -d` and then attach to Node container to see the logs: `docker-compose logs trustroots`. Otherwise you'll see logs from all the containers.
- Type `docker-compose build` to rebuild them to have fresh install.
- When you do changes to any files, they get recompiled and the browser is refreshed. If this step feels too slow for your needs, it's because of Docker. This step is faster on local [install](INSTALL.md) so you might want to consider that.
- Keep an eye on console in case of compiling errors.
- To read and debug emails, open [http://trustroots.maildev](http://trustroots.maildev) in your browser. Mails won't leave your Docker container unless you configure mailer settings from `config/env/local.js` to use e.g. [Mandrill](https://mandrillapp.com/) or [Gmail](https://support.google.com/a/answer/176600?hl=en).
- To read and debug MongoDB use e.g. [Robomongo](https://robomongo.org/) to connect to your container's IP.
- If you need to know running container IP's and names, you can run `sh scripts/docker/container-ips.sh`
- [Read more](https://github.com/Trustroots/trustroots/wiki/Development)

### Upgrading

```bash
docker-compose run trustroots npm update
```

### Running tests

```bash
docker-compose run trustroots npm test
```

### Generate API documentation

```bash
docker-compose run trustroots npm docs
```

Open [http://trustroots.dev/developers/api/](http://trustroots.dev/developers/api/) in your browser.

### Problems

- Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
- [Docker for development - common problems and solutions](https://medium.com/@rdsubhas/docker-for-development-common-problems-and-solutions-95b25cae41eb)
