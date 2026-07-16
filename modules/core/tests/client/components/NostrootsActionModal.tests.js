import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

describe('NostrootsActionModal', () => {
  const onClose = jest.fn();

  afterEach(() => jest.clearAllMocks());

  it('renders when isOpen is true', () => {
    const { getByText } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    expect(getByText('Get Nostroots')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { queryByText } = render(
      <NostrootsActionModal isOpen={false} onClose={onClose} />,
    );
    expect(queryByText('Get Nostroots')).not.toBeInTheDocument();
  });

  it('shows iOS and Android app links', () => {
    const { getByText } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    const iosLink = getByText('Download for iOS');
    expect(iosLink).toHaveAttribute(
      'href',
      'https://apps.apple.com/us/app/nostroots/id6755037304',
    );
    const androidLink = getByText('Download for Android');
    expect(androidLink).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=org.trustroots.nostroots',
    );
  });

  it('shows web app link', () => {
    const { getByText } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    const link = getByText('Open web app');
    expect(link).toHaveAttribute('href', 'https://nos.trustroots.org');
  });

  it('links the web app to the note plus code when provided', () => {
    const { getByText } = render(
      <NostrootsActionModal
        isOpen={true}
        onClose={onClose}
        plusCode="8FMHR6CC+"
      />,
    );
    const link = getByText('Open web app');
    expect(link).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/v0/#8FMHR6CC+',
    );
  });

  it('calls onClose when "Not now" is clicked', () => {
    const { getByText } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    fireEvent.click(getByText('Not now'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const { getByTestId } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    fireEvent.click(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when the dialog body is clicked', () => {
    const { getByRole } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );

    fireEvent.click(getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    render(<NostrootsActionModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape key presses', () => {
    render(<NostrootsActionModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('mentions that Trustroots account works on Nostroots', () => {
    const { getByText } = render(
      <NostrootsActionModal isOpen={true} onClose={onClose} />,
    );
    expect(
      getByText(/Your Trustroots account works on Nostroots/),
    ).toBeInTheDocument();
  });
});
