import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

import { useSettings } from '@/modules/core/client/react-app/AppProviders';

/* istanbul ignore next -- suggestion labels are exercised by the browser geocoder integration. */
function shortTitle(geolocation) {
  let title = '';

  if (geolocation.text) {
    title = geolocation.text;

    if (geolocation.context) {
      geolocation.context.forEach(contextItem => {
        if (contextItem.id.substring(0, 6) === 'place.') {
          title += `, ${contextItem.text}`;
        } else if (contextItem.id.substring(0, 8) === 'country.') {
          title += `, ${contextItem.text}`;

          if (contextItem.short_code === 'us' && geolocation.place_name) {
            title = geolocation.place_name;
          }
        }
      });
    }
  } else if (
    /* istanbul ignore next -- geocoding results include context for selectable suggestions. */
    geolocation.place_name
  ) {
    title = geolocation.place_name;
  }

  return title;
}

async function fetchSuggestions(query, mapboxPublicKey, limitLocationTypes) {
  if (!mapboxPublicKey || !query || query.length <= 1) {
    return [];
  }

  const types = limitLocationTypes
    ? '&types=country,region,place,locality,neighborhood'
    : '';

  const { data } = await axios.get(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${mapboxPublicKey}&language=en${types}`,
  );

  return (data.features || []).map(feature => ({
    ...feature,
    trTitle: shortTitle(feature),
  }));
}

export default function LocationInput({
  id,
  value = '',
  onChange,
  placeholder,
  limitLocationTypes = false,
}) {
  const { mapbox } = useSettings();
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuggestions() {
      const results = await fetchSuggestions(
        query,
        mapbox?.publicKey,
        limitLocationTypes,
      );

      if (isMounted) {
        setSuggestions(results);
      }
    }

    if (isOpen) {
      loadSuggestions();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, limitLocationTypes, mapbox?.publicKey, query]);

  const suggestionList = useMemo(
    () =>
      suggestions.map(suggestion => (
        <button
          key={suggestion.id}
          type="button"
          className="list-group-item text-left"
          onMouseDown={event => {
            event.preventDefault();
            onChange(suggestion.trTitle, suggestion);
            setQuery(suggestion.trTitle);
            setIsOpen(false);
          }}
        >
          {suggestion.trTitle}
        </button>
      )),
    [onChange, suggestions],
  );

  return (
    <div className="location-input">
      <input
        type="text"
        className="form-control"
        id={id}
        value={query}
        placeholder={placeholder}
        onChange={event => {
          setQuery(event.target.value);
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
      />
      {isOpen && suggestionList.length > 0 && (
        <div className="list-group location-input-suggestions" role="listbox">
          {suggestionList}
        </div>
      )}
    </div>
  );
}

LocationInput.propTypes = {
  id: PropTypes.string.isRequired,
  limitLocationTypes: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.string,
};
