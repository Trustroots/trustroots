import service from './admin.experience-changes.server.controller.mts';

/** @esmNamed */
export const { findExperiences, issueLink, listRequests, decide } = service;
export default service;
/** @commonjs */
export { service as 'module.exports' };
