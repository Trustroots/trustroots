// Welcome sequence emails are currently disabled.
const defaultExport = function (job: unknown, done?: () => void) {
  if (typeof done === 'function') {
    return done();
  }
};

export default defaultExport;
export { defaultExport as 'module.exports' };
