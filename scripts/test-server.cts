#!/usr/bin/env node
/* eslint-disable no-console */

const { globSync } = require('node:fs') as typeof import('node:fs');
const Mocha: typeof import('mocha') = require('mocha');
const path = require('node:path') as typeof import('node:path');

interface MongooseService {
  connect(callback: (connection: import('mongoose').Connection) => void): void;
  dropDatabase(
    connection: import('mongoose').Connection,
    callback: (error?: Error) => void,
  ): void;
  loadModels(callback: () => void): Promise<void>;
  ensureIndexes(modelNames: string[]): Promise<void>;
  disconnect(callback: (error?: Error) => void): void;
}

interface AgendaService {
  close(): Promise<void>;
}

const mongooseService = require('./../config/lib/mongoose.mjs') as MongooseService;
const agenda = require('./../config/lib/agenda.mjs') as AgendaService;
const configuredTestFiles = process.env.SERVER_TEST_FILES
  ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
  : [];
const testFiles =
  configuredTestFiles.length > 0
    ? configuredTestFiles
    : globSync('modules/*/tests/server/**/*.{js,cts,mts}').sort();

async function finish(error: unknown): Promise<void> {
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

mongooseService.connect((db: import('mongoose').Connection) => {
  mongooseService.dropDatabase(db, () => {
    mongooseService.loadModels(async () => {
            const modelNames = (
              require('mongoose') as typeof import('mongoose')
            ).connection.modelNames();

      mongooseService
        .ensureIndexes(modelNames)
        .then(async () => {
          const mochaRunner = new Mocha({ reporter: 'spec', timeout: 10000 });

          testFiles.forEach((testFile: string) =>
            mochaRunner.addFile(path.resolve(testFile)),
          );

          await mochaRunner.loadFilesAsync();
          mochaRunner.run((failures: number) => {
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
