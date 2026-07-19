import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import BirthdateSelect from '@/modules/core/client/components/BirthdateSelect.component';

describe('<BirthdateSelect />', () => {
  it('parses an initial ISO birthdate into the selects', () => {
    render(
      <BirthdateSelect onChange={jest.fn()} value="1990-05-15T00:00:00.000Z" />,
    );

    expect(screen.getByLabelText('Month')).toHaveValue('5');
    expect(screen.getByLabelText('Day')).toHaveValue('15');
    expect(screen.getByLabelText('Year')).toHaveValue('1990');
  });

  it('emits null while the birthdate is incomplete', () => {
    const onChange = jest.fn();

    render(<BirthdateSelect onChange={onChange} value="" />);

    fireEvent.change(screen.getByLabelText('Month'), {
      target: { value: '3' },
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('emits an ISO date when month, day, and year are selected', () => {
    const onChange = jest.fn();

    render(<BirthdateSelect onChange={onChange} value="" />);

    fireEvent.change(screen.getByLabelText('Month'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Day'), {
      target: { value: '29' },
    });
    fireEvent.change(screen.getByLabelText('Year'), {
      target: { value: '2020' },
    });

    expect(onChange).toHaveBeenLastCalledWith('2020-02-29T00:00:00.000Z');
  });

  it('limits day options to the selected month and year', () => {
    render(<BirthdateSelect onChange={jest.fn()} value="" />);

    fireEvent.change(screen.getByLabelText('Month'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Year'), {
      target: { value: '2021' },
    });

    expect(screen.getByLabelText('Day')).toContainHTML(
      '<option value="28">28</option>',
    );
    expect(screen.getByLabelText('Day')).not.toContainHTML(
      '<option value="29">29</option>',
    );
  });

  it('resets invalid birthdate values to empty selects', () => {
    render(<BirthdateSelect onChange={jest.fn()} value="not-a-date" />);

    expect(screen.getByLabelText('Month')).toHaveValue('');
    expect(screen.getByLabelText('Day')).toHaveValue('');
    expect(screen.getByLabelText('Year')).toHaveValue('');
  });

  it('updates local state when the value prop changes', () => {
    const { rerender } = render(
      <BirthdateSelect onChange={jest.fn()} value="1988-12-01T00:00:00.000Z" />,
    );

    rerender(
      <BirthdateSelect onChange={jest.fn()} value="2001-07-04T00:00:00.000Z" />,
    );

    expect(screen.getByLabelText('Month')).toHaveValue('7');
    expect(screen.getByLabelText('Day')).toHaveValue('4');
    expect(screen.getByLabelText('Year')).toHaveValue('2001');
  });

  it('clears a part when the user selects the empty option', () => {
    const onChange = jest.fn();

    render(
      <BirthdateSelect onChange={onChange} value="1990-05-15T00:00:00.000Z" />,
    );

    fireEvent.change(screen.getByLabelText('Day'), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
