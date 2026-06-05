import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import InfiniteMessages from '@/modules/messages/client/components/InfiniteMessages';

describe('<InfiniteMessages>', function () {
  function makeScrollableComponent(onScrollCapture) {
    const PropTypes = require('prop-types');

    const ScrollableComponent = React.forwardRef(function ScrollableComponent(
      { children, onScroll, ...props },
      ref,
    ) {
      if (onScrollCapture) {
        onScrollCapture.current = onScroll;
      }

      return (
        <div data-testid="scrollable" ref={ref} {...props}>
          {children}
        </div>
      );
    });

    ScrollableComponent.propTypes = {
      children: PropTypes.node,
      onScroll: PropTypes.func,
    };

    return ScrollableComponent;
  }

  function setScrollMetrics(
    element,
    { scrollHeight, offsetHeight, scrollTop },
  ) {
    Object.defineProperty(element, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: scrollHeight,
    });
    Object.defineProperty(element, 'offsetHeight', {
      configurable: true,
      writable: true,
      value: offsetHeight,
    });
    Object.defineProperty(element, 'scrollTop', {
      configurable: true,
      writable: true,
      value: scrollTop,
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('scrolls to the bottom on initial render if content already exists', () => {
    const Component = makeScrollableComponent();
    const onFetchMore = jest.fn();

    const { getByTestId, rerender } = render(
      <InfiniteMessages component={Component} onFetchMore={onFetchMore}>
        <div key="a">first</div>
        <div key="b">second</div>
      </InfiniteMessages>,
    );

    const scroller = getByTestId('scrollable');
    setScrollMetrics(scroller, {
      scrollHeight: 200,
      offsetHeight: 120,
      scrollTop: 0,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={onFetchMore}>
        <div key="a">first</div>
        <div key="b">second</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    expect(scroller.scrollTop).toBe(80);
  });

  it('calls fetch more callback when user scrolls to top', () => {
    const onScrollCapture = { current: null };
    const Component = makeScrollableComponent(onScrollCapture);
    const onFetchMore = jest.fn();

    const { getByTestId, rerender } = render(
      <InfiniteMessages component={Component} onFetchMore={onFetchMore}>
        <div key="only">first</div>
      </InfiniteMessages>,
    );

    const scroller = getByTestId('scrollable');
    setScrollMetrics(scroller, {
      scrollHeight: 160,
      offsetHeight: 80,
      scrollTop: 20,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={onFetchMore}>
        <div key="only">first</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    setScrollMetrics(scroller, {
      scrollHeight: 160,
      offsetHeight: 80,
      scrollTop: 0,
    });

    expect(onScrollCapture.current).toEqual(expect.any(Function));
    onScrollCapture.current();
    if (typeof onScrollCapture.current.flush === 'function') {
      onScrollCapture.current.flush();
    }
    jest.advanceTimersByTime(25);

    expect(onFetchMore).toHaveBeenCalledTimes(1);
    expect(scroller.scrollTop).toBe(0);
  });

  it('preserves scroll position when a message is added to the top', () => {
    const Component = makeScrollableComponent();

    const { getByTestId, rerender } = render(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="second">B</div>
        <div key="third">C</div>
      </InfiniteMessages>,
    );

    const scroller = getByTestId('scrollable');
    setScrollMetrics(scroller, {
      scrollHeight: 200,
      offsetHeight: 100,
      scrollTop: 50,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="second">B</div>
        <div key="third">C</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    setScrollMetrics(scroller, {
      scrollHeight: 260,
      offsetHeight: 100,
      scrollTop: 50,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">A</div>
        <div key="second">B</div>
        <div key="third">C</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    expect(scroller.scrollTop).toBe(60);
  });

  it('scrolls to the bottom when a new message is added at the end', () => {
    const Component = makeScrollableComponent();

    const { getByTestId, rerender } = render(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">A</div>
      </InfiniteMessages>,
    );

    const scroller = getByTestId('scrollable');
    setScrollMetrics(scroller, {
      scrollHeight: 120,
      offsetHeight: 100,
      scrollTop: 0,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">A</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    setScrollMetrics(scroller, {
      scrollHeight: 210,
      offsetHeight: 100,
      scrollTop: 110,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">A</div>
        <div key="second">B</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    expect(scroller.scrollTop).toBe(110);
  });

  it('registers and unregisters the resize handler', () => {
    const Component = makeScrollableComponent();
    const onFetchMore = jest.fn();
    const addEventListener = jest.spyOn(window, 'addEventListener');
    const removeEventListener = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <InfiniteMessages component={Component} onFetchMore={onFetchMore}>
        <div key="first">first</div>
      </InfiniteMessages>,
    );

    const resizeListener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'resize',
    )?.[1];

    unmount();

    expect(resizeListener).toEqual(expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('resize', resizeListener);
    expect(removeEventListener).toHaveBeenCalledWith('resize', resizeListener);
  });
});
