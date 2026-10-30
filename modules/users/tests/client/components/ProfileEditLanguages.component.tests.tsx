import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ProfileEditLanguages from '@/modules/users/client/components/ProfileEditLanguages.component';
import type LanguageSelect from '@/modules/core/client/components/LanguageSelect';
import { malformedFixture } from '@/testutils/client/malformed-fixtures';

type LanguageSelectProps = Pick<
  React.ComponentProps<typeof LanguageSelect>,
  'excludeDeprecated' | 'placeholder'
> & {
  'aria-label'?: string;
  onChangeLanguages: (languages: string[]) => void;
  preSelectedLanguages: string[];
};

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: { eng: 'English' } }),
}));
jest.mock('@/modules/core/client/components/LanguageSelect', () => {
  function MockLanguageSelect(props: LanguageSelectProps) {
    return (
      <button
        aria-label={props['aria-label']}
        data-placeholder={props.placeholder}
        data-selected={props.preSelectedLanguages.join(',')}
        data-exclude-deprecated={props.excludeDeprecated}
        onClick={() => props.onChangeLanguages(['en', 'pt'])}
        type="button"
      >
        Select languages
      </button>
    );
  }

  return MockLanguageSelect;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ProfileEditLanguages />', () => {
  it('prefills languages and broadcasts profile language changes', () => {
    const onChangeLanguages = jest.fn();

    render(
      <ProfileEditLanguages
        onChangeLanguages={onChangeLanguages}
        profileLanguages={['fi', 'sv']}
      />,
    );

    expect(screen.getByText('Languages')).toHaveClass('control-label');

    const select = screen.getByRole('button', {
      name: 'Add languages you speak.',
    });
    expect(select).toHaveAttribute('data-selected', 'fi,sv');
    expect(select).toHaveAttribute('data-exclude-deprecated', 'true');
    expect(select).toHaveAttribute(
      'data-placeholder',
      'Add languages you speak.',
    );

    fireEvent.click(select);

    expect(onChangeLanguages).toHaveBeenCalledWith(['en', 'pt']);
  });

  it('does not require an onChangeLanguages callback to update client state', () => {
    render(
      // The public prop type currently marks this callback as required; this
      // boundary deliberately supplies it as absent to cover the runtime guard.
      <ProfileEditLanguages
        {...malformedFixture<React.ComponentProps<typeof ProfileEditLanguages>>(
          {
            profileLanguages: ['en'],
            onChangeLanguages: () => undefined,
          },
          { onChangeLanguages: undefined },
        )}
      />,
    );

    const select = screen.getByRole('button', {
      name: 'Add languages you speak.',
    });

    expect(() => fireEvent.click(select)).not.toThrow();
  });

  it('always keeps selected languages visible in language select input', () => {
    render(
      <ProfileEditLanguages
        onChangeLanguages={() => undefined}
        profileLanguages={['fr', 'de', 'es']}
      />,
    );

    const select = screen.getByRole('button', {
      name: 'Add languages you speak.',
    });

    expect(select).toHaveAttribute('data-selected', 'fr,de,es');
  });

  it('uses an empty selected-language list by default', () => {
    render(<ProfileEditLanguages onChangeLanguages={() => undefined} />);

    expect(
      screen.getByRole('button', { name: 'Add languages you speak.' }),
    ).toHaveAttribute('data-selected', '');
  });
});

it('sets, clears and removes optional levels', () => {
  const onChangeLevels = jest.fn();
  const { rerender } = render(
    <ProfileEditLanguages
      profileLanguages={['eng', 'zzz']}
      languageLevels={{ eng: 'native', zzz: 'basic' }}
      onChangeLanguages={jest.fn()}
      onChangeLevels={onChangeLevels}
    />,
  );
  expect(
    screen.getByRole('combobox', { name: 'Level for English' }),
  ).toHaveValue('native');
  expect(screen.getByRole('combobox', { name: 'Level for zzz' })).toHaveValue(
    'basic',
  );
  for (const level of ['basic', 'intermediate', 'advanced', 'native']) {
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Level for English' }),
      { target: { value: level } },
    );
    expect(onChangeLevels).toHaveBeenLastCalledWith({
      eng: level,
      zzz: 'basic',
    });
  }
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Level for English' }),
    { target: { value: '' } },
  );
  expect(onChangeLevels).toHaveBeenLastCalledWith({ zzz: 'basic' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Add languages you speak.' }),
  );
  expect(onChangeLevels).toHaveBeenLastCalledWith({});
  rerender(
    <ProfileEditLanguages
      profileLanguages={['eng']}
      onChangeLanguages={jest.fn()}
      onChangeLevels={onChangeLevels}
    />,
  );
  expect(
    screen.getByRole('combobox', { name: 'Level for English' }),
  ).toHaveValue('');
});
