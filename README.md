# Trust Roots
"Travellers network"

Trust Roots is developed using MEAN.js boilerplate is based on [MongoDB](http://www.mongodb.org/), [Node.js](http://www.nodejs.org/), [Express](http://expressjs.com/), and [AngularJS](http://angularjs.org/).

## Prerequisites
Make sure you have installed all these prerequisites:
* [Node.js](http://www.nodejs.org/download/) and the npm package manager, if you encounter any problems, you can also use this [Github Gist](https://gist.github.com/isaacs/579814) to install Node.js.
* [MongoDB](http://www.mongodb.org/downloads), and make sure it's running on the default port (27017).
* [Bower](http://bower.io/) to manage your front-end packages, in order to install it make sure you've installed Node.js and npm, then install bower globally using npm: `npm install -g bower`
* [Grunt](http://gruntjs.com/) task runner to automate your development process, in order to install it make sure you've installed Node.js and npm, then install grunt globally using npm: `npm install -g grunt-cli`

### Cloning repository
```
$ git clone https://github.com/Trustroots/trustroots.git trustroots
```
This will clone the latest version of the Trust Roots repository to a **trustroots** folder.

### Downloading the repository zip file
```
$ wget https://github.com/Trustroots/trustroots/archive/master.zip -O trustroots.zip; unzip trustroots.zip; rm trustroots.zip
```

## Quick Install
Install the Node.js dependencies.

Run this inside **trustroots** folder:
```
$ npm install
```

This command does a few things:
* First it will install the dependencies needed for the application to run.
* If you're running in a development environment, it will then also install development dependencies needed for testing and running your application.
* Finally, when the install process is over, npm will initiate a bower install command to install all the front-end modules needed for the application.

## Running Your Application
After the install, just run grunt default task:

```
$ grunt
```

...that equals to:
```
$ NODE_ENV=development grunt default
```

Your application should run on the 3000 port so in your browser just go to [http://localhost:3000](http://localhost:3000)


## Development and deployment With Docker

* Install [Docker](http://www.docker.com/)
* Install [Fig](https://github.com/orchardup/fig)

* Local development and testing with fig:
```bash
$ fig up
```

* Local development and testing with just Docker:
```bash
$ docker build -t trustroots .
$ docker run -p 27017:27017 -d --name db mongo
$ docker run -p 3000:3000 --link db:db_1 trustroots
$
```

* To enable live reload forward 35729 port and mount /app and /public as volumes:
```bash
$ docker run -p 3000:3000 -p 35729:35729 -v /path/to/trustroots/public:/home/trustroots/public -v /path/to/trustroots/app:/home/trustroots/app --link db:db_1 trustroots
```

## Getting Started With Trust Roots Development
* [Github](https://github.com/Trustroots/)
* See [Offical Documentation](http://meanjs.org/docs.html) for MEAN.js
* [Our docs](documentation/README.md)
* Install [EditorConfig](http://editorconfig.org/) if possible

### Understand these
Before you begin we recommend you read about the basic building blocks that assemble a MEAN.JS application:
* MongoDB - Go through [MongoDB Official Website](http://mongodb.org/) and proceed to their [Official Manual](http://docs.mongodb.org/manual/), which should help you understand NoSQL and MongoDB better.
* Express - The best way to understand express is through its [Official Website](http://expressjs.com/), particularly [The Express Guide](http://expressjs.com/guide.html); you can also go through this [StackOverflow Thread](http://stackoverflow.com/questions/8144214/learning-express-for-node-js) for more resources.
* AngularJS - Angular's [Official Website](http://angularjs.org/) is a great starting point. You can also use [Thinkster Popular Guide](http://www.thinkster.io/), and the [Egghead Videos](https://egghead.io/).
* Node.js - Start by going through [Node.js Official Website](http://nodejs.org/) and this [StackOverflow Thread](http://stackoverflow.com/questions/2353818/how-do-i-get-started-with-node-js), which should get you going with the Node.js platform in no time.



## Community
* Join #trustroots on freenode.
* Ping us on [Twitter](http://twitter.com/trustroots) and [Facebook](http://facebook.com/trustroots)

## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
