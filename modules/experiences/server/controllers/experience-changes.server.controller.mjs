import service from './experience-changes.server.controller.mts';

export const { readAccess, readMine, submit } = service;
export default service;
export { service as 'module.exports' };
