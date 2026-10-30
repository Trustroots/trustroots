import service, {
  process,
  save,
  send,
} from './message-to-stats.server.service.mts';

/** @esmNamed */
export { process, save, send };
export default service;
/** @commonjs */
export { service as 'module.exports' };
