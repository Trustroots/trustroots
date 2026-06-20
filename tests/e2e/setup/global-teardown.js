const { mergeRawCoverage } = require('../../../scripts/e2e/merge-js-coverage');

module.exports = async () => {
  await mergeRawCoverage();
};
