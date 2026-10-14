import service from './authentication.server.service.mts';

export default service;
export const generateEmailToken = service.generateEmailToken;
export const isUsernameReserved = service.isUsernameReserved;
export const validateUsername = service.validateUsername;
export const isUsernameFormatValid = service.isUsernameFormatValid;
export const isLegacyUsernameLookupValid = service.isLegacyUsernameLookupValid;
export const usernameFormatMessage = service.usernameFormatMessage;
export { service as 'module.exports' };
