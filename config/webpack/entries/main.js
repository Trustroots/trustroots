/*
 *  Our main js entrypoint :)
 *
 *  It looks kind of empty because almost everything is happening via webpack.shims.js for now.
 *
 */

import '@/public/dist/uib-templates';
import angular from 'angular';


/*
 *  Main style import.
 *  This includes the libraries, and any global overrides.
 */
import './main.less';

if (process.env.NODE_ENV !== 'development') {
  require('@/public/dist/templates');
}

/*
 * Imports all the style files from the modules (*.less)
 *
 * Uses a webpack require context
 *  See https://webpack.js.org/guides/dependency-management/#require-context
 */
importAll(require.context('../../../modules/', true, /\.less$/));
function importAll(r) {
  r.keys().forEach(r);
}

/*
 *  Imports all react components from modules/ and register them as angular components
 *
 *  So if you defined modules/users/client/components/TrustrootsGreeting.component.js as:
 *
 *    export default function TrustrootsGreeting({ name }) {
 *      return <p>Hello {name}, from Trustroots!</p>;
 *    };
 *
 *  It will be available to use in (any) angular template as:
 *
 *    <trustroots-greeting name="'Donald'"></trustroots-greeting>
 *
 *  Uses a webpack require context
 *  See https://webpack.js.org/guides/dependency-management/#require-context
 */
importComponents(require.context('../../../modules/', true, /\.component\.js$/));

function importComponents(r) {
  r.keys().forEach(path => {
    const Component = r(path).default;
    const name = extractComponentNameFromPath(path);
    if (name !== Component.name && process.env.NODE_ENV !== 'production') {
      throw new Error(`Component filename and component name do not match: ${name || '<empty>'} vs ${Component.name || '<empty>'}`);
    }
    if (!Component.propTypes) {
      throw new Error(`You must define propTypes on your component, e.g. ${name}.propTypes = {};`);
    }
    const propNames = Object.keys(Component.propTypes);

    angular
      .module('trustroots')
      .directive(lowercaseFirstLetter(name), createDirective);

    /* @ngInject */
    function createDirective(reactDirective) {
      return reactDirective(Component, propNames);
    }
  });
}

function lowercaseFirstLetter(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function extractComponentNameFromPath(path) {
  const m = /\/([^/]+)\.component\.js$/.exec(path);
  if (m) return m[1];
}
