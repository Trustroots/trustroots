const { convertFile, isConflict } = require('./convert');

(async () => {
  const [, , ...files] = process.argv;

  if (isConflict(files)) {
    throw new Error(
      'There is a conflict. Edit either a json file or a po file, not both',
    );
  }

  for (const file of files) {
    await convertFile(file);
  }
})();

process.on('unhandledRejection', err => {
  throw err;
});
