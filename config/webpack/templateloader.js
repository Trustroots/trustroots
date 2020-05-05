const { join, resolve } = require('path');

const basedir = resolve(join(__dirname, '../..'));

// MUST use it with html-loader first
module.exports = function (source) {
  const templateName = this.resourcePath
    .substring(basedir.length) // makes it relative to project root directory
    .replace(/\/client\//, '/') // give our templates the expected name
    .replace(/.*\/angular-ui-bootstrap/, 'uib'); // give the angular-ui-templates the expected name

  // html-loader will export the value, we want to the html put into the html const
  source = source.replace('module.exports =', 'const html =');

  // ensure the ng-include replacements are correctly quoted
  source = source.replace(
    /ng-include=" \+ (require[^+]+) \+ "/g,
    'ng-include=\\"\'" + $1 + "\'\\"',
  );

  return `
    ${source}
    angular.module('ng').run(['$templateCache', function($templateCache){
      $templateCache.put('${templateName}', html);
    }]);
    module.exports = '${templateName}';
  `;
};
