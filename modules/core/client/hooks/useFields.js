// useFields gives us a simple handleChange that works for most form inputs.
// this hook also supports nested properties!
// You just have to set your input field's name attr appropriately
// e.g. w/ a schema like {person:{first_name:''}} you can do <input name="person.first_name"/>

import { useState, useCallback } from 'react';
import _ from 'lodash';

export default function useFields(initFields) {
  const [fields, setFields] = useState(initFields);
  const [modified, setModified] = useState(false);
  const handleChange = useCallback(
    e => {
      const element = e.target;
      setModified(true);
      setFields(f => {
        const out = _.cloneDeep(f);
        _.set(
          out,
          element.name,
          element.type === 'checkbox' ? element.checked : element.value,
        );
        return out;
      });
    },
    [setFields],
  );

  return [fields, handleChange, modified, setFields];
}
