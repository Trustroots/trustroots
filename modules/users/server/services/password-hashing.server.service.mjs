import service from './password-hashing.server.service.mts';

export default service;
/** @esmNamed */
export const {
  KdfOverloadedError,
  createKdfScheduler,
  dummyVerifyPassword,
  getKdfState,
  hashPassword,
  verifyPassword,
} = service;
/** @commonjs */
export { service as 'module.exports' };
