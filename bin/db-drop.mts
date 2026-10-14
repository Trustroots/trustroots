#!/usr/bin/env node
import mongooseService from './../config/lib/mongoose.mjs';
import type { Connection } from 'mongoose';
if (process.env.NODE_ENV === 'production') {
  console.error('You cannot drop database in production mode!');
  process.exit(1);
}

// Use mongoose configuration

mongooseService.connect(function (db: Connection) {
  mongooseService.dropDatabase(db, function () {
    mongooseService.disconnect();
  });
});
