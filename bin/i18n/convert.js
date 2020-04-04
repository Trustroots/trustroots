const i18nextConv = require('i18next-conv');
const fs = require('fs-extra');
const path = require('path');

/**
 * Convert a translation file from json to po or vice versa
 *
 * @param {string} file - a path to the file to convert
 * @returns {string} - output filename
 */
async function convertFile(file) {
  const extension = path.parse(file).ext;

  const extensions = ['.json', '.po'];

  if (!extensions.includes(extension)) {
    throw new Error('unsupported translation file extension');
  }

  // choose which way to perform the conversion
  const convert =
    extension === '.json'
      ? i18nextConv.i18nextToPo
      : i18nextConv.gettextToI18next;

  // get data about the converted file
  const targetExtension = extensions.find(ext => ext !== extension);
  const targetFile = changeExtension(file, targetExtension);
  const locale = getLocale(file);

  // convert
  let converted = await convert(locale, await fs.readFile(file));

  // add a formatting to the output json, so it conforms with json formatting elsewhere
  // i.e. have 2 space tabs instead of 4, and newline at the end of file
  if (targetExtension === '.json') {
    converted = JSON.stringify(JSON.parse(converted), null, 2) + '\n';
  }

  // write the updated file
  await fs.writeFile(targetFile, converted);

  return targetFile;
}

/**
 * Given a path to a file, change its extension
 *
 * @param {string} file - path/to/file.ext
 * @param {string} extension - desired file extension in format ".extension"
 * @returns {string} - path/to/file-with-the-new.extension
 */
function changeExtension(file, extension) {
  const parsed = path.parse(file);
  delete parsed.base;
  parsed.ext = extension;
  return path.format(parsed);
}

/**
 * Given a path in format path/to/translation/locale/filename.ext, returns "locale"
 * e.g. "/home/user/trustroots/public/locales/en/tribes.json" returns "en"
 *
 * @param {string} file - path/to/locale/file.ext
 * @returns {string} - locale
 */
function getLocale(file) {
  const directory = path.parse(file).dir;
  return directory.split(path.sep).pop();
}

/**
 * The conflict: An array of paths includes both path to en/example.json and en/example.po
 * therefore we don't know which direction to perform the conversion in
 * It's not very general, but serves our purpose here.
 * If you use it outside our context, you can get false positives.
 *
 * @param {string[]} files - array of paths/to/file
 * @returns {boolean} - if a conflict was detected, returns true, otherwise false
 */
function isConflict(files) {
  const identifiers = files.map(file =>
    path.join(getLocale(file), path.parse(file).name),
  );

  return new Set(identifiers).size !== identifiers.length;
}

module.exports = { convertFile, isConflict };
