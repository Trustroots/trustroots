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
if (process.argv[2]) {
  console.log(`Ensuring indexes only for Mongo collection "${process.argv[2]}"`);
  predefinedModel = process.argv[2];
} else {
  console.log('Ensuring indexes for all Mongo collections');
};

mongooseService.connect(async (connection) => {
  await mongooseService.loadModels();
  const allModels = connection.modelNames();
  if (!allModels.includes(predefinedModel)) {
    console.error(`"${predefinedModel}" is not a valid model name. Models: ${allModels.join(', ')}`);
    process.exit(1);
  }
  const models = predefinedModel ? [predefinedModel] : allModels;
  await mongooseService.ensureIndexes(connection, models);
  await mongooseService.disconnect();
});


console.log('Done!');
