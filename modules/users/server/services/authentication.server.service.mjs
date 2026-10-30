import service from './authentication.server.service.mts';

export default service;
/** @esmNamed */
export const generateEmailToken = service.generateEmailToken;
/** @esmNamed */
export const isUsernameReserved = service.isUsernameReserved;
/** @esmNamed */
export const validateUsername = service.validateUsername;
/** @esmNamed */
export const isUsernameFormatValid = service.isUsernameFormatValid;
/** @esmNamed */
export const isLegacyUsernameLookupValid = service.isLegacyUsernameLookupValid;
/** @esmNamed */
export const usernameFormatMessage = service.usernameFormatMessage;
/** @commonjs */
export { service as 'module.exports' };
