# [Trustroots.org](https://www.trustroots.org/)
_Hospitality exchange community for hitchhikers and other travellers._

![Trustroots logo](https://raw.githubusercontent.com/Trustroots/trustroots/master/public/modules/core/img/logo/color-green.png)

## Volunteering
* You don't have the be a programmer to participate. Check [volunteers page](https://github.com/Trustroots/trustroots/wiki/Volunteering) for more info.

## Development
Check [development page](https://github.com/Trustroots/trustroots/wiki/Development) to get started.

## Installing
We have two major ways of running the software: trough Vagrant box (less work but runs slower) or by installing locally (more work but runs faster).

See [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting) if you encounter errors.

### Installing with Vagrant
Easiest and quickest way to get started is with Vagrant. See [INSTALL-VAGRANT.md](INSTALL-VAGRANT.md) for further details. Since it's wrapped in a virtual container, it obviously runs slower.

### Installing locally
Installing the stack on your localhost and serving it with NodeJS. More config, but runs super fast. See [INSTALL.md](INSTALL.md) for details.

### Fill database with test users and offers
1. Make sure the collections offers and users are empty, in order to avoid duplicate values.
2. Run `node scripts/fillTestData.js 1000 username` _or_ if you use vagrant box, run: `vagrant ssh -c "node /srv/trustroots/scripts/fillTestData.js 1000 username"`. That will create 1000 users and hosting offers. Username is optional (a-z0-9) and will create user with that username as an admin.
3. It'll run a while. Mongoose might complain about duplicates - just ignore.
4. To see the result, log in with chosen username and password `password`.

## License
[The MIT License](LICENSE.md)
