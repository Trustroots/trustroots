var path = require('path'),
    firebase = require('firebase-admin'),
    // TODO: make this part of config somewhere...
    firebaseConfig = require(path.resolve('./firebase.json'));

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseConfig)
});

module.exports = firebase.messaging();
