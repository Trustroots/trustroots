import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-spinner.client.directive';

describe('trSpinner directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(size) {
    const scope = $rootScope.$new();
    const element = $compile(
      `<tr-spinner${size ? ` size="${size}"` : ''}></tr-spinner>`,
    )(scope);
    scope.$digest();
    return element;
  }

  it('renders the default medium spinner size', function () {
    const element = compile();
    const spinnerElement = element.find('svg');
    const circle = element.find('circle');

    expect(element.html()).toContain('spinner spinner-md');
    expect(spinnerElement.attr('width')).toBe('65px');
    expect(spinnerElement.attr('height')).toBe('65px');
    expect(spinnerElement.attr('viewBox')).toBe('0 0 66 66');
    expect(spinnerElement.attr('role')).toBe('alertdialog');
    expect(spinnerElement.attr('aria-busy')).toBe('true');
    expect(circle.attr('stroke-width')).toBe('3');
    expect(circle.attr('fill')).toBe('none');
  });

  it('supports all size variants', function () {
    const large = compile('lg');
    const medium = compile('md');
    const small = compile('sm');
    const xsmall = compile('xs');

    expect(large.html()).toContain('spinner spinner-lg');
    expect(large.find('svg').attr('width')).toBe('85px');
    expect(medium.find('svg').attr('width')).toBe('65px');
    expect(small.find('svg').attr('width')).toBe('35px');
    expect(xsmall.find('svg').attr('width')).toBe('25px');
    expect(large.find('circle').attr('stroke-width')).toBe('4');
    expect(xsmall.find('circle').attr('stroke-width')).toBe('1');
  });
});
