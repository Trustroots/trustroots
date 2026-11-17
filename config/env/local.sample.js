/**
 * Rename this file to local.js for having local configuration variables that
 * will not get commited and pushed to remote repositories.
 * Use it for your API keys, passwords, etc.
 *
 * Load order:
 * - default.mts
 * - {development|production|test}.mts
 * - local.js
 */

module.exports = {
  /*
  // Enable only after outbound mail and the support mailbox are configured.
  // Leave legacy support forwarding enabled until the worker logs that the
  // support mailbox cutover is initialised, then disable the legacy forwarder.
  // This first poll skips existing mail; it does not import mailbox history.
  supportInbox: {
    enabled: true,
    fromName: 'Trustroots Support',
    fromAddress: 'support@example.org',
    imap: {
      enabled: true,
      host: 'imap.example.org',
      port: 993,
      secure: true,
      user: 'support@example.org',
      password: 'set-in-private-local-config',
      mailbox: 'INBOX',
      pollIntervalMinutes: 1,
      // Above this raw size, only the sender, subject, IDs and attachment
      // metadata are stored. Stored message text is capped separately below.
      maxMessageBytes: 25 * 1024 * 1024,
      maxStoredBodyBytes: 12 * 1024 * 1024,
      maxMessagesPerPoll: 50,
    },
  },
  */
  // Uncomment if you have installed InfluxDB and would like to store collected statistics
  /*
  influxdb: {
    enabled: true,
    options: {
      host: 'localhost',
      port: 8086, // default 8086
      protocol: 'http', // default 'http'
      // username: '',
      // password: '',
      database: 'trustroots'
    }
  },
  */
  // Uncomment if you want to have Mapbox maps at development environment
  /*
  mapbox: {
    publicKey:
      'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJjanhydWF3bDkwYnd0M2JtanB2amg1NWVpIn0.a8XP1jMeVFBsScDI3oV1BA',
  }
  */
};
