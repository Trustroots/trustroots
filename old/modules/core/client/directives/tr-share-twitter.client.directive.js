/* global twttr */
/**
 * Twitter share button for current URL
 *
 * Usage:
 * ```
 * <div tr-share-twitter></div>
 * ```
 *
 * With predefined tweet text:
 * ```
 * <div tr-share-twitter data-text="Tweet text here"></div>
 * ```
 */
angular.module('core').directive('trShareTwitter', trShareTwitterDirective);

/* @ngInject */
function trShareTwitterDirective($window, $document) {
  return {
    restrict: 'A',
    replace: true,
    scope: false,
    link: trShareTwitterDirectiveLink,
  };

  function trShareTwitterDirectiveLink(scope, element, attrs) {
    activate();

    /**
     * Activate directive
     * @link https://dev.twitter.com/web/tweet-button
     */
    function activate() {
      let button =
        '<a href="https://twitter.com/share" class="twitter-share-button" data-via="trustroots"';

      // Predefined Tweet text
      if (attrs.text) {
        button += ' data-text="' + attrs.text + '"';
      }

      button += '>Tweet</a>';

      // Place html to DOM
      element.html(button);

      if (angular.isDefined($window.twttr)) {
        // Render tweet button
        twttr.widgets.load();
      } else {
        // No Twitter Widget JS present, initialize it and it'll do the rendering
        initTwitterJS();
      }
    }

    /**
     * Initialize Twitter Widgets JS if it's not loaded yet
     * @link https://dev.twitter.com/web/javascript/loading
     *
     * 1. Assign a HTML element ID of twitter-wjs to easily identify
     *    if the  JavaScript file already exists on the page.
     *    Exit early if the ID already exists.
     *
     * 2. Asynchronously load Twitter’s widget JavaScript.
     *
     * 3. Initialize an asynchronous function queue to hold functions
     *    dependent on Twitter’s widgets JavaScript until the script
     *    is available.
     */
    function initTwitterJS() {
      $window.twttr = (function (d, s, id) {
        const fjs = d.getElementsByTagName(s)[0];
        const t = $window.twttr || {};
        if (d.getElementById(id)) return t;
        const js = d.createElement(s);
        js.id = id;
        js.src = 'https://platform.twitter.com/widgets.js';
        fjs.parentNode.insertBefore(js, fjs);

        t._e = [];
        t.ready = function (f) {
          t._e.push(f);
        };

        return t;
      })($document[0], 'script', 'twitter-wjs');
    }
  }
}
