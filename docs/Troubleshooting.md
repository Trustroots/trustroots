_Expect problems and eat them for breakfast._

## Installed via Docker
#### Getting `ENOTFOUND` NPM install errors when doing Docker installation.
If you're not really offline, your VirtualMachine might be confused because of your DNS setting, a proxy or changed wifi. Restarting the VM picks up the updated network configuration: `docker-machine restart`. Follow instructions it might give you.

#### Getting flooded by `Received event die for container XYZ` messages
If they're coming from Nginx it might mean that NodeJS app either crashed or isn't running yet. Wait for _"Trustroots is up and running now."_ message.

See [this comment](https://github.com/jwilder/nginx-proxy/issues/122#issuecomment-185612265).

#### No space left on device
Running this might help ([via](https://github.com/docker/docker/issues/10613#issuecomment-188139492)):
```bash
# remove stopped containers
docker rm $(docker ps -a -q)

# remove dangling images
docker rmi $(docker images -q --filter "dangling=true")
```

#### Couldn't connect to Docker daemon
Getting this error?
```bash
ERROR: Couldn't connect to Docker daemon - you might need to run `docker-machine start default`.
```

Is your machine running? Try:
```bash
docker-machine start default
```

If it is (and you can see it with `docker-machine ls`, and its name really is "default"), try connecting your shell to the machine:

```bash
eval "$(docker-machine env default)"
```

## Installed locally

#### MongoError: connect ECONNREFUSED
Seeing this?
```bash
{ [MongoError: connect ECONNREFUSED 127.0.0.1:27017]
  name: 'MongoError',
  message: 'connect ECONNREFUSED 127.0.0.1:27017' }
[17:05:51] [nodemon] clean exit - waiting for changes before restart
```

Make sure your MongoDB is running at localhost at default port (27017).

If you are running Mongo somewhere else and/or it requires authentication, open `./config/env/development.js` and copy whole `db` block to `./config/env/local.js`. Make required changes there and restart the app.

Command to run MongoDB is usually `mongod`.

#### Error related to node-gyp
If you get errors about `node-gyp` when doing `npm install/update`, check you have [build tools installed](https://github.com/TooTallNate/node-gyp#installation). 
* For **Windows** you might need to install python or Visual Studio.
* For **OSX** you'll probably need to install XCode and Command line tools.
* For **Linux** you might need to install Python, C/C++ compiler or `make`.

This is most likely required by [lwip](https://github.com/EyalAr/lwip) package, basically a library handling image processing.

#### ImportError: No module named site
If you see error `ImportError: No module named site` when doing `npm install/update`, unsetting these python variables might help:
```bash
unset PYTHONPATH
unset PYTHONHOME
```

#### No CSS/JS assets
Make sure you have [Bower](http://bower.io/) installed and then run `bower install`.

#### When Bower is giving problems
It may help to `rm -rf ~/.cache/bower` and `rm -rf public/lib` (in your Trustroots repo clone) on GNU/Linux and macOS and then run `bower install`.

#### NPM giving EACCESS errors
You probably have an issue with directory permissions. Read [this documentation page](https://docs.npmjs.com/getting-started/fixing-npm-permissions) for how to fix it.
You shouldn't run scripts with sudo anyway.

## Other

#### Error at signup page
Make sure you've set mailer settings as described at [install instructions](https://github.com/Trustroots/trustroots/#installation).

#### No icons
Make sure you're connected to internet and try running `npm run fontello` (local) `docker-compose run trustroots npm run fontello` (Docker).

#### My database is not up to date with model
Try to run migration script by typing `migrate`. If this doesn't work, install migration module globally `npm install -g migrate` and then try again. You can also empty your database and run `node ./scripts/fillTestData.js 1000` to get yourself fresh database. 
If you're running the app inside docker, remember to run these inside containers, e.g.: `docker-compose run trustroots npm run migrate`

#### Migration script says "SyntaxError: Unexpected end of input"
Might be caused by `migrations/.migrate` file. Try removing/renaming it.

#### Some Bower error
Try these:
- removing `public/lib` folder
- or running `bower prune`
- or running `bower cache clean`
...and running `bower install` or `bower update` again.

## Tests

#### Can't run Selenium tests (test.py)
* Selenium tests might be outdated (as of 04/2016 they are).
* Do you have selenium installed? `pip install selenium`
* Do you have pip/setuptools installed? `wget https://bootstrap.pypa.io/get-pip.py && python get-pip.py && rm get-pip.py`
* Is your python version 2.x? `python --version`

## Production
#### Phusion Passenger: "Disconnecting client with error: client socket write error: Broken pipe (errno=32)"
[You can ignore this.](http://stackoverflow.com/a/29004608)
