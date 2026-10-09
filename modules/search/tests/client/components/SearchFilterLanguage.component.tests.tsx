import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import SearchFilterLanguage from '@/modules/search/client/components/SearchFilterLanguage.component';
import type LanguageSelect from '@/modules/core/client/components/LanguageSelect';

type ChangeHandler = React.ComponentProps<
  typeof SearchFilterLanguage
>['onChangeLanguages'];

jest.mock('@/modules/core/client/components/LanguageSelect', () => {
  function MockLanguageSelect(
    props: React.ComponentProps<typeof LanguageSelect> & {
      'aria-labelledby'?: string;
    },
  ) {
    return (
      <button
        aria-labelledby={props['aria-labelledby']}
        data-placeholder={props.placeholder}
        data-selected={props.preSelectedLanguages?.join(',')}
        data-exclude-deprecated={Boolean(props.excludeDeprecated)}
        onClick={() => props.onChangeLanguages?.(['es', 'de'])}
        type="button"
      >
        Language filter
      </button>
    );
  }

  return MockLanguageSelect;
});

describe('<SearchFilterLanguage />', () => {
  it('connects the language picker to the search filter heading and callback', () => {
    const onChangeLanguages = jest.fn<
      ReturnType<ChangeHandler>,
      Parameters<ChangeHandler>
    >();

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
    expect(filter).toHaveAttribute('data-exclude-deprecated', 'false');
    expect(filter).toHaveAttribute(
      'data-placeholder',
      expect.stringContaining('Select languages'),
    );

    fireEvent.click(filter);

    expect(onChangeLanguages).toHaveBeenCalledWith(['es', 'de']);
  });
});
