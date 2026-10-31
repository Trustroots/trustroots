import service from './experience-changes.server.controller.mts';

/** @esmNamed */
export const { readAccess, readMine, submit } = service;
export default service;
/** @commonjs */
export { service as 'module.exports' };
