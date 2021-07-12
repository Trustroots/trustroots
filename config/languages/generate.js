/**
 * A script to generate `languages.json`
 *
 * Run script from the same folder (./config/languages):
 *
 * node generate.js
 */
const fs = require('fs');

/**
 * Helper to adjust some labels
 */
function fixName(name) {
  // More practical
  // This is the modern day language of Greeks in Greece
  if (name === 'Modern Greek (1453-)') {
    return 'Greek';
  }

  // More practical
  if (name === 'Ancient Greek (to 1453)') {
    return 'Ancient Greek';
  }

  // Follow Wikipedia's naming convention
  // @link https://en.wikipedia.org/wiki/Punjabi_language
  // if (name === 'Panjabi') {
  //   return 'Punjabi';
  // }

  return name;
}

/**
 * Determine if language should be picked and used at Trustroots
 */
function includeLanguage({ iso_639_2b, iso_639_2t, type, name, scope }) {
  // Add individually picked languages if these languages have
  // significant "hobbyist" community around them
  if (
    [
      'grc', // Ancient Greek
      'lat', // Latin
    ].indexOf(iso_639_2b) > -1
  ) {
    return true;
  }

  // Include all "living" languages
  // Include 19 constructed languages such as "Esperanto"
  // Ignores all other types (e.g. extinct)
  if (['constructed', 'living'].includes(type)) {
    return true;
  }

  // Include all 37 creole languages
  // `i` in regexp means "ignore case"
  if (/creole/i.test(name)) {
    return true;
  }

  // Include all 135 sign languages
  // Their names always end to "Sign Language" in our data
  // e.g. "Finnish Sign Language"
  if (name.endsWith('Sign Language')) {
    return true;
  }

  // Include everything with `iso_639_2b/b` code available
  // @link https://en.wikipedia.org/wiki/ISO_639-2#B_and_T_codes
  if (iso_639_2b || iso_639_2t) {
    return true;
  }

  // Include umbarella languages such as "Serbo-Croatian", "Arabic", "Chinese"
  // These don't necessarily have `iso_639_2b` code.
  if (scope === 'macro_language') {
    return true;
  }

  return false;
}

/**
 * Pick language key
 * If `iso_639_2b` exists, returns it.
 * otherwise looks for other keys and prefixes them with ISO used, e.g.:
 * `iso_639_3-LANGUAGECODE`
 */
function getKey({ iso_639_2b, iso_639_2t, iso_639_3, iso_639_1 }) {
  if (iso_639_2b) {
    return iso_639_2b;
  }

  if (iso_639_2t) {
    return 'iso_639_2t-' + iso_639_2t;
  }

  if (iso_639_3) {
    return 'iso_639_3-' + iso_639_3;
  }

  if (iso_639_1) {
    return 'iso_639_1-' + iso_639_1;
  }

  // Failed to find key
  return false;
}

/**
 * Collect languages
 */
function collectLanguages() {
  const languagesOrig = require('./languages_orig.json');
  const languagesNew = {};

  // Loop main source for languages
  languagesOrig.forEach(language => {
    // Pick a key
    // Most of the time `iso_639_2b` is what we need but it's not always available
    const key = getKey(language);

    if (!key) {
      console.warn('Could not generate key for language:');
      console.log(language);
      return true;
    }

    // Skip languages we don't use
    if (!includeLanguage(language)) {
      return true;
    }

    // Ensure we're not overwriting anything
    if (languagesNew[key]) {
      console.warn(`Language for key ${key} exists already:`);
      console.log(languagesNew[key]);
      console.log('Attempted to collect language:');
      console.log(language);
      return true;
    }

    // Finally store languages by key=>name
    languagesNew[key] = fixName(language.name);
  });

  console.log(`Picked total ${Object.keys(languagesNew).length} languages.`);

  return languagesNew;
}

/**
 * Generate languages and write them to a file
 */
function generate(targetFile) {
  console.log('\nGenerating languages...');

  const languages = collectLanguages();
  const languagesString = JSON.stringify(languages);

  fs.writeFile(targetFile, languagesString, error => {
    if (error) {
      console.error(`Failed saving languages to file ${targetFile}`);
      console.error(error);
      return;
    }
    console.log(`Languages saved to file ${targetFile}`);
  });
}

// Initialize
generate('languages.json');
