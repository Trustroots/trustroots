#!/usr/bin/env node

// Use mongoose configuration
var mongooseService = require('../config/lib/mongoose.js');

mongooseService.connect(function (db) {
  db.connection.db.dropDatabase(function (err) {
    if (err) {
      console.error('Failed to drop db');
      console.error(err);
    } else {
      console.log('Successfully dropped db:', db.connection.db.databaseName);
    }
    db.connection.db.close();
  });
});
