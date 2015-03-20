# Running Trustroots locally

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
4. Copy config _template to development: `cp ./config/secret/_template.js ./config/secret/development.js` — add any configurations you want to keep out of version control here. Many features rely on sending emails, so add settings to the `mailer` section. See [nodemailer smtp usage](https://github.com/andris9/nodemailer-smtp-transport#usage) and note that it has pre filled settings for [some services](https://github.com/andris9/nodemailer-smtp-transport#using-well-known-services).
5. Finally run grunt default task: `grunt`

Application should run on the 3000 port in development mode. Open [http://localhost:3000](http://localhost:3000) in your browser.
