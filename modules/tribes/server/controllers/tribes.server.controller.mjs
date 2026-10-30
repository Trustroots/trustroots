import service from './tribes.server.controller.mts';

/** @esmNamed */
export const {
  getTribe,
  listMembers,
  listTribes,
  tribeBySlug,
  tribeFields,
  tribePopulateOptions,
  updateCount,
} = service;
export default service;
/** @commonjs */
export { service as 'module.exports' };
