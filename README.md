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
2. (If you develop with Vagrant, login to your box by `vagrant ssh` first.)
3. Run `node scripts/fillTestData.js 1000` (for 1000 users and offers).
4. The script will create the users and the offers. It can take some time, it will tell you when it's finished.
5. To see the result, log in with user `trout` and password `password`.

## License
[The MIT License](LICENSE.md)
