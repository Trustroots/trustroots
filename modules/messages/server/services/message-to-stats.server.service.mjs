import service, {
  process,
  save,
  send,
} from './message-to-stats.server.service.mts';

export { process, save, send };
export default service;
export { service as 'module.exports' };
