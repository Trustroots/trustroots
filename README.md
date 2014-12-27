# Trustroots
_Hospitality exchange community for hitchhikers and other travellers._

[Trustroots.org](https://www.trustroots.org)

You don't have the be a coder to participate. Check [this page](https://github.com/Trustroots/trustroots/wiki/Volunteering) for more info.


## Prerequisites
Make sure you have installed all these prerequisites:
* [Node.js](http://www.nodejs.org/download/) and the npm package manager.
* [MongoDB](http://www.mongodb.org/downloads).
* [Bower](http://bower.io/)
* [Grunt](http://gruntjs.com/)

### Getting started
1. Clone the repository: `git clone https://github.com/Trustroots/trustroots.git trustroots`
2. Install dependencies by running this inside **trustroots** folder: `npm install`
3. Make sure MongoDb running on the default port (27017)
4. Copy `./config/secret/_template.js` to `./config/secret/development.js` — add any configurations you want to keep out of version control here.
5. Run grunt default task: `grunt`

Your application should run on the 3000 port in development mode, so in your browser just go to [http://localhost:3000](http://localhost:3000)

## Development
* [Our docs](https://github.com/Trustroots/trustroots/wiki)
* See [Official Documentation](http://meanjs.org/docs.html) for MEAN.js  boilerplate
* Install [EditorConfig](http://editorconfig.org/) to your IDE if possible
* [Contact us](http://ideas.trustroots.org/contact/)

### Fill database with test users and offers
1. Make sure the collections offers and users are empty, in order to avoid duplicate values.
2. Run `node scripts/filltestData.js 1000` (for 1000 users and offers).
3. The script will create the users and the offers. It can take some time, it will tell you when it's finished.
4. To see the result run `grunt` and log in trustroots with user: trout and password: password.

## Community
* Join [#trustroots](http://webchat.freenode.net/?channels=trustroots) on freenode
* Ping us on [Twitter](https://twitter.com/trustroots) and [Facebook](https://www.facebook.com/trustroots.org)

## License
[The MIT License](LICENSE.md)
