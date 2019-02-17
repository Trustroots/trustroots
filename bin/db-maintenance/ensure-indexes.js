#!/usr/bin/env node

/**
 * Ensure DB indices are generated. Note that this is a heavy action for the DB.
 *
 * Usage:
 *
 *  npm run ensure-indexes
 *
 * Ensure indexes only for specific Mongoose Model
 *
 *  npm run ensure-indexes -- ModelName
 *
 * Example:
 *  npm run ensure-indexes -- User
 */

const config = require('../../config/config');
const mongooseService = require('../../config/lib/mongoose');

let predefinedModel;
if (process.argv[2] === 'reverse') {
  console.log(`Ensuring indexes only for Mongo collection ${process.argv[2]}`);
  predefinedModel = process.argv[2];
} else {
  console.log('Ensuring indexes for all Mongo collections');
};

mongooseService.connect(async (connection) => {
  await mongooseService.loadModels();
  const models = predefinedModel ? [predefinedModel] : connection.modelNames();
  await mongooseService.ensureIndexes(connection, models);
  await mongooseService.disconnect();
});


console.log('Done!');
