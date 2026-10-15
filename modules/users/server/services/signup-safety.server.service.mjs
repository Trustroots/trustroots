import service from './signup-safety.server.service.mts';

export const { KEYWORDS, matchSignupProfile } = service;
export default service;
export { service as 'module.exports' };
