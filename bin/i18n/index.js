const { convertFile, isConflict } = require('./convert');

/**
 * Convert translation files from .json to .po and vice versa
 *
 * usage: `npm run convert-translations paths/or/globs/to/translation-files`
 */

(async () => {
  const [, , ...files] = process.argv;

  // check that there is no conflict between provided .json and .po files
  // i.e. we can't perform conversion for a single translation in both directions
  if (isConflict(files)) {
    throw new Error(
      'There is a conflict. Edit either a .json file or a .po file, not both',
    );
  }

  // convert the translations
  for (const file of files) {
    await convertFile(file);
  }
})();

// make sure the asynchronous errors are handled properly
// https://nodejs.org/api/process.html#process_event_unhandledrejection
process.on('unhandledRejection', err => {
  throw err;
});
