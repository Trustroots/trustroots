import React, { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import usePageWheel from '@/modules/core/client/components/Map/use-page-wheel';

function Surface({
  enabled = true,
  mounted = true,
}: {
  enabled?: boolean;
  mounted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePageWheel(ref, enabled);
  return mounted ? (
    <div ref={ref} data-testid="surface">
      <canvas data-testid="canvas" />
    </div>
  ) : null;
}

it('normalises page wheel input at the original pointer position and cleans up', () => {
  const { unmount } = render(<Surface />);
  const surface = screen.getByTestId('surface');
  Object.defineProperties(surface, {
    clientHeight: { value: 400 },
    clientWidth: { value: 600 },
  });
  const canvas = screen.getByTestId('canvas');
  const received = jest.fn();
  canvas.addEventListener('wheel', received);
  const removeListener = jest.spyOn(surface, 'removeEventListener');
  const original = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaMode: 2,
    deltaY: -1,
    deltaX: 1,
    clientX: 40,
    clientY: 60,
    ctrlKey: true,
  });
  fireEvent(canvas, original);
  expect(original.defaultPrevented).toBe(true);
  expect(received).toHaveBeenCalledTimes(1);
  expect(received.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      deltaMode: 0,
      deltaY: -400,
      deltaX: 600,
      clientX: 40,
      clientY: 60,
      ctrlKey: true,
    }),
  );
  unmount();
  expect(removeListener).toHaveBeenCalledWith(
    'wheel',
    expect.any(Function),
    true,
  );
});

it.each([0, 1])('leaves native wheel mode %s unchanged', deltaMode => {
  render(<Surface />);
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaMode,
    deltaY: 3,
  });
  fireEvent(screen.getByTestId('canvas'), event);
  expect(event.defaultPrevented).toBe(false);
});

it('leaves disabled and unmounted surfaces alone', () => {
  const { rerender } = render(<Surface enabled={false} />);
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaMode: 2,
    deltaY: 1,
  });
  fireEvent(screen.getByTestId('canvas'), event);
  expect(event.defaultPrevented).toBe(false);
  rerender(<Surface mounted={false} />);
});
