import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Interaction from '@/modules/experiences/client/components/create-experience/Interaction';

describe('<Interaction />', () => {
  it('renders checked state for each interaction option', () => {
    render(
      <Interaction
        interactions={{ met: true, host: false, guest: true }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Met in person')).toBeChecked();
    expect(screen.getByLabelText('I hosted them')).not.toBeChecked();
    expect(screen.getByLabelText('They hosted me')).toBeChecked();
  });

  it.each([
    ['Met in person', 'met'],
    ['I hosted them', 'host'],
    ['They hosted me', 'guest'],
  ])('calls onChange with %s option', (label, value) => {
    const onChange = jest.fn();
    render(
      <Interaction
        interactions={{ met: false, host: false, guest: false }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText(label));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(value);
  });
});
