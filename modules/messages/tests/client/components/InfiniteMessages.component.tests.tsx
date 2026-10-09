import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import InfiniteMessages from '@/modules/messages/client/components/InfiniteMessages';

type ScrollCapture = {
  current: React.UIEventHandler<HTMLDivElement> | null | undefined;
};
type ScrollProps = React.HTMLAttributes<HTMLDivElement> & {
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};
type ScrollableComponentType = React.ComponentProps<
  typeof InfiniteMessages
>['component'];

describe('<InfiniteMessages>', function () {
  function makeScrollableComponent(onScrollCapture?: ScrollCapture) {
    const ScrollableComponent = React.forwardRef<HTMLDivElement, ScrollProps>(
      function ScrollableComponent({ children, onScroll, ...props }, ref) {
        if (onScrollCapture) {
          onScrollCapture.current = onScroll;
        }

        return (
          <div
            data-testid="scrollable"
            onScroll={onScroll}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        );
      },
    );

    // The source component intentionally accepts React.Ref, while forwardRef's
    // legacy ref type is broader. This narrows only the test component contract.
    return ScrollableComponent as unknown as ScrollableComponentType;
  }

  function setScrollMetrics(
    element: HTMLElement,
    {
      scrollHeight,
      offsetHeight,
      scrollTop,
    }: { scrollHeight: number; offsetHeight: number; scrollTop: number },
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

  function flush(handler: unknown) {
    if (
      handler === null ||
      (typeof handler !== 'function' && typeof handler !== 'object')
    ) {
      return;
    }
    const flushHandler = Reflect.get(handler, 'flush');
    if (typeof flushHandler === 'function') {
      flushHandler.call(handler);
    }
  }

  function invokeResizeListener(
    listener: EventListenerOrEventListenerObject | undefined,
  ) {
    if (!listener) {
      throw new Error('Expected the resize listener to be registered');
    }
    const event = new Event('resize');
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
    flush(listener);
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
    const onScrollCapture: ScrollCapture = { current: null };
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
    act(() => {
      fireEvent.scroll(scroller);
      flush(onScrollCapture.current);
      jest.advanceTimersByTime(25);
    });

    expect(onFetchMore).toHaveBeenCalledTimes(1);
    expect(scroller.scrollTop).toBe(0);
  });

  it('does not fetch more messages when scrolled away from the top', () => {
    const onScrollCapture: ScrollCapture = { current: null };
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

    fireEvent.scroll(scroller);
    flush(onScrollCapture.current);
    jest.advanceTimersByTime(25);

    expect(onFetchMore).not.toHaveBeenCalled();
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

  it('ignores debounced resize work after unmount', () => {
    const Component = makeScrollableComponent();
    const addEventListener = jest.spyOn(window, 'addEventListener');

    const { unmount } = render(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">first</div>
      </InfiniteMessages>,
    );

    const resizeListener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'resize',
    )?.[1];

    unmount();

    expect(() => {
      invokeResizeListener(resizeListener);
    }).not.toThrow();
  });

  it('ignores scroll work when the component does not expose a ref', () => {
    const onScrollCapture: ScrollCapture = { current: null };
    const onFetchMore = jest.fn();

    const ComponentWithoutRef: React.FC<{
      children?: React.ReactNode;
      onScroll: React.UIEventHandler<HTMLDivElement>;
    }> = ({ children, onScroll }) => {
      onScrollCapture.current = onScroll;
      return (
        <div data-testid="scrollable-without-ref" onScroll={onScroll}>
          {children}
        </div>
      );
    };

    const { getByTestId } = render(
      <InfiniteMessages
        component={ComponentWithoutRef}
        onFetchMore={onFetchMore}
      >
        <div key="first">first</div>
      </InfiniteMessages>,
    );

    expect(() => {
      fireEvent.scroll(getByTestId('scrollable-without-ref'));
      flush(onScrollCapture.current);
      jest.advanceTimersByTime(25);
    }).not.toThrow();
    expect(onFetchMore).not.toHaveBeenCalled();
  });

  it('preserves distance from the bottom when resizing while mounted', () => {
    const onScrollCapture: ScrollCapture = { current: null };
    const Component = makeScrollableComponent(onScrollCapture);
    const addEventListener = jest.spyOn(window, 'addEventListener');

    const { getByTestId, rerender } = render(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">first</div>
      </InfiniteMessages>,
    );

    const scroller = getByTestId('scrollable');
    setScrollMetrics(scroller, {
      offsetHeight: 80,
      scrollHeight: 160,
      scrollTop: 20,
    });

    rerender(
      <InfiniteMessages component={Component} onFetchMore={jest.fn()}>
        <div key="first">first</div>
      </InfiniteMessages>,
    );
    jest.advanceTimersByTime(25);

    setScrollMetrics(scroller, {
      offsetHeight: 80,
      scrollHeight: 160,
      scrollTop: 20,
    });

    act(() => {
      fireEvent.scroll(scroller);
      flush(onScrollCapture.current);
      jest.advanceTimersByTime(25);
    });

    const resizeListener = addEventListener.mock.calls
      .filter(([eventName]) => eventName === 'resize')
      .pop()?.[1];

    setScrollMetrics(scroller, {
      offsetHeight: 100,
      scrollHeight: 220,
      scrollTop: 0,
    });

    act(() => {
      invokeResizeListener(resizeListener);
      jest.advanceTimersByTime(25);
    });

    expect(scroller.scrollTop).toBe(60);
  });
});
