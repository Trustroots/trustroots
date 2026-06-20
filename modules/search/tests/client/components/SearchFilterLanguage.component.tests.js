import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchFilterLanguage from '@/modules/search/client/components/SearchFilterLanguage.component';

jest.mock('@/modules/core/client/components/LanguageSelect', () => {
  function MockLanguageSelect(props) {
    return (
      <button
        aria-labelledby={props['aria-labelledby']}
        data-placeholder={props.placeholder}
        data-selected={props.preSelectedLanguages.join(',')}
        onClick={() => props.onChangeLanguages(['es', 'de'])}
        type="button"
      >
        Language filter
      </button>
    );
  }

  MockLanguageSelect.propTypes = {
    'aria-labelledby': () => null,
    onChangeLanguages: () => null,
    placeholder: () => null,
    preSelectedLanguages: () => null,
  };

  return MockLanguageSelect;
});

describe('<SearchFilterLanguage />', () => {
  it('connects the language picker to the search filter heading and callback', () => {
    const onChangeLanguages = jest.fn();

    render(
      <SearchFilterLanguage
        onChangeLanguages={onChangeLanguages}
        preSelectedLanguages={['en', 'fr']}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Spoken languages' }),
    ).toHaveAttribute('id', 'filter-languages');

    const filter = screen.getByRole('button', { name: 'Spoken languages' });
    expect(filter).toHaveAttribute('data-selected', 'en,fr');
    expect(filter).toHaveAttribute(
      'data-placeholder',
      expect.stringContaining('Select languages'),
    );

    fireEvent.click(filter);

    expect(onChangeLanguages).toHaveBeenCalledWith(['es', 'de']);
  });
});
