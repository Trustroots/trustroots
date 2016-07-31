'use strict';
/**
 * Trustroots
 *
 * This worker script fetches queued messages from RabbitMQ and delivers these to SMTP
 */

// Debug Node.js C/C++ native code modules on dev mode
// @link https://www.npmjs.com/package/segfault-handler
if (process.env.NODE_ENV === 'development') {
  var SegfaultHandler = require('segfault-handler');
  SegfaultHandler.registerHandler('segfault.log');
  console.log('[Worker] Logging possible segfault errors to ./segfault.log');
}

var config = require('./config/config'),
    nodemailer = require('nodemailer'),
    smtpPool = require('nodemailer-smtp-pool'),
    async = require('async'),
    amqp = require('amqp'),
    chalk = require('chalk');

// Array of prefetched messages waiting for delivery
var waitingMessages = [];

// Logging initialization
console.log(chalk.white('--'));
console.log(chalk.green('[Worker] ' + new Date()));
console.log(chalk.green('[Worker] Environment:\t\t' + process.env.NODE_ENV));
console.log(chalk.green('[Worker] RabbitMQ URL:\t\t' + config.rabbitmq.options.host + ':' + config.rabbitmq.options.port));
console.log(chalk.green('[Worker] RabbitMQ SSL:\t\t' + config.rabbitmq.options.ssl.enabled));

// Reset console color
console.log(chalk.white('--'));
console.log('');
console.log(chalk.white('Trustroots background job worker running.'));
console.log('');

// Fire cleanup when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// Catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// Catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

// Create a SMTP transporter object
var transporter = nodemailer.createTransport(smtpPool(config.mailer.options), {
  // Default message fields if not present
  from: 'Trustroots <' + config.mailer.from + '>',
  subject: 'Hello from Trustroots!'
});

// Create connection to RabbitMQ
var queueConnection = amqp.createConnection(config.rabbitmq.options);

/**
 * Continue processing queue once RabbitMQ is ready
 */
queueConnection.on('ready', function () {
  queueConnection.queue(config.rabbitmq.emailsQueue, function (q) {
    console.log('[worker] -> queueConnection.queue');
    q.bind('#');
    q.subscribe({
      ack: true, // Do not fetch next messages until previous are acked
      prefetchCount: 10 // Prefetch 10 messages
    }, function (message, headers, deliveryInfo, ack) {
      console.log('[worker] -> q.subscribe');
      // Check if the message object is valid
      if (!message || !message.to) {
        console.error('[worker] No message, skipping: ' + deliveryInfo.deliveryTag.toString('hex'));
        // Reject, do not requeue
        return ack.reject();
      }
      console.log('[worker] -> push to cache');
      // Push to cache
      waitingMessages.push({
        message: message,
        deliveryTag: deliveryInfo.deliveryTag.toString('hex'),
        ack: ack
      });
      // Try to flush cached messages by sending these to SMTP
      flushWaitingMessages();
    });
  });
});

/**
 * Report connection errors
 */
queueConnection.on('error', function(err) {
  console.error('[worker] Error connecting to RabbitMQ', err);
});

/**
 * Whenever transporter gets into idling, try to send some mail
 * @link https://github.com/nodemailer/nodemailer#eventidle
 */
transporter.on('idle', flushWaitingMessages);

/**
 * Flushes cached messages to Nodemailer for delivery
 */
function flushWaitingMessages() {
  console.log('[worker] -> flushWaitingMessages');
  // Actual send function
  var send = function (data) {
    console.log('[worker] -> send');
    // sendMail does not immediatelly send, instead it tries to allocate a free connection to SMTP server
    // and if fails, then pushes the message into internal queue. As we only prefetch 10 messages
    // then the internal queue can never grow into something too large. At most there will be 5 messages
    // idling in the queue (another 5 are being currently sent by the default number of 5 connections)
    transporter.sendMail(data.message, function (err, info) {
      if (err) {
        console.log('worker -> Message failed (%s): %s', data.deliveryTag, err.message);
        console.log(data.message);
        // reject and requeue on error (wait 1 sec. before requeueing)
        // NB! If the failure is permanent then this approach results in an
        // infinite loop since failing message is never removed from the queue
        setTimeout(function () {
          data.ack.reject(true);
          console.log('worker -> data.ack.reject');
        }, 3000);
        return false;
      }
      console.log('worker -> Message delivered (%s): %s', data.deliveryTag, info.response);
      data.ack.acknowledge();
      console.log('worker -> data.ack.acknowledge');
    });

  }; // send()

  // Send cached messages if transporter is idling
  while (transporter.isIdle() && waitingMessages.length) {
    send(waitingMessages.shift());
  }

  var count = 0;
  async.whilst(
    function() {
      console.log('test: ' + transporter.isIdle() && waitingMessages.length);
      return transporter.isIdle() && waitingMessages.length;
    },
    function(callback) {
      count++;
      send(waitingMessages.shift());
      callback(null, count);
    },
    function(err, n) {
      // done whilst
      console.log('done whilst: ' + count);
      count = 0;
    }
  );

  /*
  async.forever(
    function(next) {
      send(waitingMessages.shift());
      // Repeat after the delay
      setTimeout(function() {
        next();
      }, 1000)
    },
    function(err) {
      console.error(err);
    }
  );
  */

}

/**
 * Handle script exists
 */
function exitHandler(options, err) {
  if (options.cleanup) {
    console.log('[worker] Disconnecting from RabbitMQ.');
    // Cleanly disconnect from the server,
    // the socket will not be closed until
    // the server responds to the disconnection request.
    queueConnection.disconnect();
  }

  if (err) {
    console.error('[worker] Error: ', err.stack);
  }

  if (options.exit) {
    process.exit();
  }
}

// So the program will not close instantly
process.stdin.resume();
