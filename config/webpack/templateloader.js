const { join, resolve } = require('path');

const basedir = resolve(join(__dirname, '../..'));

// MUST use it with html-loader first
module.exports = function (source) {
  const templateName = this.resourcePath
    .substring(basedir.length) // makes it relative to project root directory
    .replace(/\/client\//, '') // give our templates the expected name
    .replace(/.*\/angular-ui-bootstrap/, 'uib'); // give the angular-ui-templates the expected name

  console.log('processing template', this.resourcePath, templateName);
  source = source.replace('module.exports =', 'const html =');

  // ensure the ng-include replacements are correctly quoted
  source = source.replace(/ng-include=" \+ (require[^+]+) \+ "/g, 'ng-include=\\"\'" + $1 + "\'\\"');

  // source = source.replace(/ng-include="([^"]+)"/, '\'/1\'');
  // /code/trustroots/node_modules/angular-ui-bootstrap/template/tabs/tab.html
  source = `
    console.log('loading template for', '${templateName}');
    // console.log('  injector is', angular.element(document).injector());
    angular.module('core').run(['$templateCache', function($templateCache){
      ${source}
      console.log('put', '${templateName}', 'into cache');
      $templateCache.put('${templateName}', html);
    }]);
    module.exports = '${templateName}';
  `;
  console.log(source);
  return source;
};
