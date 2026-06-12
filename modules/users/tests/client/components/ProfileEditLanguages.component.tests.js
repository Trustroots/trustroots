import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileEditLanguages from '@/modules/users/client/components/ProfileEditLanguages.component';
import { $broadcast } from '@/modules/core/client/services/angular-compat';

jest.mock('@/modules/core/client/services/angular-compat');
jest.mock('@/modules/core/client/components/LanguageSelect', () => {
  function MockLanguageSelect(props) {
    return (
      <button
        aria-label={props['aria-label']}
        data-placeholder={props.placeholder}
        data-selected={props.preSelectedLanguages.join(',')}
        onClick={() => props.onChangeLanguages(['en', 'pt'])}
        type="button"
      >
        Select languages
      </button>
    );
  }

  MockLanguageSelect.propTypes = {
    'aria-label': () => null,
    onChangeLanguages: () => null,
    placeholder: () => null,
    preSelectedLanguages: () => null,
  };

  return MockLanguageSelect;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ProfileEditLanguages />', () => {
  it('prefills languages and broadcasts changes back to Angular', () => {
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
    expect(select).toHaveAttribute(
      'data-placeholder',
      'Add languages you speak.',
    );

    fireEvent.click(select);

    expect($broadcast).toHaveBeenCalledWith('userChanged');
    expect(onChangeLanguages).toHaveBeenCalledWith(['en', 'pt']);
  });

  it('does not require onChangeLanguages callback prop to update angular state', () => {
    render(
      <ProfileEditLanguages
        profileLanguages={['en']}
        onChangeLanguages={undefined}
      />,
    );

    const select = screen.getByRole('button', {
      name: 'Add languages you speak.',
    });

    fireEvent.click(select);

    expect($broadcast).toHaveBeenCalledWith('userChanged');
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
