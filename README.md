# Trustroots
_Hospitality exchange community for hitchhikers and other travellers._

[Trustroots.org](https://www.trustroots.org/)

![Trustroots logo](https://raw.githubusercontent.com/Trustroots/trustroots/master/public/modules/core/img/logo/color-green.png)

## Volunteering
* You don't have the be a coder to participate. Check [volunteers page](https://github.com/Trustroots/trustroots/wiki/Volunteering) for more info.
* [Drop us a message](http://ideas.trustroots.org/contact/)
* Join [#trustroots](http://webchat.freenode.net/?channels=trustroots) on Freenode chat
* Follow us on [Twitter](https://twitter.com/trustroots) and [Facebook](https://www.facebook.com/trustroots.org)

## Development
* [Check our docs](https://github.com/Trustroots/trustroots/wiki)
* See [documentation](http://meanjs.org/docs.html) for MEAN.js boilerplate
* Install [EditorConfig](http://editorconfig.org/) to your IDE if possible

### Prerequisites
Make sure you have installed all these prerequisites:
* [Node.js](http://www.nodejs.org/download/) and the npm package manager.
* [MongoDB](http://www.mongodb.org/downloads), version 2.6 (2.2 is too old)
* [Bower](http://bower.io/)      `npm -g install bower`
* [Grunt](http://gruntjs.com/)   `npm -g install grunt-cli`

### Installation
1. Clone the repository: `git clone https://github.com/Trustroots/trustroots.git trustroots`
2. Install dependencies by running this inside **trustroots** folder: `npm install`. Note that if you run npm with sudo, it might skip installing frontend assets. You can run it manually: `bower install`.
3. Make sure MongoDb is running on the default port (27017)
4. Copy config _template to develpment: `cp ./config/secret/_template.js ./config/secret/development.js` — add any configurations you want to keep out of version control here. Many features rely on sending emails, so add settings to the `mailer` section. See [nodemailer smtp usage](https://github.com/andris9/nodemailer-smtp-transport#usage) and note that it has pre filled settings for [some services](https://github.com/andris9/nodemailer-smtp-transport#using-well-known-services).
5. Finally run grunt default task: `grunt`

Application should run on the 3000 port in development mode. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Fill database with test users and offers
1. Make sure the collections offers and users are empty, in order to avoid duplicate values.
2. Run `node scripts/filltestData.js 1000` (for 1000 users and offers).
3. The script will create the users and the offers. It can take some time, it will tell you when it's finished.
4. To see the result run `grunt` and log in trustroots with user: trout and password: password.

## License
[The MIT License](LICENSE.md)
