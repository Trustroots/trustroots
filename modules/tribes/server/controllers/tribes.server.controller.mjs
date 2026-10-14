import service from './tribes.server.controller.mts';

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
export { service as 'module.exports' };
