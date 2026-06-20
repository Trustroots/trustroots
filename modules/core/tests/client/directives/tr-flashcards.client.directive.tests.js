import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-flashcards.client.directive';

describe('trFlashcards directive', function () {
  let $compile;
  let $rootScope;
  let originalRandom;

  beforeEach(function () {
    originalRandom = Math.random;
    angular.mock.module(AppConfig.appModuleName);
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  afterEach(function () {
    Math.random = originalRandom;
  });

  function compile() {
    const scope = $rootScope.$new();
    const element = $compile('<p tr-flashcards></p>')(scope);
    scope.$digest();

    return element;
  }

  it('renders an anchor with guide link and the selected title/content', function () {
    spyOn(Math, 'random').and.returnValue(0);

    const element = compile();
    const link = element.is('a') ? element : element.find('a');
    const cardTitle = element.find('p.tr-flashcards-title');
    const cardContent = element.find('p.tr-flashcards-content');

    expect(link.attr('ui-sref')).toBe('guide');
    expect(link.attr('class')).toContain('tr-flashcards');
    expect(cardTitle.text().trim()).toBe('Make sure your profile is complete');
    expect(cardContent.text()).toContain(
      "You're much more likely to get a positive response",
    );
  });

  it('can render another card when random shifts', function () {
    spyOn(Math, 'random').and.returnValue(0.99);

    const element = compile();
    const cardTitle = element.find('p.tr-flashcards-title');

    expect(cardTitle.text().trim()).toBe(
      'Trustroots is very much about spontaneous travel',
    );
  });
});
