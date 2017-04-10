
var path = require('path'),
    firebase = require('firebase-admin'),
    // TODO: make this part of config somewhere...
    firebaseConfig = require(path.resolve('./firebase.json')),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseConfig)
});

exports.sendUserNotification = function(user, tokens, payload, callback) {

  // TODO: check tokens are valid for user...

  firebase.messaging().sendToDevice(tokens, payload)
    .then(function(response) {
      var unregisteredTokens = [];
      response.results.forEach(function(result, idx) {
        if (result.error) {
          if (result.error.code === 'messaging/registration-token-not-registered') {
            unregisteredTokens.push(tokens[idx]);
          }
        }
      });
      if (unregisteredTokens.length > 0) {
        removeUserPushTokens(user, unregisteredTokens, callback);
      } else {
        callback();
      }
    }).catch(function(err) {
      if (err) console.error('error sending push!', err);
      callback(err);
    });

};

function removeUserPushTokens(user, tokens, callback) {
  if (!tokens || tokens.length === 0) return callback();

  var query = {
    $pull: {
      pushRegistration: {
        token: {
          $in: tokens
        }
      }
    }
  };

  User.findByIdAndUpdate(user._id, query, {
    safe: true // @link http://stackoverflow.com/a/4975054/1984644
  }).exec(function(err) {
    if (err) console.error('error removing tokens', err);
    callback(err);
  });

}
