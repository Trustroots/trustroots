const { cert, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const config = require('../config');
const serviceAccount = config.fcm.serviceAccount;

if (serviceAccount) {
  const app = initializeApp({
    credential: cert(serviceAccount),
  });
  module.exports = getMessaging(app);
} else {
  console.info('fcm.serviceAccount not set');
}
