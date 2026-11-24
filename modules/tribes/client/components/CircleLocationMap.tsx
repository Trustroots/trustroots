import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Map from '@/modules/core/client/components/Map/index';
import type { MapHandle } from '@/modules/core/client/components/Map/types';
import DeviceLocationButton from '@/modules/core/client/components/DeviceLocationButton';
import './circle-location-map.less';

const VIEW_KEY = 'circle-map-view';
const EXTERNAL_URL = /^https?:\/\//i;
const ACCOMMODATION_URL =
  /^\/profile\/(?:[A-Za-z0-9._~-]|%[A-F0-9]{2})+\/accommodation$/;

function readView(viewKey = VIEW_KEY) {
  try {
    const { latitude, longitude, zoom } =
      JSON.parse(sessionStorage.getItem(viewKey) || 'null') ?? {};
    return [latitude, longitude, zoom].every(Number.isFinite) &&
      Math.abs(latitude) <= 85 &&
      Math.abs(longitude) <= 180 &&
      zoom >= 1 &&
      zoom <= 24
      ? { latitude, longitude, zoom }
      : null;
  } catch {
    return null;
  }
}

export interface CircleLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  details: string[];
  markerColor?: string;
  popupHeading?: ReactNode;
  facts?: {
    label: string;
    value: string | { label: string; url?: string }[];
  }[];
  link?: { url: string; label: string };
}

function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export function LocationPopup({ location }: { location: CircleLocation }) {
  const { link } = location;
  const external = link && EXTERNAL_URL.test(link.url);
  return (
    <div className="circle-location-popup tw:flex tw:max-w-[300px] tw:min-w-40 tw:flex-col tw:items-start tw:gap-2 tw:leading-normal tw:wrap-anywhere">
      {location.popupHeading == null ? (
        <strong className="tw:text-[15px]">{location.name}</strong>
      ) : (
        <div>{location.popupHeading}</div>
      )}
      {!!location.facts?.length && (
        <dl className="tw:m-0 tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:gap-x-3.5 tw:gap-y-1">
          {location.facts.map(({ label, value }) => (
            <React.Fragment key={label}>
              <dt className="tw:font-normal tw:text-muted">{label}</dt>
              <dd className="tw:m-0">
                {typeof value === 'string'
                  ? value
                  : value.map((item, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && ', '}
                        {item.url && EXTERNAL_URL.test(item.url) ? (
                          <ExternalLink url={item.url} label={item.label} />
                        ) : (
                          item.label
                        )}
                      </React.Fragment>
                    ))}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {location.details.map(detail => (
        <p key={detail} className="tw:m-0 tw:text-xs tw:text-muted">
          {detail}
        </p>
      ))}
      {link && (external || ACCOMMODATION_URL.test(link.url)) && (
        <a
          className="tw:rounded-md tw:bg-[#edf6f2] tw:px-2.5 tw:py-1.5 tw:font-semibold tw:underline tw:hover:bg-[#dceee5] tw:focus-visible:bg-[#dceee5]"
          href={link.url}
          {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
        >
          {link.label}
        </a>
      )}
    </div>
  );
}

interface Props {
  title: string;
  description: string;
  mapLabel: string;
  locations: CircleLocation[];
  state: 'loading' | 'ready' | 'error';
  loadingText: string;
  emptyText: string;
  errorText: string;
  countLabel: string;
  headingAs?: 'h2' | 'h3';
  legend?: ReactNode;
  attribution?: ReactNode;
  markerColor?: string;
  className?: string;
  viewKey?: string;
}

export default function CircleLocationMap(props: Props) {
  const Heading = props.headingAs ?? 'h3';
  const { t } = useTranslation('core');
  const [savedView] = useState(() => readView(props.viewKey));
  const [initialView] = useState(
    () => savedView ?? { latitude: 20, longitude: 0, zoom: 1 },
  );
  const mapRef = useRef<MapHandle>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const initialViewSet = useRef(Boolean(savedView));
  const fittingResults = useRef(false);
  const viewUsesLocation = useRef(false);
  const focusAction = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = props.locations.find(({ id }) => id === selectedId);

  useEffect(() => {
    if (selected && focusAction.current) {
      popupRef.current?.querySelector('a')?.focus();
    }
    focusAction.current = false;
  }, [selected]);
  useEffect(() => {
    // Fit the initial batch once. Streaming updates must not keep panning the
    // map or interrupt someone exploring it.
    if (
      loaded &&
      props.state !== 'loading' &&
      props.locations.length &&
      !initialViewSet.current
    ) {
      initialViewSet.current = true;
      fittingResults.current = true;
      const longitudes = props.locations.map(({ longitude }) => longitude);
      const latitudes = props.locations.map(({ latitude }) => latitude);
      mapRef.current!.fitBounds(
        {
          northEast: {
            lat: Math.max(...latitudes),
            lng: Math.max(...longitudes),
          },
          southWest: {
            lat: Math.min(...latitudes),
            lng: Math.min(...longitudes),
          },
        },
        { padding: 24, maxZoom: 8, animate: false },
      );
      fittingResults.current = false;
    }
  }, [loaded, props.locations, props.state]);

  const jumpTo = (latitude: number, longitude: number, zoom: number) => {
    initialViewSet.current = true;
    // Panning or zooming after a location jump can still reveal that location.
    viewUsesLocation.current = true;
    mapRef.current?.flyTo({ latitude, longitude, zoom }, false);
  };

  return (
    <section
      className={`circle-location-map-panel${
        props.className ? ` ${props.className}` : ''
      }`}
      aria-label={props.title}
    >
      <div className="circle-location-map-heading">
        <Heading>{props.title}</Heading>
        <p>{props.description}</p>
      </div>
      <div className="circle-location-map-frame">
        <div
          className="circle-location-map tw:overflow-hidden"
          role="application"
          aria-label={props.mapLabel}
        >
          <Map
            ref={mapRef}
            view={initialView}
            minZoom={1}
            worldBounds
            style={{ width: '100%', height: '100%' }}
            onLoad={() => setLoaded(true)}
            onClick={() => setSelectedId(null)}
            // Preserve any view chosen while the initial results are loading.
            onMoveStart={() => {
              initialViewSet.current = true;
            }}
            onMoveEnd={view => {
              if (fittingResults.current || viewUsesLocation.current) return;
              try {
                sessionStorage.setItem(
                  props.viewKey || VIEW_KEY,
                  JSON.stringify(view),
                );
              } catch {
                // Maps remain usable when session storage is unavailable.
              }
            }}
            pins={props.locations.map(location => ({
              key: location.id,
              latitude: location.latitude,
              longitude: location.longitude,
              children: (
                <button
                  type="button"
                  aria-label={location.name}
                  className="tw:block tw:size-4 tw:cursor-pointer tw:rounded-full tw:border-2 tw:border-white tw:p-0"
                  style={{
                    backgroundColor:
                      location.markerColor ?? props.markerColor ?? '#488261',
                  }}
                  onClick={event => {
                    // Keyboard activation moves focus into the popup.
                    focusAction.current = event.detail === 0;
                    setSelectedId(location.id);
                    if (selectedId === location.id && focusAction.current) {
                      popupRef.current?.querySelector('a')?.focus();
                    }
                  }}
                />
              ),
            }))}
            popup={
              selected && {
                key: selected.id,
                latitude: selected.latitude,
                longitude: selected.longitude,
                children: (
                  <div ref={popupRef} className="tw:flex tw:items-start">
                    <LocationPopup location={selected} />
                    <button
                      type="button"
                      aria-label={t('Close popup')}
                      className="tw:-mt-1 tw:-mr-2 tw:ml-1 tw:size-8 tw:shrink-0 tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-2xl tw:leading-none tw:hover:bg-[#edf6f2] tw:focus-visible:bg-[#edf6f2]"
                      onClick={() => setSelectedId(null)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                ),
              }
            }
          />
        </div>
        <DeviceLocationButton
          onRequest={() => {
            initialViewSet.current = true;
          }}
          onLocation={({ lat, lng }) => jumpTo(lat, lng, 13)}
          onApproximateLocation={({ latitude, longitude, zoom }) =>
            jumpTo(latitude, longitude, zoom)
          }
        />
      </div>
      <div className="circle-location-map-footer">
        {props.legend}
        <span className="circle-location-map-status" aria-live="polite">
          {props.state === 'loading'
            ? props.loadingText
            : props.state === 'error'
              ? props.errorText
              : props.locations.length
                ? `${props.locations.length} ${props.countLabel}`
                : props.emptyText}
        </span>
        {props.attribution && (
          <span className="circle-location-map-attribution">
            {' '}
            · {props.attribution}
          </span>
        )}
      </div>
    </section>
  );
}
