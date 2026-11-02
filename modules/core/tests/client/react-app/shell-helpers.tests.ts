import { getClientNavigationTarget } from '@/layers/shell/client/shell-helpers';

type NavigationClick = Pick<
  MouseEvent,
  'button' | 'defaultPrevented' | 'target'
> &
  Partial<Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>>;

// The helper only reads these fields; keep synthetic events deliberately minimal.
function navigationClick(fixture: NavigationClick): MouseEvent {
  return fixture as MouseEvent;
}

describe('React shell helpers', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it.each([
    ['an already handled click', { defaultPrevented: true }],
    ['a secondary click', { button: 1 }],
    ['a meta-assisted click', { metaKey: true }],
    ['a control-assisted click', { ctrlKey: true }],
    ['a shift-assisted click', { shiftKey: true }],
    ['an alt-assisted click', { altKey: true }],
  ] as Array<[string, Partial<NavigationClick>]>)(
    'does not intercept %s',
    (description, overrides) => {
      const anchor = document.createElement('a');
      anchor.href = '/faq';

      expect(
        getClientNavigationTarget(
          navigationClick({
            button: 0,
            defaultPrevented: false,
            target: anchor,
            ...overrides,
          }),
        ),
      ).toBeNull();
    },
  );

  it.each([
    ['a click outside a link', document.createElement('span')],
    ['a non-element click target', document.createTextNode('label')],
    [
      'a downloaded link',
      Object.assign(document.createElement('a'), {
        download: 'rules.txt',
        href: '/rules',
      }),
    ],
    [
      'a targeted link',
      Object.assign(document.createElement('a'), {
        href: '/rules',
        target: '_blank',
      }),
    ],
    [
      'an external relationship link',
      Object.assign(document.createElement('a'), {
        href: '/rules',
        rel: 'external',
      }),
    ],
    [
      'a fragment link',
      Object.assign(document.createElement('a'), {
        href: '#content',
      }),
    ],
    [
      'an external link',
      Object.assign(document.createElement('a'), {
        href: 'https://ideas.trustroots.org/',
      }),
    ],
  ] as Array<[string, EventTarget]>)(
    'leaves %s to the browser',
    (description, target) => {
      expect(
        getClientNavigationTarget(
          navigationClick({
            button: 0,
            defaultPrevented: false,
            target,
          }),
        ),
      ).toBeNull();
    },
  );

  it('returns a same-origin application target from a nested link element', () => {
    const anchor = document.createElement('a');
    const label = document.createElement('span');
    anchor.href = '/support?report=alice';
    anchor.appendChild(label);

    expect(
      getClientNavigationTarget(
        navigationClick({
          button: 0,
          defaultPrevented: false,
          target: label,
        }),
      ),
    ).toBe('/support?report=alice');
  });
});
