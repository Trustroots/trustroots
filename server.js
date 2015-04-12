'use strict';

/**
 * Module dependencies.
 */
var init = require('./config/init')(),
    config = require('./config/config'),
    mongoose = require('mongoose'),
    chalk = require('chalk');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

// NewRelic monitoring
// @link http://newrelic.com/
if(process.env.NODE_ENV === 'production' && config.newrelic.enabled === true) {
  var newrelic = require('newrelic');
}

// Bootstrap db connection
var db = mongoose.connect(config.db.uri, config.db.options, function(err) {
	if (err) {
		console.error(chalk.red('Could not connect to MongoDB!'));
		console.log(chalk.red(err));
	}
});
mongoose.connection.on('error', function(err) {
	console.error(chalk.red('MongoDB connection error: ' + err));
	process.exit(-1);
	}
);

// Init the express application
var app = require('./config/express')(db);

// Bootstrap passport config
require('./config/passport')();

// Start the app by listening on <port>
// Added get() for socket.io - This will make sure we don’t mess up our http server instance of express. Was: app.listen(config.port);
app.get('server').listen(config.port);

// Expose app
exports = module.exports = app;

// Setup Agenda
var jobSchedule = require('./config/agenda');
jobSchedule.setupJobs();

// Logging initialization
console.log('--');
console.log(chalk.green('Trustroots started'));
console.log(chalk.green('Environment:\t\t\t' + process.env.NODE_ENV));
console.log(chalk.green('Port:\t\t\t\t' + config.port));
console.log(chalk.green('Database:\t\t\t' + config.db.uri));
if (process.env.NODE_ENV === 'secure') {
	console.log(chalk.green('HTTPs:\t\t\t\ton'));
}
console.log('--');
