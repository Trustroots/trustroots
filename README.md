# [Trustroots.org](https://www.trustroots.org/)

_Hospitality exchange community for hitchhikers and other travellers._

![Trustroots logo](https://raw.githubusercontent.com/Trustroots/trustroots/master/modules/core/client/img/logo/color.png)

## Volunteering

You don't have the be a programmer to participate. Check [volunteers page](https://github.com/Trustroots/trustroots/wiki/Volunteering) for more info.

## Development

Check [development page](https://github.com/Trustroots/trustroots/wiki/Development) to get started and [join us to chat](https://gitter.im/Trustroots).

## Installing

We have two major ways of running the software: trough Vagrant box (less work but runs slower) or by installing locally (recommended, more work but runs faster).

See [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting) if you encounter errors.

### Installing locally

Install the stack on your localhost and run NodeJS. This approach takes a little more time to setup, and bit more manual configuration, but is super fast, and can be easier to work with. See [INSTALL.md](INSTALL.md) for details.

#### Quick start
* Install dependencies: `npm install && bower install`
* Run in development mode: `grunt`
* Run in production mode: `grunt prod`
* Run tests: `test`, (server & client) or `test:server` or `test:client` for only either one.

### Vagrant

The easiest and quickest way to get started is with Vagrant. See [INSTALL-VAGRANT.md](INSTALL-VAGRANT.md) for further details. Running through Vagrant can be a little bit slower, but it's a very quick and easy way to get started. Depending on the specifics of your own development setup, you might prefer to run the code locally if you're going to do a lot of development.

### Mock data

There's a script that can generate mock user data. It's highly recommended you run this script after installation, that way you'll have something to look at.

1. Make sure the collections offers and users are empty, in order to avoid duplicate values. This is the default on a new install.
2. Run `node scripts/fillTestData.js 1000 username` _or_ if you use vagrant box, run: `vagrant ssh -c "node /srv/trustroots/scripts/fillTestData.js 1000 username"`. That will create 1000 users and hosting offers. Username is optional (a-z0-9) and will create a user with that username as an admin.
3. It can take up to 5 minutes. Mongoose might complain about duplicates - just ignore these errors.
4. To see the result, log in with your chosen username and password `password`.

### Documentation

Produce documentation by running `grunt docs`

Then run the application (just `grunt`) and open [http://localhost:3000/developers/](http://localhost:3000/developers/).

## License

[The MIT License](LICENSE.md)
