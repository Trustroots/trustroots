import _ from 'lodash';
import winston from 'winston';
import config from './../config.mjs';
import dependency3 from './log-redaction.mjs';
import dependency4 from 'winston-papertrail-transport';
/*
 * A general purpose logging service that can be used anywhere in the app
 *
 * See docs/Logging.md
 */

/**
 * Module dependencies.
 */

const { redactMetadata } = dependency3;
const { PapertrailTransport } = dependency4;

const papertrailConfig = _.get(config, 'log.papertrail');

winston.configure({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
  ),
  transports: [new winston.transports.Console()],
});

// If there we have a host and port for papertrail, then configure it
if (papertrailConfig.host && papertrailConfig.port) {
  winston.add(new PapertrailTransport(papertrailConfig));
}

// Log that the logger has been instantiated
winston.log('info', 'Logger started #a5fKSK');
// Add a console.log() to help debugging logger issues
console.log('Logger just started #SQrUgw');

// Keep Winston's existing arguments and return value, while sanitising any
// object arguments before they reach a configured transport.
function log(...args: unknown[]): winston.Logger {
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] && typeof args[index] === 'object') {
      args[index] = redactMetadata(args[index]);
    }
  }
  const forwardLog = winston.log as (
    ...arguments_: unknown[]
  ) => winston.Logger;
  return forwardLog.apply(winston, args);
}
const service = log;
export default service;
export { service as 'module.exports' };
