#!/usr/bin/env node
/* eslint-disable no-console */

const glob = require('glob');
const Mocha = require('mocha');
const path = require('path');

const mongooseService = require('../config/lib/mongoose');
const agenda = require('../config/lib/agenda');
const configuredTestFiles = process.env.SERVER_TEST_FILES
  ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
  : [];
const testFiles =
  configuredTestFiles.length > 0
    ? configuredTestFiles
    : glob.sync('modules/*/tests/server/**/*.js');

function finish(error) {
  agenda._mdb.close(() => {
    mongooseService.disconnect(() => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  });
}

mongooseService.connect(db => {
  mongooseService.dropDatabase(db, () => {
    mongooseService.loadModels(() => {
      const modelNames = require('mongoose').connection.modelNames();

      mongooseService
        .ensureIndexes(modelNames)
        .then(() => {
          const mochaRunner = new Mocha({ reporter: 'spec', timeout: 10000 });

          testFiles.forEach(testFile =>
            mochaRunner.addFile(path.resolve(testFile)),
          );

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
