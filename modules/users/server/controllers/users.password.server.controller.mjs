import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const defaultExport = require('./users.password.server.controller.js');

export default defaultExport;
export const changePassword = defaultExport.changePassword;
export const forgot = defaultExport.forgot;
export const reset = defaultExport.reset;
export const validateResetToken = defaultExport.validateResetToken;
