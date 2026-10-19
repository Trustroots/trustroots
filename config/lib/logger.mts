import winston from 'winston';
import dependency3 from './log-redaction.mjs';
/*
 * A general purpose logging service that can be used anywhere in the app
 *
 * See docs/Logging.md
 */

/**
 * Module dependencies.
 */

const { redactMetadata } = dependency3;

winston.configure({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple(),
  ),
  transports: [new winston.transports.Console()],
});

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
