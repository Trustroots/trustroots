
var firebase = require('firebase-admin'),
    serviceAccount = require('/code/fcm-play/key.json'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

exports.sendNotification = function(user, tokens, notification, callback) {

  firebase.messaging().sendToDevice(tokens, notification)
    .then(function(response) {
      var unregisteredTokens = [];
      response.results.forEach(function(result, idx) {
        if (result.error &&
            result.error.code === 'messaging/registration-token-not-registered') {
          unregisteredTokens.push(tokens[idx]);
        }
      });
      if (unregisteredTokens.length > 0) {
        removeUserPushTokens(user, unregisteredTokens, callback);
      } else {
        callback(null, user);
      }
    }).catch(callback);

};

function removeUserPushTokens(user, tokens, callback) {
  if (!tokens || tokens.length === 0) return callback();

  var query = {
    $pull: {
      pushRegistration: {
        token: tokens
      }
    }
  };

  User.findByIdAndUpdate(user._id, query, {
    safe: true // @link http://stackoverflow.com/a/4975054/1984644
  }).exec(function(err) {
    if (err) return callback(err);
    callback(null, user);
  });

}
