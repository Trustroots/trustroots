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
  /*
  featureFlags: {
    ...require('development').featureFlags
    // List your fature flag modifications here
  }
  */
  /*
  // Appears on top of every page for authenticated users.
  // There's no way turning them off permanently,
  // so remember to keep them visible only limited times.
  siteAnnouncement: {
    enabled: true,
    // Can contain HTML
    // You can access user object like this: `{{app.user.displayName}}`
    message: 'Hey {{app.user.displayName}}!'
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
  // Uncomment if you have a stathat account and would like to collect statistics.
  // You need to provide your stathat key
  /*
  // Configuration of stathat.
  // www.stathat.com is a tool/service for tracking statistics
  stathat: {
    enabled: true,
    key: ''
  },
  */
  // Uncomment to configure Google FCM push
  // serviceAccount comes from a json file downloaded from the fcm console
  /*
  fcm: {
    senderId: '',
    serviceAccount: {
    }
  },
  */
  // Uncomment if you want to have Mapbox maps at development environment
  /*
  mapbox: {
    maps: {
      // Old Trustroots main map layer (2014–05/2019)
      //streets: {
      //  map: 'k8mokch5',
      //  user: 'trustroots',
      //  legacy: true
      //},
      // New Trustroots main map layer (05/2019–)
      // https://www.mapbox.com/maps/streets/
      streets: {
        map: 'streets-v11',
        user: 'mapbox',
        legacy: false
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
      }
    },
    user: 'trustroots',
    publicKey:
      'pk.eyJ1IjoidHJ1c3Ryb290cyIsImEiOiJjanhydWF3bDkwYnd0M2JtanB2amg1NWVpIn0.a8XP1jMeVFBsScDI3oV1BA',
  }
  */
};
