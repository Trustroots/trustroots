import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Typeahead } from 'react-bootstrap-typeahead';

export default function LocationTypeahead({
  id,
  name,
  placeholder,
  minLength,
  initValue,
  onInputChange,
}) {
  const [suggestions, setSuggestions] = useState([initValue]);
  const [selected, setSelected] = useState([initValue]);

  const handleInputChange = async text => {
    setSuggestions([text]); // TODO use location service here
    onInputChange(text);
  };

  return (
    <Typeahead
      minLength={minLength}
      onChange={s => setSelected(s)}
      onInputChange={handleInputChange}
      name={name}
      type="text"
      placeholder={placeholder || 'City, Country'}
      id={id}
      limit-location-types="true"
      selected={selected}
      options={suggestions}
    />
  );
}

LocationTypeahead.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  minLength: PropTypes.number,
  initValue: PropTypes.string.isRequired,
  onInputChange: PropTypes.func.isRequired,
};
