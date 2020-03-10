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
async function convert(source, target, base = 'public/locales') {
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
}

async function convertFile(file) {
  const extension = path.parse(file).ext;

  const extensions = ['.json', '.po'];

  if (!extensions.includes(extension))
    throw new Error('unsupported file extension');

  const transform = extension === '.json' ? i18nextToPo : gettextToI18next;
  const targetExtension = extensions.find(ext => ext !== extension);
  const target = changeExtension(file, targetExtension);
  const locale = getLocale(file);

  const transformed = await transform(locale, await fs.readFile(file));

  await fs.writeFile(target, transformed);
}

function changeExtension(file, extension) {
  const parsed = path.parse(file);
  delete parsed.base;
  parsed.ext = extension;
  return path.format(parsed);
}

function getLocale(file) {
  const directory = path.parse(file).dir;
  return directory.split(path.sep).slice(-1)[0];
}

function isConflict(files) {
  const identifiers = files.map(file =>
    path.join(getLocale(file), path.parse(file).name),
  );

  return new Set(identifiers).size !== identifiers.length;
}

module.exports = { convert, convertFile, isConflict };
