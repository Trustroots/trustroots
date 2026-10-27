#!/usr/bin/env node

// Reformat JSON structure to be suitable for Weblate.
// Context https://github.com/Trustroots/trustroots/issues/1487#issuecomment-636060326
import dependency0 from 'fs';
import _ from 'lodash';
const { readFileSync, writeFileSync } = dependency0;
const filenames = process.argv.slice(2);
if (filenames.length === 0) {
  console.log('Usage: node ./bin/weblate-fix.js [filename, filename...]');
  process.exit(0);
}
for (const filename of filenames) {
  const contents = readFileSync(filename, 'utf8');
  const parsed: unknown = JSON.parse(contents);
  if (parsed === null) {
    throw new TypeError('Cannot convert undefined or null to object');
  }
  const result = convert(Object(parsed));
  writeFileSync(filename, JSON.stringify(result, null, 2) + '\n', 'utf8');
}
function convert(obj: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let key of Object.keys(obj)) {
    let value = readProperty(obj, key);
    if (_.isObject(value) && Object.keys(value).length > 1) {
      /* for plurals we receive something like:
           {
             "foo": {
               "foo._0": "No foos",
               "foo._one": "1 foo",
               "foo._other": "{{count}} foos"
             }
           }
         and we need to turn it into
            {
             "foo._0": "No foos",
             "foo._one": "1 foo",
             "foo._other": "{{count}} foos"
           }
      */
      for (const key2 of Object.keys(value)) {
        result[key2] = readProperty(value, key2);
      }
    } else {
      // For the rest we just de-nest all the keys all the way down
      while (_.isObject(value)) {
        const keys = Object.keys(value);
        const firstKey = keys[0];
        value =
          firstKey === undefined ? undefined : readProperty(value, firstKey);
        key = `${key}.${firstKey}`;
      }
      result[key] = value;
    }
  }
  return result;
}

function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key);
}
