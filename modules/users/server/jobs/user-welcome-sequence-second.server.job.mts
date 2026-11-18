// Welcome sequence emails are currently disabled.
const service = function (job: unknown, done?: () => void) {
  if (typeof done === 'function') {
    return done();
  }
};

export default service;
