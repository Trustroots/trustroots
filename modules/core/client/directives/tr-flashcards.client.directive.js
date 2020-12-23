/**
 * Directive to embed Trustroots host guide flashcards
 *
 * See also `guide` page under `pages` module.
 *
 * Use as an attribute:
 * ```html
 * <p tr-flashcards></p>
 * ```
 *
 */
angular.module('core').directive('trFlashcards', trFlashcardsDirective);

/* @ngInject */
function trFlashcardsDirective() {
  return {
    restrict: 'A',
    template:
      '<a ui-sref="guide" class="tr-flashcards text-center font-brand-regular">' +
      '  <small class="tr-flashcards-tip text-uppercase">Tip</small>' +
      '  <p class="tr-flashcards-title" ng-bind="::flashTitle"></p>' +
      '  <p class="tr-flashcards-content" ng-bind="::flashContent"></p>' +
      '</a>',
    link(scope) {
      const flashcards = [
        {
          title: 'Make sure your profile is complete',
          content:
            "You're much more likely to get a positive response if you have written a bit about yourself.",
        },
        {
          title: 'Tell a little bit about yourself',
          content:
            "You're much more likely to get a positive response if you have written a bit about yourself.",
        },
        {
          title: 'Explain to them why you are choosing them',
          content:
            '...explaining that you are interested in meeting them, not just looking for free accommodation.',
        },
        {
          title: "Tell your host why you're on a trip",
          content:
            'What are your expectations in regards with going through their town?',
        },
        {
          title: 'Trustroots is very much about spontaneous travel',
          content: "Don't write to people 2 months ahead.",
        },
      ];

      const randomFlashcard =
        flashcards[Math.floor(Math.random() * flashcards.length)];

      scope.flashTitle = randomFlashcard.title;
      scope.flashContent = randomFlashcard.content;
    },
  };
}
