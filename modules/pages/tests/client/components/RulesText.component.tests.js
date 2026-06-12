import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import RulesText from '@/modules/pages/client/components/RulesText.component';

describe('<RulesText />', () => {
  it('renders all high-level rule statements', () => {
    render(<RulesText />);

    expect(
      screen.getByText(
        /We want a world that encourages trust, adventure and intercultural connections/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Be a human being: write messages specifically for their recipient/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /We try to keep our rules simple and we value transparency/,
      ),
    ).toBeInTheDocument();
  });
});
