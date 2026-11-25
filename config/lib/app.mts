import type { Express } from 'express';
import type { Connection } from 'mongoose';
import { createServer, type Server } from 'node:http';
import { NodeRequest, sendNodeResponse } from 'srvx/node';
import config from './../config.mts';
import mongoose from './mongoose.mts';
import express from './express.mts';
type StartupConfiguration = {
  fd?: number | null;
  port: number | string;
  host: string;
  mailer: { service?: string };
  db: { uri: string; autoIndex?: unknown };
  https?: unknown;
  influxdb?: { enabled?: boolean };
};
type InitCallback = (
  app: Express,
  connection: Connection,
  config: StartupConfiguration,
) => void;
type ListenArgument = number | string | { fd: number } | (() => void);
declare const PhusionPassenger: unknown;
const service = { init, start };
/**
 * Module dependencies.
 */

function init(callback?: InitCallback) {
  mongoose.connect(async function (connection) {
    // Initialize express
    const app = await express.init(connection);
    if (callback) callback(app, connection, config as StartupConfiguration);
  });
}
const startServerEntry = new URL(
  '../../build/start-server/server.js',
  import.meta.url,
).href;

/**
 * TanStack Start serves every request. Those no Start route matches come back
 * marked, and Express answers them on the untouched Node request and response.
 * In development the Vite server fronts Express instead.
 */
async function createHttpServer(app: Express): Promise<Server> {
  if (process.env.NODE_ENV === 'development') return createServer(app);
  const { default: startServer } = await import(startServerEntry);
  const fallbackHeader = 'x-trustroots-express';
  const express = () =>
    new Response(null, { headers: { [fallbackHeader]: '1' } });
  return createServer(async (req, res) => {
    const response: Response = await startServer.fetch(
      new NodeRequest({ req, res }),
      { context: { express } },
    );
    if (response.headers.has(fallbackHeader)) app(req, res);
    else await sendNodeResponse(res, response);
  });
}
function start(this: { init: typeof init }, callback?: InitCallback) {
  this.init(async function (app, db, config) {
    const listenArgs: ListenArgument[] = [];
    if (config.fd) {
      // Start the app by listening on a file descriptor (useful for systemd socket activation)
      listenArgs.push({
        fd: config.fd,
      });
    } else {
      // Start the app by listening on <port> at <host>
      listenArgs.push(config.port, config.host);
    }
    const server = await createHttpServer(app);
    (server.listen as (...args: ListenArgument[]) => Server)(
      ...listenArgs,
      function () {
        // Check in case mailer config is still set to default values (a common problem)
        if (
          config.mailer.service &&
          config.mailer.service === 'MAILER_SERVICE_PROVIDER'
        ) {
          console.warn(
            "Remember to setup mailer from ./config/env/local.js - some features won't work without it.",
          );
        }

        // Logging initialization
        console.log('--');
        console.log(new Date());
        console.log('Environment:\t\t' + process.env.NODE_ENV);
        console.log('Database:\t\t' + config.db.uri);
        console.log(
          'Database autoindexing:\t' + (config.db.autoIndex ? 'on' : 'off'),
        );
        console.log('HTTPS:\t\t\t' + (config.https ? 'on' : 'off'));
        if (config.fd) {
          console.log('File Descriptor:\t' + config.fd);
        } else {
          console.log('Port:\t\t\t' + config.port);
        }
        console.log(
          'Phusion Passenger:\t' +
            (typeof PhusionPassenger !== 'undefined' ? 'on' : 'off'),
        );
        console.log(
          'InfluxDB:\t\t' +
            (config.influxdb && config.influxdb.enabled === true
              ? 'on'
              : 'off'),
        );
        console.log('--');
        console.log('');
        console.log('Trustroots is up and running now.');
        console.log('');
        if (callback) callback(app, db, config);
      },
    );
  });
}
export default service;
