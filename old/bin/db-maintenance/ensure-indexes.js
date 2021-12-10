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
const mongooseService = require('../../config/lib/mongoose');

let predefinedModel;
if (process.argv[2]) {
  console.log(
    `Ensuring indexes only for Mongo collection "${process.argv[2]}"`,
  );
  predefinedModel = process.argv[2];
} else {
  console.log('Ensuring indexes for all Mongo collections');
}

mongooseService.connect(async connection => {
  await mongooseService.loadModels();
  const modelNames = connection.modelNames();

  // Validate manually defined model
  if (predefinedModel && !modelNames.includes(predefinedModel)) {
    console.error(
      `"${predefinedModel}" is not a valid model name. Models: ${modelNames.join(
        ', ',
      )}`,
    );
    process.exit(1);
  }

  const modelNamesToIndex = predefinedModel ? [predefinedModel] : modelNames;

  await mongooseService.ensureIndexes(modelNamesToIndex).catch(console.error);
  await mongooseService.disconnect();
});
