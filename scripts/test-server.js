#!/usr/bin/env node
/* eslint-disable no-console */

if (process.env.NODE_ENV !== 'test') {
  console.error('Server tests require NODE_ENV=test; refusing to connect.');
  process.exit(1);
}

const glob = require('glob');
const Mocha = require('mocha');
const path = require('path');

const mongooseService = require('./../config/lib/mongoose.mjs');
const agenda = require('./../config/lib/agenda.mjs');
const configuredTestFiles = process.env.SERVER_TEST_FILES
  ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
  : [];
const testFiles =
  configuredTestFiles.length > 0
    ? configuredTestFiles
    : glob.sync('modules/*/tests/server/**/*.js');

async function finish(error) {
  try {
    await agenda.close();
  } catch (closeError) {
    error = error || closeError;
  }
  mongooseService.disconnect(() => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

mongooseService.connect(db => {
  const databaseName = db?.db?.databaseName || db?.name;
  if (!/^trustroots-test(?:-worker-[a-f0-9]{12}-[1-8])?$/.test(databaseName)) {
    return finish(
      new Error(
        `Refusing to run server tests against unexpected database: ${databaseName || 'unknown'}`,
      ),
    );
  }

  mongooseService.dropDatabase(db, () => {
    mongooseService.loadModels(async () => {
      const modelNames = require('mongoose').connection.modelNames();

      mongooseService
        .ensureIndexes(modelNames)
        .then(async () => {
          const mochaRunner = new Mocha({ reporter: 'spec', timeout: 10000 });

          testFiles.forEach(testFile =>
            mochaRunner.addFile(path.resolve(testFile)),
          );

          await mochaRunner.loadFilesAsync();
          mochaRunner.run(failures => {
            if (typeof mochaRunner.unloadFiles === 'function') {
              mochaRunner.unloadFiles();
            }

            finish(failures ? `${failures} server test(s) failed.` : null);
          });
        })
        .catch(finish);
    });
  });
});
