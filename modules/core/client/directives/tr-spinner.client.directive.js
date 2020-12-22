angular.module('core').directive('trSpinner', trSpinnerDirective);

function trSpinnerDirective() {
  return {
    restrict: 'E',
    link(scope, element, attrs) {
      // @link https://haltersweb.github.io/Accessibility/svg.html
      function generateSVGMarkup(size, square, stroke) {
        return (
          '<svg class="spinner spinner-' +
          size +
          '"' +
          '  width="' +
          square +
          'px"' +
          '  height="' +
          square +
          'px"' +
          '  viewBox="0 0 ' +
          (square + 1) +
          ' ' +
          (square + 1) +
          '"' +
          '  role="alertdialog"' +
          '  aria-busy="true"' +
          '  aria-live="assertive"' +
          '  aria-label="Loading, please wait."' +
          '  xmlns="http://www.w3.org/2000/svg">' +
          '  <circle class="spinner-path"' +
          '          fill="none"' +
          '          stroke-width="' +
          stroke +
          '"' +
          '          stroke-linecap="round"' +
          '          cx="' +
          (square + 1) / 2 +
          '"' +
          '          cy="' +
          (square + 1) / 2 +
          '"' +
          '          r="' +
          ((square + 1) / 2 - stroke) +
          '"></circle>' +
          '</svg>'
        );
      }

      function renderSVG() {
        const size = attrs.size || 'md';
        let square;
        let stroke;

        if (size === 'lg') {
          square = 85;
          stroke = 4;
        } else if (size === 'md') {
          square = 65;
          stroke = 3;
        } else if (size === 'sm') {
          square = 35;
          stroke = 2;
        } else if (size === 'xs') {
          square = 25;
          stroke = 1;
        }

        const svg = generateSVGMarkup(size, square, stroke);

        element.html(svg);
      }

      // Initialize svg
      renderSVG();
    },
  };
}
