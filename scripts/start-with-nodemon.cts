#!/usr/bin/env node

interface NodemonOptions {
  script: string;
  nodeArgs: string[];
  ext: string;
  ignore: string[];
  watch: string[];
}

interface NodemonProcess {
  on(event: 'crash' | 'exit', listener: () => void): NodemonProcess;
}

interface ServerAssets {
  fontelloConfig: string;
  workerJS: string[];
  allJS: string[];
  views: string;
  config: string;
}

const nodemon = require('nodemon') as (
  options: NodemonOptions,
) => NodemonProcess;
const assets = (
  require('./../config/assets/default.mjs') as {
    server: ServerAssets;
  }
).server;

const worker = process.argv[2] === 'worker';
const name = worker ? 'Worker' : 'Server';
const inspectPort = worker ? 5859 : 5858;
const inspectHost = process.env.TRUSTROOTS_NODE_INSPECT_HOST || '127.0.0.1';

nodemon({
  script: worker ? 'worker.js' : 'server.js',
  nodeArgs: [`--inspect=${inspectHost}:${inspectPort}`],
  ext: worker ? 'js, mjs, mts' : 'js, mjs, mts, html',
  ignore: [
    'bin/**',
    'migrations/**',
    'modules/*/client/**',
    'modules/*/tests/client/**/*.js',
    'modules/*/tests/server/**/*.{js,cts,mts}',
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
