import service from './signup-safety.server.service.mts';

export const { KEYWORDS, matchSignupProfile } = service;
export default service;
/** @commonjs */
export { service as 'module.exports' };
