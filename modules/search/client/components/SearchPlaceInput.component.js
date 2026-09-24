import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { fetchLocationSuggestions, locatePlace } from '../api/location.api';

export default function SearchPlaceInput({
  id = 'search-query',
  onPlaceSearch,
  searchQuery,
  setSearchQuery,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [locationNotFound, setLocationNotFound] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const skipSuggestionsRef = useRef(false);
  const containerRef = useRef(null);

  const [loadSuggestions] = useDebouncedCallback(async query => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const results = await fetchLocationSuggestions(query);

    if (skipSuggestionsRef.current) {
      skipSuggestionsRef.current = false;

      if (results.length) {
        handleSelect(results[0]);
      } else {
        setLocationNotFound(query);
      }

      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setSuggestions(results);
    setIsOpen(results.length > 0);
    setLocationNotFound(false);
  }, 300);

  useEffect(() => {
    loadSuggestions(searchQuery);
  }, [loadSuggestions, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(feature) {
    const located = locatePlace(feature);

    if (located) {
      onPlaceSearch(located.data, located.type);
    }

    /* istanbul ignore next -- search suggestions always include display titles. */
    setSearchQuery(feature.trTitle || '');
    setSuggestions([]);
    setIsOpen(false);
    setLocationNotFound(false);
  }

  return (
    <div
      className={`form-group search-form-group search-place${
        locationNotFound ? ' has-warning' : ''
      }`}
      ref={containerRef}
    >
      <div className="input-group input-location">
        <label className="sr-only" htmlFor={id}>
          Search places
        </label>
        <input
          className="form-control input-lg"
          id={id}
          onChange={({ target: { value } }) => {
            setLocationNotFound(false);
            setSearchQuery(value);
          }}
          onFocus={() => {
            if (suggestions.length) {
              setIsOpen(true);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              skipSuggestionsRef.current = true;
              event.preventDefault();
              loadSuggestions(searchQuery);
            }
          }}
          placeholder="Search Places"
          tabIndex="0"
          type="text"
          value={searchQuery}
        />
        <span className="input-group-btn">
          <button
            aria-label="Clear location search"
            className="btn btn-lg btn-default"
            disabled={!searchQuery.length}
            onClick={() => {
              setSearchQuery('');
              setSuggestions([]);
              setIsOpen(false);
              setLocationNotFound(false);
            }}
            title="Clear search"
            type="button"
          >
            <i className="icon-close"></i>
          </button>
        </span>
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul
          className="dropdown-menu"
          role="listbox"
          style={{ display: 'block' }}
        >
          {suggestions.map(feature => (
            <li key={feature.id}>
              <a
                href="#"
                onClick={event => {
                  event.preventDefault();
                  handleSelect(feature);
                }}
                role="option"
              >
                {feature.trTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
      {locationNotFound && (
        <p className="help-block">
          We could not find <em>{locationNotFound}</em>
          <br />
          <small>Make sure your search is spelled correctly.</small>
        </p>
      )}
    </div>
  );
}

SearchPlaceInput.propTypes = {
  id: PropTypes.string,
  onPlaceSearch: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
};
