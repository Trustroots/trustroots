import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ReadMorePanel from '@/modules/core/client/components/ReadMorePanel';

describe('<ReadMorePanel />', () => {
  it('renders nothing for empty content', () => {
    const { container } = render(<ReadMorePanel content="" id="empty" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders full content when it fits limit', () => {
    render(<ReadMorePanel content="<p>Hello</p>" id="short" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryByText('Read more…')).not.toBeInTheDocument();
  });

  it('shows truncated content and read-more trigger when content is long', () => {
    const content = `<p>${'A'.repeat(2005)}</p>`;

    const { container } = render(
      <ReadMorePanel content={content} id="long-content" />,
    );

    const fadeButton = screen.getByText('Read more…');
    expect(fadeButton).toBeInTheDocument();
    expect(container.querySelector('.panel-more-wrap')).toHaveTextContent(
      `${'A'.repeat(2000)} …`,
    );
  });

  it('expands full content when read-more is clicked', async () => {
    const content = `Long story: ${'x'.repeat(2005)}`;
    render(<ReadMorePanel content={content} id="expands-on-click" />);

    fireEvent.click(screen.getByText('Read more…'));

    await waitFor(() =>
      expect(screen.queryByText('Read more…')).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Long story:/)).toBeInTheDocument();
    expect(screen.getByText(/x{20}/)).toBeInTheDocument();
  });

  it('does not keep the collapsed preview after expansion', () => {
    const content = `<p>${'B'.repeat(2008)}</p>`;
    const { container } = render(
      <ReadMorePanel content={content} id="expansion" />,
    );

    fireEvent.click(screen.getByText('Read more…'));

    expect(container.querySelector('.panel-more-wrap')).toBeNull();
  });

  it('expands full content when the collapsed preview is clicked', () => {
    const content = `<p>${'C'.repeat(2008)}</p>`;
    const { container } = render(
      <ReadMorePanel content={content} id="preview-click" />,
    );

    fireEvent.click(container.querySelector('#preview-click'));

    expect(screen.queryByText('Read more…')).not.toBeInTheDocument();
    expect(container.querySelector('.panel-more-wrap')).toBeNull();
    expect(container).toHaveTextContent('C'.repeat(2008));
  });
});
