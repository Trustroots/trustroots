import service from './admin.experience-changes.server.controller.mts';

export const { findExperiences, issueLink, listRequests, decide } = service;
export default service;
export { service as 'module.exports' };
