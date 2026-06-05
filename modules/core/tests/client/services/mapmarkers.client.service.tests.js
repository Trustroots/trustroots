import AppConfig from '@/modules/core/client/app/config';

describe('MapMarkersFactory', function () {
  let MapMarkersFactory;

  function createFactory(windowWidth) {
    let current;
    const iconFactory = jest.fn(options => ({
      ...options,
    }));

    angular.mock.module(function ($provide) {
      $provide.value('$window', {
        innerWidth: windowWidth,
        L: {
          icon: iconFactory,
        },
      });
    });

    angular.mock.module(AppConfig.appModuleName);

    inject(function (_MapMarkersFactory_) {
      MapMarkersFactory = _MapMarkersFactory_;
      current = MapMarkersFactory;
    });

    return { factory: current, iconFactory };
  }

  it('builds correct marker style defaults for unknown offer type', function () {
    const { factory } = createFactory(1000);
    const offer = {};
    const config = factory.getIconConfig(offer);

    expect(offer.type).toBe('other');
    expect(offer.status).toBe('yes');
    expect(config.iconUrl).toBe('/img/map/marker-icon.svg');
    expect(config.ariaLabel).toBe('Other');
    expect(config.iconSize).toEqual([20, 20]);
    expect(config.iconAnchor).toEqual([10, 10]);
  });

  it('maps host and meet offer types to distinct icons', function () {
    const { factory } = createFactory(500);
    const offerHostYes = { type: 'host', status: 'yes' };
    const offerHostMaybe = { type: 'host', status: 'maybe' };
    const offerMeet = { type: 'meet' };

    expect(factory.getIconConfig(offerHostYes).iconUrl).toBe(
      '/img/map/marker-icon-yes.svg',
    );
    expect(factory.getIconConfig(offerHostMaybe).iconUrl).toBe(
      '/img/map/marker-icon-maybe.svg',
    );
    expect(factory.getIconConfig(offerMeet).iconUrl).toBe(
      '/img/map/marker-icon-meet.svg',
    );
  });

  it('creates circles with defaults and overrides', function () {
    const { factory, iconFactory } = createFactory(500);
    const icon = factory.getIcon({
      type: 'host',
      status: 'yes',
    });

    expect(iconFactory).toHaveBeenCalled();
    expect(icon.ariaLabel).toBe('Yes host');

    const circle = factory.getOfferCircle({
      radius: 20,
      type: 'custom',
    });
    expect(circle.radius).toBe(20);
    expect(circle.type).toBe('custom');
    expect(circle.clickable).toBe(false);
  });
});
