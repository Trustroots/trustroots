#!/usr/bin/env node
/* eslint-disable no-console */

const nodemon = require('nodemon');
const assets = require('../config/assets/default').server;

const worker = process.argv[2] === 'worker';
const name = worker ? 'Worker' : 'Server';
const inspectPort = worker ? 5859 : 5858;
const inspectHost = process.env.TRUSTROOTS_NODE_INSPECT_HOST || '127.0.0.1';

nodemon({
  script: worker ? 'worker.js' : 'server.js',
  nodeArgs: [`--inspect=${inspectHost}:${inspectPort}`],
  ext: worker ? 'js' : 'js, html',
  ignore: [
    'bin/**',
    'migrations/**',
    'modules/*/client/**',
    'modules/*/tests/client/**/*.js',
    'modules/*/tests/server/**/*.js',
    'node_modules/**',
    'public/**',
    'scripts/**',
    'tmp/**',
    assets.fontelloConfig,
  ],
  watch: [
    ...(worker ? assets.workerJS : [assets.views]),
    ...assets.allJS,
    assets.config,
  ],
})
  .on('crash', () => console.error(`[${name}] Script crashed.`))
  .on('exit', () => console.log(`[${name}] Script exited.`));
