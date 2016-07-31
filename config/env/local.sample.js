'use strict';

/**
 * Rename this file to local.js for having local configuration variables that
 * will not get commited and pushed to remote repositories.
 * Use it for your API keys, passwords, etc.
 *
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 */

module.exports = {

  // See https://github.com/andris9/Nodemailer#tldr-usage-example how to configure mailer
  // Note about Gmail https://github.com/andris9/Nodemailer#using-gmail
  // We recommend Mandrill, which is free up to 12K messages.
  /*
  mailer: {
    from: 'gmail.user@gmail.com',
    options: {
      service: 'Gmail',
      auth: {
        user: 'gmail.user@gmail.com',
        pass: 'userpass'
      }
    }
  }
  */

  // Example configuration using MailDev
  // https://github.com/djfarrelly/MailDev
  /*
  mailer: {
    from: 'trustroots@dev.trustroots.org',
    options: {
      host: 'localhost',
      port: 1025,
      ignoreTLS: true,
      auth: false
    }
  }
  */

  // Uncomment if you want to have Mapbox maps at development environment
  /*
  mapbox: {
    maps: {
      streets: {
        map: 'k8mokch5',
        user: 'trustroots',
        legacy: true
      },
      satellite: {
        map: 'satellite-streets-v9',
        user: 'mapbox',
        legacy: false
      },
      outdoors: {
        map: 'outdoors-v9',
        user: 'mapbox',
        legacy: false
      },
    },
    user: 'trustroots',
    publicKey: 'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJVWFFGa19BIn0.4e59q4-7e8yvgvcd1jzF4g'
  }
  */

  // RabbitMQ job queue
  // https://www.rabbitmq.com/access-control.html
  /*
  rabbitmq: {
    emailsQueue: 'emails',
    // options object for AMQP
    // https://www.npmjs.com/package/amqp
    options: {
      host: 'localhost',
      port: 5672,
      login: 'guest',
      password: 'guest',
      connectionTimeout: 10000,
      noDelay: true,
      authMechanism: 'AMQPLAIN',
      vhost: '/',
      ssl: {
        enabled: true,
        keyFile: '/path/to/key/file',
        certFile: '/path/to/cert/file',
        caFile: '/path/to/cacert/file',
        rejectUnauthorized: true
      }
    }
  }
  */

};
