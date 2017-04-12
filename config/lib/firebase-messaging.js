var path = require('path'),
    firebase = require('firebase-admin'),
    config = require(path.resolve('./config/config')),
    serviceAccount = config.fcm.serviceAccount;

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

module.exports = firebase.messaging();
