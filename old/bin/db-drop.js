#!/usr/bin/env node

if (process.env.NODE_ENV === 'production') {
  console.error('You cannot drop database in production mode!');
  process.exit(1);
}

// Use mongoose configuration
const mongooseService = require('../config/lib/mongoose.js');

mongooseService.connect(function (db) {
  mongooseService.dropDatabase(db, function () {
    mongooseService.disconnect();
  });
});
