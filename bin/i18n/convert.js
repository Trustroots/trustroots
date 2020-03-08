const { i18nextToPo, gettextToI18next } = require('i18next-conv');
const fs = require('fs-extra');
const path = require('path');

/**
 * Convert all translation files from json to po or vice versa
 *
 * @param {string} source - source files (json or po)
 * @param {string} target - target files (po or json)
 * @param {string} [base=public/locales] - directory with locale directories with translation files
 */
module.exports = async function convert(
  source,
  target,
  base = 'public/locales',
) {
  // find all existing translation files in source format
  const locales = await fs.readdir(base);
  for (const locale of locales) {
    const files = (await fs.readdir(path.join(base, locale))).filter(
      file => path.parse(file).ext === `.${source}`,
    );

    // transform each of the found translation files to target format
    for (const file of files) {
      const transformed = await (source === 'json'
        ? i18nextToPo
        : gettextToI18next)(
        locale,
        await fs.readFile(path.join(base, locale, file)),
      );
      await fs.writeFile(
        path.join(base, locale, path.parse(file).name + `.${target}`),
        transformed,
      );
    }
  }
};
